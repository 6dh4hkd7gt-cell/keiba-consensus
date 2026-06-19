const MARK_SCORES = {
  "◎": 100,
  "○": 80,
  "▲": 65,
  "△": 45,
  "☆": 35
};

const MARK_SEQUENCE = ["◎", "○", "▲", "△", "☆"];
const OPERATING_DAYS = [0, 1, 2, 3, 4, 5, 6];
const OPERATING_START_MINUTES = 10 * 60;
const OPERATING_END_MINUTES = 21 * 60;
const DAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const urlParams = new URLSearchParams(window.location.search);
const DEMO_TIME = urlParams.get("demoTime");
const INITIAL_RACE_ID = urlParams.get("race");
const INITIAL_HORSE_NAME = urlParams.get("horse") || "";
const PUBLIC_DATA_BASE = "https://6dh4hkd7gt-cell.github.io/keiba-consensus/chihou";
const MIN_CONSENSUS_SITES = 5;

const DEFAULT_WEIGHTS = {
  "楽天みんなの予想": 1,
  "netkeiba地方": 1,
  "オッズパーク": 1,
  "SPAT4": 1,
  "競馬ブック地方": 1,
  "競馬エース": 1,
  "勝馬": 1,
  "ケイシュウNEWS": 1,
  "通信社": 1,
  "競馬カナザワ": 1
};

const SOURCE_AUDIT = {
  "楽天みんなの予想": {
    status: "public",
    note: "公開投票の◎○▲△数を取得"
  },
  "netkeiba地方": {
    status: "blocked",
    note: "予想ページが取得不可"
  },
  "オッズパーク": {
    status: "blocked",
    note: "ログイン画面で停止"
  },
  "SPAT4": {
    status: "blocked",
    note: "ログイン系サービス"
  },
  "競馬ブック地方": {
    status: "blocked",
    note: "会員・有料新聞系"
  },
  "競馬エース": {
    status: "blocked",
    note: "有料新聞系"
  },
  "勝馬": {
    status: "blocked",
    note: "有料新聞系"
  },
  "ケイシュウNEWS": {
    status: "blocked",
    note: "有料新聞系"
  },
  "通信社": {
    status: "pending",
    note: "公開予想URL未確認"
  },
  "競馬カナザワ": {
    status: "pending",
    note: "公開予想URL未確認"
  }
};

const VENUES = {
  obihiro: { venueName: "帯広" },
  monbetsu: { venueName: "門別" },
  morioka: { venueName: "盛岡" },
  mizusawa: { venueName: "水沢" },
  urawa: { venueName: "浦和" },
  funabashi: { venueName: "船橋" },
  ooi: { venueName: "大井" },
  kawasaki: { venueName: "川崎" },
  kanazawa: { venueName: "金沢" },
  kasamatsu: { venueName: "笠松" },
  nagoya: { venueName: "名古屋" },
  sonoda: { venueName: "園田" },
  himeji: { venueName: "姫路" },
  kochi: { venueName: "高知" },
  saga: { venueName: "佐賀" }
};

const HORSE_NUMBERS = [1, 3, 6, 9, 12];

const FALLBACK_RACE_SCHEDULE_BY_DATE = {
  "2026-06-19": {
    kawasaki: ["15:00", "15:30", "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:05", "19:40", "20:15", "20:50"],
    nagoya: ["12:15", "12:50", "13:25", "14:00", "14:35", "15:10", "15:40", "16:10", "16:45", "17:15", "17:45", "18:20"],
    sonoda: ["14:20", "14:50", "15:20", "15:50", "16:25", "17:00", "17:35", "18:10", "18:45", "19:20", "19:55", "20:30"]
  }
};

function subtractMinutes(time, minutesToSubtract) {
  const [hours, minutes] = time.split(":").map(Number);
  const date = new Date(2026, 0, 1, hours, minutes - minutesToSubtract, 0);
  return date.toLocaleTimeString("ja-JP", { hour12: false });
}

function buildRaceFromSchedule(date, venue, startAt, raceIndex, raceData = {}) {
  const venueInfo = VENUES[venue];
  const number = `${raceIndex + 1}R`;
  const officialHorses = Array.isArray(raceData.horses) ? raceData.horses : [];
  const horses = officialHorses.length
    ? officialHorses.map((horse, horseIndex) => ({
        number: Number(horse.number) || horseIndex + 1,
        name: horse.name,
        odds: Number(horse.odds) || 99.9,
        predictions: horse.predictions || {}
      }))
    : HORSE_NUMBERS.map((numberValue) => ({
        number: numberValue,
        name: `${numberValue}番 公式出馬表未取得`,
        odds: 99.9,
        predictions: {}
      }));

  return {
    id: `${date}-${venue}-${number.toLowerCase()}`,
    venue,
    venueName: venueInfo.venueName,
    number,
    name: `${venueInfo.venueName}第${raceIndex + 1}競走`,
    date,
    startAt,
    updatedAt: subtractMinutes(startAt, 10),
    missingSites: Array.isArray(raceData.missingSites) ? raceData.missingSites : Object.keys(DEFAULT_WEIGHTS),
    horses
  };
}

function buildRacesFromSchedule(scheduleByDate) {
  return Object.entries(scheduleByDate).flatMap(([date, venueSchedules]) => (
    Object.entries(venueSchedules).flatMap(([venue, startTimes]) => {
      if (!VENUES[venue]) {
        return [];
      }

      return startTimes.map((startAt, raceIndex) => buildRaceFromSchedule(date, venue, startAt, raceIndex));
    })
  ));
}

let races = buildRacesFromSchedule(FALLBACK_RACE_SCHEDULE_BY_DATE);

const todaysInitialRaces = getTodaysRaces();

const state = {
  selectedRaceId: todaysInitialRaces.some((race) => race.id === INITIAL_RACE_ID) ? INITIAL_RACE_ID : todaysInitialRaces[0]?.id,
  selectedHorseName: INITIAL_HORSE_NAME,
  venue: "all",
  query: "",
  sort: "support",
  weights: loadWeights()
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
  sourceAudit: document.querySelector("#sourceAudit"),
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

async function loadDailyRaceSchedule() {
  const dataBase = window.location.protocol === "file:" ? PUBLIC_DATA_BASE : ".";
  const dataUrl = `${dataBase}/data/today-races.json?date=${encodeURIComponent(getTodayKey())}&v=${Date.now()}`;
  const response = await fetch(dataUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`schedule fetch failed: ${response.status}`);
  }

  const payload = await response.json();
  if (!payload || payload.date !== getTodayKey() || !Array.isArray(payload.races)) {
    throw new Error("schedule payload is not for today");
  }

  return payload.races
    .filter((race) => race && VENUES[race.venue] && /^\d{1,2}:\d{2}$/.test(race.startAt || ""))
    .map((race, index) => {
      const raceNumber = Number(race.number) || index + 1;
      return buildRaceFromSchedule(payload.date, race.venue, race.startAt, raceNumber - 1, race);
    });
}

function getMinutes(date) {
  return date.getHours() * 60 + date.getMinutes();
}

function getRaceStartMinutes(race) {
  const [hours, minutes] = race.startAt.split(":").map(Number);
  return hours * 60 + minutes;
}

function getNextRaceIdsByVenue() {
  const nowMinutes = getMinutes(getNow());
  const nextByVenue = getTodaysRaces().reduce((map, race) => {
    const startMinutes = getRaceStartMinutes(race);
    if (startMinutes < nowMinutes) {
      return map;
    }

    const current = map.get(race.venue);
    if (!current || startMinutes < getRaceStartMinutes(current)) {
      map.set(race.venue, race);
    }

    return map;
  }, new Map());

  return new Set([...nextByVenue.values()].map((race) => race.id));
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
    candidate.setHours(10, 0, 0, 0);

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
    detail: active ? "21:00まで取得可" : `次回 ${formatOperatingDate(nextStart)}`
  };
}

function getPredictionsForHorse(race, horse) {
  return Object.keys(DEFAULT_WEIGHTS).reduce((predictions, site) => {
    if (!race.missingSites.includes(site) && horse.predictions?.[site]) {
      predictions[site] = horse.predictions[site];
    }

    return predictions;
  }, {});
}

function getAcquiredSites(ranking) {
  return new Set(ranking.flatMap((horse) => Object.keys(horse.predictions || {})));
}

function getPredictionCount(prediction) {
  if (!prediction?.raw || typeof prediction.raw !== "object") {
    return 0;
  }

  return Object.values(prediction.raw).reduce((total, value) => total + Number(value || 0), 0);
}

function getPredictionIndexScore(prediction) {
  const markScore = MARK_SCORES[prediction.mark] || 0;
  const indexScore = Number(prediction.index || 0) || markScore;
  const rawCount = getPredictionCount(prediction);

  if (!rawCount) {
    return markScore * 0.7 + indexScore * 0.3;
  }

  const confidence = Math.min(1, rawCount / 20);
  const confidenceAdjustedIndex = 45 + (indexScore - 45) * confidence;
  const confidenceAdjustedMark = 45 + (markScore - 45) * confidence;
  return confidenceAdjustedMark * 0.4 + confidenceAdjustedIndex * 0.6;
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
      const combined = getPredictionIndexScore(prediction);
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
  return weightedSupport / horses.reduce((total, _, index) => total + positionWeights[index], 0);
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
  const nextRaceIds = getNextRaceIdsByVenue();
  const filtered = getTodaysRaces().filter((race) => {
    const matchesVenue = state.venue === "all" || race.venue === state.venue;
    const matchesQuery = `${race.venueName} ${race.number} ${race.name}`.toLowerCase().includes(query);
    return matchesVenue && matchesQuery;
  });

  if (!filtered.length) {
    elements.raceList.innerHTML = `
      <div class="empty-state race-empty">
        <strong>本日の地方競馬開催はありません</strong>
        <span>開催日のレースだけ表示します</span>
      </div>
    `;
    return;
  }

  const grouped = filtered.reduce((groups, race) => {
    if (!groups[race.venue]) {
      groups[race.venue] = {
        venueName: race.venueName,
        races: []
      };
    }

    groups[race.venue].races.push(race);
    return groups;
  }, {});

  elements.raceList.innerHTML = Object.values(grouped).map((group) => `
    <section class="race-group">
      <div class="race-group-heading">
        <strong>${group.venueName}</strong>
        <span>${group.races.length}レース</span>
      </div>
      <div class="race-chip-grid">
        ${group.races.map((race) => {
          const isNextRace = nextRaceIds.has(race.id);
          return `
          <button class="race-card race-chip ${race.id === state.selectedRaceId ? "active" : ""} ${isNextRace ? "next-race" : ""}" data-race-id="${race.id}" type="button" aria-label="${race.venueName} ${race.number} ${race.name} ${race.startAt}${isNextRace ? " 次レース" : ""}">
            <strong>${race.number}</strong>
            <span>${race.startAt}</span>
            ${isNextRace ? '<em class="next-race-badge">次</em>' : ""}
          </button>
        `;
        }).join("")}
      </div>
    </section>
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
  const acquiredSites = getAcquiredSites(ranking);
  const acquired = acquiredSites.size;
  const scoredRanking = ranking.filter((horse) => horse.voteCount > 0);
  const average = scoredRanking.length ? scoredRanking.reduce((sum, horse) => sum + horse.support, 0) / scoredRanking.length : 0;
  const operation = getOperatingStatus();
  const operationMetric = elements.operationStatus.closest(".metric");

  elements.raceTitle.textContent = `${race.venueName} ${race.number} ${race.name}`;
  elements.updatedAt.textContent = race.updatedAt;
  elements.operationStatus.textContent = operation.label;
  elements.operationWindow.textContent = operation.detail;
  elements.siteCount.textContent = `${acquired}/${siteNames.length}`;
  elements.missingSites.textContent = acquired
    ? acquired < MIN_CONSENSUS_SITES
      ? `参考不足 ${acquired}/${MIN_CONSENSUS_SITES}`
      : (race.missingSites.length ? race.missingSites.join(" / ") : "なし")
    : "予想印未取得";
  elements.averageSupport.textContent = `${average.toFixed(1)}%`;
  if (elements.refreshButton) {
    elements.refreshButton.disabled = !operation.active;
    elements.refreshButton.title = operation.active ? "取得を更新" : "地方競馬開催時間帯のみ取得できます";
  }

  if (operationMetric) {
    operationMetric.classList.toggle("is-active", operation.active);
    operationMetric.classList.toggle("is-paused", !operation.active);
  }
}

function renderSourceAudit(ranking = []) {
  if (!elements.sourceAudit) {
    return;
  }

  const acquiredSites = getAcquiredSites(ranking);
  const siteNames = Object.keys(DEFAULT_WEIGHTS);
  elements.sourceAudit.innerHTML = siteNames.map((site) => {
    const audit = SOURCE_AUDIT[site] || { status: "pending", note: "確認中" };
    const isAcquired = acquiredSites.has(site);
    const status = isAcquired ? "acquired" : audit.status;
    const label = isAcquired
      ? "取得済み"
      : status === "blocked"
        ? "未取得"
        : status === "public"
          ? "対象"
          : "確認中";

    return `
      <div class="source-audit-row ${status}">
        <div>
          <strong>${site}</strong>
          <span>${isAcquired ? "このレースで実データあり" : audit.note}</span>
        </div>
        <em>${label}</em>
      </div>
    `;
  }).join("");
}

function renderNoRaceState() {
  renderRaceList();

  if (elements.raceTitle) {
    elements.raceTitle.textContent = "本日の地方競馬開催はありません";
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
  if (elements.sourceAudit) elements.sourceAudit.innerHTML = "";
  if (elements.siteRaceSelect) elements.siteRaceSelect.innerHTML = "";
  if (elements.siteHorseSelect) elements.siteHorseSelect.innerHTML = "";
  if (elements.refreshButton) {
    elements.refreshButton.disabled = true;
    elements.refreshButton.title = "本日の地方競馬開催はありません";
  }
}

function renderRanking(ranking) {
  if (!elements.rankingRows) {
    return;
  }

  elements.rankingRows.innerHTML = ranking.map((horse) => {
    const gapClass = horse.gap > 0 ? "positive" : horse.gap < 0 ? "negative" : "neutral";
    const gapText = horse.gap > 0 ? `AI +${horse.gap}` : horse.gap < 0 ? `人気 +${Math.abs(horse.gap)}` : "一致";
    const supportCell = horse.voteCount
      ? `
          <div class="support-bar">
            <span class="bar-track"><span class="bar-fill" style="width: ${Math.max(4, horse.support)}%"></span></span>
            <strong>${horse.support.toFixed(1)}%</strong>
          </div>
        `
      : "<span>印未取得</span>";
    return `
      <tr>
        <td>${horse.voteCount ? horse.aiRank : "-"}</td>
        <td><button class="horse-cell" data-horse-name="${horse.name}" type="button">${horse.number}. ${horse.name}</button></td>
        <td>${supportCell}</td>
        <td>${horse.voteCount ? horse.favorites : "-"}</td>
        <td>${horse.odds.toFixed(1)}倍</td>
        <td><span class="gap-pill ${gapClass}">${horse.voteCount ? gapText : "未取得"}</span></td>
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
  const acquired = getAcquiredSites(ranking).size;
  const supportLabel = acquired >= MIN_CONSENSUS_SITES ? "AI支持率" : "参考スコア";

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
    <div><span>${supportLabel}</span><strong>${selected.voteCount ? `${selected.support.toFixed(1)}%` : "未取得"}</strong></div>
    <div><span>本命数</span><strong>${selected.voteCount ? selected.favorites : "-"}</strong></div>
    <div><span>オッズ</span><strong>${selected.odds.toFixed(1)}倍</strong></div>
  `;

  if (elements.siteVotes) {
    const entries = Object.entries(selected.predictions);
    elements.siteVotes.innerHTML = entries.length ? entries.map(([site, prediction]) => `
      <div class="vote-row">
        <div>
          <strong>${site}</strong>
          <span>重み ${Number(state.weights[site] || 1).toFixed(2)}</span>
        </div>
        <span class="mark-badge">${prediction.mark}</span>
        <strong>${prediction.index}</strong>
      </div>
    `).join("") : `
      <div class="empty-state">
        <strong>予想印は未取得です</strong>
        <span>実際のサイト印が取得できるまで支持率は出しません</span>
      </div>
    `;
  }
}

function renderRecommendations(ranking) {
  if (!elements.recommendationGroups) {
    return;
  }

  const acquired = getAcquiredSites(ranking).size;

  if (!ranking.some((horse) => horse.voteCount > 0) || acquired < MIN_CONSENSUS_SITES) {
    elements.recommendationGroups.innerHTML = `
      <section class="recommendation-card">
        <h4>${acquired ? "参考不足" : "推奨未取得"}</h4>
        <div class="empty-state">
          <strong>${acquired ? `${acquired}/10サイト取得。5サイト未満です` : "予想サイトの実印が未取得です"}</strong>
          <span>${acquired ? "コンセンサスとしては扱わず、買い目推奨は出しません" : "仮の印では買い目推奨を出しません"}</span>
        </div>
      </section>
    `;
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
  const acquired = getAcquiredSites(ranking).size;
  const supportLabel = acquired >= MIN_CONSENSUS_SITES ? "AI支持率" : "参考スコア";

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
      <div><span>${supportLabel}</span><strong>${selected.voteCount ? `${selected.support.toFixed(1)}%` : "未取得"}</strong></div>
      <div><span>オッズ</span><strong>${selected.odds.toFixed(1)}倍</strong></div>
    `;
  }

  const entries = Object.entries(selected.predictions);
  elements.siteDetailList.innerHTML = entries.length ? entries.map(([site, prediction]) => `
    <div class="vote-row">
      <div>
        <strong>${site}</strong>
        <span>重み ${Number(state.weights[site] || 1).toFixed(2)}</span>
      </div>
      <span class="mark-badge">${prediction.mark}</span>
      <strong>${prediction.index}</strong>
    </div>
  `).join("") : `
    <div class="empty-state">
      <strong>予想印は未取得です</strong>
      <span>実際のサイト印だけを表示します</span>
    </div>
  `;

  if (elements.siteBackLink) {
    elements.siteBackLink.href = buildStateHref("phone.html");
  }

  syncSitesPageUrl();
}

function render() {
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
  renderSourceAudit(ranking);
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
  elements.refreshButton.addEventListener("click", async () => {
    if (!getOperatingStatus().active) {
      render();
      return;
    }
    await hydrateDailyRaceSchedule({ preserveSelection: true });
  });
}

render();

async function hydrateDailyRaceSchedule(options = {}) {
  try {
    if (elements.refreshButton) {
      elements.refreshButton.disabled = true;
      elements.refreshButton.classList.add("is-loading");
    }

    const dailyRaces = await loadDailyRaceSchedule();
    races = dailyRaces;

    const todaysRaces = getTodaysRaces();
    const requestedRaceId = options.preserveSelection ? state.selectedRaceId : INITIAL_RACE_ID;
    state.selectedRaceId = todaysRaces.some((race) => race.id === requestedRaceId)
      ? requestedRaceId
      : todaysRaces[0]?.id;
    if (!options.preserveSelection) {
      state.selectedHorseName = INITIAL_HORSE_NAME;
    }
    render();
  } catch (error) {
    console.warn("Daily local racing schedule is unavailable. Using fallback schedule.", error);
  } finally {
    if (elements.refreshButton) {
      elements.refreshButton.classList.remove("is-loading");
    }
    render();
  }
}

async function hydrateAutoWeights() {
  if (!window.ConsensusAutoWeights) {
    return;
  }

  const result = await window.ConsensusAutoWeights.applyLatest();
  state.weights = { ...DEFAULT_WEIGHTS, ...result.weights };
  render();
}

hydrateDailyRaceSchedule();
hydrateAutoWeights();
setInterval(() => hydrateDailyRaceSchedule({ preserveSelection: true }), 60 * 1000);
