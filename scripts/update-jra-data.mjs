import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const rootDir = path.resolve(import.meta.dirname, "..");
const appPath = path.join(rootDir, "docs", "app.js");
const dataDir = path.join(rootDir, "docs", "data");
const racesPath = path.join(dataDir, "jra-races.json");
const statusPath = path.join(dataDir, "update-status.json");
const updateLeadMinutes = 10;

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
  const seedRaces = externalRaces || extractSeedRaces(appSource);
  const races = seedRaces.map((race) => normalizeRace(race, targetDate, now));
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
    source: externalRaces ? "external-json" : "seed-fallback",
    races
  };

  const status = {
    generatedAt: nowParts.iso,
    targetDate,
    updateLeadMinutes,
    source: payload.source,
    raceCount: races.length,
    readyRaceIds: readyRaces.map((race) => race.id)
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
