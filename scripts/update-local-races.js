const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL = "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop";
const RAKUTEN_TOP_URL = "https://keiba.rakuten.co.jp/";
const OUTPUT_PATH = path.join(process.cwd(), "docs", "chihou", "data", "today-races.json");
const PREDICTION_SOURCES = [
  "楽天みんなの予想",
  "AiBA無料AI",
  "ウマークス順位",
  "競馬新聞ゼロ本紙",
  "競馬新聞ゼロ指数"
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

const AIBA_VENUE_CODES = {
  monbetsu: "30",
  morioka: "35",
  mizusawa: "36",
  urawa: "42",
  funabashi: "43",
  ooi: "44",
  kawasaki: "45",
  kanazawa: "46",
  kasamatsu: "47",
  nagoya: "48",
  sonoda: "50",
  himeji: "51",
  kochi: "54",
  saga: "55"
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

function scoreFromIndex(index) {
  if (!Number.isFinite(index)) {
    return null;
  }

  const normalized = Math.max(1, Math.min(100, Math.round(index)));
  return {
    mark: normalized >= 80 ? "◎" : normalized >= 70 ? "○" : normalized >= 60 ? "▲" : normalized >= 45 ? "△" : "☆",
    index: normalized
  };
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mergePrediction(map, horseNumber, sourceName, prediction) {
  if (!prediction) {
    return;
  }

  map.set(horseNumber, {
    ...(map.get(horseNumber) || {}),
    [sourceName]: prediction
  });
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

function parseAibaPredictions(html) {
  const predictions = new Map();
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i);
  if (tableMatch) {
    for (const row of tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
      if (cells.length < 4 || !MARK_SCORES[cells[0]]) {
        continue;
      }

      const info = cells[1] || "";
      const numberMatch = info.match(/^(\d{1,2})\s+/);
      const index = Number(cells[cells.length - 1]);
      if (!numberMatch || !Number.isFinite(index)) {
        continue;
      }

      predictions.set(Number(numberMatch[1]), {
        mark: cells[0] === "◯" ? "○" : cells[0],
        index: Math.max(1, Math.min(100, Math.round(index)))
      });
    }
  }

  if (predictions.size) {
    return predictions;
  }

  const lines = htmlToLines(html);
  for (let index = 0; index < lines.length - 1; index += 1) {
    const rowMatch = lines[index].match(/^([◎○◯▲△☆])\s+(\d{1,2})\s+(.+)$/);
    if (!rowMatch) {
      continue;
    }

    let indexValue = null;
    for (const line of lines.slice(index + 1, index + 4)) {
      if (/^[◎○◯▲△☆注]\s+\d{1,2}\s+/.test(line)) {
        break;
      }

      const numbers = [...line.matchAll(/\d+(?:\.\d+)?/g)]
        .map((match) => Number(match[0]))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 100);
      if (numbers.length >= 2) {
        indexValue = numbers.at(-1);
        break;
      }
    }

    if (!Number.isFinite(indexValue)) {
      continue;
    }

    predictions.set(Number(rowMatch[2]), {
      mark: rowMatch[1] === "◯" ? "○" : rowMatch[1],
      index: Math.max(1, Math.min(100, Math.round(indexValue)))
    });
  }

  return predictions;
}

function parseUmaXPredictions(html, raceHorses) {
  const predictions = new Map();
  const lines = htmlToLines(html);
  const horseByName = new Map(raceHorses.map((horse) => [horse.name, horse]));

  for (const [horseName, horse] of horseByName.entries()) {
    const line = lines.find((item) => item.startsWith(`${horseName} `));
    if (!line) {
      continue;
    }

    const rankMatch = line.match(new RegExp(`^${escapeRegExp(horseName)}\\s+[牡牝セ]\\d+\\s+\\S+\\s+(\\d{1,2})\\b`));
    const rank = Number(rankMatch?.[1]);
    const scored = Number.isFinite(rank)
      ? scoreFromIndex(100 - (rank - 1) * 6)
      : null;
    if (!scored) {
      continue;
    }

    predictions.set(horse.number, scored);
  }

  return predictions;
}

function parseKeibaZeroPredictions(html) {
  const predictions = new Map();
  const sourceLines = htmlToLines(html);
  const pairLine = sourceLines.find((line) => line.includes("本紙予想") && line.includes("馬連")) || "";
  const pairScores = new Map();

  for (const pair of pairLine.matchAll(/\b(\d{1,2})-(\d{1,2})\b/g)) {
    const first = Number(pair[1]);
    const second = Number(pair[2]);
    pairScores.set(first, (pairScores.get(first) || 0) + 18);
    pairScores.set(second, (pairScores.get(second) || 0) + 12);
  }

  const lines = sourceLines.slice(sourceLines.findIndex((line) => line.includes("枠番") && line.includes("馬番")));
  for (const line of lines) {
    const match = line.match(/^\d+\s+(\d{1,2})\s+[牡牝セ]\s+\d+\s+\S+\s+\S+\s+(.+?)\s+.+?\s+(\d+)\s+(\d+)\s+(?:\d+週|[一二三四五六七八九十]+週|連闘|中\d+週)/);
    if (!match) {
      continue;
    }

    const horseNumber = Number(match[1]);
    const maxIndex = Number(match[3]);
    const averageIndex = Number(match[4]);
    const indexScore = Math.round((maxIndex + averageIndex) / 2);
    const pairScore = Math.min(35, pairScores.get(horseNumber) || 0);
    const paperScore = scoreFromIndex(45 + pairScore);
    const indexPrediction = scoreFromIndex(indexScore);

    if (paperScore) {
      mergePrediction(predictions, horseNumber, "競馬新聞ゼロ本紙", paperScore);
    }
    if (indexPrediction) {
      mergePrediction(predictions, horseNumber, "競馬新聞ゼロ指数", indexPrediction);
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

async function fetchHtml(url, referer = SOURCE_URL) {
  const response = await fetch(url, {
    headers: {
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "ja,en-US;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      "pragma": "no-cache",
      "referer": referer,
      "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return readJapaneseHtml(response);
}

async function fetchAibaRaceLinks(date, venues) {
  const datePath = date.replaceAll("-", "/");
  const linksByRace = new Map();

  for (const venue of venues) {
    const venueCode = AIBA_VENUE_CODES[venue];
    const venueName = Object.entries(VENUE_ALIASES).find(([, key]) => key === venue)?.[0];
    if (!venueCode || !venueName) {
      continue;
    }

    const categoryUrl = `https://xn--ai-f10fm89h.com/category/race-local/race-local-${venueCode}/`;
    try {
      const html = await fetchHtml(categoryUrl, "https://xn--ai-f10fm89h.com/");
      const anchorPattern = /<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
      for (const match of html.matchAll(anchorPattern)) {
        const href = decodeEntities(match[1]);
        const text = decodeEntities(match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
        if (!href.includes(`/${datePath}/`)) {
          continue;
        }

        const raceMatch = text.match(new RegExp(`${venueName}(\\d{1,2})R`));
        if (raceMatch) {
          linksByRace.set(`${venue}-${Number(raceMatch[1])}`, href);
        }
      }
    } catch (error) {
      console.warn(error.message);
    }
  }

  return linksByRace;
}

async function fetchAibaPredictions(url) {
  const html = await fetchHtml(url, "https://xn--ai-f10fm89h.com/");
  return parseAibaPredictions(html);
}

function buildUmaXUrl(date, race) {
  const code = VENUE_CODES[race.venue];
  if (!code) {
    return "";
  }
  return `https://uma-x.jp/nar_result/z${code}${date.replaceAll("-", "")}${String(race.number).padStart(2, "0")}`;
}

async function fetchUmaXPredictions(date, race, raceHorses) {
  const url = buildUmaXUrl(date, race);
  if (!url) {
    return new Map();
  }

  const html = await fetchHtml(url, "https://uma-x.jp/nar");
  return parseUmaXPredictions(html, raceHorses);
}

function buildKeibaZeroUrl(date, race) {
  const code = VENUE_CODES[race.venue];
  if (!code) {
    return "";
  }
  return `https://keiba0.com/nar/detail/${date.replaceAll("-", "")}/${code}/${String(race.number).padStart(2, "0")}/`;
}

async function fetchKeibaZeroPredictions(date, race) {
  const url = buildKeibaZeroUrl(date, race);
  if (!url) {
    return new Map();
  }

  const html = await fetchHtml(url, "https://keiba0.com/nar/");
  return parseKeibaZeroPredictions(html);
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
  const venues = [...new Set(races.map((race) => race.venue))];
  let rakutenRaceIds = new Map();
  let aibaRaceLinks = new Map();
  try {
    rakutenRaceIds = await fetchRakutenRaceIds(date);
  } catch (error) {
    console.warn(error.message);
  }
  try {
    aibaRaceLinks = await fetchAibaRaceLinks(date, venues);
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
            mergePrediction(predictionsByHorseNumber, horseNumber, "楽天みんなの予想", predictionData.prediction);
          }
        } catch (error) {
          console.warn(error.message);
        }
      }
      const aibaUrl = aibaRaceLinks.get(raceKey);
      if (aibaUrl) {
        try {
          const aibaPredictions = await fetchAibaPredictions(aibaUrl);
          for (const [horseNumber, prediction] of aibaPredictions.entries()) {
            mergePrediction(predictionsByHorseNumber, horseNumber, "AiBA無料AI", prediction);
          }
        } catch (error) {
          console.warn(error.message);
        }
      }
      try {
        const umaXPredictions = await fetchUmaXPredictions(date, race, raceHorses);
        for (const [horseNumber, prediction] of umaXPredictions.entries()) {
          mergePrediction(predictionsByHorseNumber, horseNumber, "ウマークス順位", prediction);
        }
      } catch (error) {
        console.warn(error.message);
      }
      try {
        const keibaZeroPredictions = await fetchKeibaZeroPredictions(date, race);
        for (const [horseNumber, predictions] of keibaZeroPredictions.entries()) {
          predictionsByHorseNumber.set(horseNumber, {
            ...(predictionsByHorseNumber.get(horseNumber) || {}),
            ...predictions
          });
        }
      } catch (error) {
        console.warn(error.message);
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
