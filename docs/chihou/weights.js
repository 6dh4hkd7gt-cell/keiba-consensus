const DEFAULT_WEIGHTS = {
  "楽天みんなの予想": 1,
  "AiBA無料AI": 1,
  "ウマークス順位": 1,
  "オッズパークAI": 1,
  "公式単勝人気": 1,
  "競馬新聞ゼロ本紙": 1,
  "競馬新聞ゼロ指数": 1
};

const weightControls = document.querySelector("#weightControls");
const autoWeightSummary = document.querySelector("#autoWeightSummary");

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

function formatSigned(value) {
  if (!Number.isFinite(value) || value === 0) {
    return "+0.00";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}`;
}

function formatDate(value) {
  if (!value) {
    return "--";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function renderAutoWeightSummary() {
  if (!autoWeightSummary) {
    return;
  }

  const audit = window.ConsensusAutoWeights?.loadAudit();
  if (!audit?.rows?.length) {
    autoWeightSummary.innerHTML = `
      <div>
        <span>自動調整</span>
        <strong>待機中</strong>
      </div>
      <div>
        <span>対象週</span>
        <strong>--</strong>
      </div>
      <div>
        <span>反映</span>
        <strong>--</strong>
      </div>
    `;
    return;
  }

  const largestMove = [...audit.rows].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  autoWeightSummary.innerHTML = `
    <div>
      <span>対象週</span>
      <strong>${audit.weekOf || "--"}</strong>
    </div>
    <div>
      <span>更新</span>
      <strong>${formatDate(audit.generatedAt)}</strong>
    </div>
    <div>
      <span>最大変化</span>
      <strong>${largestMove.site} ${formatSigned(largestMove.delta)}</strong>
    </div>
  `;
}

function renderWeights() {
  const weights = loadWeights();
  renderAutoWeightSummary();

  weightControls.innerHTML = Object.keys(DEFAULT_WEIGHTS).map((site) => `
    <div class="weight-control weight-readout">
      <div class="weight-line">
        <span>${site}</span>
        <strong>${Number(weights[site]).toFixed(2)}</strong>
      </div>
      <small>週次成績から自動反映</small>
    </div>
  `).join("");
}

async function initWeightsPage() {
  if (window.ConsensusAutoWeights) {
    await window.ConsensusAutoWeights.applyLatest();
  }

  renderWeights();
}

initWeightsPage();
