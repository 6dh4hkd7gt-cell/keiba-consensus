const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL = "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop";
const OUTPUT_PATH = path.join(process.cwd(), "docs", "chihou", "data", "today-races.json");

const VENUE_ALIASES = {
  "帯広": "obihiro",
  "帯広ば": "obihiro",
  "門別": "monbetsu",
  "盛岡": "morioka",
  "水沢": "mizusawa",
  "浦和": "urawa",
  "船橋": "funabashi",
  "大井": "ooi",
  "川崎": "kawasaki",
  "金沢": "kanazawa",
  "笠松": "kasamatsu",
  "名古屋": "nagoya",
  "園田": "sonoda",
  "姫路": "himeji",
  "高知": "kochi",
  "佐賀": "saga"
};

function formatDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function htmlToLines(html) {
  return decodeEntities(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|tr|div|p|li|h[1-6]|td|th)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function parseRaceRows(lines) {
  const races = [];
  let currentVenue = null;
  let currentRaceNumber = 1;

  for (const line of lines) {
    if (/^※/.test(line) || line.includes("開催場") || line.includes("重賞競走")) {
      break;
    }

    const venueName = Object.keys(VENUE_ALIASES).find((name) => (
      line === name || line.startsWith(`${name} `)
    ));

    if (venueName) {
      currentVenue = VENUE_ALIASES[venueName];
      currentRaceNumber = 1;
    }

    if (!currentVenue) {
      continue;
    }

    const times = [...line.matchAll(/\b([01]?\d|2[0-3]):([0-5]\d)\b/g)]
      .map((match) => `${match[1].padStart(2, "0")}:${match[2]}`);

    for (const startAt of times) {
      races.push({
        venue: currentVenue,
        number: currentRaceNumber,
        startAt
      });
      currentRaceNumber += 1;
    }
  }

  return races;
}

async function main() {
  const response = await fetch(SOURCE_URL, {
    headers: {
      "user-agent": "keiba-consensus-schedule-updater/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NAR schedule: ${response.status}`);
  }

  const html = await response.text();
  const lines = htmlToLines(html);
  const start = lines.findIndex((line) => line.includes("本日のレース"));
  const sourceLines = start >= 0 ? lines.slice(start + 1) : lines;
  const races = parseRaceRows(sourceLines);

  if (!races.length) {
    throw new Error("No local races were parsed from today's NAR schedule.");
  }

  const payload = {
    date: formatDateKey(),
    source: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    races
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);
  console.log(`Wrote ${races.length} races to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
