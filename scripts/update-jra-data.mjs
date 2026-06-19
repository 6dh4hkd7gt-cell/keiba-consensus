import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const appPath = path.join(rootDir, "docs", "app.js");
const dataDir = path.join(rootDir, "docs", "data");
const racesPath = path.join(dataDir, "jra-races.json");
const statusPath = path.join(dataDir, "update-status.json");
const updateLeadMinutes = 10;
const requiredConsensusSiteCount = 4;
const defaultSites = [
  { name: "SPAIA", env: "JRA_SOURCE_SPAIA_URL", builtin: "spaia" },
  { name: "競馬ブック", env: "JRA_SOURCE_KEIBA_BOOK_URL", builtin: "keibabook" },
  { name: "競馬ラボ", env: "JRA_SOURCE_KEIBA_LAB_URL", defaultUrl: "https://www.keibalab.jp/db/race/{jraDateRaceId}/" },
  { name: "ウマークス", env: "JRA_SOURCE_UMARKS_URL", builtin: "umarks" },
  { name: "ATHENA", env: "JRA_SOURCE_ATHENA_URL", builtin: "athena" },
  { name: "無料競馬AI", env: "JRA_SOURCE_FREE_KEIBA_AI_URL", builtin: "muryouKeibaAi" },
  { name: "AiBA", env: "JRA_SOURCE_AIBA_URL", builtin: "aiba" },
  { name: "日刊AI", env: "JRA_SOURCE_NIKKAN_AI_URL", builtin: "nikkanAi" },
  { name: "SIVA", env: "JRA_SOURCE_SIVA_URL", builtin: "siva" },
  { name: "ウマニティU指数", env: "JRA_SOURCE_UMANITY_U_INDEX_URL", builtin: "umanityUIndex" }
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

function markFromIndex(index) {
  const score = normalizeIndex(index);
  if (score === undefined) {
    return "";
  }
  if (score >= 90) return "◎";
  if (score >= 80) return "○";
  if (score >= 65) return "▲";
  if (score >= 50) return "△";
  return "☆";
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
    url: process.env[site.env] || urlMap[site.name] || urlMap[site.env] || site.defaultUrl || ""
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

function parseKeibaLabPredictions(html) {
  const horseOrder = [];
  const selectPattern = /<select class="user_mark" name="([^"]+)"[^>]*data-umano="(\d+)"/g;
  for (const match of html.matchAll(selectPattern)) {
    horseOrder.push({
      name: decodeHtml(match[1]),
      number: Number(match[2])
    });
  }

  const omegaMatch = html.match(/<!-- Ω指数 -->\s*<tr class="kyusya std9">([\s\S]*?)<th>Ω指数<\/th>[\s\S]*?<\/tr>\s*<!-- Ω指数 -->/);
  if (!omegaMatch || !horseOrder.length) {
    return [];
  }

  const values = [...omegaMatch[1].matchAll(/<td[^>]*>\s*(\d{1,3})\s*<\/td>/g)].map((match) => normalizeIndex(match[1]));
  return horseOrder
    .map((horse, index) => ({
      horseName: horse.name,
      prediction: {
        mark: markFromIndex(values[index]),
        index: values[index]
      }
    }))
    .filter((entry) => entry.prediction.index !== undefined);
}

async function fetchJson(url) {
  const { text, contentType } = await fetchText(url);
  if (!contentType.includes("json") && !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    throw new Error("JSONではありません");
  }
  return JSON.parse(text);
}

function formatSpaiaStartTime(startTime) {
  const value = String(startTime || "").padStart(4, "0");
  return `${value.slice(0, 2)}:${value.slice(2)}`;
}

async function getSpaiaRaceId(race, targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const raceNumber = String(race.number || "").replace(/\D/g, "");
  const url = `https://spaia-keiba.com/api/v2/public/race/raceId?raceNumber=${encodeURIComponent(raceNumber)}&place=${encodeURIComponent(race.venueName)}&date=${compactDate}`;
  const data = await fetchJson(url);
  return data.raceId || "";
}

async function loadSpaiaRaces(targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const data = await fetchJson(`https://spaia-keiba.com/api/v2/public/races/${compactDate}/races`);
  if (!Array.isArray(data)) {
    return null;
  }

  const races = data.flatMap((place) => (place.races || []).map((item) => ({
    id: `${jraVenueByCode[String(place.placeCode).padStart(2, "0")] || String(place.place || "").toLowerCase()}-${item.raceNumber}`,
    sourceRaceId: item.raceId,
    venue: jraVenueByCode[String(place.placeCode).padStart(2, "0")] || "",
    venueName: place.place,
    number: `${item.raceNumber}R`,
    name: item.raceTitle,
    date: targetDate,
    startAt: formatSpaiaStartTime(item.startTime),
    updatedAt: shiftTime(formatSpaiaStartTime(item.startTime), -updateLeadMinutes),
    missingSites: [],
    horses: []
  }))).filter((race) => race.venue && race.id);

  for (const race of races) {
    try {
      const horseInfo = await fetchJson(`https://spaia-keiba.com/api/v2/public/race/${race.sourceRaceId}/horseInfo`);
      race.horses = (horseInfo.horses || []).map((horse) => ({
        number: horse.horseNumber,
        name: horse.horseName,
        sourceHorseId: horse.horseId,
        odds: 0,
        predictions: {}
      })).sort((a, b) => a.number - b.number);
    } catch {
      race.horses = [];
    }
  }

  return races.filter((race) => race.horses.length > 0);
}

async function fetchSpaiaPredictions(site, race, targetDate) {
  const spaiaRaceId = race.sourceRaceId || await getSpaiaRaceId(race, targetDate);
  if (!spaiaRaceId) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "SPAIA raceId未取得" };
  }

  const [horseInfo, oddsInfo, timeInfo] = await Promise.all([
    fetchJson(`https://spaia-keiba.com/api/v2/public/race/${spaiaRaceId}/horseInfo`),
    fetchJson(`https://spaia-keiba.com/api/v2/private/race/${spaiaRaceId}/oddsInfo`).catch(() => null),
    fetchJson(`https://spaia-keiba.com/api/v2/private/race/${spaiaRaceId}/timeRatingIndicatorInfo`).catch(() => null)
  ]);

  const horseById = new Map((horseInfo.horses || []).map((horse) => [horse.horseId, horse]));
  const oddsById = new Map(((oddsInfo && oddsInfo.horses) || []).map((horse) => [horse.horseId, horse]));
  const timeRows = (timeInfo && timeInfo.timeRatingIndicatorInfo) || [];
  const values = timeRows.map((row) => row.timeRatingIndicator).filter((value) => Number.isFinite(value));
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;

  const entries = timeRows.map((row) => {
    const horse = horseById.get(row.horseId);
    if (!horse) {
      return null;
    }

    const odds = oddsById.get(row.horseId);
    const index = max > min ? Math.round(50 + ((row.timeRatingIndicator - min) / (max - min)) * 50) : normalizeIndex(row.timeRatingIndicator);
    return {
      horseName: horse.horseName,
      prediction: {
        mark: markFromIndex(index),
        index,
        ...(odds?.tanshouOdds ? { odds: odds.tanshouOdds } : {})
      }
    };
  }).filter(Boolean);

  return { site: site.name, configured: true, raceId: race.id, url: `https://spaia-keiba.com/race/${spaiaRaceId}/race-cards`, entries };
}

function parseKeibaBookRaceMap(html) {
  const map = new Map();
  const sections = html.split(/<th[^>]*class="[^"]*\bmidasi\b[^"]*"[^>]*>/i);

  sections.forEach((section) => {
    const headerEnd = section.indexOf("</th>");
    if (headerEnd === -1) {
      return;
    }

    const header = stripHtml(section.slice(0, headerEnd));
    const venueEntry = Object.entries(jraVenueNames).find(([, name]) => header.includes(name));
    if (!venueEntry) {
      return;
    }

    const [venue] = venueEntry;
    const linkPattern = /<a\s+href="\/cyuou\/syutuba\/(\d+)"[\s\S]*?<p class="raceno">(\d+)R<\/p>/g;
    for (const match of section.matchAll(linkPattern)) {
      const [, keibaBookRaceId, raceNumber] = match;
      map.set(`${venue}-${Number(raceNumber)}`, keibaBookRaceId);
    }
  });

  return map;
}

async function loadKeibaBookRaceMap(targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const { text } = await fetchText(`https://p.keibabook.co.jp/cyuou/nittei/${compactDate}`);
  return parseKeibaBookRaceMap(text);
}

function parseKeibaBookCpuPredictions(html) {
  const entries = [];
  const rowPattern = /<!-- 1頭始まり -->([\s\S]*?)<!-- 1頭終わり -->/g;
  for (const match of html.matchAll(rowPattern)) {
    const row = match[1];
    const nameMatch = row.match(/class="umalink_click"[^>]*>([^<]+)<\/a>/i);
    if (!nameMatch) {
      continue;
    }

    const horseName = decodeHtml(nameMatch[1]);
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((cell) => ({
      attrs: cell[1] || "",
      text: stripHtml(cell[2])
    }));
    const graphCell = cells.find((cell) => cell.attrs.includes("graph"));
    const graphWidths = graphCell ? [...row.matchAll(/style="width:\s*([\d.]+)%"/g)].map((width) => Number(width[1])) : [];
    const graphScore = graphWidths.length ? graphWidths.reduce((sum, value) => sum + value, 0) : undefined;
    const rating = normalizeIndex(cells.find((cell) => cell.attrs.includes("GIIcolor"))?.text || cells.find((cell) => cell.attrs.includes("GIcolor"))?.text);
    const score = normalizeIndex(graphScore !== undefined ? graphScore : rating);
    const mark = normalizeMark(cells.map((cell) => cell.text).find((text) => normalizeMark(text))) || markFromIndex(score);
    const odds = normalizeOdds(cells.at(-1)?.text);

    if (score !== undefined || mark || odds !== undefined) {
      entries.push({
        horseName,
        prediction: {
          ...(mark ? { mark } : {}),
          ...(score !== undefined ? { index: score } : {}),
          ...(odds !== undefined ? { odds } : {})
        }
      });
    }
  }

  return entries;
}

async function fetchKeibaBookPredictions(site, race, targetDate) {
  if (!fetchKeibaBookPredictions.cache || fetchKeibaBookPredictions.cache.date !== targetDate) {
    fetchKeibaBookPredictions.cache = {
      date: targetDate,
      raceMap: await loadKeibaBookRaceMap(targetDate)
    };
  }

  const key = `${race.venue}-${String(race.number || "").replace(/\D/g, "")}`;
  const raceId = fetchKeibaBookPredictions.cache.raceMap.get(key);
  if (!raceId) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "競馬ブック raceId未取得" };
  }

  const url = `https://p.keibabook.co.jp/cyuou/cpu/${raceId}`;
  const { text } = await fetchText(url);
  return { site: site.name, configured: true, raceId: race.id, url, entries: parseKeibaBookCpuPredictions(text) };
}

function parseUmarksRaceMap(html, targetDate) {
  const map = new Map();
  const compactDate = targetDate.replaceAll("-", "");
  const linkPattern = /<a\s+class="top_race_menu[^"]*" href="(\/race_result\/(\d+))"/g;

  for (const match of html.matchAll(linkPattern)) {
    const [, pathName, raceCode] = match;
    if (!raceCode.endsWith(compactDate)) {
      continue;
    }

    const raceNumber = Number(raceCode.slice(-10, -8));
    const year = targetDate.slice(0, 4);
    const venueEntry = Object.entries(jraVenueCodes)
      .map(([venue, code]) => [venue, String(Number(code))])
      .sort((a, b) => b[1].length - a[1].length)
      .find(([, code]) => raceCode.startsWith(`${code}${year}`));
    if (venueEntry && raceNumber) {
      map.set(`${venueEntry[0]}-${raceNumber}`, { pathName, raceCode });
    }
  }

  return map;
}

async function loadUmarksRaceMap(targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const { text } = await fetchText(`https://uma-x.jp/race/${compactDate}`);
  return parseUmarksRaceMap(text, targetDate);
}

function parseUmarksPredictions(html) {
  const entries = [];
  const rowPattern = /<tr id="tbl_uma_no_(\d+)"[^>]*>([\s\S]*?)<\/tr>/g;

  for (const match of html.matchAll(rowPattern)) {
    const [, , row] = match;
    const nameMatch = row.match(/<td class="tleft uname[\s\S]*?<a class="tl"[^>]*>([^<]+)<\/a>/i);
    if (!nameMatch) {
      continue;
    }

    const horseName = decodeHtml(nameMatch[1]);
    const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)].map((cell) => stripHtml(cell[2]));
    const total = normalizeIndex(cells[1]);
    const speed = normalizeIndex(cells[2]);
    const agility = normalizeIndex(cells[3]);
    const stamina = normalizeIndex(cells[4]);
    const values = [total, speed, agility, stamina].filter((value) => value !== undefined);
    const index = values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : undefined;

    if (index !== undefined) {
      entries.push({
        horseName,
        prediction: {
          mark: markFromIndex(index),
          index
        }
      });
    }
  }

  return entries;
}

async function fetchUmarksPredictions(site, race, targetDate) {
  if (!fetchUmarksPredictions.cache || fetchUmarksPredictions.cache.date !== targetDate) {
    fetchUmarksPredictions.cache = {
      date: targetDate,
      raceMap: await loadUmarksRaceMap(targetDate)
    };
  }

  const key = `${race.venue}-${String(race.number || "").replace(/\D/g, "")}`;
  const source = fetchUmarksPredictions.cache.raceMap.get(key);
  if (!source) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "ウマークス raceId未取得" };
  }

  const url = `https://uma-x.jp${source.pathName}`;
  const { text } = await fetchText(url);
  return { site: site.name, configured: true, raceId: race.id, url, entries: parseUmarksPredictions(text) };
}

function formatJapaneseDate(targetDate) {
  const [year, month, day] = targetDate.split("-");
  return `${year}年${month}月${day}日`;
}

async function findAthenaArticleUrl(targetDate) {
  const { text } = await fetchText("https://keiba-ai.jp/archives/category/predict");
  const targetLabel = formatJapaneseDate(targetDate);
  const linkPattern = /<h2 class="entry-title"[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;

  for (const match of text.matchAll(linkPattern)) {
    const [, url, rawTitle] = match;
    const title = stripHtml(rawTitle);
    if (title.includes(targetLabel) && title.includes("AI予想")) {
      return url;
    }
  }

  return "";
}

function parseAthenaPredictions(html, race) {
  const text = stripTags(html);
  const entries = [];

  race.horses.forEach((horse) => {
    const escapedName = horse.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escapedName}\\s+.{0,140}?(\\d+(?:\\.\\d+)?)\\s*%\\s*\\((\\d{1,4})\\)\\s*(\\d{1,2})`, "u");
    const match = text.match(pattern);
    if (!match) {
      return;
    }

    const aiIndex = normalizeIndex(Math.round(Number(match[2]) / 10));
    entries.push({
      horseName: horse.name,
      prediction: {
        mark: markFromIndex(aiIndex),
        index: aiIndex
      }
    });
  });

  return entries;
}

async function fetchAthenaPredictions(site, race, targetDate) {
  if (!fetchAthenaPredictions.cache || fetchAthenaPredictions.cache.date !== targetDate) {
    const articleUrl = await findAthenaArticleUrl(targetDate);
    fetchAthenaPredictions.cache = {
      date: targetDate,
      articleUrl,
      text: articleUrl ? (await fetchText(articleUrl)).text : ""
    };
  }

  if (!fetchAthenaPredictions.cache.articleUrl) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "ATHENA target article未公開" };
  }

  return {
    site: site.name,
    configured: true,
    raceId: race.id,
    url: fetchAthenaPredictions.cache.articleUrl,
    entries: parseAthenaPredictions(fetchAthenaPredictions.cache.text, race)
  };
}

function parseMuryouKeibaAiRaceMap(html, targetDate) {
  const map = new Map();
  const compactDate = targetDate.replaceAll("-", "");
  const linkPattern = /<a\s+class="race_list_item" href="([^"]+)"[\s\S]*?<span class="race_cource">([^<]+)<time datetime="([^"]+)"[\s\S]*?<span class="race_num">(\d+)R/g;

  for (const match of html.matchAll(linkPattern)) {
    const [, url, venueName, dateTime, raceNumber] = match;
    if (!dateTime.startsWith(`${targetDate}T`)) {
      continue;
    }

    const venueEntry = Object.entries(jraVenueNames).find(([, name]) => name === decodeHtml(venueName));
    if (venueEntry) {
      map.set(`${venueEntry[0]}-${Number(raceNumber)}`, url);
    }
  }

  if (!map.size) {
    const jsonPattern = /"name":"「([^」]+)」 ([^"]+?)競馬場 (\d+)R(?: [G\d]+)?","sport":"競馬"[\s\S]*?"endDate":"(\d{4}-\d{2}-\d{2})T[\s\S]*?"url":"(https:\/\/muryou-keiba-ai\.jp\/predict\/[^"]+)"/g;
    for (const match of html.matchAll(jsonPattern)) {
      const [, , venueName, raceNumber, date, url] = match;
      if (date.replaceAll("-", "") !== compactDate) {
        continue;
      }

      const venueEntry = Object.entries(jraVenueNames).find(([, name]) => name === venueName);
      if (venueEntry) {
        map.set(`${venueEntry[0]}-${Number(raceNumber)}`, url.replaceAll("\\/", "/"));
      }
    }
  }

  return map;
}

async function loadMuryouKeibaAiRaceMap(targetDate) {
  const { text } = await fetchText("https://muryou-keiba-ai.jp/");
  return parseMuryouKeibaAiRaceMap(text, targetDate);
}

function parseMuryouKeibaAiPredictions(html) {
  const entries = [];
  const tableMatch = html.match(/<table class="race_table baken_race_table"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tableMatch) {
    return entries;
  }

  const rowPattern = /<tr>([\s\S]*?)<\/tr>/g;
  for (const match of tableMatch[1].matchAll(rowPattern)) {
    const row = match[1];
    const nameMatch = row.match(/class="bamei[^"]*"[^>]*>\s*(?:<strong>)?([^<]+)(?:<\/strong>)?/i);
    const markMatch = row.match(/class="mark">([^<]+)<\/span>/i);
    const indexMatch = row.match(/class="predict">([^<]+)<\/span>/i);
    const oddsMatch = row.match(/class="odds">([^<]+)<\/span>/i);
    if (!nameMatch || !indexMatch) {
      continue;
    }

    const index = normalizeIndex(indexMatch[1]);
    entries.push({
      horseName: decodeHtml(nameMatch[1]).replace(/^\(地\)/, ""),
      prediction: {
        mark: normalizeMark(markMatch?.[1]) || markFromIndex(index),
        ...(index !== undefined ? { index } : {}),
        ...(normalizeOdds(oddsMatch?.[1]) ? { odds: normalizeOdds(oddsMatch?.[1]) } : {})
      }
    });
  }

  return entries;
}

async function fetchMuryouKeibaAiPredictions(site, race, targetDate) {
  if (!fetchMuryouKeibaAiPredictions.cache || fetchMuryouKeibaAiPredictions.cache.date !== targetDate) {
    fetchMuryouKeibaAiPredictions.cache = {
      date: targetDate,
      raceMap: await loadMuryouKeibaAiRaceMap(targetDate)
    };
  }

  const key = `${race.venue}-${String(race.number || "").replace(/\D/g, "")}`;
  const url = fetchMuryouKeibaAiPredictions.cache.raceMap.get(key);
  if (!url) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "無料競馬AI raceId未取得" };
  }

  const { text } = await fetchText(url);
  return { site: site.name, configured: true, raceId: race.id, url, entries: parseMuryouKeibaAiPredictions(text) };
}

function parseAibaRaceMap(html, targetDate) {
  const map = new Map();
  const targetSlashDate = targetDate.replaceAll("-", "/");
  const linkPattern = /<span class="cat-post-date">([^<]+)<\/span>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;

  for (const match of html.matchAll(linkPattern)) {
    const [, dateText, url, title] = match;
    if (!dateText.trim().startsWith(targetSlashDate)) {
      continue;
    }

    const raceMatch = title.match(/^(札幌|函館|福島|新潟|東京|中山|中京|京都|阪神|小倉)(\d+)R/);
    if (!raceMatch) {
      continue;
    }

    const venueEntry = Object.entries(jraVenueNames).find(([, name]) => name === raceMatch[1]);
    if (venueEntry) {
      map.set(`${venueEntry[0]}-${Number(raceMatch[2])}`, url);
    }
  }

  return map;
}

async function loadAibaRaceMap(targetDate) {
  const categoryUrls = [
    "https://xn--ai-f10fm89h.com/category/race-central/",
    ...Object.values(jraVenueCodes).map((code) => `https://xn--ai-f10fm89h.com/category/race-central/race-central-${code}/`)
  ];
  const map = new Map();

  for (const url of categoryUrls) {
    try {
      const { text } = await fetchText(url);
      for (const [key, raceUrl] of parseAibaRaceMap(text, targetDate).entries()) {
        map.set(key, raceUrl);
      }
    } catch {
      // AiBA is a直前公開サイトなので、カテゴリが一時的に空でも次回更新で拾い直す。
    }
  }

  return map;
}

function parseAibaPredictions(html) {
  const tableMatch = html.match(/<table[\s\S]*?印[\s\S]*?馬情報[\s\S]*?単勝[\s\S]*?指数[\s\S]*?<\/table>/i);
  if (!tableMatch) {
    return [];
  }

  const entries = [];
  const rowPattern = /<tr[\s\S]*?<\/tr>/gi;
  for (const match of tableMatch[0].matchAll(rowPattern)) {
    const cells = [...match[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => stripHtml(cell[1]))
      .filter(Boolean);
    if (cells.length < 4 || cells.includes("印")) {
      continue;
    }

    const mark = normalizeMark(cells[0]);
    const horseText = cells[1].replace(/\s+/g, " ").trim();
    const horseName = horseText
      .replace(/^\d+\s+/, "")
      .split(/\s+/)[0];
    const odds = normalizeOdds(cells[cells.length - 2]);
    const index = normalizeIndex(cells[cells.length - 1]);
    if (!horseName || index === undefined) {
      continue;
    }

    entries.push({
      horseName,
      prediction: {
        mark: mark || markFromIndex(index),
        index,
        ...(odds !== undefined ? { odds } : {})
      }
    });
  }

  return entries;
}

async function fetchAibaPredictions(site, race, targetDate) {
  if (!fetchAibaPredictions.cache || fetchAibaPredictions.cache.date !== targetDate) {
    fetchAibaPredictions.cache = {
      date: targetDate,
      raceMap: await loadAibaRaceMap(targetDate)
    };
  }

  const key = `${race.venue}-${String(race.number || "").replace(/\D/g, "")}`;
  const url = fetchAibaPredictions.cache.raceMap.get(key);
  if (!url) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "AiBA予測未公開" };
  }

  const { text } = await fetchText(url);
  return { site: site.name, configured: true, raceId: race.id, url, entries: parseAibaPredictions(text) };
}

async function fetchNikkanAiJson(pathname, params = {}, token = "") {
  const url = `https://horse.ai-nikkansports.com${pathname}?${new URLSearchParams(params)}`;
  const response = await fetch(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
      "authorization": token ? `Bearer ${token}` : "",
      "origin": "https://www.nikkansports.com",
      "referer": "https://www.nikkansports.com/keiba/ai/",
      "user-agent": "keiba-consensus-data-check/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    url,
    data: await response.json()
  };
}

async function getNikkanAiToken() {
  if (getNikkanAiToken.cache) {
    return getNikkanAiToken.cache;
  }

  const response = await fetch("https://horse.ai-nikkansports.com/auth/login", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "origin": "https://www.nikkansports.com",
      "referer": "https://www.nikkansports.com/keiba/ai/",
      "user-agent": "keiba-consensus-data-check/1.0"
    },
    body: new URLSearchParams({
      userId: "zY7J3ptH",
      password: "u7LMJFpy"
    })
  });

  if (!response.ok) {
    throw new Error(`日刊AI login HTTP ${response.status}`);
  }

  const json = await response.json();
  if (!json.access_token) {
    throw new Error("日刊AI token未取得");
  }

  getNikkanAiToken.cache = json.access_token;
  return getNikkanAiToken.cache;
}

function parseNikkanAiPredictions(rows, race) {
  const raceNumber = Number(String(race.number || "").replace(/\D/g, ""));
  return rows
    .filter((row) => Number(row.race_number) === raceNumber && Number(row.run_type) === 0)
    .map((row) => {
      const rank = Number(row.predict_rank);
      const index = Number.isFinite(rank) ? normalizeIndex(100 - (rank - 1) * 7) : undefined;
      return {
        horseName: row.horse_name,
        prediction: {
          mark: normalizeMark(row.predict_mark) || markFromIndex(index),
          ...(index !== undefined ? { index } : {})
        }
      };
    })
    .filter((entry) => entry.horseName);
}

async function fetchNikkanAiPredictions(site, race, targetDate) {
  const token = await getNikkanAiToken();
  const compactDate = targetDate.replaceAll("-", "");
  const { url, data } = await fetchNikkanAiJson("/predict/getPredictHorse_w", {
    raceDate: compactDate,
    courseName: race.venueName,
    tollReleaseFlg: 0
  }, token);
  const entries = parseNikkanAiPredictions(Array.isArray(data) ? data : [], race);
  return {
    site: site.name,
    configured: true,
    raceId: race.id,
    url,
    entries,
    error: entries.length ? "" : "日刊AI無料公開対象外"
  };
}

async function loadSivaRaceMap(targetDate) {
  const compactDate = targetDate.replaceAll("-", "");
  const url = `https://siva-ai.com/rest/race/listPage?raceDate=${compactDate}`;
  const { text } = await fetchText(url);
  const data = parseJsonPayload(text);
  const map = new Map();

  for (const item of data?.raceList || []) {
    const venue = jraVenueByCode[item.KEIBAJO_CODE];
    const raceNumber = Number(item.RACE_BANGO);
    if (venue && raceNumber && item.RACE_CODE) {
      map.set(`${venue}-${raceNumber}`, item.RACE_CODE);
    }
  }

  return map;
}

function parseSivaPredictions(data) {
  const rows = Array.isArray(data?.detail) ? data.detail : [];
  const ranked = rows
    .map((row) => ({
      horseName: row.BAMEI,
      rank: Number(row.RECOMMEND_NO),
      odds: normalizeOdds(row.TANSHO_ODDS)
    }))
    .filter((row) => row.horseName && Number.isFinite(row.rank) && row.rank > 0)
    .sort((a, b) => a.rank - b.rank);

  return ranked.map((row, index) => {
    const score = normalizeIndex(100 - index * 7);
    return {
      horseName: row.horseName,
      prediction: {
        mark: markFromIndex(score),
        index: score,
        ...(row.odds !== undefined ? { odds: row.odds } : {})
      }
    };
  });
}

async function fetchSivaPredictions(site, race, targetDate) {
  if (!fetchSivaPredictions.cache || fetchSivaPredictions.cache.date !== targetDate) {
    fetchSivaPredictions.cache = {
      date: targetDate,
      raceMap: await loadSivaRaceMap(targetDate)
    };
  }

  const key = `${race.venue}-${String(race.number || "").replace(/\D/g, "")}`;
  const raceCode = fetchSivaPredictions.cache.raceMap.get(key);
  if (!raceCode) {
    return { site: site.name, configured: true, raceId: race.id, entries: [], error: "SIVA raceCode未取得" };
  }

  const url = `https://siva-ai.com/rest/race/detailPage?raceCode=${encodeURIComponent(raceCode)}`;
  const { text } = await fetchText(url);
  const data = parseJsonPayload(text);
  const entries = parseSivaPredictions(data);
  return {
    site: site.name,
    configured: true,
    raceId: race.id,
    url,
    entries,
    error: entries.length ? "" : "SIVA予測未公開"
  };
}

function parseUmanityUIndexPredictions(html, race) {
  const plainText = stripTags(html);
  const entries = [];

  race.horses.forEach((horse) => {
    const escapedName = horse.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`${escapedName}.{0,80}?(?:U指数|指数)\\s*[:：]?\\s*(\\d{1,3}(?:\\.\\d+)?)`, "u");
    const index = normalizeIndex(plainText.match(pattern)?.[1]);
    if (index !== undefined) {
      entries.push({
        horseName: horse.name,
        prediction: {
          mark: markFromIndex(index),
          index
        }
      });
    }
  });

  return entries;
}

async function fetchUmanityUIndexPredictions(site, race) {
  const url = "https://umanity.jp/racedata/race_newspaper.php";
  const { text } = await fetchText(url);
  const entries = parseUmanityUIndexPredictions(text, race);
  return {
    site: site.name,
    configured: true,
    raceId: race.id,
    url,
    entries,
    error: entries.length ? "" : "ウマニティU指数未公開またはログイン範囲"
  };
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

function parsePredictions(text, contentType, race, site) {
  if (site.name === "競馬ラボ") {
    return parseKeibaLabPredictions(text);
  }

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
  if (site.builtin === "spaia") {
    try {
      return await fetchSpaiaPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "keibabook") {
    try {
      return await fetchKeibaBookPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "umarks") {
    try {
      return await fetchUmarksPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "athena") {
    try {
      return await fetchAthenaPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "muryouKeibaAi") {
    try {
      return await fetchMuryouKeibaAiPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "aiba") {
    try {
      return await fetchAibaPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "nikkanAi") {
    try {
      return await fetchNikkanAiPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "siva") {
    try {
      return await fetchSivaPredictions(site, race, targetDate);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (site.builtin === "umanityUIndex") {
    try {
      return await fetchUmanityUIndexPredictions(site, race);
    } catch (error) {
      return { site: site.name, configured: true, raceId: race.id, entries: [], error: error.message };
    }
  }

  if (!site.url) {
    return { site: site.name, configured: false, raceId: race.id, entries: [], error: "URL未設定" };
  }

  const url = makeUrl(site.url, race, targetDate);
  try {
    const { text, contentType } = await fetchText(url);
    const entries = parsePredictions(text, contentType, race, site);
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
    const raceReports = [];
    race.horses.forEach((horse) => {
      horse.predictions = {};
    });

    for (const site of sites) {
      const result = await fetchSiteRacePredictions(site, race, targetDate);
      const matched = mergeSiteEntries(race, site.name, result.entries);
      const report = {
        site: site.name,
        raceId: race.id,
        configured: result.configured,
        fetched: result.configured && !result.error,
        horseCount: race.horses.length,
        matched,
        complete: race.horses.length > 0 && matched >= race.horses.length,
        error: result.error || ""
      };
      reports.push(report);
      raceReports.push(report);
    }

    race.missingSites = sites
      .map((site) => site.name)
      .filter((siteName) => !raceReports.some((report) => report.site === siteName && report.complete));
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
  const spaiaRaces = externalRaces ? null : await loadSpaiaRaces(targetDate).catch(() => null);
  const keibaLabRaces = externalRaces || spaiaRaces ? null : await loadKeibaLabRaces(targetDate).catch(() => null);
  const liveRaces = spaiaRaces || keibaLabRaces;
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
    raceSource: externalRaces ? "external-json" : (spaiaRaces ? "spaia-race-list" : (keibaLabRaces ? "keibalab-race-list" : "seed-fallback")),
    siteSources: sourceReports,
    races
  };
  const configuredSiteNames = new Set(sourceReports.filter((report) => report.configured).map((report) => report.site));
  const fetchedSiteNames = new Set(sourceReports.filter((report) => report.fetched).map((report) => report.site));
  const matchedSiteNames = new Set(sourceReports.filter((report) => report.complete).map((report) => report.site));

  const consensusReady = matchedSiteNames.size >= requiredConsensusSiteCount;
  const status = {
    generatedAt: nowParts.iso,
    targetDate,
    updateLeadMinutes,
    source: consensusReady ? payload.source : "insufficient-site-scrape",
    raceSource: payload.raceSource,
    requiredConsensusSiteCount,
    consensusReady,
    raceCount: races.length,
    readyRaceIds: readyRaces.map((race) => race.id),
    configuredSiteCount: configuredSiteNames.size,
    fetchedSiteCount: fetchedSiteNames.size,
    matchedSiteCount: matchedSiteNames.size,
    fetchedRaceCount: sourceReports.filter((report) => report.fetched).length,
    matchedRaceCount: sourceReports.filter((report) => report.complete).length,
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
