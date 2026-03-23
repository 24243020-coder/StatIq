/* ============================================================
   STATS CALCULATOR  –  app.js
   All API calls go to the Node.js backend at localhost:3000
   ============================================================ */

// Auto-detect: use current host when deployed, fallback to localhost for dev
const API = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000/api'
  : window.location.origin + '/api';
let currentTab = 'frequency';
let charts     = {};

/* ── presets ─────────────────────────────────────────────────── */
const PRESETS = {
  exam:    '45, 67, 72, 55, 88, 91, 63, 77, 82, 69, 74, 58, 95, 61, 78, 83, 70, 66, 88, 52',
  salary:  '28000,32000,35000,41000,38000,55000,29000,33000,120000,36000,40000,44000,31000,250000',
  heights: '158,162,165,167,169,170,171,172,173,174,175,176,178,180,182,185,188,190',
  skewed:  '1,1,2,2,2,3,3,3,3,4,4,5,6,8,12,20,35,60',
};

function loadPreset(k) { document.getElementById('data-input').value = PRESETS[k]; }

/* ── formatting helpers ─────────────────────────────────────── */
function f(v, d = 2) {
  if (v === undefined || v === null || (typeof v === 'number' && isNaN(v))) return '—';
  return Number(Number(v).toFixed(d)).toLocaleString();
}
function f4(v)  { return f(v, 4); }
function fp(v)  { return f(v, 2) + '%'; }

/* ── chart helper ────────────────────────────────────────────── */
function mkChart(id, cfg) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  const el = document.getElementById(id);
  if (!el) return;
  charts[id] = new Chart(el, cfg);
}

/* ── API helper ──────────────────────────────────────────────── */
async function post(endpoint, body) {
  const res = await fetch(`${API}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

/* ── health check ────────────────────────────────────────────── */
async function checkHealth() {
  try {
    const r = await fetch(window.location.origin + '/health');
    const d = await r.json();
    document.getElementById('api-status').textContent =
      d.status === 'ok' ? '🟢 API connected' : '🔴 API error';
  } catch {
    document.getElementById('api-status').textContent = '🔴 API offline — run npm start';
  }
}

/* ── tab switching ───────────────────────────────────────────── */
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentTab = btn.dataset.tab;

    const xyTabs    = ['correlation', 'regression'];
    const multiTab  = currentTab === 'multiregression';
    const normalTab = currentTab === 'normal';
    const singleTab = !xyTabs.includes(currentTab) && !multiTab && !normalTab;

    show('panel-single', singleTab);
    show('panel-xy',     xyTabs.includes(currentTab));
    show('panel-multi',  multiTab);
    show('panel-normal', normalTab);

    setHTML('results', '<div class="loading">Press <strong>Calculate ▶</strong> to see results</div>');
  });
});

function show(id, visible) {
  document.getElementById(id).style.display = visible ? '' : 'none';
}
function setHTML(id, html) { document.getElementById(id).innerHTML = html; }

/* ── add predictor ───────────────────────────────────────────── */
let predCount = 2;
function addPredictor() {
  predCount++;
  const wrap = document.getElementById('predictors-wrap');
  const row  = wrap.querySelector('.predictor-row');
  const div  = document.createElement('div');
  div.className = 'input-group';
  div.style.flex = '1';
  div.innerHTML = `<label>X${predCount} — predictor ${predCount}</label>
    <textarea class="pred-input" rows="2" placeholder="values…"></textarea>`;
  row.appendChild(div);
}

/* ── main calculate ──────────────────────────────────────────── */
async function calculate() {
  const btn = document.getElementById('calc-btn');
  btn.textContent = 'Calculating…';
  btn.disabled    = true;
  setHTML('results', '<div class="loading">⏳ Fetching from Node.js API…</div>');

  try {
    switch (currentTab) {
      case 'frequency':      await showFrequency();      break;
      case 'averages':       await showAverages();       break;
      case 'variability':    await showVariability();    break;
      case 'outliers':       await showOutliers();       break;
      case 'normal':         await showNormal();         break;
      case 'zscores':        await showZScores();        break;
      case 'correlation':    await showCorrelation();    break;
      case 'regression':     await showRegression();     break;
      case 'multiregression':await showMultiReg();       break;
    }
  } catch (err) {
    setHTML('results',
      `<div class="err-box">❌ <strong>Error:</strong> ${err.message}<br>
       <small>Make sure the backend is running: open a terminal → <code>cd backend</code> → <code>npm start</code></small></div>`
    );
  }

  btn.textContent = 'Calculate ▶';
  btn.disabled    = false;
}

function showError(msg) {
  setHTML('results', `<div class="err-box">❌ ${msg}</div>`);
}

/* ════════════════════════════════════════════════════════════════
   MODULE RENDERERS
   ════════════════════════════════════════════════════════════════ */

/* ── 1. Frequency distribution ──────────────────────────────── */
async function showFrequency() {
  const res = await post('frequency', { data: document.getElementById('data-input').value });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('n (count)',  r.n,             false)}
      ${metric('Min',        f(r.min),        false)}
      ${metric('Max',        f(r.max),        false)}
      ${metric('Bin width',  f(r.binWidth),   false)}
    </div>
    <div class="card">
      <div class="card-title">Histogram</div>
      <div class="chart-wrap h240"><canvas id="hist-c"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">Frequency distribution table</div>
      <div class="tbl-wrap">${freqTable(r.bins)}</div>
    </div>`);

  mkChart('hist-c', {
    type: 'bar',
    data: {
      labels: r.bins.map(b => b.interval),
      datasets: [{
        label: 'Frequency',
        data:  r.bins.map(b => b.frequency),
        backgroundColor: 'rgba(83,74,183,0.65)',
        borderColor: '#534AB7',
        borderWidth: 0.5,
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 35 } },
        y: { beginAtZero: true, grid: { color: '#f0efea' }, ticks: { font: { size: 10 } } },
      },
    },
  });
}

function freqTable(bins) {
  return `<table>
    <thead><tr><th>Interval</th><th>Frequency</th><th>Relative %</th><th>Cumul. freq</th><th>Cumul. %</th></tr></thead>
    <tbody>
      ${bins.map(b => `<tr>
        <td>${b.interval}</td>
        <td>${b.frequency}</td>
        <td>${b.relativeFreq}%</td>
        <td>${b.cumulativeFreq}</td>
        <td>${b.cumulativePct}%</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

/* ── 2. Averages ─────────────────────────────────────────────── */
async function showAverages() {
  const res = await post('averages', { data: document.getElementById('data-input').value });
  if (!res.success) return showError(res.error);
  const r    = res.result;
  const diff = Math.abs((r.mean - r.median) / r.mean * 100);

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Mean (x̄)',   f(r.mean),                  true)}
      ${metric('Median',      f(r.median),                true)}
      ${metric('Mode',        r.mode.map(v => f(v)).join(', '), true)}
      ${metric('n',           r.n,                        false)}
      ${metric('Min',         f(r.min),                   false)}
      ${metric('Max',         f(r.max),                   false)}
      ${metric('Skewness',    f4(r.skewness),             false)}
      ${metric('Kurtosis',    f4(r.kurtosis),             false)}
    </div>
    <div class="info ${diff > 15 ? 'amber' : 'green'}">
      ${diff > 15
        ? `⚠ Mean (${f(r.mean)}) and median (${f(r.median)}) differ by ${f(diff,1)}% — outliers or skew are pulling the mean. The median is more representative.`
        : `✅ Mean (${f(r.mean)}) and median (${f(r.median)}) are close — the distribution is roughly symmetric.`}
      <br><strong>Shape:</strong> ${r.shape}
    </div>
    <div class="row2">
      <div class="card">
        <div class="card-title">Values with mean &amp; median markers</div>
        <div class="chart-wrap h240"><canvas id="avg-c"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Interpretation guide</div>
        <div style="font-size:13px;line-height:1.9;color:#555">
          <strong>Mean = ${f(r.mean)}</strong> — arithmetic average; sensitive to outliers.<br>
          <strong>Median = ${f(r.median)}</strong> — middle value; robust to outliers.<br>
          <strong>Mode = ${r.mode.map(v => f(v)).join(', ')}</strong> — most frequent value(s).<br>
          <strong>Skewness = ${f4(r.skewness)}</strong> — ${r.shape}.<br>
          <strong>Kurtosis = ${f4(r.kurtosis)}</strong> — ${r.kurtosis > 0 ? 'heavier tails than normal (leptokurtic)' : 'lighter tails than normal (platykurtic)'}.
        </div>
      </div>
    </div>`);

  mkChart('avg-c', {
    type: 'scatter',
    data: { datasets: [
      { label: 'Values',  data: r.sorted.map((v,i) => ({x:i,y:v})), backgroundColor: 'rgba(83,74,183,0.55)', pointRadius: 5 },
      { label: 'Mean',    data: [{x:-1,y:r.mean},{x:r.n,y:r.mean}],     type:'line', borderColor:'#E24B4A', borderWidth:2, pointRadius:0, borderDash:[6,3] },
      { label: 'Median',  data: [{x:-1,y:r.median},{x:r.n,y:r.median}], type:'line', borderColor:'#1D9E75', borderWidth:2, pointRadius:0, borderDash:[4,4] },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font:{size:11}, boxWidth:12 } } },
      scales: {
        x: { display: false },
        y: { grid: { color:'#f0efea' }, ticks: { font:{size:10} } },
      },
    },
  });
}

/* ── 3. Variability & IQR ────────────────────────────────────── */
async function showVariability() {
  const res = await post('variability', { data: document.getElementById('data-input').value });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Range',        f(r.range),       true)}
      ${metric('Variance s²',  f(r.variance),    true)}
      ${metric('Std dev s',    f(r.stdDev),      true)}
      ${metric('CV',           fp(r.cv),         true)}
      ${metric('Q1',           f(r.q1),          false)}
      ${metric('Q3',           f(r.q3),          false)}
      ${metric('IQR',          f(r.iqr),         false)}
      ${metric('Lower fence',  f(r.lowerFence),  false)}
      ${metric('Upper fence',  f(r.upperFence),  false)}
    </div>
    <div class="info blue">
      <strong>IQR = Q3 − Q1 = ${f(r.q3)} − ${f(r.q1)} = ${f(r.iqr)}</strong><br>
      Lower fence (Q1 − 1.5×IQR) = <strong>${f(r.lowerFence)}</strong> &nbsp;|&nbsp;
      Upper fence (Q3 + 1.5×IQR) = <strong>${f(r.upperFence)}</strong><br>
      Coefficient of variation = <strong>${fp(r.cv)}</strong> — 
      ${r.cv < 15 ? 'low' : r.cv < 30 ? 'moderate' : 'high'} relative variability.
    </div>
    <div class="row2">
      <div class="card">
        <div class="card-title">Box &amp; whisker plot</div>
        <div class="chart-wrap h140"><canvas id="box-c"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">5-number summary</div>
        <div class="chart-wrap h140"><canvas id="five-c"></canvas></div>
      </div>
    </div>`);

  const wLo = Math.max(r.min, r.lowerFence);
  const wHi = Math.min(r.max, r.upperFence);
  mkChart('box-c', {
    type: 'bar',
    data: { labels: [''],
      datasets: [
        { data: [wLo - r.min],   base: r.min,  backgroundColor: 'rgba(83,74,183,0.12)', borderWidth:0 },
        { data: [r.q1 - wLo],   base: wLo,    backgroundColor: 'rgba(83,74,183,0.35)', borderWidth:0 },
        { data: [r.q3 - r.q1],  base: r.q1,   backgroundColor: 'rgba(83,74,183,0.65)', borderColor:'#534AB7', borderWidth:1 },
        { data: [wHi - r.q3],   base: r.q3,   backgroundColor: 'rgba(83,74,183,0.35)', borderWidth:0 },
        { data: [r.max - wHi],  base: wHi,    backgroundColor: 'rgba(83,74,183,0.12)', borderWidth:0 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: { legend: { display: false } },
      scales: {
        x: { stacked: true, grid: { color:'#f0efea' }, ticks: { font:{size:10} } },
        y: { stacked: true, display: false },
      },
    },
  });

  mkChart('five-c', {
    type: 'bar',
    data: {
      labels: ['Min','Q1','Median','Q3','Max'],
      datasets: [{ data: [r.min, r.q1, (r.q1+r.q3)/2, r.q3, r.max],
        backgroundColor: ['#B4B2A9','#5DCAA5','#534AB7','#5DCAA5','#B4B2A9'],
        borderRadius: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color:'#f0efea' }, ticks: { font:{size:10} } },
        x: { grid: { display:false },  ticks: { font:{size:10} } },
      },
    },
  });
}

/* ── 4. Outliers ─────────────────────────────────────────────── */
async function showOutliers() {
  const res = await post('outliers', { data: document.getElementById('data-input').value });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Outliers found', r.count,          false, r.count > 0 ? 'warn' : 'good')}
      ${metric('Lower fence',    f(r.lowerFence),  false)}
      ${metric('Upper fence',    f(r.upperFence),  false)}
      ${metric('Mean',           f(r.mean),        false)}
      ${metric('Std dev',        f(r.stdDev),      false)}
    </div>
    <div class="info ${r.count > 0 ? 'red' : 'green'}">
      ${r.count > 0
        ? `⚠ ${r.count} outlier(s) detected: <strong>${r.outliers.join(', ')}</strong>. These may be distorting the mean.`
        : `✅ No outliers detected. All values are within 1.5×IQR of Q1 and Q3.`}
    </div>
    <div class="card">
      <div class="card-title">Outlier analysis — all values</div>
      <div class="tbl-wrap">${outlierTable(r.details)}</div>
    </div>`);
}

function outlierTable(d) {
  return `<table>
    <thead><tr><th>#</th><th>Value</th><th>Z-score</th><th>IQR test</th><th>Z test</th><th>Status</th></tr></thead>
    <tbody>
      ${d.map(row => `<tr class="${row.isOutlier ? 'outlier-row' : ''}">
        <td>${row.index}</td>
        <td><strong>${f(row.value)}</strong></td>
        <td>${f4(row.zScore)}</td>
        <td>${row.iqrOutlier ? badge('Outside','b-red') : badge('Within','b-green')}</td>
        <td>${row.zOutlier   ? badge('|z|>3',  'b-red') : badge('Normal','b-green')}</td>
        <td>${row.isOutlier  ? badge('Outlier','b-red') : badge('Normal','b-green')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

/* ── 5. Normal distribution ──────────────────────────────────── */
async function showNormal() {
  const value = document.getElementById('n-val').value;
  const mn    = document.getElementById('n-mean').value;
  const sd    = document.getElementById('n-sd').value;
  const res   = await post('normal', { value:+value, mean:+mn, stdDev:+sd });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Z-score',        f4(r.z),                 true)}
      ${metric('P(X ≤ '+value+')',  fp(r.pBelow*100),     true)}
      ${metric('P(X > '+value+')',  fp(r.pAbove*100),     true)}
      ${metric('Percentile',     f(r.percentile,1)+'th',  true)}
    </div>
    <div class="info blue">
      Value <strong>${value}</strong> with μ = <strong>${mn}</strong> and σ = <strong>${sd}</strong>
      → Z = <strong>${f4(r.z)}</strong><br>
      <strong>${fp(r.pBelow*100)}</strong> of the distribution falls <em>below</em> this value.
      <strong>${fp(r.pAbove*100)}</strong> falls <em>above</em>.
    </div>
    <div class="card">
      <div class="card-title">Normal curve — shaded area = P(X ≤ ${value})</div>
      <div class="chart-wrap h240"><canvas id="norm-c"></canvas></div>
    </div>`);

  const pts  = r.points;
  const zVal = r.z;
  mkChart('norm-c', {
    type: 'line',
    data: { labels: pts.map(p => p.z.toFixed(2)),
      datasets: [
        { label: 'Normal curve', data: pts.map(p => p.y), borderColor:'#534AB7', borderWidth:2, fill:false, pointRadius:0, tension:0.4 },
        { label: `P(Z ≤ ${f4(zVal)})`, data: pts.map(p => p.z <= zVal ? p.y : null), borderColor:'rgba(0,0,0,0)', backgroundColor:'rgba(83,74,183,0.25)', fill:'origin', pointRadius:0, tension:0.4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels: { font:{size:11}, boxWidth:12 } } },
      scales: {
        x: { grid: { color:'#f0efea' }, ticks: { maxTicksLimit:9, font:{size:10} } },
        y: { display: false },
      },
    },
  });
}

/* ── 6. Z-scores ─────────────────────────────────────────────── */
async function showZScores() {
  const res = await post('zscores', { data: document.getElementById('data-input').value });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Mean',    f(r.mean),   true)}
      ${metric('Std dev', f(r.stdDev), true)}
    </div>
    <div class="info blue">
      Z-score = (value − mean) / std dev. Values with |z| &gt; 3 are typically considered extreme outliers. Values with |z| &gt; 2 are unusual.
    </div>
    <div class="card">
      <div class="card-title">Z-scores bar chart</div>
      <div class="chart-wrap h200"><canvas id="z-c"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">Z-score table</div>
      <div class="tbl-wrap">${zTable(r.zScores)}</div>
    </div>`);

  mkChart('z-c', {
    type: 'bar',
    data: {
      labels: r.zScores.map(z => z.value),
      datasets: [{
        label: 'Z-score',
        data:  r.zScores.map(z => +z.zScore.toFixed(3)),
        backgroundColor: r.zScores.map(z =>
          Math.abs(z.zScore) > 3 ? '#E24B4A' :
          Math.abs(z.zScore) > 2 ? '#BA7517' : '#534AB7'
        ),
        borderRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { grid: { color:'#f0efea' }, ticks: { font:{size:10} } },
        x: { grid: { display:false },  ticks: { font:{size:10} } },
      },
    },
  });
}

function zTable(d) {
  return `<table>
    <thead><tr><th>#</th><th>Value</th><th>Z-score</th><th>Percentile</th><th>Interpretation</th></tr></thead>
    <tbody>
      ${d.map(row => `<tr>
        <td>${row.index}</td>
        <td>${f(row.value)}</td>
        <td class="${Math.abs(row.zScore)>3?'outlier-row':''}">${f4(row.zScore)}</td>
        <td>${f(row.percentile,1)}th</td>
        <td>${Math.abs(row.zScore)>3 ? badge('Extreme outlier','b-red')   :
             Math.abs(row.zScore)>2 ? badge('Unusual','b-amber')           :
                                      badge('Normal','b-green')}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

/* ── 7. Correlation ──────────────────────────────────────────── */
async function showCorrelation() {
  const res = await post('correlation', {
    x: document.getElementById('x-input').value,
    y: document.getElementById('y-input').value,
  });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Pearson r',   f4(r.pearsonR),      true)}
      ${metric('Spearman ρ',  f4(r.spearmanR),     true)}
      ${metric('R²',          fp(r.r2*100),         true)}
      ${metric('t-statistic', f4(r.tStatistic),    false)}
    </div>
    <div class="info ${Math.abs(r.pearsonR)>=0.5?'green':'blue'}">
      <strong>${r.interpretation}</strong> (r = ${f4(r.pearsonR)})<br>
      R² = ${fp(r.r2*100)} — the X variable explains ${fp(r.r2*100)} of variance in Y.
    </div>
    <div class="row2">
      <div class="card">
        <div class="card-title">Scatter plot</div>
        <div class="chart-wrap h240"><canvas id="scat-c"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Strength guide</div>
        <div style="font-size:13px;line-height:2.1;color:#555">
          🔴 0.9 – 1.0 = Very strong<br>
          🟠 0.7 – 0.9 = Strong<br>
          🟡 0.5 – 0.7 = Moderate<br>
          🔵 0.3 – 0.5 = Weak<br>
          ⚪ 0.0 – 0.3 = Negligible
        </div>
      </div>
    </div>`);

  mkChart('scat-c', {
    type: 'scatter',
    data: { datasets: [{ label:'Data', data: r.pairs, backgroundColor:'rgba(83,74,183,0.6)', pointRadius:6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid:{color:'#f0efea'}, ticks:{font:{size:10}}, title:{display:true,text:'X',font:{size:11}} },
        y: { grid:{color:'#f0efea'}, ticks:{font:{size:10}}, title:{display:true,text:'Y',font:{size:11}} },
      },
    },
  });
}

/* ── 8. Simple linear regression ─────────────────────────────── */
async function showRegression() {
  const res = await post('regression', {
    x: document.getElementById('x-input').value,
    y: document.getElementById('y-input').value,
  });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('Slope (b)',    f4(r.slope),      true)}
      ${metric('Intercept (a)',f4(r.intercept),  true)}
      ${metric('R²',           fp(r.r2*100),     true)}
      ${metric('Pearson r',    f4(r.r),          true)}
      ${metric('SEE',          f4(r.see),        false)}
    </div>
    <div class="info green">
      <strong>Equation: ${r.equation}</strong><br>
      R² = ${fp(r.r2*100)} of variance in Y is explained by X.<br>
      Standard Error of Estimate (SEE) = ${f4(r.see)} — average prediction error.
    </div>
    <div class="row2">
      <div class="card">
        <div class="card-title">Regression line</div>
        <div class="chart-wrap h240"><canvas id="reg-c"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">Residual plot</div>
        <div class="chart-wrap h240"><canvas id="resid-c"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Predictions table</div>
      <div class="tbl-wrap">${regTable(r.pairs)}</div>
    </div>`);

  const pts  = r.pairs;
  const xMin = Math.min(...pts.map(p=>p.x));
  const xMax = Math.max(...pts.map(p=>p.x));

  mkChart('reg-c', {
    type: 'scatter',
    data: { datasets: [
      { label:'Observed', data: pts.map(p=>({x:p.x,y:p.y})), backgroundColor:'rgba(83,74,183,0.65)', pointRadius:6 },
      { label:'Regression', data:[{x:xMin,y:r.slope*xMin+r.intercept},{x:xMax,y:r.slope*xMax+r.intercept}], type:'line', borderColor:'#E24B4A', borderWidth:2, pointRadius:0 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels:{font:{size:11},boxWidth:12} } },
      scales: {
        x: { grid:{color:'#f0efea'}, ticks:{font:{size:10}} },
        y: { grid:{color:'#f0efea'}, ticks:{font:{size:10}} },
      },
    },
  });

  mkChart('resid-c', {
    type: 'scatter',
    data: { datasets: [
      { label:'Residuals', data: pts.map(p=>({x:p.x,y:p.residual})), backgroundColor:'rgba(186,117,23,0.65)', pointRadius:6 },
      { label:'Zero',      data:[{x:xMin,y:0},{x:xMax,y:0}], type:'line', borderColor:'#aaa', borderWidth:1, borderDash:[4,4], pointRadius:0 },
    ]},
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { labels:{font:{size:11},boxWidth:12} } },
      scales: {
        x: { grid:{color:'#f0efea'}, ticks:{font:{size:10}} },
        y: { grid:{color:'#f0efea'}, ticks:{font:{size:10}} },
      },
    },
  });
}

function regTable(d) {
  return `<table>
    <thead><tr><th>#</th><th>X</th><th>Y actual</th><th>Ŷ predicted</th><th>Residual</th></tr></thead>
    <tbody>
      ${d.map((row,i) => `<tr>
        <td>${i+1}</td><td>${f(row.x)}</td><td>${f(row.y)}</td>
        <td>${f4(row.predicted)}</td>
        <td class="${Math.abs(row.residual) > 2*Math.abs(row.y)*0.1 ? 'outlier-row':''}">${f4(row.residual)}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

/* ── 9. Multiple regression ──────────────────────────────────── */
async function showMultiReg() {
  const y    = document.getElementById('my-input').value;
  const preds= Array.from(document.querySelectorAll('.pred-input')).map(el => el.value);
  const res  = await post('multiple-regression', { y, predictors: preds });
  if (!res.success) return showError(res.error);
  const r = res.result;

  setHTML('results', `
    <div class="metrics-grid">
      ${metric('R²',           fp(r.r2*100),    true)}
      ${metric('Adjusted R²',  fp(r.adjR2*100), true)}
      ${metric('SEE',          f4(r.see),       true)}
    </div>
    <div class="info green">
      <strong>Equation: ${r.equation}</strong><br>
      R² = ${fp(r.r2*100)} of variance explained. Adjusted R² = ${fp(r.adjR2*100)} (penalises for extra predictors).<br>
      SEE = ${f4(r.see)} — standard error of the estimate.
    </div>
    <div class="card">
      <div class="card-title">Coefficients chart</div>
      <div class="chart-wrap h180"><canvas id="coef-c"></canvas></div>
    </div>
    <div class="card">
      <div class="card-title">Coefficients table</div>
      <div class="tbl-wrap">${coefTable(r.coefficients)}</div>
    </div>`);

  mkChart('coef-c', {
    type: 'bar',
    data: {
      labels: r.coefficients.map(c=>c.label),
      datasets: [{
        label: 'Coefficient',
        data:  r.coefficients.map(c=>c.value),
        backgroundColor: r.coefficients.map((_,i) => i===0 ? '#B4B2A9' : '#534AB7'),
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend:{display:false} },
      scales: {
        y: { grid:{color:'#f0efea'}, ticks:{font:{size:10}} },
        x: { grid:{display:false},  ticks:{font:{size:10}} },
      },
    },
  });
}

function coefTable(d) {
  return `<table>
    <thead><tr><th>Predictor</th><th>Coefficient</th><th>Interpretation</th></tr></thead>
    <tbody>
      ${d.map((c,i) => `<tr>
        <td>${c.label}</td>
        <td>${f4(c.value)}</td>
        <td style="font-size:12px;color:#777">${i===0 ? 'Expected Y when all X = 0' : `1-unit increase in X${i} → ${f4(c.value)} change in Y`}</td>
      </tr>`).join('')}
    </tbody>
  </table>`;
}

/* ── shared helpers ──────────────────────────────────────────── */
function metric(lbl, val, accent=false, cls='') {
  return `<div class="metric ${accent?'accent':''} ${cls}">
    <div class="m-lbl">${lbl}</div>
    <div class="m-val ${String(val).length>7?'sm':''}">${val}</div>
  </div>`;
}

function badge(text, cls) {
  return `<span class="badge ${cls}">${text}</span>`;
}

/* ── init ────────────────────────────────────────────────────── */
checkHealth();
setInterval(checkHealth, 15000);
