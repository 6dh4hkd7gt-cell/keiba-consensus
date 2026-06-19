const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL = "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop";
const RAKUTEN_TOP_URL = "https://keiba.rakuten.co.jp/";
const OUTPUT_PATH = path.join(process.cwd(), "docs", "chihou", "data", "today-races.json");
const PREDICTION_SOURCES = [
  "楽天みんなの予想",
  "netkeiba地方",
  "オッズパーク",
  "SPAT4",
  "競馬ブック地方",
  "競馬エース",
  "勝馬",
  "ケイシュウNEWS",
  "通信社",
  "競馬カナザワ"
];
const MARK_SCORES = {
  "◎": 100,
  "○": 80,
  "◯": 80,
  "▲": 65,
  "△": 45,
  "☆": 35
};

const VENUE_CODES = {
  obihiro: "03",
  monbetsu: "36",
  morioka: "10",
  mizusawa: "11",
  urawa: "18",
  funabashi: "19",
  ooi: "20",
  kawasaki: "21",
  kanazawa: "22",
  kasamatsu: "23",
  nagoya: "24",
  sonoda: "27",
  himeji: "28",
  kochi: "31",
  saga: "32"
};

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

async function readJapaneseHtml(response) {
  const bytes = await response.arrayBuffer();
  const decoders = ["utf-8", "shift_jis", "euc-jp"];
  let best = { html: "", score: -Infinity };

  for (const encoding of decoders) {
    try {
      const html = new TextDecoder(encoding).decode(bytes);
      const venueHits = Object.keys(VENUE_ALIASES).filter((venueName) => html.includes(venueName)).length;
      const replacementPenalty = (html.match(/\uFFFD/g) || []).length;
      const score =
        (html.includes("本日のレース") ? 100 : 0) +
        (html.includes("TodayRaceInfo") ? 10 : 0) +
        venueHits * 20 +
        (html.includes("15:00") ? 5 : 0) -
        replacementPenalty;

      if (score > best.score) {
        best = { html, score };
      }
    } catch {
      // Try the next decoder.
    }
  }

  return best.html || new TextDecoder("utf-8").decode(bytes);
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

function loadExistingSchedule(date) {
  try {
    const payload = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
    if (payload.date === date && Array.isArray(payload.races) && payload.races.length) {
      return payload.races;
    }
  } catch {
    // No usable checked-in schedule yet.
  }

  return [];
}

function buildRaceKey(race) {
  return `${race.venue}-${race.number}`;
}

function formatNarRaceDate(dateKey) {
  return dateKey.replaceAll("-", "/");
}

function buildDebaTableUrl(date, race) {
  const code = VENUE_CODES[race.venue];
  if (!code) {
    return "";
  }

  const params = new URLSearchParams({
    k_babaCode: code,
    k_raceDate: formatNarRaceDate(date),
    k_raceNo: String(race.number)
  });
  return `https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/DebaTable?${params.toString()}`;
}

function parseHorseRows(lines) {
  const horses = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    if (!/人気/.test(lines[index + 1])) {
      continue;
    }

    const match = lines[index].match(/^(?:[1-8]\s+)?(\d{1,2})\s+([^\s]+)\s+.+?\s+(\d+(?:\.\d+)?)$/);
    if (!match) {
      continue;
    }

    const horseNumber = Number(match[1]);
    const odds = Number(match[3]);
    if (!Number.isFinite(horseNumber) || horseNumber < 1 || horseNumber > 18) {
      continue;
    }

    horses.push({
      number: horseNumber,
      name: match[2],
      odds: Number.isFinite(odds) ? odds : undefined
    });
  }

  const seen = new Set();
  return horses.filter((horse) => {
    if (seen.has(horse.number)) {
      return false;
    }
    seen.add(horse.number);
    return true;
  });
}

function scorePredictionCounts(counts) {
  const entries = Object.entries(counts).filter(([, count]) => count > 0);
  if (!entries.length) {
    return null;
  }

  const totalCount = entries.reduce((total, [, count]) => total + count, 0);
  const weightedScore = entries.reduce((total, [mark, count]) => total + (MARK_SCORES[mark] || 0) * count, 0);
  const index = Math.round(weightedScore / totalCount);
  const topMark = index >= 85 ? "◎" : index >= 75 ? "○" : index >= 65 ? "▲" : "△";

  return {
    mark: topMark,
    index,
    raw: counts
  };
}

function parseRakutenPredictionSummary(lines) {
  const predictions = new Map();
  const start = lines.findIndex((line) => line.includes("馬番") && line.includes("馬名") && line.includes("◎"));

  if (start < 0) {
    return predictions;
  }

  for (const line of lines.slice(start + 1)) {
    if (line.includes("ピンク色") || line.includes("予想一覧を見る") || line.includes("出馬表やオッズ")) {
      break;
    }

    const match = line.match(/^(\d{1,2})\s+(.+?)\s+\S+（[^）]+）\s+[-\d.]+ \([^)]+\)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/);
    if (!match) {
      continue;
    }

    const score = scorePredictionCounts({
      "◎": Number(match[3]),
      "○": Number(match[4]),
      "▲": Number(match[5]),
      "△": Number(match[6])
    });

    if (score) {
      predictions.set(Number(match[1]), {
        name: match[2],
        prediction: score
      });
    }
  }

  return predictions;
}

async function fetchRakutenRaceIds(date) {
  const response = await fetch(RAKUTEN_TOP_URL, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Rakuten top: ${response.status}`);
  }

  const dateDigits = date.replaceAll("-", "");
  const html = await readJapaneseHtml(response);
  const raceIds = new Map();
  for (const match of html.matchAll(/race_card\/list\/RACEID\/(\d{18})/g)) {
    const raceId = match[1];
    if (!raceId.startsWith(dateDigits)) {
      continue;
    }

    const venue = Object.entries(VENUE_CODES).find(([, code]) => code === raceId.slice(8, 10))?.[0];
    const raceNumber = Number(raceId.slice(-2));
    if (venue && raceNumber) {
      raceIds.set(`${venue}-${raceNumber}`, raceId);
    }
  }

  return raceIds;
}

async function fetchRakutenPredictions(raceId) {
  const url = `https://keiba.rakuten.co.jp/race_card/list/RACEID/${raceId}/mode/2`;
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "referer": RAKUTEN_TOP_URL,
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Rakuten predictions ${raceId}: ${response.status}`);
  }

  const html = await readJapaneseHtml(response);
  return parseRakutenPredictionSummary(htmlToLines(html));
}

async function fetchRaceHorses(date, race) {
  const url = buildDebaTableUrl(date, race);
  if (!url) {
    return [];
  }

  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "referer": SOURCE_URL,
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NAR horses for ${race.venue} ${race.number}R: ${response.status}`);
  }

  const html = await readJapaneseHtml(response);
  return parseHorseRows(htmlToLines(html));
}

async function enrichRaceHorses(date, races, existingRaces) {
  const existingByRace = new Map(existingRaces.map((race) => [buildRaceKey(race), race]));
  let rakutenRaceIds = new Map();
  try {
    rakutenRaceIds = await fetchRakutenRaceIds(date);
  } catch (error) {
    console.warn(error.message);
  }
  const enriched = [];

  for (const race of races) {
    let raceHorses = [];
    try {
      const horses = await fetchRaceHorses(date, race);
      if (horses.length) {
        raceHorses = horses;
      }
    } catch (error) {
      console.warn(error.message);
    }

    const raceKey = buildRaceKey(race);
    const existing = existingByRace.get(raceKey);
    if (!raceHorses.length && existing?.horses?.length) {
      raceHorses = existing.horses;
    }

    if (raceHorses.length) {
      const predictionsByHorseNumber = new Map();
      const raceId = rakutenRaceIds.get(raceKey);
      if (raceId) {
        try {
          const rakutenPredictions = await fetchRakutenPredictions(raceId);
          for (const [horseNumber, predictionData] of rakutenPredictions.entries()) {
            predictionsByHorseNumber.set(horseNumber, {
              ...(predictionsByHorseNumber.get(horseNumber) || {}),
              "楽天みんなの予想": predictionData.prediction
            });
          }
        } catch (error) {
          console.warn(error.message);
        }
      }

      const horses = raceHorses.map((horse) => ({
        ...horse,
        predictions: {
          ...(horse.predictions || {}),
          ...(predictionsByHorseNumber.get(horse.number) || {})
        }
      }));
      const acquiredSites = new Set(horses.flatMap((horse) => Object.keys(horse.predictions || {})));
      enriched.push({
        ...race,
        horses,
        missingSites: PREDICTION_SOURCES.filter((source) => !acquiredSites.has(source))
      });
      continue;
    }

    enriched.push({
      ...race,
      missingSites: PREDICTION_SOURCES
    });
  }

  return enriched;
}

async function main() {
  const today = formatDateKey();
  const existingRaces = loadExistingSchedule(today);
  const response = await fetch(SOURCE_URL, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "referer": "https://www.keiba.go.jp/",
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch NAR schedule: ${response.status}`);
  }

  const html = await readJapaneseHtml(response);
  const lines = htmlToLines(html);
  const start = lines.findIndex((line) => line.includes("本日のレース"));
  const sourceLines = start >= 0 ? lines.slice(start + 1) : lines;
  let races = parseRaceRows(sourceLines);

  if (!races.length) {
    races = existingRaces;
  }

  if (!races.length) {
    throw new Error(`No local races were parsed from today's NAR schedule. Parsed ${lines.length} text lines.`);
  }

  races = await enrichRaceHorses(today, races, existingRaces);

  const payload = {
    date: today,
    source: SOURCE_URL,
    generatedAt: new Date().toISOString(),
    races
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(`${OUTPUT_PATH}.tmp`, `${JSON.stringify(payload, null, 2)}\n`);
  fs.renameSync(`${OUTPUT_PATH}.tmp`, OUTPUT_PATH);
  const horseRaceCount = races.filter((race) => Array.isArray(race.horses) && race.horses.length).length;
  console.log(`Wrote ${races.length} races to ${OUTPUT_PATH} (${horseRaceCount} with official horse rows)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
