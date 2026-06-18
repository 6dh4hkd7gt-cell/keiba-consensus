const AUTO_WEIGHT_DEFAULTS = {
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

const AUTO_WEIGHT_KEYS = {
  weights: "consensusWeights",
  audit: "weeklyWeightAudit",
  signature: "weeklyAutoWeightSignature"
};

function clampWeight(value, min = 0.5, max = 1.8) {
  return Math.min(max, Math.max(min, value));
}

function roundWeight(value) {
  return Math.round(value * 100) / 100;
}

function loadStoredWeights() {
  try {
    const saved = JSON.parse(localStorage.getItem(AUTO_WEIGHT_KEYS.weights) || "{}");
    return { ...AUTO_WEIGHT_DEFAULTS, ...saved };
  } catch {
    return { ...AUTO_WEIGHT_DEFAULTS };
  }
}

function saveStoredWeights(weights) {
  localStorage.setItem(AUTO_WEIGHT_KEYS.weights, JSON.stringify(weights));
}

function loadStoredAudit() {
  try {
    return JSON.parse(localStorage.getItem(AUTO_WEIGHT_KEYS.audit) || "null");
  } catch {
    return null;
  }
}

async function loadWeeklyReport() {
  try {
    const response = await fetch("./data/weekly-results.json", { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch {
    return null;
  }
}

function metricScore(value, baseline, min = 0.45, max = 1.75) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return null;
  }

  return clampWeight(numeric / baseline, min, max);
}

function calculateSiteWeight(currentWeight, result) {
  const pieces = [
    { value: metricScore(result.hitRate, 25), share: 0.35 },
    { value: metricScore(result.roi, 100, 0.45, 1.85), share: 0.45 },
    { value: metricScore(result.topMatch, 40), share: 0.2 }
  ].filter((piece) => piece.value !== null);

  if (!pieces.length) {
    return currentWeight;
  }

  const shareTotal = pieces.reduce((total, piece) => total + piece.share, 0);
  const target = pieces.reduce((total, piece) => total + piece.value * piece.share, 0) / shareTotal;
  return roundWeight(clampWeight(currentWeight * 0.65 + target * 0.35));
}

function calculateWeightsFromReport(report, currentWeights = loadStoredWeights()) {
  const nextWeights = { ...AUTO_WEIGHT_DEFAULTS, ...currentWeights };
  const rows = (report?.sites || []).map((result) => {
    const site = result.site;
    const before = Number(nextWeights[site] || 1);
    const after = calculateSiteWeight(before, result);
    nextWeights[site] = after;

    return {
      site,
      before,
      after,
      delta: roundWeight(after - before),
      hitRate: Number(result.hitRate),
      roi: Number(result.roi),
      topMatch: Number(result.topMatch)
    };
  });

  return { weights: nextWeights, rows };
}

function getReportSignature(report) {
  if (!report) {
    return "";
  }

  return `${report.weekOf || ""}|${report.generatedAt || ""}`;
}

async function applyLatestWeeklyWeights() {
  const report = await loadWeeklyReport();
  const currentWeights = loadStoredWeights();

  if (!report || !Array.isArray(report.sites)) {
    return {
      applied: false,
      report: null,
      audit: loadStoredAudit(),
      weights: currentWeights
    };
  }

  const signature = getReportSignature(report);
  const storedAudit = loadStoredAudit();
  const previousSignature = localStorage.getItem(AUTO_WEIGHT_KEYS.signature) || storedAudit?.signature;
  const calculated = calculateWeightsFromReport(report, currentWeights);
  const audit = {
    weekOf: report.weekOf,
    generatedAt: report.generatedAt,
    source: report.source || "weekly-results",
    signature,
    rows: calculated.rows
  };

  if (signature && signature !== previousSignature) {
    saveStoredWeights(calculated.weights);
    localStorage.setItem(AUTO_WEIGHT_KEYS.audit, JSON.stringify(audit));
    localStorage.setItem(AUTO_WEIGHT_KEYS.signature, signature);

    return {
      applied: true,
      report,
      audit,
      weights: calculated.weights
    };
  }

  return {
    applied: false,
    report,
    audit: storedAudit || audit,
    weights: currentWeights
  };
}

window.ConsensusAutoWeights = {
  defaults: AUTO_WEIGHT_DEFAULTS,
  keys: AUTO_WEIGHT_KEYS,
  applyLatest: applyLatestWeeklyWeights,
  calculateFromReport: calculateWeightsFromReport,
  loadAudit: loadStoredAudit,
  loadReport: loadWeeklyReport,
  loadWeights: loadStoredWeights,
  saveWeights: saveStoredWeights
};
