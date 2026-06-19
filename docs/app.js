const MARK_SCORES = {
  "◎": 100,
  "○": 80,
  "▲": 65,
  "△": 45,
  "☆": 35
};

const MARK_SEQUENCE = ["◎", "○", "▲", "△", "☆"];
const OPERATING_DAYS = [0, 6];
const OPERATING_START_MINUTES = 9 * 60;
const OPERATING_END_MINUTES = 17 * 60;
const UPDATE_LEAD_MINUTES = 10;
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const urlParams = new URLSearchParams(window.location.search);
const DEMO_TIME = urlParams.get("demoTime");
const INITIAL_RACE_ID = urlParams.get("race");
const INITIAL_HORSE_NAME = urlParams.get("horse") || "";

const DEFAULT_WEIGHTS = {
  "SPAIA": 1,
  "netkeiba AI": 1,
  "AI指数": 1,
  "競馬ラボ": 1,
  "無料競馬AI": 1,
  "Uma Cloud": 1,
  "SIVA": 1,
  "Deep Keiba": 1,
  "Race AI": 1,
  "Prediction One": 1
};

const races = [
  {
    id: "tokyo-11",
    venue: "tokyo",
    venueName: "東京",
    number: "11R",
    name: "青嵐ステークス",
    date: "2026-06-20",
    startAt: "15:45",
    updatedAt: "15:35:03",
    missingSites: ["Uma Cloud"],
    horses: [
      {
        number: 1,
        name: "グランアルタイル",
        odds: 3.8,
        predictions: {
          "SPAIA": { mark: "◎", index: 91 },
          "netkeiba AI": { mark: "◎", index: 88 },
          "AI指数": { mark: "○", index: 84 },
          "競馬ラボ": { mark: "▲", index: 78 },
          "無料競馬AI": { mark: "◎", index: 90 }
        }
      },
      {
        number: 4,
        name: "ミヤビレゾナンス",
        odds: 6.4,
        predictions: {
          "SPAIA": { mark: "○", index: 84 },
          "netkeiba AI": { mark: "▲", index: 79 },
          "AI指数": { mark: "◎", index: 89 },
          "競馬ラボ": { mark: "○", index: 82 },
          "無料競馬AI": { mark: "▲", index: 77 }
        }
      },
      {
        number: 7,
        name: "サトノブリッジ",
        odds: 11.2,
        predictions: {
          "SPAIA": { mark: "▲", index: 76 },
          "netkeiba AI": { mark: "○", index: 82 },
          "AI指数": { mark: "△", index: 70 },
          "競馬ラボ": { mark: "◎", index: 87 },
          "無料競馬AI": { mark: "○", index: 81 }
        }
      },
      {
        number: 9,
        name: "エアリーフォルテ",
        odds: 4.9,
        predictions: {
          "SPAIA": { mark: "△", index: 69 },
          "netkeiba AI": { mark: "△", index: 71 },
          "AI指数": { mark: "▲", index: 75 },
          "競馬ラボ": { mark: "○", index: 80 },
          "無料競馬AI": { mark: "△", index: 72 }
        }
      },
      {
        number: 12,
        name: "ロードカノープス",
        odds: 18.6,
        predictions: {
          "SPAIA": { mark: "☆", index: 64 },
          "netkeiba AI": { mark: "△", index: 68 },
          "AI指数": { mark: "△", index: 66 },
          "競馬ラボ": { mark: "☆", index: 62 },
          "無料競馬AI": { mark: "▲", index: 74 }
        }
      }
    ]
  },
  {
    id: "kyoto-10",
    venue: "kyoto",
    venueName: "京都",
    number: "10R",
    name: "朱雀特別",
    date: "2026-06-20",
    startAt: "15:10",
    updatedAt: "15:00:08",
    missingSites: [],
    horses: [
      {
        number: 2,
        name: "カレンミストラル",
        odds: 2.9,
        predictions: {
          "SPAIA": { mark: "◎", index: 94 },
          "netkeiba AI": { mark: "○", index: 86 },
          "AI指数": { mark: "◎", index: 92 },
          "競馬ラボ": { mark: "◎", index: 90 },
          "無料競馬AI": { mark: "○", index: 85 },
          "Uma Cloud": { mark: "◎", index: 91 }
        }
      },
      {
        number: 5,
        name: "キョウトノアカリ",
        odds: 8.7,
        predictions: {
          "SPAIA": { mark: "○", index: 83 },
          "netkeiba AI": { mark: "▲", index: 76 },
          "AI指数": { mark: "○", index: 84 },
          "競馬ラボ": { mark: "▲", index: 78 },
          "無料競馬AI": { mark: "▲", index: 77 },
          "Uma Cloud": { mark: "○", index: 82 }
        }
      },
      {
        number: 8,
        name: "ルミエールパルス",
        odds: 12.4,
        predictions: {
          "SPAIA": { mark: "▲", index: 77 },
          "netkeiba AI": { mark: "◎", index: 89 },
          "AI指数": { mark: "△", index: 69 },
          "競馬ラボ": { mark: "○", index: 81 },
          "無料競馬AI": { mark: "△", index: 70 },
          "Uma Cloud": { mark: "▲", index: 76 }
        }
      },
      {
        number: 11,
        name: "ナリタサージュ",
        odds: 5.6,
        predictions: {
          "SPAIA": { mark: "△", index: 70 },
          "netkeiba AI": { mark: "△", index: 71 },
          "AI指数": { mark: "▲", index: 77 },
          "競馬ラボ": { mark: "△", index: 68 },
          "無料競馬AI": { mark: "◎", index: 88 },
          "Uma Cloud": { mark: "△", index: 69 }
        }
      }
    ]
  },
  {
    id: "hakodate-12",
    venue: "hakodate",
    venueName: "函館",
    number: "12R",
    name: "湯川温泉特別",
    date: "2026-06-20",
    startAt: "16:05",
    updatedAt: "15:55:14",
    missingSites: ["netkeiba AI", "競馬ラボ"],
    horses: [
      {
        number: 3,
        name: "ノースグリッター",
        odds: 7.1,
        predictions: {
          "SPAIA": { mark: "○", index: 82 },
          "AI指数": { mark: "◎", index: 90 },
          "無料競馬AI": { mark: "▲", index: 78 },
          "Uma Cloud": { mark: "○", index: 83 }
        }
      },
      {
        number: 6,
        name: "ハコダテブリーズ",
        odds: 4.4,
        predictions: {
          "SPAIA": { mark: "◎", index: 88 },
          "AI指数": { mark: "○", index: 82 },
          "無料競馬AI": { mark: "◎", index: 87 },
          "Uma Cloud": { mark: "▲", index: 77 }
        }
      },
      {
        number: 10,
        name: "シーサイドリズム",
        odds: 15.8,
        predictions: {
          "SPAIA": { mark: "▲", index: 74 },
          "AI指数": { mark: "△", index: 68 },
          "無料競馬AI": { mark: "○", index: 82 },
          "Uma Cloud": { mark: "◎", index: 86 }
        }
      },
      {
        number: 13,
        name: "クラウンセレーネ",
        odds: 3.5,
        predictions: {
          "SPAIA": { mark: "△", index: 70 },
          "AI指数": { mark: "▲", index: 75 },
          "無料競馬AI": { mark: "△", index: 69 },
          "Uma Cloud": { mark: "△", index: 67 }
        }
      }
    ]
  },
  {
    id: "sapporo-11",
    venue: "sapporo",
    venueName: "札幌",
    number: "11R",
    name: "大通公園ステークス",
    date: "2026-06-20",
    startAt: "15:25",
    updatedAt: "15:15:12",
    missingSites: ["Prediction One"],
    horses: [
      { number: 1, name: "ポラリスグレイス", odds: 4.2, predictions: {} },
      { number: 5, name: "エルムクラウン", odds: 6.8, predictions: {} },
      { number: 8, name: "ライラックノース", odds: 9.7, predictions: {} },
      { number: 12, name: "サッポロブレイズ", odds: 13.4, predictions: {} }
    ]
  },
  {
    id: "nakayama-11",
    venue: "nakayama",
    venueName: "中山",
    number: "11R",
    name: "船橋ステークス",
    date: "2026-06-20",
    startAt: "15:40",
    updatedAt: "15:30:22",
    missingSites: [],
    horses: [
      { number: 2, name: "マツリダセレーノ", odds: 3.6, predictions: {} },
      { number: 6, name: "ナカヤマルーチェ", odds: 7.4, predictions: {} },
      { number: 10, name: "ベイサイドコール", odds: 11.9, predictions: {} },
      { number: 14, name: "スプリングヴェロス", odds: 5.2, predictions: {} }
    ]
  },
  {
    id: "chukyo-10",
    venue: "chukyo",
    venueName: "中京",
    number: "10R",
    name: "熱田特別",
    date: "2026-06-20",
    startAt: "15:00",
    updatedAt: "14:50:31",
    missingSites: ["Race AI"],
    horses: [
      { number: 3, name: "ミッドランドアロー", odds: 5.5, predictions: {} },
      { number: 7, name: "キンシャチライン", odds: 8.2, predictions: {} },
      { number: 9, name: "トヨアケパルス", odds: 4.1, predictions: {} },
      { number: 13, name: "オワリノヒカリ", odds: 16.8, predictions: {} }
    ]
  },
  {
    id: "hanshin-11",
    venue: "hanshin",
    venueName: "阪神",
    number: "11R",
    name: "六甲ステークス",
    date: "2026-06-20",
    startAt: "15:35",
    updatedAt: "15:25:44",
    missingSites: ["Deep Keiba"],
    horses: [
      { number: 1, name: "ナニワサンダー", odds: 6.1, predictions: {} },
      { number: 4, name: "ロッコウミラージュ", odds: 3.4, predictions: {} },
      { number: 11, name: "コウベスプラッシュ", odds: 10.5, predictions: {} },
      { number: 15, name: "アマガサキスター", odds: 18.2, predictions: {} }
    ]
  },
  {
    id: "kokura-12",
    venue: "kokura",
    venueName: "小倉",
    number: "12R",
    name: "企救丘特別",
    date: "2026-06-20",
    startAt: "16:10",
    updatedAt: "16:00:17",
    missingSites: ["競馬ラボ"],
    horses: [
      { number: 2, name: "メイショウアサギリ", odds: 4.7, predictions: {} },
      { number: 6, name: "コクラノカゼ", odds: 9.3, predictions: {} },
      { number: 9, name: "ムラサキリバー", odds: 12.1, predictions: {} },
      { number: 16, name: "ホウワグランツ", odds: 5.8, predictions: {} }
    ]
  },
  {
    id: "fukushima-11",
    venue: "fukushima",
    venueName: "福島",
    number: "11R",
    name: "吾妻小富士ステークス",
    date: "2026-06-20",
    startAt: "15:20",
    updatedAt: "15:10:02",
    missingSites: ["Uma Cloud"],
    horses: [
      { number: 3, name: "アヅマノハヤテ", odds: 7.9, predictions: {} },
      { number: 5, name: "フクシマエール", odds: 4.5, predictions: {} },
      { number: 8, name: "ミチノククラウン", odds: 14.6, predictions: {} },
      { number: 12, name: "バンダイサンライズ", odds: 6.6, predictions: {} }
    ]
  },
  {
    id: "niigata-11",
    venue: "niigata",
    venueName: "新潟",
    number: "11R",
    name: "越後ステークス",
    date: "2026-06-20",
    startAt: "15:30",
    updatedAt: "15:20:39",
    missingSites: ["netkeiba AI"],
    horses: [
      { number: 1, name: "エチゴブリーズ", odds: 5.9, predictions: {} },
      { number: 4, name: "ササガワミスト", odds: 8.8, predictions: {} },
      { number: 7, name: "ニイガタノユメ", odds: 3.9, predictions: {} },
      { number: 13, name: "トキメキロード", odds: 17.5, predictions: {} }
    ]
  }
];

const state = {
  selectedRaceId: races.some((race) => race.id === INITIAL_RACE_ID) ? INITIAL_RACE_ID : races[0].id,
  selectedHorseName: INITIAL_HORSE_NAME,
  venue: "all",
  query: "",
  sort: "support",
  weights: loadWeights(),
  autoUpdatedRaceIds: new Set()
};

const elements = {
  raceSearch: document.querySelector("#raceSearch"),
  raceList: document.querySelector("#raceList"),
  raceTitle: document.querySelector("#raceTitle"),
  updatedAt: document.querySelector("#updatedAt"),
  siteCount: document.querySelector("#siteCount"),
  operationStatus: document.querySelector("#operationStatus"),
  operationWindow: document.querySelector("#operationWindow"),
  missingSites: document.querySelector("#missingSites"),
  averageSupport: document.querySelector("#averageSupport"),
  rankingRows: document.querySelector("#rankingRows"),
  recommendationGroups: document.querySelector("#recommendationGroups"),
  sortSelect: document.querySelector("#sortSelect"),
  horseName: document.querySelector("#horseName"),
  horseNumber: document.querySelector("#horseNumber"),
  horseSummary: document.querySelector("#horseSummary"),
  siteVotes: document.querySelector("#siteVotes"),
  sitePageLink: document.querySelector("#sitePageLink"),
  siteDetailLink: document.querySelector("#siteDetailLink"),
  siteRaceSelect: document.querySelector("#siteRaceSelect"),
  siteHorseSelect: document.querySelector("#siteHorseSelect"),
  siteDetailMeta: document.querySelector("#siteDetailMeta"),
  siteDetailList: document.querySelector("#siteDetailList"),
  siteBackLink: document.querySelector("#siteBackLink"),
  refreshButton: document.querySelector("#refreshButton")
};

function loadWeights() {
  if (window.ConsensusAutoWeights) {
    return window.ConsensusAutoWeights.loadWeights();
  }

  try {
    const saved = JSON.parse(localStorage.getItem("consensusWeights") || "{}");
    return { ...DEFAULT_WEIGHTS, ...saved };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

function getRace() {
  const todaysRaces = getTodaysRaces();
  return todaysRaces.find((race) => race.id === state.selectedRaceId) || todaysRaces[0] || null;
}

function buildStateHref(pageName) {
  const params = new URLSearchParams();
  params.set("race", state.selectedRaceId);

  if (state.selectedHorseName) {
    params.set("horse", state.selectedHorseName);
  }

  if (DEMO_TIME) {
    params.set("demoTime", DEMO_TIME);
  }

  return `./${pageName}?${params.toString()}`;
}

function syncSitesPageUrl() {
  if (!elements.siteDetailList || !window.history?.replaceState) {
    return;
  }

  window.history.replaceState(null, "", buildStateHref("sites.html"));
}

function getNow() {
  if (!DEMO_TIME) {
    return new Date();
  }

  const normalizedDemoTime = DEMO_TIME.trim().replace(/ (\d{2}:\d{2})$/, "+$1");
  const demoDate = new Date(normalizedDemoTime);
  return Number.isNaN(demoDate.getTime()) ? new Date() : demoDate;
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return formatDateKey(getNow());
}

function getTodaysRaces() {
  const todayKey = getTodayKey();
  return races.filter((race) => race.date === todayKey);
}

function getRaceStartDate(race) {
  if (!race?.date || !race?.startAt) {
    return null;
  }

  const start = new Date(`${race.date}T${race.startAt}:00+09:00`);
  return Number.isNaN(start.getTime()) ? null : start;
}

function getRaceUpdateStatus(race, now = getNow()) {
  const operation = getOperatingStatus(now);
  const start = getRaceStartDate(race);

  if (!race || !start) {
    return {
      ready: false,
      label: "待機中",
      detail: "発走10分前から取得"
    };
  }

  if (!operation.active) {
    return {
      ready: false,
      label: "停止中",
      detail: operation.detail
    };
  }

  const minutesUntilStart = Math.ceil((start.getTime() - now.getTime()) / 60000);
  if (minutesUntilStart > UPDATE_LEAD_MINUTES) {
    return {
      ready: false,
      label: "待機中",
      detail: `${race.startAt}の10分前から取得`
    };
  }

  if (minutesUntilStart < 0) {
    return {
      ready: false,
      label: "発走後",
      detail: "取得時間を過ぎました"
    };
  }

  return {
    ready: true,
    label: "取得可",
    detail: `発走${minutesUntilStart}分前`
  };
}

function runTenMinuteAutoUpdates(now = getNow()) {
  getTodaysRaces().forEach((race) => {
    const updateStatus = getRaceUpdateStatus(race, now);
    if (!updateStatus.ready || state.autoUpdatedRaceIds.has(race.id)) {
      return;
    }

    race.updatedAt = now.toLocaleTimeString("ja-JP", { hour12: false });
    state.autoUpdatedRaceIds.add(race.id);
  });
}

function getMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function isOperatingDay(date) {
  return OPERATING_DAYS.includes(date.getDay());
}

function isOperatingNow(date = new Date()) {
  const minutes = getMinutes(date);
  return isOperatingDay(date) && minutes >= OPERATING_START_MINUTES && minutes < OPERATING_END_MINUTES;
}

function getNextOperatingStart(from = new Date()) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const candidate = new Date(from);
    candidate.setDate(from.getDate() + offset);
    candidate.setHours(9, 0, 0, 0);

    if (isOperatingDay(candidate) && candidate > from) {
      return candidate;
    }
  }

  return from;
}

function formatOperatingDate(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const week = DAY_LABELS[date.getDay()];
  const time = date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${month}/${day}(${week}) ${time}`;
}

function getOperatingStatus(now = getNow()) {
  const active = isOperatingNow(now);
  const nextStart = active ? null : getNextOperatingStart(now);
  return {
    active,
    label: active ? "稼働中" : "停止中",
    detail: active ? "17:00まで取得可" : `次回 ${formatOperatingDate(nextStart)}`
  };
}

function buildFallbackPrediction(site, horse, race) {
  const siteIndex = Object.keys(DEFAULT_WEIGHTS).indexOf(site);
  const seed = horse.number * 11 + siteIndex * 7 + race.id.length;
  const mark = MARK_SEQUENCE[seed % MARK_SEQUENCE.length];
  const baseScore = MARK_SCORES[mark] || 50;
  const index = Math.max(55, Math.min(96, baseScore - 6 + (seed % 15)));

  return { mark, index };
}

function getPredictionsForHorse(race, horse) {
  return Object.keys(DEFAULT_WEIGHTS).reduce((predictions, site) => {
    if (!race.missingSites.includes(site)) {
      predictions[site] = horse.predictions[site] || buildFallbackPrediction(site, horse, race);
    }

    return predictions;
  }, {});
}

function calculateRanking(race) {
  const oddsRanks = [...race.horses]
    .sort((a, b) => a.odds - b.odds)
    .reduce((map, horse, index) => {
      map[horse.name] = index + 1;
      return map;
    }, {});

  const rows = race.horses.map((horse) => {
    const predictions = getPredictionsForHorse(race, horse);
    const entries = Object.entries(predictions);
    const totalWeight = entries.reduce((sum, [site]) => sum + (state.weights[site] || 1), 0);
    const weightedScore = entries.reduce((sum, [site, prediction]) => {
      const markScore = MARK_SCORES[prediction.mark] || 0;
      const indexScore = Number(prediction.index || 0);
      const combined = markScore * 0.7 + indexScore * 0.3;
      return sum + combined * (state.weights[site] || 1);
    }, 0);
    const support = totalWeight ? weightedScore / totalWeight : 0;
    const favorites = entries.filter(([, prediction]) => prediction.mark === "◎").length;

    return {
      ...horse,
      predictions,
      support,
      favorites,
      oddsRank: oddsRanks[horse.name],
      voteCount: entries.length
    };
  });

  const ranked = rows.sort((a, b) => b.support - a.support);
  ranked.forEach((horse, index) => {
    horse.aiRank = index + 1;
    horse.gap = horse.oddsRank - horse.aiRank;
  });

  if (state.sort === "odds") {
    ranked.sort((a, b) => a.odds - b.odds);
  }

  if (state.sort === "gap") {
    ranked.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
  }

  return ranked;
}

function combine(items, size) {
  const results = [];

  function walk(start, selected) {
    if (selected.length === size) {
      results.push(selected);
      return;
    }

    for (let index = start; index < items.length; index += 1) {
      walk(index + 1, [...selected, items[index]]);
    }
  }

  walk(0, []);
  return results;
}

function permutations(items, size) {
  if (size === 1) {
    return items.map((item) => [item]);
  }

  return items.flatMap((item, index) => {
    const rest = items.filter((_, restIndex) => restIndex !== index);
    return permutations(rest, size - 1).map((combo) => [item, ...combo]);
  });
}

function estimateTicketOdds(horses, type) {
  const product = horses.reduce((total, horse) => total * horse.odds, 1);
  const divisor = {
    umaren: 2.4,
    umatan: 1.55,
    sanrenpuku: 8.5,
    sanrentan: 2.4
  }[type] || 2;

  return Math.max(1.1, Math.min(999.9, product / divisor));
}

function scoreTicket(horses, type) {
  const positionWeights = type === "umaren" || type === "sanrenpuku" ? [1, 1, 1] : [1, 0.86, 0.72];
  const weightedSupport = horses.reduce((total, horse, index) => total + horse.support * positionWeights[index], 0);
  const supportBase = weightedSupport / horses.reduce((total, _, index) => total + positionWeights[index], 0);
  const estimatedOdds = estimateTicketOdds(horses, type);
  const valueBoost = Math.log10(estimatedOdds + 1) * 7;

  return supportBase + valueBoost;
}

function formatTicket(horses, separator) {
  return horses.map((horse) => horse.number).join(separator);
}

function formatTicketNames(horses) {
  return horses.map((horse) => horse.name).join(" / ");
}

function buildTicketRecommendations(ranking) {
  const supportOrder = [...ranking].sort((a, b) => b.support - a.support);
  const topHorses = supportOrder.slice(0, 6);
  const ticketTypes = [
    { id: "umaren", label: "馬複", separator: "-", source: combine(topHorses, 2) },
    { id: "umatan", label: "馬単", separator: "→", source: permutations(topHorses.slice(0, 5), 2) },
    { id: "sanrenpuku", label: "三連複", separator: "-", source: combine(topHorses, 3) },
    { id: "sanrentan", label: "三連単", separator: "→", source: permutations(topHorses.slice(0, 5), 3) }
  ];

  return ticketTypes.map((type) => ({
    ...type,
    tickets: type.source
      .map((horses) => ({
        horses,
        numbers: formatTicket(horses, type.separator),
        names: formatTicketNames(horses),
        estimatedOdds: estimateTicketOdds(horses, type.id),
        score: scoreTicket(horses, type.id)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }));
}

function renderRaceList() {
  if (!elements.raceList) {
    return;
  }

  const query = state.query.trim().toLowerCase();
  const filtered = getTodaysRaces().filter((race) => {
    const matchesVenue = state.venue === "all" || race.venue === state.venue;
    const matchesQuery = `${race.venueName} ${race.number} ${race.name}`.toLowerCase().includes(query);
    return matchesVenue && matchesQuery;
  });

  if (!filtered.length) {
    elements.raceList.innerHTML = `
      <div class="empty-state race-empty">
        <strong>本日のJRA開催はありません</strong>
        <span>開催日のレースだけ表示します</span>
      </div>
    `;
    return;
  }

  elements.raceList.innerHTML = filtered.map((race) => `
    <button class="race-card ${race.id === state.selectedRaceId ? "active" : ""}" data-race-id="${race.id}" type="button">
      <span>
        <strong>${race.venueName} ${race.number}</strong>
        <span>${race.name}</span>
      </span>
      <span class="countdown">${race.startAt}</span>
    </button>
  `).join("");

  elements.raceList.querySelectorAll(".race-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRaceId = button.dataset.raceId;
      state.selectedHorseName = "";
      render();
    });
  });
}

function renderStatus(race, ranking) {
  if (!elements.raceTitle || !elements.updatedAt || !elements.operationStatus || !elements.operationWindow || !elements.siteCount || !elements.missingSites || !elements.averageSupport) {
    return;
  }

  const siteNames = Object.keys(DEFAULT_WEIGHTS);
  const acquired = siteNames.length - race.missingSites.length;
  const average = ranking.reduce((sum, horse) => sum + horse.support, 0) / ranking.length;
  const updateStatus = getRaceUpdateStatus(race);
  const operationMetric = elements.operationStatus.closest(".metric");

  elements.raceTitle.textContent = `${race.venueName} ${race.number} ${race.name}`;
  elements.updatedAt.textContent = updateStatus.label === "待機中" ? "未取得" : race.updatedAt;
  elements.operationStatus.textContent = updateStatus.label;
  elements.operationWindow.textContent = updateStatus.detail;
  elements.siteCount.textContent = `${acquired}/${siteNames.length}`;
  elements.missingSites.textContent = race.missingSites.length ? race.missingSites.join(" / ") : "なし";
  elements.averageSupport.textContent = `${average.toFixed(1)}%`;
  if (elements.refreshButton) {
    elements.refreshButton.disabled = !updateStatus.ready;
    elements.refreshButton.title = updateStatus.ready ? "10分前データを取得" : updateStatus.detail;
  }

  if (operationMetric) {
    operationMetric.classList.toggle("is-active", updateStatus.ready);
    operationMetric.classList.toggle("is-paused", !updateStatus.ready);
  }
}

function renderNoRaceState() {
  renderRaceList();

  if (elements.raceTitle) {
    elements.raceTitle.textContent = "本日のJRA開催はありません";
  }

  if (elements.updatedAt) elements.updatedAt.textContent = "--:--:--";
  if (elements.operationStatus) elements.operationStatus.textContent = "停止中";
  if (elements.operationWindow) elements.operationWindow.textContent = "開催日のみ表示";
  if (elements.siteCount) elements.siteCount.textContent = "0/10";
  if (elements.missingSites) elements.missingSites.textContent = "なし";
  if (elements.averageSupport) elements.averageSupport.textContent = "0.0%";
  if (elements.rankingRows) elements.rankingRows.innerHTML = "";
  if (elements.recommendationGroups) elements.recommendationGroups.innerHTML = "";
  if (elements.horseName) elements.horseName.textContent = "レースなし";
  if (elements.horseNumber) elements.horseNumber.textContent = "--";
  if (elements.horseSummary) {
    elements.horseSummary.innerHTML = `
      <div><span>対象日</span><strong>${getTodayKey()}</strong></div>
      <div><span>開催</span><strong>0場</strong></div>
      <div><span>表示</span><strong>当日のみ</strong></div>
    `;
  }
  if (elements.siteVotes) elements.siteVotes.innerHTML = "";
  if (elements.siteDetailMeta) elements.siteDetailMeta.innerHTML = "";
  if (elements.siteDetailList) elements.siteDetailList.innerHTML = "";
  if (elements.siteRaceSelect) elements.siteRaceSelect.innerHTML = "";
  if (elements.siteHorseSelect) elements.siteHorseSelect.innerHTML = "";
  if (elements.refreshButton) {
    elements.refreshButton.disabled = true;
    elements.refreshButton.title = "本日のJRA開催はありません";
  }
}

function renderRanking(ranking) {
  if (!elements.rankingRows) {
    return;
  }

  elements.rankingRows.innerHTML = ranking.map((horse) => {
    const gapClass = horse.gap > 0 ? "positive" : horse.gap < 0 ? "negative" : "neutral";
    const gapText = horse.gap > 0 ? `AI +${horse.gap}` : horse.gap < 0 ? `人気 +${Math.abs(horse.gap)}` : "一致";
    return `
      <tr>
        <td>${horse.aiRank}</td>
        <td><button class="horse-cell" data-horse-name="${horse.name}" type="button">${horse.number}. ${horse.name}</button></td>
        <td>
          <div class="support-bar">
            <span class="bar-track"><span class="bar-fill" style="width: ${Math.max(4, horse.support)}%"></span></span>
            <strong>${horse.support.toFixed(1)}%</strong>
          </div>
        </td>
        <td>${horse.favorites}</td>
        <td>${horse.odds.toFixed(1)}倍</td>
        <td><span class="gap-pill ${gapClass}">${gapText}</span></td>
      </tr>
    `;
  }).join("");

  elements.rankingRows.querySelectorAll(".horse-cell").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedHorseName = button.dataset.horseName;
      render();
    });
  });
}

function renderHorseDetail(ranking) {
  const selected = ranking.find((horse) => horse.name === state.selectedHorseName) || ranking[0];
  state.selectedHorseName = selected.name;

  [elements.sitePageLink, elements.siteDetailLink].forEach((link) => {
    if (link) {
      link.href = buildStateHref("sites.html");
    }
  });

  if (!elements.horseName || !elements.horseNumber || !elements.horseSummary) {
    return;
  }

  elements.horseName.textContent = selected.name;
  elements.horseNumber.textContent = `${selected.number}番`;
  elements.horseSummary.innerHTML = `
    <div><span>AI支持率</span><strong>${selected.support.toFixed(1)}%</strong></div>
    <div><span>本命数</span><strong>${selected.favorites}</strong></div>
    <div><span>オッズ</span><strong>${selected.odds.toFixed(1)}倍</strong></div>
  `;

  if (elements.siteVotes) {
    elements.siteVotes.innerHTML = Object.entries(selected.predictions).map(([site, prediction]) => `
      <div class="vote-row">
        <div>
          <strong>${site}</strong>
          <span>重み ${Number(state.weights[site] || 1).toFixed(2)}</span>
        </div>
        <span class="mark-badge">${prediction.mark}</span>
        <strong>${prediction.index}</strong>
      </div>
    `).join("");
  }
}

function renderRecommendations(ranking) {
  if (!elements.recommendationGroups) {
    return;
  }

  const groups = buildTicketRecommendations(ranking);
  elements.recommendationGroups.innerHTML = groups.map((group) => `
    <section class="recommendation-card">
      <h4>${group.label}</h4>
      <div class="ticket-list">
        ${group.tickets.map((ticket, index) => `
          <div class="ticket-row">
            <span class="ticket-rank">${index + 1}</span>
            <div class="ticket-main">
              <strong>${ticket.numbers}</strong>
              <small>${ticket.names}</small>
            </div>
            <div class="ticket-meta">
              <strong>${ticket.estimatedOdds.toFixed(1)}倍</strong>
              <small>AI ${ticket.score.toFixed(0)}</small>
            </div>
          </div>
        `).join("")}
      </div>
    </section>
  `).join("");
}

function renderSiteDetailPage(race, ranking) {
  if (!elements.siteDetailList) {
    return;
  }

  const selected = ranking.find((horse) => horse.name === state.selectedHorseName) || ranking[0];
  state.selectedHorseName = selected.name;

  if (elements.siteRaceSelect) {
    elements.siteRaceSelect.innerHTML = getTodaysRaces().map((raceOption) => `
      <option value="${raceOption.id}">${raceOption.venueName} ${raceOption.number} ${raceOption.name}</option>
    `).join("");
    elements.siteRaceSelect.value = state.selectedRaceId;
  }

  if (elements.siteHorseSelect) {
    elements.siteHorseSelect.innerHTML = ranking.map((horse) => `
      <option value="${horse.name}">${horse.number}. ${horse.name}</option>
    `).join("");
    elements.siteHorseSelect.value = selected.name;
  }

  if (elements.siteDetailMeta) {
    elements.siteDetailMeta.innerHTML = `
      <div><span>レース</span><strong>${race.venueName} ${race.number}</strong></div>
      <div><span>AI支持率</span><strong>${selected.support.toFixed(1)}%</strong></div>
      <div><span>オッズ</span><strong>${selected.odds.toFixed(1)}倍</strong></div>
    `;
  }

  elements.siteDetailList.innerHTML = Object.entries(selected.predictions).map(([site, prediction]) => `
    <div class="vote-row">
      <div>
        <strong>${site}</strong>
        <span>重み ${Number(state.weights[site] || 1).toFixed(2)}</span>
      </div>
      <span class="mark-badge">${prediction.mark}</span>
      <strong>${prediction.index}</strong>
    </div>
  `).join("");

  if (elements.siteBackLink) {
    elements.siteBackLink.href = buildStateHref("phone.html");
  }

  syncSitesPageUrl();
}

function render() {
  runTenMinuteAutoUpdates();
  const race = getRace();
  if (!race) {
    renderNoRaceState();
    return;
  }

  if (state.selectedRaceId !== race.id) {
    state.selectedRaceId = race.id;
    state.selectedHorseName = "";
  }

  const ranking = calculateRanking(race);
  renderRaceList();
  renderStatus(race, ranking);
  renderRanking(ranking);
  renderHorseDetail(ranking);
  renderRecommendations(ranking);
  renderSiteDetailPage(race, ranking);
}

document.querySelectorAll(".venue-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".venue-tabs button").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    state.venue = button.dataset.venue;
    renderRaceList();
  });
});

if (elements.raceSearch) {
  elements.raceSearch.addEventListener("input", () => {
    state.query = elements.raceSearch.value;
    renderRaceList();
  });
}

if (elements.sortSelect) {
  elements.sortSelect.addEventListener("change", () => {
    state.sort = elements.sortSelect.value;
    render();
  });
}

if (elements.siteRaceSelect) {
  elements.siteRaceSelect.addEventListener("change", () => {
    state.selectedRaceId = elements.siteRaceSelect.value;
    state.selectedHorseName = "";
    render();
  });
}

if (elements.siteHorseSelect) {
  elements.siteHorseSelect.addEventListener("change", () => {
    state.selectedHorseName = elements.siteHorseSelect.value;
    render();
  });
}

if (elements.refreshButton) {
  elements.refreshButton.addEventListener("click", () => {
    const race = getRace();
    if (!getRaceUpdateStatus(race).ready) {
      render();
      return;
    }

    const now = getNow();
    race.updatedAt = now.toLocaleTimeString("ja-JP", { hour12: false });
    render();
  });
}

render();
async function hydrateAutoWeights() {
  if (!window.ConsensusAutoWeights) {
    return;
  }

  const result = await window.ConsensusAutoWeights.applyLatest();
  state.weights = { ...DEFAULT_WEIGHTS, ...result.weights };
  render();
}

hydrateAutoWeights();
setInterval(render, 60 * 1000);
