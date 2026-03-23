const e = require('../utils/statsEngine');

const bad = (res, msg) => res.status(400).json({ success: false, error: msg });
const ok  = (res, result) => res.json({ success: true, result });

// ── 1. Frequency distribution ────────────────────────────────
exports.frequency = (req, res) => {
  try {
    const data = e.parseData(req.body.data);
    if (data.length < 2) return bad(res, 'Need at least 2 values');
    ok(res, e.frequencyDist(data));
  } catch (err) { bad(res, err.message); }
};

// ── 2. Averages ──────────────────────────────────────────────
exports.averages = (req, res) => {
  try {
    const data = e.parseData(req.body.data);
    if (!data.length) return bad(res, 'No valid data');
    const s    = e.sorted(data);
    const m    = e.mean(data);
    const skew = e.skewness(data);
    ok(res, {
      n:        data.length,
      mean:     m,
      median:   e.median(data),
      mode:     e.mode(data),
      min:      s[0],
      max:      s[s.length - 1],
      skewness: skew,
      kurtosis: e.kurtosis(data),
      shape:    Math.abs(skew) < 0.5 ? 'Symmetric'
              : skew > 0             ? 'Right skewed (positive)'
              :                        'Left skewed (negative)',
      sorted:   s,
    });
  } catch (err) { bad(res, err.message); }
};

// ── 3. Variability & IQR ────────────────────────────────────
exports.variability = (req, res) => {
  try {
    const data = e.parseData(req.body.data);
    if (data.length < 2) return bad(res, 'Need at least 2 values');
    const s              = e.sorted(data);
    const m              = e.mean(data);
    const sd             = e.stdDev(data);
    const { q1, q3, iqr, lo, hi } = e.iqrFences(data);
    ok(res, {
      range:       s[s.length - 1] - s[0],
      variance:    e.variance(data),
      stdDev:      sd,
      cv:          (sd / Math.abs(m)) * 100,
      q1, q3, iqr,
      lowerFence:  lo,
      upperFence:  hi,
      min:         s[0],
      max:         s[s.length - 1],
      sorted:      s,
    });
  } catch (err) { bad(res, err.message); }
};

// ── 4. Outliers ──────────────────────────────────────────────
exports.outliers = (req, res) => {
  try {
    const data = e.parseData(req.body.data);
    if (!data.length) return bad(res, 'No valid data');
    const m  = e.mean(data);
    const sd = e.stdDev(data);
    const { lo, hi } = e.iqrFences(data);
    const details = data.map((v, i) => {
      const z       = e.zScore(v, m, sd);
      const iqrOut  = v < lo || v > hi;
      const zOut    = Math.abs(z) > 3;
      return { value: v, index: i + 1, zScore: z,
               iqrOutlier: iqrOut, zOutlier: zOut, isOutlier: iqrOut || zOut };
    });
    ok(res, {
      details,
      outliers:   details.filter(d => d.isOutlier).map(d => d.value),
      count:      details.filter(d => d.isOutlier).length,
      lowerFence: lo, upperFence: hi, mean: m, stdDev: sd,
    });
  } catch (err) { bad(res, err.message); }
};

// ── 5. Normal distribution ───────────────────────────────────
exports.normalDist = (req, res) => {
  try {
    const { value, mean: m, stdDev: sd } = req.body;
    if ([value, m, sd].some(v => v === undefined))
      return bad(res, 'Provide value, mean and stdDev');
    const z      = e.zScore(+value, +m, +sd);
    const pBelow = e.normalCDF(z);
    const points = Array.from({ length: 120 }, (_, i) => {
      const zv = -4 + i * (8 / 120);
      return { z: +zv.toFixed(3), y: e.normalPDF(zv) };
    });
    ok(res, {
      z, pBelow, pAbove: 1 - pBelow,
      percentile: pBelow * 100,
      pdf: e.normalPDF(z),
      points,
    });
  } catch (err) { bad(res, err.message); }
};

// ── 6. Z-scores for a dataset ────────────────────────────────
exports.zScores = (req, res) => {
  try {
    const data = e.parseData(req.body.data);
    if (!data.length) return bad(res, 'No valid data');
    const m  = e.mean(data);
    const sd = e.stdDev(data);
    ok(res, {
      mean: m, stdDev: sd,
      zScores: data.map((v, i) => ({
        value:      v,
        index:      i + 1,
        zScore:     e.zScore(v, m, sd),
        percentile: e.normalCDF(e.zScore(v, m, sd)) * 100,
      })),
    });
  } catch (err) { bad(res, err.message); }
};

// ── 7. Correlation ───────────────────────────────────────────
exports.correlation = (req, res) => {
  try {
    const x = e.parseData(req.body.x);
    const y = e.parseData(req.body.y);
    if (x.length !== y.length || x.length < 3)
      return bad(res, 'X and Y must have equal length (min 3)');
    const r  = e.pearsonR(x, y);
    const rs = e.spearmanR(x, y);
    const n  = x.length;
    const t  = r * Math.sqrt(n - 2) / Math.sqrt(1 - r * r);
    const strength =
      Math.abs(r) >= 0.9 ? 'Very strong' :
      Math.abs(r) >= 0.7 ? 'Strong'      :
      Math.abs(r) >= 0.5 ? 'Moderate'    :
      Math.abs(r) >= 0.3 ? 'Weak'        : 'Negligible';
    ok(res, {
      pearsonR: r, spearmanR: rs, r2: r * r, tStatistic: t,
      strength, direction: r >= 0 ? 'positive' : 'negative',
      interpretation: `${strength} ${r >= 0 ? 'positive' : 'negative'} correlation`,
      pairs: x.map((xi, i) => ({ x: xi, y: y[i] })),
    });
  } catch (err) { bad(res, err.message); }
};

// ── 8. Simple linear regression ─────────────────────────────
exports.regression = (req, res) => {
  try {
    const x = e.parseData(req.body.x);
    const y = e.parseData(req.body.y);
    if (x.length !== y.length || x.length < 3)
      return bad(res, 'X and Y must match length (min 3)');
    const reg = e.linearRegression(x, y);
    ok(res, {
      ...reg,
      equation: `y = ${reg.slope.toFixed(4)}x + (${reg.intercept.toFixed(4)})`,
      pairs: x.map((xi, i) => ({
        x: xi, y: y[i],
        predicted: reg.predicted[i],
        residual:  reg.residuals[i],
      })),
    });
  } catch (err) { bad(res, err.message); }
};

// ── 9. Multiple regression ───────────────────────────────────
exports.multipleRegression = (req, res) => {
  try {
    const y          = e.parseData(req.body.y);
    const predictors = req.body.predictors;
    if (!Array.isArray(predictors) || predictors.length < 1)
      return bad(res, 'Provide predictors array');
    const X = predictors.map(p => e.parseData(p));
    if (X.some(col => col.length !== y.length))
      return bad(res, 'All predictors must match Y length');
    const reg    = e.multipleRegression(X, y);
    const labels = ['Intercept', ...X.map((_, i) => `X${i + 1}`)];
    ok(res, {
      ...reg,
      coefficients: reg.coeffs.map((c, i) => ({ label: labels[i], value: c })),
      equation: 'y = ' + reg.coeffs
        .map((c, i) => i === 0 ? c.toFixed(4) : `${c.toFixed(4)}·X${i}`)
        .join(' + '),
    });
  } catch (err) { bad(res, err.message); }
};
