// ═══════════════════════════════════════════════════════════
//  NABZ CDSS Frontend — dashboard, patient sheet, calculators
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  NABZ.showCdss = async function(p, d) {
    const m = document.getElementById('content');
    let h = '<div class="sec-hd"><span>🧠 موتور بالینی</span>';
    h += '<span style="font-size:11px;color:var(--fg-2)">' + d.stats.total + ' بیمار</span></div>';

    h += '<div class="grid-4" style="margin-bottom:16px">';
    h += '<div class="stat dng"><div class="v">' + d.stats.critical + '</div><div class="l">بحرانی</div></div>';
    h += '<div class="stat warn"><div class="v">' + d.stats.high + '</div><div class="l">پرخطر</div></div>';
    h += '<div class="stat ok"><div class="v">' + d.stats.moderate + '</div><div class="l">پایدار</div></div>';
    h += '<div class="stat"><div class="v">' + d.stats.interactionsTracked + '</div><div class="l">تداخل</div></div>';
    h += '</div>';

    h += '<div class="sec-hd"><span>🛠 ابزار بالینی</span></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssInteractions()"><span style="font-size:20px">💊</span><span style="font-size:11px;font-weight:800">تداخل دارو</span></button>';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssRenal()"><span style="font-size:20px">🫘</span><span style="font-size:11px;font-weight:800">دوز کلیوی</span></button>';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssMorse()"><span style="font-size:20px">🚶</span><span style="font-size:11px;font-weight:800">Morse Fall</span></button>';
    h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.cdssBraden()"><span style="font-size:20px">🛏</span><span style="font-size:11px;font-weight:800">Braden</span></button>';
    h += '</div>';

    h += '<div class="sec-hd"><span>👥 امتیاز بیماران</span></div>';
    if (!d.patients.length) {
      h += '<div class="empty">بیماری بستری نیست</div>';
    } else {
      for (const pt of d.patients) {
        const lvl = pt.qsofa >= 2 || pt.news2 >= 7 ? 'hi' : pt.qsofa === 1 || pt.news2 >= 5 ? 'md' : 'lo';
        const cc = pt.composite >= 60 ? 'dng' : pt.composite >= 30 ? 'warn' : 'ok';
        h += '<div class="row ' + lvl + '" onclick="NABZ.cdssPatient(\'' + pt.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(pt.name) + '</div>';
        h += '<span class="pill ' + cc + '">' + pt.composite + '%</span></div>';
        h += '<div class="row-meta">' + NABZ._esc(pt.ward) + ' · تخت ' + NABZ._esc(pt.bed || '—') + ' · ' + (pt.age || '—') + ' س · ' + NABZ._esc(pt.diagnosis || '') + '</div>';
        h += '<div class="row-meta" style="font-size:11px">qSOFA: ' + pt.qsofa + ' · NEWS2: ' + pt.news2 + (pt.missedMar ? ' · ' + pt.missedMar + ' missed' : '') + '</div>';
        h += '</div>';
      }
    }
    m.innerHTML = h;
  };

  NABZ.cdssPatient = async function(patientId) {
    try {
      const d = await NABZ._api('/api/cdss/patient/' + patientId);
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧠 ' + NABZ._esc(d.patient.name) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05))">';
      h += '<div style="font-size:15px;font-weight:900">' + NABZ._esc(d.patient.name) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:3px">' + (d.patient.age || '—') + ' سال · ' + NABZ._esc(d.patient.ward) + ' · تخت ' + NABZ._esc(d.patient.bed || '—') + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(d.patient.diagnosis || '') + '</div>';
      h += '</div>';
      const cc = d.composite >= 60 ? 'dng' : d.composite >= 30 ? 'warn' : 'ok';
      h += '<div class="card"><div class="card-title">📊 ریسک ترکیبی</div>';
      h += '<div style="font-size:36px;font-weight:900;color:var(--' + cc + ');text-align:center;line-height:1">' + d.composite + '%</div>';
      h += '<div class="progress" style="margin-top:8px"><div class="progress-fill ' + cc + '" style="width:' + d.composite + '%"></div></div>';
      h += '</div>';
      h += '<div class="card"><div class="card-title">🦠 qSOFA</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span>امتیاز:</span><strong>' + d.scores.qsofa.score + '/3</strong></div>';
      if (d.scores.qsofa.findings.length) {
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(d.scores.qsofa.findings.join(' + ')) + '</div>';
      }
      h += '<div style="font-size:11.5px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">' + NABZ._esc(d.scores.qsofa.recommendation) + '</div>';
      h += '</div>';
      h += '<div class="card"><div class="card-title">📈 NEWS2</div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:13px"><span>امتیاز:</span><strong>' + d.scores.news2.score + '</strong></div>';
      h += '</div>';
      if (d.interactions.length) {
        h += '<div class="card" style="border-color:var(--dng)"><div class="card-title">💊 تداخل دارویی</div>';
        for (const ix of d.interactions) {
          h += '<div style="padding:8px;background:var(--dng-soft);border-radius:6px;margin-top:6px;font-size:11.5px">';
          h += '<div><strong>' + NABZ._esc(ix.drug1) + ' + ' + NABZ._esc(ix.drug2) + '</strong></div>';
          h += '<div style="color:var(--fg-2);margin-top:2px">' + NABZ._esc(ix.effect) + '</div>';
          h += '<div style="margin-top:2px">← ' + NABZ._esc(ix.action) + '</div>';
          h += '</div>';
        }
        h += '</div>';
      }
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(function() { sheet.classList.add('show'); });
    } catch (e) { alert('خطا: ' + e.message); }
  };

  NABZ.cdssInteractions = function() {
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">💊 بررسی تداخل دارویی</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-form">';
    h += '<div class="bs-field"><label>داروها (با کاما)</label>';
    h += '<textarea id="cdssDrugs" rows="3" style="font-family:monospace">warfarin, aspirin</textarea></div>';
    h += '<button class="bs-submit" onclick="NABZ._cdssCheckIx()">🔍 بررسی</button>';
    h += '<div id="cdssIxResult" style="margin-top:12px"></div>';
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { sheet.classList.add('show'); });
  };

  NABZ._cdssCheckIx = async function() {
    const drugs = document.getElementById('cdssDrugs').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean);
    if (drugs.length < 2) { alert('حداقل ۲ دارو'); return; }
    const el = document.getElementById('cdssIxResult');
    el.innerHTML = '<div style="text-align:center"><span class="spinner"></span></div>';
    try {
      const d = await NABZ._api('/api/cdss/interactions', {
        method: 'POST', body: JSON.stringify({ drugs: drugs })
      });
      if (!d.interactions.length) {
        el.innerHTML = '<div class="card" style="border-color:var(--ok);text-align:center;color:var(--ok);font-weight:800">✅ تداخلی یافت نشد</div>';
        return;
      }
      let h = '';
      for (const ix of d.interactions) {
        const sev = ix.severity === 'major' ? 'dng' : 'warn';
        h += '<div class="card" style="border-color:var(--' + sev + ')">';
        h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(ix.drug1) + ' + ' + NABZ._esc(ix.drug2) + '</div>';
        h += '<span class="pill ' + sev + '">' + ix.severity + '</span></div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(ix.effect) + '</div>';
        h += '<div style="font-size:11.5px;margin-top:6px;padding:6px;background:var(--bg-3);border-radius:6px">' + NABZ._esc(ix.action) + '</div>';
        h += '</div>';
      }
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
  };

  NABZ.cdssRenal = function() {
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">🫘 دوز کلیوی — Cockcroft-Gault</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-form">';
    h += '<div class="bs-field"><label>سن</label><input type="number" id="rdAge" value="65"></div>';
    h += '<div class="bs-field"><label>وزن (kg)</label><input type="number" id="rdWeight" value="70" step="0.1"></div>';
    h += '<div class="bs-field"><label>کراتینین (mg/dL)</label><input type="number" id="rdScr" value="1.0" step="0.01"></div>';
    h += '<div class="bs-field"><label>جنسیت</label><select id="rdSex"><option value="male">مرد</option><option value="female">زن</option></select></div>';
    h += '<div class="bs-field"><label>داروها (با کاما)</label><input type="text" id="rdDrugs" value="vancomycin, meropenem"></div>';
    h += '<button class="bs-submit" onclick="NABZ._cdssRenal()">🧮 محاسبه</button>';
    h += '<div id="rdResult" style="margin-top:12px"></div>';
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { sheet.classList.add('show'); });
  };

  NABZ._cdssRenal = async function() {
    const payload = {
      age: Number(document.getElementById('rdAge').value),
      weightKg: Number(document.getElementById('rdWeight').value),
      creatinineMgDl: Number(document.getElementById('rdScr').value),
      sex: document.getElementById('rdSex').value,
      drugs: document.getElementById('rdDrugs').value.split(',').map(function(s) { return s.trim(); }).filter(Boolean)
    };
    const el = document.getElementById('rdResult');
    el.innerHTML = '<div style="text-align:center"><span class="spinner"></span></div>';
    try {
      const d = await NABZ._api('/api/cdss/renal-dose', { method: 'POST', body: JSON.stringify(payload) });
      let h = '<div class="card"><div class="card-title">📊 CrCl: ' + d.crcl + ' mL/min</div></div>';
      for (const r of d.results) {
        h += '<div class="card">';
        h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(r.drug) + '</div>';
        h += r.found ? '<span class="pill info">CrCl ' + d.crcl + '</span>' : '<span class="pill warn">نامشخص</span>';
        h += '</div>';
        if (r.found) {
          h += '<div style="font-size:11.5px;margin-top:4px"><strong>معمول:</strong> ' + NABZ._esc(r.normal) + '</div>';
          h += '<div style="font-size:11.5px;margin-top:4px;padding:6px;background:var(--primary-soft);border-radius:6px"><strong>توصیه:</strong> ' + NABZ._esc(r.recommended) + '</div>';
          if (r.note) h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">⚠️ ' + NABZ._esc(r.note) + '</div>';
        } else {
          h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(r.message) + '</div>';
        }
        h += '</div>';
      }
      el.innerHTML = h;
    } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
  };

  NABZ.cdssMorse = function() {
    NABZ._cdssForm('morse', '🚶 Morse Fall Scale', [
      { id: 'historyOfFalling', label: 'سابقه سقوط', type: 'checkbox' },
      { id: 'secondaryDiagnosis', label: 'تشخیص ثانویه', type: 'checkbox' },
      { id: 'ambulatoryAid', label: 'وسیله کمکی', type: 'select', options: [
        { v: 'none', l: 'ندارد (0)' }, { v: 'furniture', l: 'مبلمان (30)' },
        { v: 'crutch_cane_walker', l: 'عصا/واکر (15)' } ]},
      { id: 'ivOrHeparinLock', label: 'سرم/هپارین‌لاک', type: 'checkbox' },
      { id: 'gait', label: 'راه‌رفتن', type: 'select', options: [
        { v: 'normal', l: 'طبیعی (0)' }, { v: 'weak', l: 'ضعیف (10)' },
        { v: 'impaired', l: 'اختلال (20)' } ]},
      { id: 'mentalStatus', label: 'وضعیت روانی', type: 'select', options: [
        { v: 'oriented', l: 'آگاه (0)' }, { v: 'overestimates', l: 'بیش‌برآورد (15)' } ]}
    ]);
  };

  NABZ.cdssBraden = function() {
    NABZ._cdssForm('braden', '🛏 Braden Scale', [
      { id: 'sensoryPerception', label: 'درک حسی (1-4)', type: 'number', min: 1, max: 4, default: 3 },
      { id: 'moisture', label: 'رطوبت (1-4)', type: 'number', min: 1, max: 4, default: 2 },
      { id: 'activity', label: 'فعالیت (1-4)', type: 'number', min: 1, max: 4, default: 2 },
      { id: 'mobility', label: 'تحرک (1-4)', type: 'number', min: 1, max: 4, default: 2 },
      { id: 'nutrition', label: 'تغذیه (1-4)', type: 'number', min: 1, max: 4, default: 3 },
      { id: 'frictionShear', label: 'اصطکاک/کشش (1-3)', type: 'number', min: 1, max: 3, default: 2 }
    ]);
  };

  NABZ._cdssForm = function(type, title, fields) {
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = function(e) { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">' + title + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<form class="bs-form" id="cdssForm">';
    for (const f of fields) {
      h += '<div class="bs-field"><label>' + NABZ._esc(f.label) + '</label>';
      if (f.type === 'checkbox') h += '<input type="checkbox" name="' + f.id + '">';
      else if (f.type === 'select') {
        h += '<select name="' + f.id + '">';
        for (const o of f.options) h += '<option value="' + o.v + '">' + NABZ._esc(o.l) + '</option>';
        h += '</select>';
      } else if (f.type === 'number') {
        h += '<input type="number" name="' + f.id + '" min="' + (f.min || '') + '" max="' + (f.max || '') + '" value="' + (f.default || '') + '">';
      } else {
        h += '<input type="text" name="' + f.id + '">';
      }
      h += '</div>';
    }
    h += '<button type="submit" class="bs-submit">🧮 محاسبه</button>';
    h += '<div id="cdssScoreResult" style="margin-top:12px"></div>';
    h += '</form>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(function() { sheet.classList.add('show'); });
    c.querySelector('#cdssForm').onsubmit = async function(ev) {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = {};
      fd.forEach(function(v, k) { data[k] = v === 'on' ? true : v; });
      try {
        const d = await NABZ._api('/api/cdss/score/' + type, { method: 'POST', body: JSON.stringify(data) });
        const el = document.getElementById('cdssScoreResult');
        const lc = d.level === 'high' || d.level === 'very_high' ? 'dng' : d.level === 'moderate' ? 'warn' : 'ok';
        let rh = '<div class="card" style="border-color:var(--' + lc + ')">';
        rh += '<div style="text-align:center;font-size:32px;font-weight:900;color:var(--' + lc + ')">' + d.score + '</div>';
        rh += '<div style="text-align:center;font-size:11px;color:var(--fg-2)">سطح: ' + d.level + '</div>';
        if (d.items && d.items.length) {
          rh += '<div style="font-size:11px;margin-top:8px;color:var(--fg-2)">' + NABZ._esc(d.items.join(' · ')) + '</div>';
        }
        rh += '<div style="font-size:11.5px;margin-top:8px;padding:6px;background:var(--bg-3);border-radius:6px">' + NABZ._esc(d.recommendation) + '</div>';
        rh += '</div>';
        el.innerHTML = rh;
      } catch (e) { alert('خطا: ' + e.message); }
    };
  };

  // ─── Wrap NABZ.show to intercept kind: 'cdss' ───
  function patchShow() {
    if (!window.NABZ || typeof NABZ.show !== 'function') {
      return setTimeout(patchShow, 200);
    }
    if (NABZ.show._cdssWrapped) return;
    const orig = NABZ.show;
    NABZ.show = async function(id) {
      const p = NABZ.state.panels.find(function(x) { return x.id === id; });
      if (!p || p.kind !== 'cdss') return orig.call(NABZ, id);
      NABZ.state.current = id;
      document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const d = await NABZ._api(p.api);
        await NABZ.showCdss(p, d);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
      }
    };
    NABZ.show._cdssWrapped = true;
    console.log('[cdss] show() wrapped ✓');
  }
  patchShow();

  // ─── Live alert listener ───
  function hookLive() {
    if (typeof window.Live === 'undefined') return setTimeout(hookLive, 300);
    Live.on('cdss.alert', function(data) {
      try {
        const kind = data.severity === 'critical' ? 'dng' : 'warn';
        const msg = '🧠 ' + (data.title || 'CDSS Alert');
        if (typeof liveToast === 'function') liveToast(msg, kind);
        else if (NABZ && NABZ._toast) NABZ._toast(msg);
        if (navigator.vibrate) {
          try { navigator.vibrate(data.severity === 'critical' ? [200,100,200] : 100); } catch (_) {}
        }
      } catch (e) { console.warn('[cdss] alert:', e.message); }
    });
    console.log('[cdss] alert listener ✓');
  }
  hookLive();
})();
