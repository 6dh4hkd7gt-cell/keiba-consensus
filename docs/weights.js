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

const weightControls = document.querySelector("#weightControls");
const resetWeights = document.querySelector("#resetWeights");

function loadWeights() {
  try {
    const saved = JSON.parse(localStorage.getItem("consensusWeights") || "{}");
    return { ...DEFAULT_WEIGHTS, ...saved };
  } catch {
    return { ...DEFAULT_WEIGHTS };
  }
}

function saveWeights(weights) {
  localStorage.setItem("consensusWeights", JSON.stringify(weights));
}

function renderWeights() {
  const weights = loadWeights();

  weightControls.innerHTML = Object.keys(DEFAULT_WEIGHTS).map((site) => `
    <div class="weight-control">
      <label for="weight-${site}">
        <span>${site}</span>
        <strong>${Number(weights[site]).toFixed(2)}</strong>
      </label>
      <input id="weight-${site}" type="range" min="0.5" max="1.8" step="0.01" value="${weights[site]}" data-site="${site}" />
    </div>
  `).join("");

  weightControls.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", () => {
      weights[input.dataset.site] = Number(input.value);
      saveWeights(weights);
      renderWeights();
    });
  });
}

resetWeights.addEventListener("click", () => {
  saveWeights({ ...DEFAULT_WEIGHTS });
  renderWeights();
});

renderWeights();
