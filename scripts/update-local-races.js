const fs = require("node:fs");
const path = require("node:path");

const SOURCE_URL = "https://www.keiba.go.jp/KeibaWeb/TodayRaceInfo/TodayRaceInfoTop";
const RAKUTEN_TOP_URL = "https://keiba.rakuten.co.jp/";
const OUTPUT_PATH = path.join(process.cwd(), "docs", "chihou", "data", "today-races.json");
const FETCH_TIMEOUT_MS = 12000;
const PREDICTION_SOURCES = [
  "楽天みんなの予想",
  "AiBA無料AI",
  "ウマークス順位",
  "オッズパークAI",
  "公式単勝人気",
  "南関公式単勝人気",
  "競馬新聞ゼロ本紙",
  "競馬新聞ゼロ指数"
];
const MARK_SCORES = {
  "◎": 100,
  "○": 80,
  "◯": 80,
  "▲": 65,
  "△": 45,
  "☆": 35,
  "注": 35,
  "×": 25
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

const ODDSPARK_AI_CODES = {
  nagoya: "43",
  sonoda: "51"
};

const NANKAN_VENUE_CODES = {
  urawa: "18",
  funabashi: "19",
  ooi: "20",
  kawasaki: "21"
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

async function fetchWithTimeout(url, options = {}) {
  const timeoutSignal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutSignal])
    : timeoutSignal;

  try {
    return await fetch(url, {
      ...options,
      signal
    });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      throw new Error(`Timed out fetching ${url}`);
    }
    throw error;
  }
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
    const inlineMatch = lines[index].match(/^([◎○◯▲△☆])\s+(\d{1,2})\s+(.+)$/);
    const splitMark = MARK_SCORES[lines[index]] ? lines[index] : "";
    const splitNumber = Number(lines[index + 1]);
    const splitName = lines[index + 2] || "";
    const row = inlineMatch
      ? {
          mark: inlineMatch[1],
          number: Number(inlineMatch[2]),
          name: inlineMatch[3],
          indexStart: index + 1
        }
      : splitMark && Number.isFinite(splitNumber) && splitName
        ? {
            mark: splitMark,
            number: splitNumber,
            name: splitName,
            indexStart: index + 3
          }
        : null;

    if (!row) {
      continue;
    }

    let indexValue = null;
    for (const line of lines.slice(row.indexStart, row.indexStart + 6)) {
      if (/^[◎○◯▲△☆注]\s+\d{1,2}\s+/.test(line)) {
        break;
      }
      if (/^[◎○◯▲△☆注]$/.test(line)) {
        break;
      }

      const numbers = [...line.matchAll(/\d+(?:\.\d+)?/g)]
        .map((match) => Number(match[0]))
        .filter((value) => Number.isFinite(value) && value >= 1 && value <= 100);
      if (numbers.length) {
        indexValue = numbers.at(-1);
      }
    }

    if (!Number.isFinite(indexValue)) {
      continue;
    }

    predictions.set(row.number, {
      mark: row.mark === "◯" ? "○" : row.mark,
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

function normalizeMark(mark) {
  return mark === "◯" ? "○" : mark;
}

function parseTableCells(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)]
    .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()));
}

function parseOddsParkAiPredictions(html) {
  const racePredictions = new Map();
  const racePattern = /(\d{1,2})R[\s\S]*?<table class="race-table">([\s\S]*?)<\/table>/gi;

  for (const raceMatch of html.matchAll(racePattern)) {
    const raceNumber = Number(raceMatch[1]);
    if (!Number.isFinite(raceNumber)) {
      continue;
    }

    const predictions = new Map();
    for (const rowMatch of raceMatch[2].matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
      const cells = parseTableCells(rowMatch[0]);
      const horseNumberText = cells.slice(0, 2).filter((cell) => /^\d{1,2}$/.test(cell)).at(-1);
      if (cells.length < 7 || !horseNumberText) {
        continue;
      }

      const horseNumber = Number(horseNumberText);
      const counts = cells.slice(-4).reduce((marks, mark) => {
        const normalized = normalizeMark(mark);
        if (MARK_SCORES[normalized]) {
          marks[normalized] = (marks[normalized] || 0) + 1;
        }
        return marks;
      }, {});
      const prediction = scorePredictionCounts(counts);
      if (prediction) {
        predictions.set(horseNumber, prediction);
      }
    }

    if (predictions.size) {
      racePredictions.set(raceNumber, predictions);
    }
  }

  return racePredictions;
}

function buildOfficialOddsPredictions(raceHorses) {
  const predictions = new Map();
  const ranked = [...raceHorses]
    .filter((horse) => Number.isFinite(horse.odds) && horse.odds > 0)
    .sort((a, b) => a.odds - b.odds);

  ranked.forEach((horse, index) => {
    predictions.set(horse.number, {
      ...scoreFromIndex(100 - index * 6),
      raw: {
        odds: horse.odds,
        rank: index + 1
      }
    });
  });

  return predictions;
}

function scoreOddsRows(oddsRows) {
  const predictions = new Map();
  const ranked = [...oddsRows]
    .filter((row) => Number.isFinite(row.odds) && row.odds > 0)
    .sort((a, b) => a.odds - b.odds);

  ranked.forEach((row, index) => {
    predictions.set(row.number, {
      ...scoreFromIndex(100 - index * 6),
      raw: {
        odds: row.odds,
        rank: index + 1
      }
    });
  });

  return predictions;
}

function parseNankanOddsPredictions(html) {
  const winPlaceTable = html.match(/<p class="[^"]*table04__title[^"]*">単勝・複勝<\/p>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/i);
  const tableHtml = winPlaceTable?.[1] || "";
  const oddsRows = [];
  for (const rowMatch of tableHtml.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const cells = parseTableCells(rowMatch[0]);
    const horseNumberText = cells.slice(0, 2).filter((cell) => /^\d{1,2}$/.test(cell)).at(-1);
    if (!horseNumberText) {
      continue;
    }

    const odds = cells.slice(2)
      .map((cell) => Number(cell))
      .find((value) => Number.isFinite(value) && value > 0);
    if (!Number.isFinite(odds)) {
      continue;
    }

    oddsRows.push({
      number: Number(horseNumberText),
      odds
    });
  }

  return scoreOddsRows(oddsRows);
}

function parseKeibaZeroPredictions(html) {
  const predictions = new Map();
  const sourceLines = htmlToLines(html);
  const pairStart = sourceLines.findIndex((line) => line.includes("本紙予想") || line.includes("本誌予想"));
  const pairLine = pairStart >= 0 ? sourceLines.slice(pairStart, pairStart + 4).join(" ") : "";
  const pairScores = new Map();

  for (const pair of pairLine.matchAll(/\b(\d{1,2})-(\d{1,2})\b/g)) {
    const first = Number(pair[1]);
    const second = Number(pair[2]);
    pairScores.set(first, (pairScores.get(first) || 0) + 18);
    pairScores.set(second, (pairScores.get(second) || 0) + 12);
  }

  const tableStart = sourceLines.findIndex((line, index) => (
    (line.includes("枠番") && (line.includes("馬番") || sourceLines.slice(index, index + 4).some((nextLine) => nextLine.includes("馬番"))))
  ));
  const lines = tableStart >= 0 ? sourceLines.slice(tableStart) : sourceLines;
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

    if (pairScore > 0 && paperScore) {
      mergePrediction(predictions, horseNumber, "競馬新聞ゼロ本紙", paperScore);
    }
    if (indexPrediction) {
      mergePrediction(predictions, horseNumber, "競馬新聞ゼロ指数", indexPrediction);
    }
  }

  const rowStartPattern = /^(\d{1,2})\s+(\d{1,2})\s+[牡牝セ]\s+\d+\b/;
  for (let index = 0; index < lines.length; index += 1) {
    const inlineRow = lines[index].match(rowStartPattern);
    const splitRow = /^\d{1,2}$/.test(lines[index] || "")
      && /^\d{1,2}$/.test(lines[index + 1] || "")
      && /^[牡牝セ]\s+\d+\b/.test(lines[index + 2] || "");
    const horseNumber = inlineRow
      ? Number(inlineRow[2])
      : splitRow
        ? Number(lines[index + 1])
        : null;

    if (!horseNumber || predictions.has(horseNumber)) {
      continue;
    }

    const nextRowIndex = lines.findIndex((candidate, offset) => (
      offset > index
      && (rowStartPattern.test(candidate) || (
        /^\d{1,2}$/.test(candidate)
        && /^\d{1,2}$/.test(lines[offset + 1] || "")
        && /^[牡牝セ]\s+\d+\b/.test(lines[offset + 2] || "")
      ))
    ));
    const searchEnd = nextRowIndex > index ? nextRowIndex : Math.min(lines.length, index + 28);
    const indexLine = lines.slice(index + 1, searchEnd)
      .find((candidate) => {
        const values = candidate.match(/^(\d{1,3})\s+(\d{1,3})$/);
        if (!values) {
          return false;
        }

        return Number(values[1]) <= 100 && Number(values[2]) <= 100;
      });

    if (!indexLine) {
      continue;
    }

    const [, maxIndex, averageIndex] = indexLine.match(/^(\d{1,3})\s+(\d{1,3})$/);
    const pairScore = Math.min(35, pairScores.get(horseNumber) || 0);
    if (pairScore > 0) {
      mergePrediction(predictions, horseNumber, "競馬新聞ゼロ本紙", scoreFromIndex(45 + pairScore));
    }
    mergePrediction(predictions, horseNumber, "競馬新聞ゼロ指数", scoreFromIndex(Math.round((Number(maxIndex) + Number(averageIndex)) / 2)));
  }

  return predictions;
}

async function fetchRakutenRaceIds(date) {
  const response = await fetchWithTimeout(RAKUTEN_TOP_URL, {
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
  const response = await fetchWithTimeout(url, {
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
  const requestHeaders = {
    "accept": url.includes("keiba0.com/nar/excel/")
      ? "application/vnd.ms-excel,text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      : "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "ja,en-US;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    "pragma": "no-cache",
    "referer": referer,
    "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
  };
  const response = await fetchWithTimeout(url, {
    headers: requestHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const cookieHeader = extractCookieHeader(response.headers);
  const firstHtml = await readJapaneseHtml(response);
  if (url.includes("keiba0.com") && cookieHeader) {
    const retry = await fetchWithTimeout(url, {
      headers: {
        ...requestHeaders,
        "cookie": cookieHeader
      }
    });

    if (retry.ok) {
      const retryHtml = await readJapaneseHtml(retry);
      return selectBestKeibaZeroHtml(firstHtml, retryHtml);
    }
  }

  return firstHtml;
}

function extractCookieHeader(headers) {
  const setCookies = typeof headers.getSetCookie === "function"
    ? headers.getSetCookie()
    : [];
  const fallbackCookie = headers.get("set-cookie");
  const cookies = setCookies.length
    ? setCookies
    : fallbackCookie
      ? fallbackCookie.split(/,(?=\s*[^;,=\s]+=[^;,]+)/)
      : [];

  return cookies
    .map((cookie) => cookie.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

function selectBestKeibaZeroHtml(firstHtml, retryHtml) {
  const candidates = [firstHtml, retryHtml].filter(Boolean);
  if (candidates.length < 2) {
    return candidates[0] || "";
  }

  return candidates
    .map((html) => ({ html, score: scoreKeibaZeroHtml(html) }))
    .sort((a, b) => b.score - a.score)[0].html;
}

function scoreKeibaZeroHtml(html) {
  const lines = htmlToLines(html);
  const predictions = parseKeibaZeroPredictions(html);
  const sourceCount = new Set(
    [...predictions.values()].flatMap((sources) => Object.keys(sources || {}))
  ).size;
  const horseRows = [...predictions.values()].filter((sources) => sources?.["競馬新聞ゼロ指数"]).length;
  const paperRows = [...predictions.values()].filter((sources) => sources?.["競馬新聞ゼロ本紙"]).length;

  return (
    (lines.some((line) => line.includes("本紙予想") || line.includes("本誌予想")) ? 1000 : 0) +
    (lines.some((line) => line.includes("馬連")) ? 300 : 0) +
    (lines.some((line) => line.includes("枠番")) ? 100 : 0) +
    (lines.some((line) => line.includes("馬番")) ? 100 : 0) +
    paperRows * 40 +
    horseRows * 20 +
    sourceCount * 10 +
    Math.min(lines.length, 300)
  );
}

async function fetchJson(url, referer = SOURCE_URL) {
  const response = await fetchWithTimeout(url, {
    headers: {
      "accept": "application/json,text/plain,*/*",
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

  return response.json();
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
      const response = await fetchWithTimeout(categoryUrl, {
        headers: {
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "accept-language": "ja,en-US;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
          "pragma": "no-cache",
          "referer": "https://xn--ai-f10fm89h.com/",
          "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ${categoryUrl}: ${response.status}`);
      }

      const linkHeader = response.headers.get("link") || "";
      const categoryId = linkHeader.match(/\/wp-json\/wp\/v2\/categories\/(\d+)/)?.[1];
      if (categoryId) {
        try {
          const postsUrl = `https://xn--ai-f10fm89h.com/wp-json/wp/v2/posts?categories=${categoryId}&per_page=50&_fields=link,title,date`;
          const posts = await fetchJson(postsUrl, categoryUrl);
          for (const post of posts) {
            if (!String(post.date || "").startsWith(date)) {
              continue;
            }

            const title = decodeEntities(String(post.title?.rendered || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
            const raceMatch = title.match(new RegExp(`${venueName}(\\d{1,2})R`));
            if (raceMatch && post.link) {
              linksByRace.set(`${venue}-${Number(raceMatch[1])}`, post.link);
            }
          }
        } catch (error) {
          console.warn(error.message);
        }
      }

      const html = await readJapaneseHtml(response);
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

function buildOddsParkAiUrl(date, venue) {
  const code = ODDSPARK_AI_CODES[venue];
  if (!code) {
    return "";
  }

  return `https://www.oddspark.com/keiba/yosou/ai/RaceList.do?jo_code=${code}&race_date=${date.replaceAll("-", "")}`;
}

async function fetchOddsParkAiRacePredictions(date, venues) {
  const predictionsByRace = new Map();

  for (const venue of venues) {
    const url = buildOddsParkAiUrl(date, venue);
    if (!url) {
      continue;
    }

    try {
      const html = await fetchHtml(url, "https://www.oddspark.com/keiba/yosou/");
      const racePredictions = parseOddsParkAiPredictions(html);
      for (const [raceNumber, predictions] of racePredictions.entries()) {
        predictionsByRace.set(`${venue}-${raceNumber}`, predictions);
      }
    } catch (error) {
      console.warn(error.message);
    }
  }

  return predictionsByRace;
}

async function fetchNankanOddsLinks(date, venues) {
  const targetVenueEntries = Object.entries(NANKAN_VENUE_CODES)
    .filter(([venue]) => venues.includes(venue));
  const linksByRace = new Map();
  if (!targetVenueEntries.length) {
    return linksByRace;
  }

  const html = await fetchHtml("https://www.nankankeiba.com/", "https://www.nankankeiba.com/");
  const dateDigits = date.replaceAll("-", "");
  const baseCodeByVenue = new Map();
  for (const match of html.matchAll(/href="([^"]*\/odds\/(\d{18})\.do[^"]*)"/g)) {
    const href = decodeEntities(match[1]);
    const raceCode = match[2];
    if (!raceCode.startsWith(dateDigits) || !raceCode.endsWith("01")) {
      continue;
    }

    const venue = targetVenueEntries.find(([, code]) => raceCode.slice(8, 10) === code)?.[0];
    const raceNumber = Number(raceCode.slice(14, 16));
    if (!venue || !raceNumber) {
      continue;
    }

    baseCodeByVenue.set(venue, raceCode.slice(0, 14));
    linksByRace.set(`${venue}-${raceNumber}`, href.startsWith("http") ? href : `https://www.nankankeiba.com${href}`);
  }

  for (const [venue, baseCode] of baseCodeByVenue.entries()) {
    for (let raceNumber = 1; raceNumber <= 12; raceNumber += 1) {
      const key = `${venue}-${raceNumber}`;
      if (!linksByRace.has(key)) {
        linksByRace.set(key, `https://www.nankankeiba.com/odds/${baseCode}${String(raceNumber).padStart(2, "0")}01.do`);
      }
    }
  }

  return linksByRace;
}

async function fetchNankanOddsPredictions(url) {
  const html = await fetchHtml(url, "https://www.nankankeiba.com/");
  return parseNankanOddsPredictions(html);
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

function buildKeibaZeroExcelUrl(date, race) {
  const code = VENUE_CODES[race.venue];
  if (!code) {
    return "";
  }
  return `https://keiba0.com/nar/excel/${date.replaceAll("-", "")}/${code}/${String(race.number).padStart(2, "0")}/`;
}

function hasPredictionSource(predictions, sourceName) {
  return [...predictions.values()].some((sources) => Boolean(sources?.[sourceName]));
}

function mergePredictionMaps(basePredictions, extraPredictions) {
  const merged = new Map(basePredictions);

  for (const [horseNumber, predictions] of extraPredictions.entries()) {
    merged.set(horseNumber, {
      ...(merged.get(horseNumber) || {}),
      ...predictions
    });
  }

  return merged;
}

async function fetchKeibaZeroPredictions(date, race) {
  const url = buildKeibaZeroUrl(date, race);
  if (!url) {
    return new Map();
  }

  const html = await fetchHtml(url, "https://keiba0.com/nar/");
  let predictions = parseKeibaZeroPredictions(html);
  if (hasPredictionSource(predictions, "競馬新聞ゼロ本紙")) {
    return predictions;
  }

  const excelUrl = buildKeibaZeroExcelUrl(date, race);
  if (!excelUrl) {
    return predictions;
  }

  try {
    const excelHtml = await fetchHtml(excelUrl, url);
    const fallbackPredictions = parseKeibaZeroPredictions(`${excelHtml}\n${html}`);
    predictions = mergePredictionMaps(predictions, fallbackPredictions);
  } catch (error) {
    console.warn(error.message);
  }

  return predictions;
}

async function fetchRaceHorses(date, race) {
  const url = buildDebaTableUrl(date, race);
  if (!url) {
    return [];
  }

  const response = await fetchWithTimeout(url, {
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
  let oddsParkAiPredictions = new Map();
  let nankanOddsLinks = new Map();
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
  try {
    oddsParkAiPredictions = await fetchOddsParkAiRacePredictions(date, venues);
  } catch (error) {
    console.warn(error.message);
  }
  try {
    nankanOddsLinks = await fetchNankanOddsLinks(date, venues);
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
      const officialOddsPredictions = buildOfficialOddsPredictions(raceHorses);
      for (const [horseNumber, prediction] of officialOddsPredictions.entries()) {
        mergePrediction(predictionsByHorseNumber, horseNumber, "公式単勝人気", prediction);
      }
      const nankanOddsUrl = nankanOddsLinks.get(raceKey);
      if (nankanOddsUrl) {
        try {
          const nankanOddsPredictions = await fetchNankanOddsPredictions(nankanOddsUrl);
          for (const [horseNumber, prediction] of nankanOddsPredictions.entries()) {
            mergePrediction(predictionsByHorseNumber, horseNumber, "南関公式単勝人気", prediction);
          }
        } catch (error) {
          console.warn(error.message);
        }
      }
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
      const oddsParkAiRacePredictions = oddsParkAiPredictions.get(raceKey);
      if (oddsParkAiRacePredictions) {
        for (const [horseNumber, prediction] of oddsParkAiRacePredictions.entries()) {
          mergePrediction(predictionsByHorseNumber, horseNumber, "オッズパークAI", prediction);
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
  const response = await fetchWithTimeout(SOURCE_URL, {
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
