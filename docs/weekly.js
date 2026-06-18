const weeklySummary = document.querySelector("#weeklySummary");
const weeklyRows = document.querySelector("#weeklyRows");

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

function renderSummary(audit) {
  if (!weeklySummary) {
    return;
  }

  if (!audit) {
    weeklySummary.innerHTML = `
      <div>
        <span>反映状態</span>
        <strong>待機中</strong>
      </div>
      <div>
        <span>対象週</span>
        <strong>--</strong>
      </div>
      <div>
        <span>生成</span>
        <strong>--</strong>
      </div>
    `;
    return;
  }

  const upCount = audit.rows.filter((row) => row.delta > 0).length;
  const downCount = audit.rows.filter((row) => row.delta < 0).length;

  weeklySummary.innerHTML = `
    <div>
      <span>対象週</span>
      <strong>${audit.weekOf || "--"}</strong>
    </div>
    <div>
      <span>反映</span>
      <strong>${upCount}↑ / ${downCount}↓</strong>
    </div>
    <div>
      <span>生成</span>
      <strong>${formatDate(audit.generatedAt)}</strong>
    </div>
  `;
}

function renderRows(audit) {
  if (!weeklyRows) {
    return;
  }

  if (!audit?.rows?.length) {
    weeklyRows.innerHTML = `
      <div class="empty-state">
        週次成績データを読み込めませんでした。
      </div>
    `;
    return;
  }

  weeklyRows.innerHTML = audit.rows.map((row) => `
    <div class="weekly-result-row ${row.delta > 0 ? "is-up" : row.delta < 0 ? "is-down" : ""}">
      <div>
        <strong>${row.site}</strong>
        <span>的中 ${row.hitRate.toFixed(1)}% / 回収 ${row.roi.toFixed(0)}% / 上位 ${row.topMatch.toFixed(1)}%</span>
      </div>
      <div class="weight-change">
        <span>${row.before.toFixed(2)} → ${row.after.toFixed(2)}</span>
        <strong>${formatSigned(row.delta)}</strong>
      </div>
    </div>
  `).join("");
}

async function initWeeklyPage() {
  if (!window.ConsensusAutoWeights) {
    renderSummary(null);
    renderRows(null);
    return;
  }

  const result = await window.ConsensusAutoWeights.applyLatest();
  renderSummary(result.audit);
  renderRows(result.audit);
}

initWeeklyPage();
