'use strict';
// ═══════════════════════════════════════════════════════════
//  NEURAL ENGINE — Multi-layer intelligence
//  Layers: (1) Anomaly (2) Sequence (3) Cohort (4) Ensemble
// ═══════════════════════════════════════════════════════════
const store = require('./store');
const bus = require('./events');

class Neural {
  constructor() {
    this.events = [];          // Rolling event window (last 10k)
    this.baselines = {};       // { metric: { mean, sd, n, min, max } }
    this.sequences = {};       // { "A>B": { count, avgGap } }
    this.anomalies = [];       // Recent anomalies
    this.weights = this._defaultWeights();
    this.trainCount = 0;
    bus.on('*', (e) => this.ingest(e));
  }

  _defaultWeights() {
    // Feature weights for patient risk ensemble
    return {
      news2: 0.30, age: 0.10, comorbidity: 0.12, los: 0.08,
      marMissed: 0.10, glucose: 0.08, isolation: 0.05,
      pain: 0.06, ioBalance: 0.06, codeStatus: 0.05
    };
  }

  // ─── LAYER 1: Event Ingestion ───
  ingest(payload) {
    const evt = {
      at: Date.now(),
      event: payload._event || 'unknown',
      data: payload
    };
    this.events.push(evt);
    if (this.events.length > 10000) this.events.shift();

    // Update baselines for numeric metrics
    this._updateBaseline('news2', payload.record && payload.record.news2);
    this._updateBaseline('marOverdueMin',
      payload.record && payload.record.status === 'scheduled' ?
        (Date.now() - new Date(payload.record.scheduledAt).getTime()) / 60000 : null);

    // Sequence mining
    if (this.events.length >= 2) {
      const prev = this.events[this.events.length - 2];
      const cur = evt;
      if (cur.at - prev.at < 60000) { // same minute cluster
        const key = prev.event + '>' + cur.event;
        if (!this.sequences[key]) this.sequences[key] = { count: 0, totalGap: 0 };
        this.sequences[key].count++;
        this.sequences[key].totalGap += cur.at - prev.at;
      }
    }
  }

  _updateBaseline(metric, value) {
    if (value == null || isNaN(value)) return;
    const b = this.baselines[metric] || { mean: 0, sd: 0, n: 0, min: Infinity, max: -Infinity, sum: 0, sumSq: 0 };
    b.n++; b.sum += value; b.sumSq += value * value;
    b.mean = b.sum / b.n;
    b.sd = Math.sqrt(Math.max(0, b.sumSq / b.n - b.mean * b.mean));
    b.min = Math.min(b.min, value); b.max = Math.max(b.max, value);
    this.baselines[metric] = b;
  }

  // ─── LAYER 2: Anomaly Detection (Z-score + IQR) ───
  zscore(value, metric) {
    const b = this.baselines[metric];
    if (!b || b.sd === 0 || b.n < 5) return 0;
    return (value - b.mean) / b.sd;
  }

  detectAnomaly(metric, value) {
    const z = this.zscore(value, metric);
    const b = this.baselines[metric];
    if (Math.abs(z) < 2.5 || !b) return null;
    const anomaly = { metric, value, z: Math.round(z * 100) / 100,
                      baselineMean: Math.round(b.mean * 100) / 100,
                      baselineSd: Math.round(b.sd * 100) / 100,
                      level: Math.abs(z) > 3.5 ? 'critical' : 'high',
                      at: new Date().toISOString() };
    this.anomalies.push(anomaly);
    if (this.anomalies.length > 200) this.anomalies.shift();
    return anomaly;
  }

  // ─── LAYER 3: Sequence Mining (n-gram) ───
  sequences_() {
    return Object.entries(this.sequences)
      .filter(([k, v]) => v.count >= 3)
      .map(([key, v]) => {
        const [from, to] = key.split('>');
        return { from, to, count: v.count,
                 avgGapSec: Math.round(v.totalGap / v.count / 1000),
                 confidence: Math.min(100, v.count * 10) };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }

  // ─── LAYER 4: Feature Extraction ───
  extractFeatures(patient, context) {
    const v = context.lastVital || {};
    const los = patient.admittedAt ? (Date.now() - new Date(patient.admittedAt).getTime()) / 86400000 : 0;
    return {
      news2: v.news2 || v.newsScore || 0,
      age: patient.age || 50,
      comorbidity: (patient.comorbidities || []).length,
      los: Math.min(los, 60),
      marMissed: context.marMissed || 0,
      glucose: context.glucose || 100,
      isolation: context.isolation ? 1 : 0,
      pain: v.pain || 0,
      ioBalance: context.ioBalance || 0,
      codeStatus: patient.codeStatus === 'dnr' ? 1 : patient.codeStatus === 'dni' ? 2 : 0
    };
  }

  // ─── LAYER 5: Patient Risk Ensemble (3 models) ───
  patientRisk(patient, context) {
    const f = this.extractFeatures(patient, context);

    // Model 1: Weighted logistic
    let z = -3; // bias
    for (const [k, w] of Object.entries(this.weights)) {
      if (f[k] != null) z += w * this._normalize(k, f[k]);
    }
    const logistic = 1 / (1 + Math.exp(-z));

    // Model 2: Naive Bayes style (evidence accumulation)
    let bayes = 0.3;
    if (f.news2 >= 7) bayes += 0.30;
    else if (f.news2 >= 5) bayes += 0.15;
    if (f.age >= 80) bayes += 0.15;
    else if (f.age >= 70) bayes += 0.08;
    if (f.comorbidity >= 4) bayes += 0.15;
    if (f.marMissed >= 3) bayes += 0.10;
    bayes = Math.min(1, bayes);

    // Model 3: Simple decision tree
    let tree = 0.2;
    if (f.news2 >= 7) tree += 0.35;
    if (f.age >= 75 && f.comorbidity >= 2) tree += 0.20;
    if (f.marMissed >= 2 && f.news2 >= 5) tree += 0.15;
    tree = Math.min(1, tree);

    // Ensemble (weighted average)
    const score = Math.round((logistic * 0.4 + bayes * 0.35 + tree * 0.25) * 100);

    return {
      score,
      level: score >= 65 ? 'hi' : score >= 35 ? 'md' : 'lo',
      models: {
        logistic: Math.round(logistic * 100),
        bayes: Math.round(bayes * 100),
        tree: Math.round(tree * 100)
      },
      features: f,
      // Explainability: top contributors
      explain: this._explain(f)
    };
  }

  _normalize(metric, value) {
    const b = this.baselines[metric];
    if (b && b.sd > 0) return Math.max(-3, Math.min(3, (value - b.mean) / b.sd));
    const ranges = { news2: [0,10], age: [0,100], comorbidity: [0,6], los: [0,30],
                     marMissed: [0,5], glucose: [50,300], pain: [0,10], ioBalance: [-3000,3000] };
    const [lo, hi] = ranges[metric] || [0, 1];
    return Math.max(-1, Math.min(1, (value - lo) / (hi - lo) * 2 - 1));
  }

  _explain(features) {
    const contributions = [];
    for (const [k, w] of Object.entries(this.weights)) {
      const v = this._normalize(k, features[k]);
      if (Math.abs(v * w) > 0.05) {
        contributions.push({ feature: k, weight: Math.round(v * w * 100), value: features[k] });
      }
    }
    return contributions.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight)).slice(0, 5);
  }

  // ─── Cohort Risk (per ward) ───
  cohortRisk() {
    const patients = store.readAll('patients').filter(p => ['in_care','admitted'].includes(p.status));
    const vitals = store.readAll('vitals');
    const lastVital = {};
    for (const v of vitals) {
      if (!lastVital[v.patientId] || new Date(v.recordedAt) > new Date(lastVital[v.patientId].recordedAt))
        lastVital[v.patientId] = v;
    }
    const mar = store.readAll('mar');
    const byWard = {};
    for (const p of patients) {
      if (!byWard[p.wardCode]) byWard[p.wardCode] = { patients: [], critical: 0, high: 0 };
      const marMissed = mar.filter(m => m.patientId === p.id && m.status === 'missed').length;
      const risk = this.patientRisk(p, { lastVital: lastVital[p.id], marMissed });
      byWard[p.wardCode].patients.push({ patientId: p.id, name: p.firstName + ' ' + p.lastName, bed: p.bedNumber, ...risk });
      if (risk.level === 'hi') byWard[p.wardCode].critical++;
      else if (risk.level === 'md') byWard[p.wardCode].high++;
    }
    return Object.entries(byWard).map(([ward, d]) => ({
      wardCode: ward, total: d.patients.length, critical: d.critical, high: d.high,
      topRisks: d.patients.sort((a, b) => b.score - a.score).slice(0, 5)
    })).sort((a, b) => b.critical - a.critical);
  }

  // ─── Alerts for an actor ───
  alertsFor(actor) {
    const alerts = [];
    // Cohort alerts
    const cohorts = this.cohortRisk();
    for (const c of cohorts.filter(c => c.critical > 0).slice(0, 5)) {
      alerts.push({
        type: 'cohort_critical', severity: 'critical', icon: '🧠',
        title: `${c.critical} بیمار بحرانی در ${c.wardCode}`,
        message: `Neural score ${c.topRisks[0].score}% برای ${c.topRisks[0].name}`,
        href: '/panel/clinical'
      });
    }
    // Recent anomalies
    for (const a of this.anomalies.slice(-5)) {
      alerts.push({
        type: 'anomaly', severity: a.level, icon: '📊',
        title: `انحراف در ${a.metric}`,
        message: `مقدار ${a.value} (z=${a.z})`,
        href: '/panel/neural'
      });
    }
    // Sequence insights
    for (const s of this.sequences_().slice(0, 3)) {
      alerts.push({
        type: 'pattern', severity: 'medium', icon: '🔗',
        title: `الگوی مکرر: ${s.from} → ${s.to}`,
        message: `${s.count} بار (میانگین ${s.avgGapSec} ثانیه)`,
        href: '/panel/neural'
      });
    }
    return alerts;
  }

  stats() {
    return {
      eventsIngested: this.events.length,
      baselinesTracked: Object.keys(this.baselines).length,
      patternsLearned: Object.keys(this.sequences).length,
      anomaliesDetected: this.anomalies.length,
      trainingSamples: this.trainCount,
      baselines: this.baselines
    };
  }

  // Online learning: update weights from feedback
  learn(features, outcome) {
    const lr = 0.05;
    const pred = this.patientRisk({}, { lastVital: { news2: features.news2 } });
    const error = outcome - pred.score / 100;
    for (const [k, w] of Object.entries(this.weights)) {
      if (features[k] != null) {
        this.weights[k] = Math.max(0.01, Math.min(0.5, w + lr * error * this._normalize(k, features[k])));
      }
    }
    this.trainCount++;
  }


  // Compatibility aliases
  alerts(actor) { return this.alertsFor(actor || { role: "admin", id: "sys", username: "sys" }); }
  cohort() { return this.cohortRisk(); }
}

module.exports = new Neural();
