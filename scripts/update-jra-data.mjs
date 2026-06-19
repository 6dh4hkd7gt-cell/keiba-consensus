import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const appPath = path.join(rootDir, "docs", "app.js");
const dataDir = path.join(rootDir, "docs", "data");
const racesPath = path.join(dataDir, "jra-races.json");
const statusPath = path.join(dataDir, "update-status.json");
const updateLeadMinutes = 10;
const defaultSites = [
  { name: "SPAIA", env: "JRA_SOURCE_SPAIA_URL" },
  { name: "netkeiba AI", env: "JRA_SOURCE_NETKEIBA_AI_URL" },
  { name: "AI指数", env: "JRA_SOURCE_AI_INDEX_URL" },
  { name: "競馬ラボ", env: "JRA_SOURCE_KEIBA_LAB_URL" },
  { name: "無料競馬AI", env: "JRA_SOURCE_FREE_KEIBA_AI_URL" },
  { name: "Uma Cloud", env: "JRA_SOURCE_UMA_CLOUD_URL" },
  { name: "SIVA", env: "JRA_SOURCE_SIVA_URL" },
  { name: "Deep Keiba", env: "JRA_SOURCE_DEEP_KEIBA_URL" },
  { name: "Race AI", env: "JRA_SOURCE_RACE_AI_URL" },
  { name: "Prediction One", env: "JRA_SOURCE_PREDICTION_ONE_URL" }
];
const markAliases = new Map([
  ["◎", "◎"],
  ["本命", "◎"],
  ["honmei", "◎"],
  ["○", "○"],
  ["対抗", "○"],
  ["taikou", "○"],
  ["▲", "▲"],
  ["単穴", "▲"],
  ["tanana", "▲"],
  ["△", "△"],
  ["連下", "△"],
  ["renka", "△"],
  ["☆", "☆"],
  ["注", "☆"],
  ["穴", "☆"]
]);
const jraVenueCodes = {
  sapporo: "01",
  hakodate: "02",
  fukushima: "03",
  niigata: "04",
  tokyo: "05",
  nakayama: "06",
  chukyo: "07",
  kyoto: "08",
  hanshin: "09",
  kokura: "10"
};
const jraVenueByCode = Object.entries(jraVenueCodes).reduce((map, [venue, code]) => {
  map[code] = venue;
  return map;
}, {});
const jraVenueNames = {
  sapporo: "札幌",
  hakodate: "函館",
  fukushima: "福島",
  niigata: "新潟",
  tokyo: "東京",
  nakayama: "中山",
  chukyo: "中京",
  kyoto: "京都",
  hanshin: "阪神",
  kokura: "小倉"
};

function getJstNow() {
  if (process.env.DEMO_TIME) {
    const demo = new Date(process.env.DEMO_TIME);
    if (!Number.isNaN(demo.getTime())) {
      return demo;
    }
  }

  return new Date();
}

function toJstParts(date) {
  const formatter = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
    iso: `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}+09:00`
  };
}

function getNextJraDate(now) {
  const override = process.env.TARGET_DATE;
  if (override) {
    return override;
  }

  const jstParts = toJstParts(now);
  const jstMidnight = new Date(`${jstParts.date}T00:00:00+09:00`);
  const day = jstMidnight.getDay();
  if (day === 0 || day === 6) {
    return jstParts.date;
  }

  const daysUntilSaturday = (6 - day + 7) % 7 || 7;
  jstMidnight.setDate(jstMidnight.getDate() + daysUntilSaturday);
  return toJstParts(jstMidnight).date;
}

function startDateForRace(race) {
  const start = new Date(`${race.date}T${race.startAt}:00+09:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function shiftTime(time, deltaMinutes) {
  const [hour, minute] = time.split(":").map(Number);
  const date = new Date(`2026-01-01T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+09:00`);
  date.setMinutes(date.getMinutes() + deltaMinutes);
  return toJstParts(date).time;
}

function extractSeedRaces(appSource) {
  const startToken = "let races = [";
  const startIndex = appSource.indexOf(startToken);
  const endToken = "\n];\n\nconst state";
  const endIndex = appSource.indexOf(endToken, startIndex);
  if (startIndex === -1 || endIndex === -1) {
    throw new Error("Could not find seed race data in docs/app.js");
  }

  const arraySource = appSource.slice(startIndex + "let races = ".length, endIndex + 2);
  return Function(`"use strict"; return (${arraySource});`)();
}

function normalizeRace(race, targetDate, now) {
  const next = {
    ...race,
    date: targetDate,
    missingSites: Array.isArray(race.missingSites) ? race.missingSites : [],
    horses: (race.horses || []).map((horse) => ({
      predictions: {},
      ...horse
    }))
  };

  const start = startDateForRace(next);
  if (!start) {
    return next;
  }

  const minutesUntilStart = Math.ceil((start.getTime() - now.getTime()) / 60000);
  if (minutesUntilStart <= updateLeadMinutes && minutesUntilStart >= 0) {
    next.updatedAt = toJstParts(now).time;
  } else {
    next.updatedAt = shiftTime(next.startAt, -updateLeadMinutes);
  }

  return next;
}

function validateRacePayload(payload) {
  return payload &&
    Array.isArray(payload.races) &&
    payload.races.every((race) => (
      race.id &&
      race.venue &&
      race.venueName &&
      race.number &&
      race.name &&
      race.date &&
      race.startAt &&
      Array.isArray(race.horses)
    ));
}

function normalizeSiteName(value) {
  return String(value || "").trim();
}

function normalizeMark(value) {
  const text = String(value || "").trim();
  return markAliases.get(text) || markAliases.get(text.toLowerCase()) || (["◎", "○", "▲", "△", "☆"].includes(text) ? text : "");
}

function normalizeIndex(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(String(value).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(number)) {
    return undefined;
  }

  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeOdds(value) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(String(value).replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? Number(number.toFixed(1)) : undefined;
}

function decodeHtml(value) {
  return String(value || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value) {
  return decodeHtml(String(value || "").replace(/<[^>]+>/g, " "));
}

function makeUrl(template, race, targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const raceNumber = String(race.number || "").replace(/\D/g, "").padStart(2, "0");
  const venueCode = jraVenueCodes[race.venue] || "";
  const jraDateRaceId = venueCode && raceNumber ? `${compactDate}${venueCode}${raceNumber}` : "";

  return template
    .replaceAll("{date}", targetDate)
    .replaceAll("{dateCompact}", compactDate)
    .replaceAll("{jraDateRaceId}", jraDateRaceId)
    .replaceAll("{venueCode}", venueCode)
    .replaceAll("{raceNumber}", raceNumber)
    .replaceAll("{raceId}", race.id)
    .replaceAll("{venue}", race.venue)
    .replaceAll("{venueName}", encodeURIComponent(race.venueName))
    .replaceAll("{number}", encodeURIComponent(race.number))
    .replaceAll("{raceName}", encodeURIComponent(race.name));
}

function parseSourceUrlMap() {
  const raw = process.env.JRA_SOURCE_URLS;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    // Fall through to compact "site=url" format.
  }

  return raw.split(",").reduce((map, pair) => {
    const index = pair.indexOf("=");
    if (index > 0) {
      map[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
    }
    return map;
  }, {});
}

function getConfiguredSites() {
  const urlMap = parseSourceUrlMap();
  return defaultSites.map((site) => ({
    ...site,
    url: process.env[site.env] || urlMap[site.name] || urlMap[site.env] || ""
  }));
}

function normalizePredictionEntry(entry) {
  const horseName = entry.horseName || entry.horse || entry.name || entry.runner || entry.runnerName;
  const mark = normalizeMark(entry.mark || entry.symbol || entry.pick || entry.prediction);
  const index = normalizeIndex(entry.index ?? entry.score ?? entry.ai ?? entry.rating ?? entry.point);
  const odds = normalizeOdds(entry.odds ?? entry.winOdds);

  if (!horseName || (!mark && index === undefined && odds === undefined)) {
    return null;
  }

  return {
    horseName: String(horseName).trim(),
    prediction: {
      ...(mark ? { mark } : {}),
      ...(index !== undefined ? { index } : {}),
      ...(odds !== undefined ? { odds } : {})
    }
  };
}

function collectPredictionEntries(value, entries = []) {
  if (!value) {
    return entries;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectPredictionEntries(item, entries));
    return entries;
  }

  if (typeof value !== "object") {
    return entries;
  }

  const entry = normalizePredictionEntry(value);
  if (entry) {
    entries.push(entry);
  }

  Object.entries(value).forEach(([key, child]) => {
    if (child && typeof child === "object" && !Array.isArray(child)) {
      const nested = normalizePredictionEntry({ horseName: key, ...child });
      if (nested) {
        entries.push(nested);
      }
    }
  });

  ["races", "horses", "runners", "predictions", "entries", "data", "items", "results"].forEach((key) => {
    if (value[key]) {
      collectPredictionEntries(value[key], entries);
    }
  });

  return entries;
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKeibaLabRaceId(raceId) {
  const compact = String(raceId || "").replace(/\D/g, "");
  const match = compact.match(/^(\d{8})(\d{2})(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, dateCompact, venueCode, raceNumber] = match;
  const venue = jraVenueByCode[venueCode];
  if (!venue) {
    return null;
  }

  return {
    date: `${dateCompact.slice(0, 4)}-${dateCompact.slice(4, 6)}-${dateCompact.slice(6, 8)}`,
    venue,
    venueName: jraVenueNames[venue],
    number: `${Number(raceNumber)}R`,
    raceNumber,
    venueCode,
    raceId: `${venue}-${Number(raceNumber)}`
  };
}

function parseKeibaLabRaceList(html) {
  const races = [];
  const rowPattern = /<tr>\s*<td class="raceNum[\s\S]*?href="\/db\/race\/(\d{12})\/">(\d+)R<\/a>[\s\S]*?<span class="std11">(\d{2}:\d{2})<\/span>[\s\S]*?<td><a[^>]*href="\/db\/race\/\1\/"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/tr>/g;

  for (const match of html.matchAll(rowPattern)) {
    const [, keibaLabRaceId, raceNumber, startAt, rawName] = match;
    const parsed = parseKeibaLabRaceId(keibaLabRaceId);
    if (!parsed) {
      continue;
    }

    races.push({
      id: parsed.raceId,
      sourceRaceId: keibaLabRaceId,
      venue: parsed.venue,
      venueName: parsed.venueName,
      number: `${Number(raceNumber)}R`,
      name: stripHtml(rawName),
      date: parsed.date,
      startAt,
      updatedAt: shiftTime(startAt, -updateLeadMinutes),
      missingSites: [],
      horses: []
    });
  }

  return races;
}

function parseKeibaLabHorses(html) {
  const byNumber = new Map();
  const selectPattern = /<select class="user_mark" name="([^"]+)"[^>]*data-umano="(\d+)"/g;
  for (const match of html.matchAll(selectPattern)) {
    const name = decodeHtml(match[1]);
    const number = Number(match[2]);
    if (name && number && !byNumber.has(number)) {
      byNumber.set(number, {
        number,
        name,
        odds: 0,
        predictions: {}
      });
    }
  }

  if (!byNumber.size) {
    const horsePattern = /data-hsnm="([^"]+)"/g;
    let fallbackNumber = 1;
    for (const match of html.matchAll(horsePattern)) {
      const name = decodeHtml(match[1]);
      if (name && ![...byNumber.values()].some((horse) => horse.name === name)) {
        byNumber.set(fallbackNumber, {
          number: fallbackNumber,
          name,
          odds: 0,
          predictions: {}
        });
        fallbackNumber += 1;
      }
    }
  }

  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

async function loadKeibaLabRaces(targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const listUrl = `https://www.keibalab.jp/db/race/${compactDate}/`;
  const { text } = await fetchText(listUrl);
  const races = parseKeibaLabRaceList(text);
  if (!races.length) {
    return null;
  }

  for (const race of races) {
    try {
      const { text: raceHtml } = await fetchText(`https://www.keibalab.jp/db/race/${race.sourceRaceId}/`);
      race.horses = parseKeibaLabHorses(raceHtml);
    } catch {
      race.horses = [];
    }
  }

  return races.filter((race) => race.horses.length > 0);
}

function parseJsonPayload(text) {
  const trimmed = text.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function parseEmbeddedJson(html) {
  const entries = [];
  const scriptPattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(scriptPattern)) {
    const parsed = parseJsonPayload(match[1]);
    if (parsed) {
      collectPredictionEntries(parsed, entries);
    }
  }
  return entries;
}

function parseHtmlPredictions(html, race) {
  const entries = parseEmbeddedJson(html);
  const plainText = stripTags(html);

  race.horses.forEach((horse) => {
    const escapedName = horse.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const snippetPattern = new RegExp(`(.{0,80}${escapedName}.{0,160})`, "u");
    const snippet = plainText.match(snippetPattern)?.[1] || "";
    if (!snippet) {
      return;
    }

    const mark = normalizeMark(snippet.match(/[◎○▲△☆]|本命|対抗|単穴|連下|注|穴/u)?.[0]);
    const index = normalizeIndex(snippet.match(/(?:指数|AI|score|rating|point|評価)\\s*[:：]?\\s*(\\d{1,3})/iu)?.[1]);
    const odds = normalizeOdds(snippet.match(/(\\d+(?:\\.\\d+)?)\\s*倍/u)?.[1]);
    if (mark || index !== undefined || odds !== undefined) {
      entries.push({
        horseName: horse.name,
        prediction: {
          ...(mark ? { mark } : {}),
          ...(index !== undefined ? { index } : {}),
          ...(odds !== undefined ? { odds } : {})
        }
      });
    }
  });

  return entries;
}

function parsePredictions(text, contentType, race) {
  const json = contentType.includes("json") ? parseJsonPayload(text) : parseJsonPayload(text);
  if (json) {
    return collectPredictionEntries(json);
  }

  return parseHtmlPredictions(text, race);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/json;q=0.9,*/*;q=0.8",
      "user-agent": "keiba-consensus-data-check/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    text: await response.text(),
    contentType: response.headers.get("content-type") || ""
  };
}

async function fetchSiteRacePredictions(site, race, targetDate) {
  if (!site.url) {
    return { site: site.name, configured: false, raceId: race.id, entries: [], error: "URL未設定" };
  }

  const url = makeUrl(site.url, race, targetDate);
  try {
    const { text, contentType } = await fetchText(url);
    const entries = parsePredictions(text, contentType, race);
    return { site: site.name, configured: true, raceId: race.id, url, entries };
  } catch (error) {
    return { site: site.name, configured: true, raceId: race.id, url, entries: [], error: error.message };
  }
}

function mergeSiteEntries(race, siteName, entries) {
  let matched = 0;
  race.horses.forEach((horse) => {
    const entry = entries.find((item) => item.horseName === horse.name || item.horseName.includes(horse.name) || horse.name.includes(item.horseName));
    if (!entry) {
      return;
    }

    if (!horse.predictions) {
      horse.predictions = {};
    }

    const prediction = entry.prediction;
    if (prediction.odds !== undefined) {
      horse.odds = prediction.odds;
    }

    if (prediction.mark || prediction.index !== undefined) {
      horse.predictions[siteName] = {
        mark: prediction.mark || "△",
        index: prediction.index ?? 50
      };
      matched += 1;
    }
  });

  return matched;
}

async function applySitePredictions(races, targetDate) {
  const sites = getConfiguredSites();
  const reports = [];

  for (const race of races) {
    race.horses.forEach((horse) => {
      horse.predictions = {};
    });

    for (const site of sites) {
      const result = await fetchSiteRacePredictions(site, race, targetDate);
      const matched = mergeSiteEntries(race, site.name, result.entries);
      reports.push({
        site: site.name,
        raceId: race.id,
        configured: result.configured,
        fetched: result.configured && !result.error,
        matched,
        error: result.error || ""
      });
    }

    race.missingSites = sites
      .map((site) => site.name)
      .filter((siteName) => !race.horses.some((horse) => horse.predictions?.[siteName]));
  }

  return reports;
}

async function loadExternalRaces() {
  const url = process.env.JRA_RACES_JSON_URL;
  if (!url) {
    return null;
  }

  const response = await fetch(url, { headers: { "accept": "application/json" } });
  if (!response.ok) {
    throw new Error(`JRA_RACES_JSON_URL returned ${response.status}`);
  }

  const payload = await response.json();
  if (!validateRacePayload(payload)) {
    throw new Error("JRA_RACES_JSON_URL payload is not valid");
  }

  return payload.races;
}

async function main() {
  const now = getJstNow();
  const nowParts = toJstParts(now);
  const targetDate = getNextJraDate(now);
  const appSource = await readFile(appPath, "utf8");
  const externalRaces = await loadExternalRaces();
  const liveRaces = externalRaces ? null : await loadKeibaLabRaces(targetDate);
  const seedRaces = externalRaces || liveRaces || extractSeedRaces(appSource);
  const races = seedRaces.map((race) => normalizeRace(race, targetDate, now));
  const sourceReports = await applySitePredictions(races, targetDate);
  const readyRaces = races.filter((race) => {
    const start = startDateForRace(race);
    if (!start) return false;
    const minutesUntilStart = Math.ceil((start.getTime() - now.getTime()) / 60000);
    return minutesUntilStart <= updateLeadMinutes && minutesUntilStart >= 0;
  });

  const payload = {
    generatedAt: nowParts.iso,
    targetDate,
    updateLeadMinutes,
    source: sourceReports.some((report) => report.fetched && report.matched > 0) ? "site-scrape" : (externalRaces ? "external-json" : (liveRaces ? "keibalab-race-list" : "seed-fallback")),
    raceSource: externalRaces ? "external-json" : (liveRaces ? "keibalab-race-list" : "seed-fallback"),
    siteSources: sourceReports,
    races
  };
  const configuredSiteNames = new Set(sourceReports.filter((report) => report.configured).map((report) => report.site));
  const fetchedSiteNames = new Set(sourceReports.filter((report) => report.fetched).map((report) => report.site));
  const matchedSiteNames = new Set(sourceReports.filter((report) => report.matched > 0).map((report) => report.site));

  const status = {
    generatedAt: nowParts.iso,
    targetDate,
    updateLeadMinutes,
    source: payload.source,
    raceSource: payload.raceSource,
    raceCount: races.length,
    readyRaceIds: readyRaces.map((race) => race.id),
    configuredSiteCount: configuredSiteNames.size,
    fetchedSiteCount: fetchedSiteNames.size,
    matchedSiteCount: matchedSiteNames.size,
    fetchedRaceCount: sourceReports.filter((report) => report.fetched).length,
    matchedRaceCount: sourceReports.filter((report) => report.matched > 0).length,
    siteSources: sourceReports
  };

  await mkdir(dataDir, { recursive: true });
  await writeFile(racesPath, `${JSON.stringify(payload, null, 2)}\n`);
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`);
  console.log(`Updated ${races.length} JRA races for ${targetDate} (${payload.source})`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
