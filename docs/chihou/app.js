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

const DEFAULT_WEIGHTS = {
  "楽天競馬AI": 1,
  "netkeiba地方": 1,
  "NAR指数": 1,
  "競馬ブック地方": 1,
  "地方競馬予想AI": 1,
  "オッズパークAI": 1,
  "SPAT4分析": 1,
  "Uma Cloud": 1,
  "Race AI": 1,
  "Prediction One": 1
};

const VENUES = {
  obihiro: { venueName: "帯広", missingSites: ["SPAT4分析"] },
  monbetsu: { venueName: "門別", missingSites: ["netkeiba地方"] },
  morioka: { venueName: "盛岡", missingSites: [] },
  mizusawa: { venueName: "水沢", missingSites: ["Prediction One"] },
  urawa: { venueName: "浦和", missingSites: [] },
  funabashi: { venueName: "船橋", missingSites: ["Uma Cloud"] },
  ooi: { venueName: "大井", missingSites: ["Prediction One"] },
  kawasaki: { venueName: "川崎", missingSites: ["競馬ブック地方"] },
  kanazawa: { venueName: "金沢", missingSites: ["SPAT4分析"] },
  kasamatsu: { venueName: "笠松", missingSites: [] },
  nagoya: { venueName: "名古屋", missingSites: ["Race AI"] },
  sonoda: { venueName: "園田", missingSites: ["Race AI"] },
  himeji: { venueName: "姫路", missingSites: ["オッズパークAI"] },
  kochi: { venueName: "高知", missingSites: ["Uma Cloud"] },
  saga: { venueName: "佐賀", missingSites: ["地方競馬予想AI"] }
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

function hashText(text) {
  return [...text].reduce((total, char, index) => total + char.charCodeAt(0) * (index + 3), 0);
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
        predictions: {}
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
    missingSites: venueInfo.missingSites,
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
  const dataUrl = `./data/today-races.json?date=${encodeURIComponent(getTodayKey())}&v=${Date.now()}`;
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

function buildFallbackPrediction(site, horse, race) {
  const siteIndex = Object.keys(DEFAULT_WEIGHTS).indexOf(site);
  const seed = hashText(`${race.id}-${race.startAt}-${horse.name}-${site}`) + horse.number * 11 + siteIndex * 7;
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
        ${group.races.map((race) => `
          <button class="race-card race-chip ${race.id === state.selectedRaceId ? "active" : ""}" data-race-id="${race.id}" type="button" aria-label="${race.venueName} ${race.number} ${race.name} ${race.startAt}">
            <strong>${race.number}</strong>
            <span>${race.startAt}</span>
          </button>
        `).join("")}
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
  const acquired = siteNames.length - race.missingSites.length;
  const average = ranking.reduce((sum, horse) => sum + horse.support, 0) / ranking.length;
  const operation = getOperatingStatus();
  const operationMetric = elements.operationStatus.closest(".metric");

  elements.raceTitle.textContent = `${race.venueName} ${race.number} ${race.name}`;
  elements.updatedAt.textContent = race.updatedAt;
  elements.operationStatus.textContent = operation.label;
  elements.operationWindow.textContent = operation.detail;
  elements.siteCount.textContent = `${acquired}/${siteNames.length}`;
  elements.missingSites.textContent = race.missingSites.length ? race.missingSites.join(" / ") : "なし";
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
    if (!getOperatingStatus().active) {
      render();
      return;
    }
    render();
  });
}

render();

async function hydrateDailyRaceSchedule() {
  try {
    const dailyRaces = await loadDailyRaceSchedule();
    races = dailyRaces;

    const todaysRaces = getTodaysRaces();
    state.selectedRaceId = todaysRaces.some((race) => race.id === INITIAL_RACE_ID)
      ? INITIAL_RACE_ID
      : todaysRaces[0]?.id;
    state.selectedHorseName = INITIAL_HORSE_NAME;
    render();
  } catch (error) {
    console.warn("Daily local racing schedule is unavailable. Using fallback schedule.", error);
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
setInterval(render, 60 * 1000);
