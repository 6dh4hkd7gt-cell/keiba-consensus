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
    startAt: "15:45",
    updatedAt: "15:40:03",
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
    startAt: "15:10",
    updatedAt: "15:05:08",
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
    startAt: "16:05",
    updatedAt: "16:00:14",
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
  }
];

const state = {
  selectedRaceId: races.some((race) => race.id === INITIAL_RACE_ID) ? INITIAL_RACE_ID : races[0].id,
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
  weightControls: document.querySelector("#weightControls"),
  resetWeights: document.querySelector("#resetWeights"),
  refreshButton: document.querySelector("#refreshButton")
};

function loadWeights() {
  try {
    const saved = JSON.parse(localStorage.getItem("consensusWeights") || "{}");
    return { ...DEFAULT_WEIGHTS, ...saved };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

function saveWeights() {
  localStorage.setItem("consensusWeights", JSON.stringify(state.weights));
}

function getRace() {
  return races.find((race) => race.id === state.selectedRaceId) || races[0];
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
  const filtered = races.filter((race) => {
    const matchesVenue = state.venue === "all" || race.venue === state.venue;
    const matchesQuery = `${race.venueName} ${race.number} ${race.name}`.toLowerCase().includes(query);
    return matchesVenue && matchesQuery;
  });

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
    elements.refreshButton.title = operation.active ? "取得を更新" : "土日 09:00-17:00のみ取得できます";
  }

  if (operationMetric) {
    operationMetric.classList.toggle("is-active", operation.active);
    operationMetric.classList.toggle("is-paused", !operation.active);
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
    elements.siteRaceSelect.innerHTML = races.map((raceOption) => `
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

function renderWeights() {
  if (!elements.weightControls) {
    return;
  }

  elements.weightControls.innerHTML = Object.keys(DEFAULT_WEIGHTS).map((site) => `
    <div class="weight-control">
      <label for="weight-${site}">
        <span>${site}</span>
        <strong>${Number(state.weights[site]).toFixed(2)}</strong>
      </label>
      <input id="weight-${site}" type="range" min="0.5" max="1.8" step="0.01" value="${state.weights[site]}" data-site="${site}" />
    </div>
  `).join("");

  elements.weightControls.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      state.weights[input.dataset.site] = Number(input.value);
      saveWeights();
      render();
    });
  });
}

function render() {
  const race = getRace();
  const ranking = calculateRanking(race);
  renderRaceList();
  renderStatus(race, ranking);
  renderRanking(ranking);
  renderHorseDetail(ranking);
  renderRecommendations(ranking);
  renderSiteDetailPage(race, ranking);
  renderWeights();
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

if (elements.resetWeights) {
  elements.resetWeights.addEventListener("click", () => {
    state.weights = { ...DEFAULT_WEIGHTS };
    saveWeights();
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

    const race = getRace();
    const now = getNow();
    race.updatedAt = now.toLocaleTimeString("ja-JP", { hour12: false });
    render();
  });
}

render();
setInterval(render, 60 * 1000);
