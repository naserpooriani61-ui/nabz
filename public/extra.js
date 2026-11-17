// ═══════════════════════════════════════════════════════════
//  NABZ Extra — Home Dashboard + Search
// ═══════════════════════════════════════════════════════════

NABZ.showHome = async function() {
  document.querySelectorAll('.bn-tab').forEach((b, i) => b.classList.toggle('on', i === 0));
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const d = await NABZ._api('/api/home/dashboard');

    let h = '';
    // Greeting
    h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.15),rgba(139,92,246,.1));border-color:rgba(6,182,212,.3)">';
    h += '<div style="font-size:24px;font-weight:900">' + NABZ._esc(d.greeting) + ' 👋</div>';
    h += '<div class="card-sub" style="margin-top:4px">' + NABZ._esc(d.user.role) + (d.user.ward ? ' · ' + NABZ._esc(d.user.ward) : '') + '</div>';
    h += '<div class="card-sub" style="margin-top:2px">' + new Date().toLocaleDateString('fa-IR', {weekday:'long', year:'numeric', month:'long', day:'numeric'}) + '</div>';
    h += '</div>';

    // Stats
    if (d.stats.length) {
      h += '<div class="sec-hd"><span>📊 امروز</span></div><div class="grid-4">';
      for (const s of d.stats) {
        const act = s.action ? ' onclick="' + s.action + '" style="cursor:pointer"' : '';
        h += '<div class="stat ' + (s.color || '') + '"' + act + '>';
        h += '<div class="v">' + s.value + '</div><div class="l">' + NABZ._esc(s.label) + '</div></div>';
      }
      h += '</div>';
    }

    // Alerts
    if (d.alerts.length) {
      h += '<div class="sec-hd"><span>🚨 هشدارها</span><span style="font-size:11px;color:var(--fg-2)">' + d.alerts.length + '</span></div>';
      for (const a of d.alerts) {
        const act = a.action ? ' onclick="' + a.action + '" style="cursor:pointer"' : '';
        h += '<div class="alert ' + a.severity + '"' + act + '>';
        h += '<div class="row-title">' + a.icon + ' ' + NABZ._esc(a.title) + '</div>';
        h += '<div class="row-meta">' + NABZ._esc(a.message || '') + '</div></div>';
      }
    } else {
      h += '<div class="empty" style="padding:24px">✅ همه چیز تحت کنترل</div>';
    }

    // Quick links
    if (d.quickLinks.length) {
      h += '<div class="sec-hd"><span>⚡ دسترسی سریع</span></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">';
      for (const q of d.quickLinks) {
        h += '<button class="btn" style="flex-direction:column;padding:16px 8px;display:flex;gap:6px;align-items:center" onclick="' + q.action + '">';
        h += '<span style="font-size:22px">' + q.icon + '</span>';
        h += '<span style="font-size:10.5px;font-weight:800">' + NABZ._esc(q.label) + '</span></button>';
      }
      h += '</div>';
    }

    m.innerHTML = h;
  } catch (e) {
    m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
  }
};

NABZ.showSearch = function() {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

  let html = '<div class="bs-handle"></div>';
  html += '<div class="bs-hd"><div class="bs-title">🔍 جستجوی سراسری</div>';
  html += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  html += '<input id="nsIn" type="search" placeholder="نام بیمار، دارو، خدمت..." autocomplete="off" ';
  html += 'style="width:100%;padding:14px;font-size:15px;border:1.5px solid var(--border-2);background:var(--bg-2);color:var(--fg);border-radius:12px;margin-bottom:14px;font-family:inherit">';
  html += '<div id="nsRes" style="max-height:55vh;overflow-y:auto"></div>';

  const content = document.createElement('div');
  content.className = 'bs-sheet';
  content.innerHTML = html;
  sheet.appendChild(content);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));

  const input = content.querySelector('#nsIn');
  const res = content.querySelector('#nsRes');
  let timer;

  input.oninput = () => {
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { res.innerHTML = '<div class="empty">حداقل ۲ حرف</div>'; return; }
    timer = setTimeout(async () => {
      res.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
      try {
        const d = await NABZ._api('/api/home/search?q=' + encodeURIComponent(q));
        if (!d.items.length) { res.innerHTML = '<div class="empty">نتیجه‌ای نیست</div>'; return; }
        let rh = '';
        for (const r of d.items) {
          const it = r.item;
          const nm = it.patientName || ((it.firstName || '') + ' ' + (it.lastName || '')).trim()
            || it.fullName || it.drugName || (it.description || '').slice(0, 40) || '?';
          const path = r.module + '.' + r.panel;
          rh += '<div class="row lo" onclick="NABZ._closeAndGo(\'' + path + '\')">';
          rh += '<div class="row-hd"><div class="row-title">' + NABZ._esc(String(nm).slice(0, 50)) + '</div>';
          rh += '<span class="pill info">' + NABZ._esc(r.module) + '</span></div></div>';
        }
        res.innerHTML = rh;
      } catch (e) { res.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
    }, 300);
  };
  setTimeout(() => input.focus(), 100);
};

NABZ._closeAndGo = function(path) {
  const bd = document.querySelector('.bs-backdrop');
  if (bd) bd.remove();
  NABZ.show(path);
};

// Expose internal helpers for extra.js
NABZ._api = function(path, opts) {
  const t = NABZ.state.token;
  return fetch(path, {
    ...(opts || {}),
    headers: { 'Content-Type': 'application/json', ...(opts && opts.headers || {}), Authorization: 'Bearer ' + t }
  }).then(r => r.json()).then(b => {
    if (!b.ok) throw new Error(b.error || 'error');
    return b.data;
  });
};
NABZ._esc = function(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
};

// ═══════════════════════════════════════════════════════════
//  Nursing Report — Custom Editor
// ═══════════════════════════════════════════════════════════

NABZ.showNursing = async function(p, d) {
  const items = d.items || [];
  let h = '<div class="sec-hd"><span>📝 گزارش پرستاری</span><span style="font-size:11px;color:var(--fg-2)">' + items.length + '</span></div>';
  h += '<button class="btn btn-primary btn-block" style="margin-bottom:12px" onclick="NABZ.pickPatientForReport()">➕ گزارش جدید</button>';

  if (!items.length) {
    h += '<div class="empty">گزارشی ثبت نشده<br><span style="font-size:11px;opacity:.7">اولین گزارش را بساز</span></div>';
  } else {
    for (const r of items) {
      const statusLbl = { draft:'پیش‌نویس', signed:'امضا', received:'دریافت' }[r.status];
      const statusCls = { draft:'warn', signed:'info', received:'ok' }[r.status];
      const shift = { morning:'صبح', evening:'عصر', night:'شب' }[r.shiftType] || r.shiftType;
      h += '<div class="row ' + (r.status === 'signed' ? 'md' : r.status === 'received' ? 'lo' : '') + '" onclick="NABZ.viewNursing(\'' + r.id + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(r.patientName) + '</div>';
      h += '<span class="pill ' + statusCls + '">' + statusLbl + '</span></div>';
      h += '<div class="row-meta">' + NABZ._esc(r.wardCode || '') + ' · شیفت ' + shift + ' · ' + NABZ._esc(r.fromUserName || '') + '</div>';
      if (r.uniqueCode) h += '<div class="row-meta" style="color:var(--primary);font-family:monospace;font-size:10px">🔐 ' + NABZ._esc(r.uniqueCode) + '</div>';
      h += '</div>';
    }
  }
  document.getElementById('content').innerHTML = h;
};

NABZ.pickPatientForReport = async function() {
  try {
    const d = await NABZ._api('/api/clinical/patients');
    const patients = (d.items || []).filter(x => ['in_care','admitted'].includes(x.status));
    if (!patients.length) { alert('بیماری در حال بستری نیست'); return; }
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">👤 انتخاب بیمار</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-body">';
    for (const p of patients) {
      h += '<button class="btn btn-block" style="text-align:right;padding:16px;margin-bottom:6px" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.createNursingDraft(\'' + p.id + '\')">';
      h += '<div style="font-weight:800">' + NABZ._esc(p.firstName + ' ' + p.lastName) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(p.wardCode || '') + ' · تخت ' + NABZ._esc(p.bedNumber || '—') + '</div>';
      h += '</button>';
    }
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  } catch (e) { alert(e.message); }
};

NABZ.createNursingDraft = async function(patientId) {
  try {
    const r = await NABZ._api('/api/nr/create', { method:'POST', body: JSON.stringify({ patientId, shiftType: 'morning' }) });
    await NABZ.openNursingEditor(r.id);
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.openNursingEditor = async function(reportId) {
  try {
    const [report, nandaCatalog] = await Promise.all([
      NABZ._api('/api/nr/' + reportId),
      NABZ._api('/api/nr/nanda')
    ]);
    const ctx = await NABZ._api('/api/nr/context/' + report.patientId);
    const isDraft = report.status === 'draft';
    const isbar = report.isbar || {};
    const sit = isbar.situation || {};
    const bg = isbar.background || {};
    const asmt = isbar.assessment || {};
    const rec = isbar.recommendation || {};
    const selectedNanda = new Set(asmt.diagnoses || []);

    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };

    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">📝 ' + NABZ._esc(ctx.patient.name) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

    // Patient header
    h += '<div class="card" style="margin-bottom:12px;background:linear-gradient(135deg,rgba(6,182,212,.08),rgba(139,92,246,.05))">';
    h += '<div style="font-size:15px;font-weight:900">' + NABZ._esc(ctx.patient.name) + '</div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-top:3px">' + (ctx.patient.age || '—') + ' سال · ' + (ctx.patient.sex === 'female' ? 'زن' : 'مرد') + ' · ' + NABZ._esc(ctx.patient.wardCode || '') + ' · تخت ' + NABZ._esc(ctx.patient.bedNumber || '—') + '</div>';
    if (ctx.patient.allergies.length) h += '<div style="font-size:10.5px;color:var(--dng);margin-top:4px;font-weight:700">⚠️ آلرژی: ' + NABZ._esc(ctx.patient.allergies.join('، ')) + '</div>';
    h += '</div>';

    // Shift + auto-fill
    h += '<div class="bs-field"><label>شیفت</label>';
    h += '<select id="nrShift" ' + (isDraft ? '' : 'disabled') + '>';
    for (const [k, v] of [['morning','صبح'],['evening','عصر'],['night','شب']]) {
      h += '<option value="' + k + '"' + (report.shiftType === k ? ' selected' : '') + '>' + v + '</option>';
    }
    h += '</select></div>';

    if (isDraft) {
      h += '<button class="btn btn-block" style="margin-bottom:14px;background:var(--bg-3)" onclick="NABZ.autoFillReport(\'' + reportId + '\')">🤖 پرکردن خودکار از داده‌های بیمار</button>';
    }

    // S
    h += '<div class="card" style="margin-top:10px"><div class="card-title">📌 S — وضعیت فعلی</div>';
    h += '<div class="bs-field"><label>وضعیت</label><input id="nrS" value="' + NABZ._esc(sit.currentIssue || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '<div class="bs-field" style="margin-top:8px"><label>ویتال خلاصه</label><input id="nrSVit" value="' + NABZ._esc(sit.vitals || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '</div>';

    // B
    h += '<div class="card"><div class="card-title">📚 B — سابقه</div>';
    h += '<div class="bs-field"><label>علت بستری</label><input id="nrB" value="' + NABZ._esc(bg.reason || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '<div class="bs-field" style="margin-top:8px"><label>همراهی / سابقه</label><input id="nrBHist" value="' + NABZ._esc(bg.history || '') + '" ' + (isDraft ? '' : 'disabled') + '></div>';
    h += '</div>';

    // A — NANDA picker
    h += '<div class="card"><div class="card-title">🔍 A — ارزیابی</div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">تشخیص‌های NANDA</div>';
    h += '<div style="max-height:240px;overflow-y:auto;background:var(--bg);border-radius:8px;padding:8px" id="nandaBox">';
    for (const dom of nandaCatalog.domains) {
      const items = nandaCatalog.diagnoses.filter(d => d.domain === dom.id);
      if (!items.length) continue;
      h += '<div style="font-size:10px;font-weight:900;color:var(--primary);padding:6px 4px 3px">' + NABZ._esc(dom.label) + '</div>';
      for (const d of items) {
        const on = selectedNanda.has(d.code);
        h += '<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:11.5px;cursor:pointer' + (isDraft ? '' : ';opacity:.7') + '">';
        h += '<input type="checkbox" data-code="' + d.code + '" ' + (on ? 'checked' : '') + ' ' + (isDraft ? '' : 'disabled') + ' style="width:16px;height:16px;flex-shrink:0">';
        h += '<span>' + (d.risk ? '⚠️ ' : '') + NABZ._esc(d.label) + '</span>';
        h += '<span style="font-family:monospace;font-size:9px;color:var(--fg-3);margin-right:auto">' + d.code + '</span>';
        h += '</label>';
      }
    }
    h += '</div>';
    h += '<div class="bs-field" style="margin-top:8px"><label>ارزیابی بالینی</label><textarea id="nrA" rows="3" ' + (isDraft ? '' : 'disabled') + '>' + NABZ._esc(asmt.clinicalImpression || '') + '</textarea></div>';
    h += '</div>';

    // R
    h += '<div class="card"><div class="card-title">📋 R — پیگیری</div>';
    h += '<div class="bs-field"><label>توصیه‌ها</label><textarea id="nrR" rows="2" ' + (isDraft ? '' : 'disabled') + '>' + NABZ._esc(rec.followUp || '') + '</textarea></div>';
    h += '</div>';

    // Actions
    if (isDraft) {
      h += '<div style="display:flex;gap:8px;margin-top:16px">';
      h += '<button class="btn" style="flex:1;padding:14px" onclick="NABZ.saveNursingReport(\'' + reportId + '\',false)">💾 ذخیره</button>';
      h += '<button class="btn btn-primary" style="flex:1;padding:14px" onclick="NABZ.saveNursingReport(\'' + reportId + '\',true)">✍️ امضا</button>';
      h += '</div>';
    } else if (report.status === 'signed') {
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:16px" onclick="NABZ.receiveReport(\'' + reportId + '\')">✅ دریافت</button>';
    }

    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.autoFillReport = async function(reportId) {
  try {
    const r = await NABZ._api('/api/nr/' + reportId);
    const s = await NABZ._api('/api/nr/suggest/' + r.patientId);
    const setv = (id, v) => { const el = document.getElementById(id); if (el && v) el.value = v; };
    setv('nrS', s.situation);
    setv('nrSVit', s.vitalsText);
    setv('nrB', s.background);
    setv('nrA', s.assessment);
    setv('nrR', s.recommendation);
    // NANDA
    document.querySelectorAll('#nandaBox input[type=checkbox]').forEach(cb => {
      if (s.suggestedNanda.includes(cb.dataset.code)) cb.checked = true;
    });
    alert('✅ پر شد — بازبینی کن و امضا');
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.saveNursingReport = async function(reportId, sign) {
  try {
    const isbar = {
      situation: { currentIssue: document.getElementById('nrS').value, vitals: document.getElementById('nrSVit').value },
      background: { reason: document.getElementById('nrB').value, history: document.getElementById('nrBHist').value },
      assessment: {
        diagnoses: [...document.querySelectorAll('#nandaBox input:checked')].map(c => c.dataset.code),
        clinicalImpression: document.getElementById('nrA').value
      },
      recommendation: { followUp: document.getElementById('nrR').value }
    };
    const shiftType = document.getElementById('nrShift').value;
    await NABZ._api('/api/nr/' + reportId, { method: 'PUT', body: JSON.stringify({ isbar, shiftType }) });
    if (sign) {
      const signed = await NABZ._api('/api/nr/' + reportId + '/sign', { method: 'POST', body: '{}' });
      document.querySelector('.bs-backdrop')?.remove();
      setTimeout(() => {
        alert('✅ امضا شد!\n\nکد یکتا: ' + signed.uniqueCode + '\n\nاین کد در گزارش‌های دریافت‌کننده ثبت می‌شود.');
        NABZ.show('nursing_report.nursing');
      }, 100);
    } else {
      document.querySelector('.bs-backdrop')?.remove();
      alert('💾 ذخیره شد');
      NABZ.show('nursing_report.nursing');
    }
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.receiveReport = async function(reportId) {
  try {
    await NABZ._api('/api/nr/' + reportId + '/receive', { method: 'POST', body: '{}' });
    document.querySelector('.bs-backdrop')?.remove();
    alert('✅ دریافت شد');
    NABZ.show('nursing_report.nursing');
  } catch (e) { alert('خطا: ' + e.message); }
};

NABZ.viewNursing = async function(reportId) {
  try {
    const r = await NABZ._api('/api/nr/' + reportId);
    const nanda = await NABZ._api('/api/nr/nanda');
    const isbar = r.isbar || {};
    const sit = isbar.situation || {};
    const bg = isbar.background || {};
    const asmt = isbar.assessment || {};
    const rec = isbar.recommendation || {};

    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">📝 ' + NABZ._esc(r.patientName) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div style="font-size:11px;color:var(--fg-2);padding-bottom:10px;border-bottom:1px solid var(--border);margin-bottom:14px">';
    h += NABZ._esc(r.wardCode) + ' · شیفت ' + ({morning:'صبح',evening:'عصر',night:'شب'})[r.shiftType] + ' · ' + NABZ._esc(r.fromUserName);
    if (r.uniqueCode) h += '<div style="margin-top:6px;font-family:monospace;color:var(--primary);font-weight:800">🔐 ' + NABZ._esc(r.uniqueCode) + '</div>';
    h += '</div>';

    if (sit.currentIssue) h += '<div class="card"><div class="card-title">📌 S</div><div>' + NABZ._esc(sit.currentIssue) + '</div>' + (sit.vitals ? '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(sit.vitals) + '</div>' : '') + '</div>';
    if (bg.reason || bg.history) h += '<div class="card"><div class="card-title">📚 B</div>' + (bg.reason ? '<div>' + NABZ._esc(bg.reason) + '</div>' : '') + (bg.history ? '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + NABZ._esc(bg.history) + '</div>' : '') + '</div>';
    if (asmt.diagnoses?.length || asmt.clinicalImpression) {
      h += '<div class="card"><div class="card-title">🔍 A</div>';
      if (asmt.diagnoses?.length) {
        const dnames = asmt.diagnoses.map(c => { const d = nanda.diagnoses.find(x => x.code === c); return d ? d.label : c; }).join('، ');
        h += '<div style="font-size:12px;margin-bottom:4px"><strong>NANDA:</strong> ' + NABZ._esc(dnames) + '</div>';
      }
      if (asmt.clinicalImpression) h += '<div style="font-size:12px">' + NABZ._esc(asmt.clinicalImpression) + '</div>';
      h += '</div>';
    }
    if (rec.followUp) h += '<div class="card"><div class="card-title">📋 R</div><div>' + NABZ._esc(rec.followUp) + '</div></div>';

    if (r.status === 'signed') {
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:14px" onclick="NABZ.receiveReport(\'' + reportId + '\')">✅ دریافت این گزارش</button>';
    }
    if (r.status === 'received') {
      h += '<div class="card" style="border-color:var(--ok);text-align:center;color:var(--ok);font-weight:800">✅ دریافت شده</div>';
    }

    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  } catch (e) { alert('خطا: ' + e.message); }
};

// ═══════════════════════════════════════════════════════════
//  Bed Board + Ward Filter
// ═══════════════════════════════════════════════════════════

const WARD_GROUP_LABELS = {
  admin:'🏛 دفتر', critical:'💔 مراقبت ویژه', emergency:'🚨 اورژانس',
  surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورولوژی',
  oncology:'🎗 آنکولوژی', special:'✨ ویژه', vip:'⭐ VIP'
};

NABZ.showBedboard = async function(p, d) {
  const wards = d.items || [];
  const byGroup = {};
  for (const w of wards) {
    if (!byGroup[w.group]) byGroup[w.group] = [];
    byGroup[w.group].push(w);
  }
  const groupOrder = ['critical','emergency','surgical','internal','neuro','oncology','special','vip','admin'];

  const totalBeds = wards.reduce((s, w) => s + w.total, 0);
  const totalOcc = wards.reduce((s, w) => s + w.occupied, 0);
  const totalAvail = wards.reduce((s, w) => s + w.available, 0);

  let h = '<div class="sec-hd"><span>🛏️ نقشه تخت سینا</span><span style="font-size:11px;color:var(--fg-2)">' + wards.length + ' بخش</span></div>';

  // Stats
  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ok"><div class="v">' + totalAvail + '</div><div class="l">تخت آزاد</div></div>';
  h += '<div class="stat dng"><div class="v">' + totalOcc + '</div><div class="l">اشغال</div></div>';
  h += '<div class="stat"><div class="v">' + totalBeds + '</div><div class="l">کل</div></div>';
  h += '<div class="stat ' + (totalOcc/totalBeds >= 0.85 ? 'warn' : '') + '"><div class="v">' + Math.round(totalOcc/totalBeds*100) + '%</div><div class="l">اشغال</div></div>';
  h += '</div>';

  // Wards by group
  for (const grp of groupOrder) {
    if (!byGroup[grp]) continue;
    h += '<div style="font-size:12px;font-weight:900;color:var(--fg-2);margin:16px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--border)">' + (WARD_GROUP_LABELS[grp] || grp) + '</div>';
    for (const w of byGroup[grp]) {
      const lvl = w.occupancyPct >= 90 ? 'dng' : w.occupancyPct >= 75 ? 'warn' : 'ok';
      h += '<div class="row ' + (lvl === 'dng' ? 'hi' : lvl === 'warn' ? 'md' : 'lo') + '" onclick="NABZ.openWard(\'' + w.code + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(w.label) + '</div>';
      h += '<span class="pill ' + lvl + '">' + w.occupancyPct + '%</span></div>';
      h += '<div class="row-meta">سرپرستار: ' + NABZ._esc(w.headNurse || '—') + ' · ' + w.occupied + '/' + w.total + ' تخت</div>';
      // occupancy bar
      h += '<div style="height:4px;background:var(--border);border-radius:2px;margin-top:8px;overflow:hidden"><div style="height:100%;width:' + w.occupancyPct + '%;background:var(--' + (lvl === 'dng' ? 'dng' : lvl === 'warn' ? 'warn' : 'ok') + ');border-radius:2px"></div></div>';
      h += '</div>';
    }
  }
  document.getElementById('content').innerHTML = h;
};

NABZ.openWard = async function(code) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const d = await NABZ._api('/api/bedboard/ward/' + code);
    const w = d.ward;
    let h = '<div class="sec-hd"><span>🛏️ ' + NABZ._esc(w.label) + '</span><span style="font-size:11px;color:var(--fg-2)">' + d.items.length + ' تخت</span></div>';
    h += '<div class="card" style="margin-bottom:12px"><div style="font-size:12px">سرپرستار: <strong>' + NABZ._esc(w.headNurse) + '</strong></div></div>';
    h += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(70px,1fr));gap:8px">';
    for (const b of d.items) {
      const color = b.status === 'occupied' ? 'var(--dng)' : b.status === 'cleaning' ? 'var(--warn)' : 'var(--ok)';
      h += '<div class="card" style="padding:8px;text-align:center;border-top:3px solid ' + color + ';cursor:pointer" onclick="NABZ.showBedDetail(\'' + b.id + '\')">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary)">' + NABZ._esc(b.bedNumber) + '</div>';
      if (b.patient) {
        h += '<div style="font-size:9.5px;font-weight:700;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + NABZ._esc(b.patient.name) + '</div>';
        h += '<div style="font-size:8.5px;color:var(--fg-2)">' + (b.patient.age || '—') + ' س</div>';
      } else {
        h += '<div style="font-size:9px;color:var(--fg-3);margin-top:2px">' + (b.status === 'cleaning' ? '🧹' : '✓') + '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
    h += '<div style="margin-top:16px"><button class="btn btn-block" onclick="NABZ.show(\'bedboard.wards\')">← بازگشت</button></div>';
    m.innerHTML = h;
  } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>'; }
};

NABZ.showBedDetail = function(bedId) {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  NABZ._api('/api/bedboard/ward/' + NABZ._currentWard).then(d => {
    const b = d.items.find(x => x.id === bedId);
    if (!b) return;
    let h = '<div class="bs-handle"></div>';
    h += '<div class="bs-hd"><div class="bs-title">🛏️ ' + NABZ._esc(b.bedNumber) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div class="bs-body">';
    h += '<div class="bs-row"><div class="bs-key">status</div><div class="bs-val">' + NABZ._esc(b.status) + '</div></div>';
    if (b.patient) {
      h += '<div class="bs-row"><div class="bs-key">patient</div><div class="bs-val">' + NABZ._esc(b.patient.name) + '</div></div>';
      h += '<div class="bs-row"><div class="bs-key">age</div><div class="bs-val">' + (b.patient.age || '—') + '</div></div>';
      h += '<div class="bs-row"><div class="bs-key">diagnosis</div><div class="bs-val">' + NABZ._esc(b.patient.diagnosis || '—') + '</div></div>';
    }
    h += '</div>';
    const c = document.createElement('div');
    c.className = 'bs-sheet';
    c.innerHTML = h;
    sheet.appendChild(c);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  }).catch(e => alert(e.message));
};

// Store current ward for bed detail
const _origOpenWard = NABZ.openWard;
NABZ.openWard = async function(code) {
  NABZ._currentWard = code;
  return _origOpenWard(code);
};

// ═══════════════════════════════════════════════════════════
//  Sina Reseed Button
// ═══════════════════════════════════════════════════════════

NABZ.loadSinaData = async function() {
  if (!confirm('⚠️ این عمل تمام تخت‌ها و پرسنل فعلی را پاک می‌کند و دیتای واقعی سینا را بارگذاری می‌کند.\n\nبیماران و سایر داده‌ها حفظ می‌شوند.\n\nادامه؟')) return;
  try {
    const r = await NABZ._api('/api/bedboard/reseed-sina', { method:'POST', body: '{}' });
    alert('✅ دیتای سینا بارگذاری شد\n\nبخش‌ها: ' + r.wardsLoaded + '\nتخت‌ها: ' + r.bedsAfter + '\nپرسنل: ' + r.staffAfter);
    NABZ.show('bedboard.wards');
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ.loadRealPatients = async function() {
  if (!confirm('⚠️ تمام بیماران و داده‌های بالینی فعلی پاک می‌شوند.\n\n۱۵ بیمار واقعی با داده کامل جایگزین می‌شوند.\n\nادامه؟')) return;
  try {
    const r = await NABZ._api('/api/bedboard/seed-real', { method:'POST', body: '{}' });
    alert('✅ دیتا بارگذاری شد\n\nبیماران: ' + r.patients + '\nویتال: ' + r.vitals + '\nدستورات: ' + r.orders + '\nMAR: ' + r.mar);
    if (NABZ.showHome) NABZ.showHome();
    else NABZ.show('bedboard.wards');
  } catch (e) { alert('❌ ' + e.message); }
};

// ═══════════════════════════════════════════════════════════
//  SVG Chart Helpers
// ═══════════════════════════════════════════════════════════
function svgLineChart(width, height, labels, series) {
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 1);
  const n = labels.length;
  let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;display:block">';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    const v = Math.round(max - (max / 4) * i);
    svg += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (width - pad.r) + '" y2="' + y + '" stroke="#1c2942" stroke-width="0.6" stroke-dasharray="2,2"/>';
    svg += '<text x="' + (pad.l - 4) + '" y="' + (y + 3) + '" font-size="8" fill="#8a96ae" text-anchor="end">' + v + '</text>';
  }
  for (let i = 0; i < n; i++) {
    const x = pad.l + (w / Math.max(1, n - 1)) * i;
    svg += '<text x="' + x + '" y="' + (height - 6) + '" font-size="8" fill="#8a96ae" text-anchor="middle">' + labels[i] + '</text>';
  }
  for (const s of series) {
    const pts = s.values.map((v, i) => {
      const x = pad.l + (w / Math.max(1, n - 1)) * i;
      const y = pad.t + h - (v / max) * h;
      return x.toFixed(1) + ',' + y.toFixed(1);
    }).join(' ');
    svg += '<polyline points="' + pts + '" fill="none" stroke="' + s.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';
    for (let i = 0; i < s.values.length; i++) {
      const x = pad.l + (w / Math.max(1, n - 1)) * i;
      const y = pad.t + h - (s.values[i] / max) * h;
      svg += '<circle cx="' + x + '" cy="' + y + '" r="2.5" fill="' + s.color + '"/>';
    }
  }
  svg += '</svg>';
  return svg;
}

function svgBarChart(width, height, labels, series) {
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const allVals = series.flatMap(s => s.values);
  const max = Math.max(...allVals, 1);
  const n = labels.length;
  const gw = w / n;
  const bw = (gw * 0.7) / series.length;
  let svg = '<svg viewBox="0 0 ' + width + ' ' + height + '" style="width:100%;height:auto;display:block">';
  for (let i = 0; i <= 4; i++) {
    const y = pad.t + (h / 4) * i;
    const v = Math.round(max - (max / 4) * i);
    svg += '<line x1="' + pad.l + '" y1="' + y + '" x2="' + (width - pad.r) + '" y2="' + y + '" stroke="#1c2942" stroke-width="0.6" stroke-dasharray="2,2"/>';
    svg += '<text x="' + (pad.l - 4) + '" y="' + (y + 3) + '" font-size="8" fill="#8a96ae" text-anchor="end">' + v + '</text>';
  }
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < series.length; j++) {
      const v = series[j].values[i] || 0;
      const bh = (v / max) * h;
      const x = pad.l + i * gw + (gw - bw * series.length) / 2 + j * bw;
      const y = pad.t + h - bh;
      if (bh > 0) svg += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 1) + '" height="' + bh + '" fill="' + series[j].color + '" rx="1"/>';
    }
    svg += '<text x="' + (pad.l + i * gw + gw / 2) + '" y="' + (height - 6) + '" font-size="8" fill="#8a96ae" text-anchor="middle">' + labels[i] + '</text>';
  }
  svg += '</svg>';
  return svg;
}

function svgDonut(size, data) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const cx = size / 2, cy = size / 2;
  const r = size * 0.35;
  const strokeW = size * 0.14;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  let svg = '<svg viewBox="0 0 ' + size + ' ' + size + '" style="width:100%;max-width:180px;height:auto;display:block;margin:0 auto">';
  for (const d of data) {
    const pct = d.value / total;
    const dash = pct * circ;
    svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="' + d.color + '" stroke-width="' + strokeW + '" stroke-dasharray="' + dash + ' ' + (circ - dash) + '" stroke-dashoffset="' + (-offset) + '" transform="rotate(-90 ' + cx + ' ' + cy + ')" opacity="' + (pct > 0 ? 1 : 0.15) + '"/>';
    offset += dash;
  }
  svg += '<text x="' + cx + '" y="' + (cy - 4) + '" font-size="' + (size * 0.16) + '" font-weight="900" text-anchor="middle" fill="#eef2f9">' + total + '</text>';
  svg += '<text x="' + cx + '" y="' + (cy + size * 0.1) + '" font-size="' + (size * 0.07) + '" text-anchor="middle" fill="#8a96ae">بیمار</text>';
  svg += '</svg>';
  return svg;
}

// ═══════════════════════════════════════════════════════════
//  Analytics Dashboard
// ═══════════════════════════════════════════════════════════
NABZ.showAnalytics = async function(p, d) {
  if (!d) d = await NABZ._api('/api/analytics/overview');
  let h = '<div class="sec-hd"><span>📊 تحلیل زنده</span><span style="font-size:11px;color:var(--fg-2)">' + new Date().toLocaleTimeString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + '</span></div>';

  // KPI strip
  const totalNews = d.topCritical.reduce((s, x) => s + 1, 0);
  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ' + (d.topCritical[0] && d.topCritical[0].news >= 7 ? 'dng' : 'warn') + '"><div class="v">' + totalNews + '</div><div class="l">بحرانی</div></div>';
  h += '<div class="stat ' + (d.crisisActive ? 'dng' : 'ok') + '"><div class="v">' + (d.crisisActive ? '🚨' : '✓') + '</div><div class="l">بحران</div></div>';
  h += '<div class="stat ' + (d.sepsisAlerts > 0 ? 'warn' : 'ok') + '"><div class="v">' + d.sepsisAlerts + '</div><div class="l">سپسیس</div></div>';
  h += '<div class="stat"><div class="v">' + d.openIncidents + '</div><div class="l">حادثه</div></div>';
  h += '</div>';

  // NEWS Trend
  if (d.newsTrend.series.length) {
    h += '<div class="card"><div class="card-title">📈 روند NEWS2 — ۷ روز</div>';
    h += svgLineChart(340, 160, d.newsTrend.labels, d.newsTrend.series);
    h += '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:10px;font-size:11px">';
    for (const s of d.newsTrend.series) {
      h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:' + s.color + ';border-radius:2px"></span>' + NABZ._esc(s.label) + '</span>';
    }
    h += '</div></div>';
  }

  // MAR Trend
  h += '<div class="card"><div class="card-title">💊 روند MAR — ۷ روز</div>';
  h += svgBarChart(340, 140, d.marTrend.labels, d.marTrend.series);
  h += '<div style="display:flex;gap:12px;margin-top:10px;font-size:11px">';
  for (const s of d.marTrend.series) {
    h += '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:' + s.color + ';border-radius:2px"></span>' + NABZ._esc(s.label) + '</span>';
  }
  h += '</div></div>';

  // Occupancy
  if (d.occupancy.length) {
    h += '<div class="card"><div class="card-title">🛏️ اشغال تخت بر اساس گروه</div>';
    for (const g of d.occupancy.slice(0, 6)) {
      h += '<div style="margin-bottom:10px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:11.5px;margin-bottom:4px"><span>' + NABZ._esc(g.label) + '</span><span style="font-weight:800">' + g.occupied + '/' + g.total + ' · ' + g.pct + '%</span></div>';
      h += '<div class="progress"><div class="progress-fill ' + g.level + '" style="width:' + g.pct + '%"></div></div>';
      h += '</div>';
    }
    h += '</div>';
  }

  // ESI distribution
  const esiData = [
    { label:'ESI 1', value: d.esi[1], color:'#7f1d1d' },
    { label:'ESI 2', value: d.esi[2], color:'#dc2626' },
    { label:'ESI 3', value: d.esi[3], color:'#f59e0b' },
    { label:'ESI 4', value: d.esi[4], color:'#0ea5e9' },
    { label:'ESI 5', value: d.esi[5], color:'#10b981' }
  ];
  if (esiData.some(e => e.value > 0)) {
    h += '<div class="card"><div class="card-title">🚑 توزیع ESI — اورژانس</div>';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:center">';
    h += '<div>' + svgDonut(180, esiData) + '</div>';
    h += '<div style="font-size:11.5px">';
    for (const e of esiData) {
      if (e.value === 0) continue;
      h += '<div style="display:flex;align-items:center;gap:6px;margin:4px 0"><span style="width:10px;height:10px;background:' + e.color + ';border-radius:2px"></span>' + e.label + ': <strong>' + e.value + '</strong></div>';
    }
    h += '</div></div></div>';
  }

  // Top critical
  if (d.topCritical.length) {
    h += '<div class="sec-hd"><span>🚨 بیماران بحرانی</span></div>';
    for (const p2 of d.topCritical) {
      const lvl = p2.news >= 7 ? 'hi' : 'md';
      h += '<div class="row ' + lvl + '" onclick="NABZ.showItem(\'clinical.patients\',\'' + p2.id + '\')">';
      h += '<div class="row-hd"><div class="row-title">' + NABZ._esc(p2.name) + '</div>';
      h += '<span class="pill ' + (p2.news >= 7 ? 'dng' : 'warn') + '">NEWS ' + p2.news + '</span></div>';
      h += '<div class="row-meta">' + NABZ._esc(p2.ward) + ' · تخت ' + NABZ._esc(p2.bed || '—') + ' · ' + NABZ._esc(p2.dx || '') + '</div>';
      h += '</div>';
    }
  }

  document.getElementById('content').innerHTML = h;
};

// ═══════════════════════════════════════════════════════════
//  Crisis Mode UI
// ═══════════════════════════════════════════════════════════
const CRISIS_TYPES = [
  { code:'war', label:'جنگ', icon:'⚔️' },
  { code:'flood', label:'سیل', icon:'🌊' },
  { code:'earthquake', label:'زلزله', icon:'🏔️' },
  { code:'storm', label:'طوفان', icon:'🌪️' },
  { code:'fire', label:'آتش‌سوزی', icon:'🔥' },
  { code:'bio', label:'بیولوژیک', icon:'☣️' },
  { code:'terror', label:'تروریستی', icon:'💥' },
  { code:'pandemic', label:'پاندمی', icon:'🦠' }
];

NABZ.showCrisis = async function(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const active = await NABZ._api('/api/crisis/active');
    if (!active.active) return NABZ._renderCrisisEmpty();
    const s = active.session;
    NABZ._currentCrisis = s;
    await NABZ._renderCrisisActive(s);
  } catch (e) {
    m.innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
  }
};

NABZ._renderCrisisEmpty = function() {
  let h = '<div class="crisis-empty">';
  h += '<div style="font-size:64px;text-align:center;filter:drop-shadow(0 0 24px rgba(16,185,129,0.3))">🛡️</div>';
  h += '<div style="text-align:center;font-size:18px;font-weight:900;margin:16px 0 4px">آماده</div>';
  h += '<div style="text-align:center;color:var(--fg-2);font-size:12px;margin-bottom:24px">هیچ بحرانی فعال نیست · کلیه سیستم‌ها در وضعیت عادی</div>';
  h += '</div>';
  h += '<div class="sec-hd"><span>🚨 فعال‌سازی بحران</span></div>';
  h += '<div class="crisis-warning">⚠️ فعال‌سازی بحران تمام پنل‌ها را به حالت اضطراری می‌برد</div>';
  h += '<div class="crisis-types">';
  for (const t of CRISIS_TYPES) {
    h += '<button class="crisis-type-btn" onclick="NABZ._openCrisisActivation(\'' + t.code + '\',\'' + t.label + '\')">';
    h += '<span style="font-size:32px">' + t.icon + '</span>';
    h += '<span style="font-size:12px;font-weight:800">' + t.label + '</span></button>';
  }
  h += '</div>';
  document.getElementById('content').innerHTML = h;
};

NABZ._openCrisisActivation = function(code, label) {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">🚨 فعال‌سازی ' + NABZ._esc(label) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<form class="bs-form" id="crisisForm">';
  h += '<div class="bs-field"><label>علت</label><input name="reason" placeholder="مثلاً: تمرین ناتو"></div>';
  h += '<div class="bs-field"><label>محل</label><input name="location" placeholder="مثلاً: تهران"></div>';
  h += '<div class="bs-field"><label>تخمین مصدومان</label><input type="number" name="estimatedCasualties" value="0"></div>';
  h += '<label style="display:flex;gap:10px;padding:14px;background:rgba(239,68,68,0.1);border-radius:12px;font-size:12.5px;cursor:pointer"><input type="checkbox" name="confirm" value="true" required style="width:20px;height:20px;accent-color:var(--dng)"><span><strong>تأیید می‌کنم</strong> — تمام اقدامات لازم را انجام داده‌ام</span></label>';
  h += '<button type="submit" class="bs-submit" style="background:var(--g-dng)">🚨 فعال‌سازی</button>';
  h += '</form>';
  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  c.querySelector('#crisisForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const data = {
      crisisType: code,
      reason: fd.get('reason') || '',
      location: fd.get('location') || '',
      estimatedCasualties: Number(fd.get('estimatedCasualties')) || 0,
      confirm: true
    };
    try {
      await NABZ._api('/api/crisis/activate', { method:'POST', body: JSON.stringify(data) });
      sheet.remove();
      NABZ.showCrisis();
    } catch (e) { alert('❌ ' + e.message); }
  };
};

NABZ._renderCrisisActive = async function(s) {
  const [roles, tasks, evac] = await Promise.all([
    NABZ._api('/api/crisis/' + s.id + '/roles'),
    NABZ._api('/api/crisis/' + s.id + '/tasks'),
    NABZ._api('/api/crisis/' + s.id + '/evacuation')
  ]);
  const elapsed = Math.floor((Date.now() - new Date(s.activatedAt).getTime()) / 60000);
  const filledRoles = roles.roles.filter(r => r.status === 'filled').length;
  const completedTasks = (tasks.items || []).filter(t => t.status === 'completed').length;
  const movedEvac = (evac.items || []).filter(e => e.status === 'moved').length;

  let h = '<div class="crisis-active-hero">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
  h += '<div><div style="font-size:24px;font-weight:900">' + (s.icon || '🚨') + ' ' + NABZ._esc(s.crisisLabel) + '</div>';
  h += '<div style="font-size:11.5px;opacity:0.9;margin-top:4px">' + NABZ._esc(s.reason || '') + (s.location ? ' · ' + NABZ._esc(s.location) : '') + '</div></div>';
  h += '<div style="text-align:left;background:rgba(0,0,0,0.3);padding:8px 12px;border-radius:10px;font-weight:900" id="crisisTimer">' + elapsed + ' دقیقه</div>';
  h += '</div>';
  h += '<div style="font-size:10.5px;opacity:0.8;margin-top:12px">شروع: ' + new Date(s.activatedAt).toLocaleString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + ' · ' + NABZ._esc(s.activatedByName || '') + '</div>';
  h += '</div>';

  // Stats
  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ok"><div class="v">' + filledRoles + '/' + roles.roles.length + '</div><div class="l">نقش‌ها</div></div>';
  h += '<div class="stat"><div class="v">' + completedTasks + '/' + (tasks.items || []).length + '</div><div class="l">وظایف</div></div>';
  h += '<div class="stat warn"><div class="v">' + movedEvac + '/' + (evac.items || []).length + '</div><div class="l">تخلیه</div></div>';
  h += '<div class="stat dng"><div class="v">' + (s.estimatedCasualties || 0) + '</div><div class="l">مصدومان</div></div>';
  h += '</div>';

  // Tabs
  h += '<div class="crisis-tabs">';
  h += '<button class="crisis-tab on" onclick="NABZ._crisisTab(\'roles\',this)">🎖️ نقش‌ها</button>';
  h += '<button class="crisis-tab" onclick="NABZ._crisisTab(\'tasks\',this)">📋 وظایف</button>';
  h += '<button class="crisis-tab" onclick="NABZ._crisisTab(\'evac\',this)">🚑 تخلیه</button>';
  h += '</div>';

  h += '<div id="crisisTabContent"></div>';
  h += '<div style="margin-top:20px"><button class="btn btn-block" style="background:var(--g-dng);color:#fff;border:none;padding:14px;font-weight:900" onclick="NABZ._deactivateCrisis(\'' + s.id + '\')">🔚 پایان بحران</button></div>';

  document.getElementById('content').innerHTML = h;
  NABZ._crisisData = { roles, tasks, evac, session: s };
  NABZ._renderCrisisRoles();

  // Auto-refresh timer
  if (NABZ._crisisTimerId) clearInterval(NABZ._crisisTimerId);
  NABZ._crisisTimerId = setInterval(() => {
    const el = document.getElementById('crisisTimer');
    if (!el) { clearInterval(NABZ._crisisTimerId); return; }
    const e2 = Math.floor((Date.now() - new Date(s.activatedAt).getTime()) / 60000);
    el.textContent = e2 + ' دقیقه';
  }, 30000);
};

NABZ._crisisTab = function(tab, btn) {
  document.querySelectorAll('.crisis-tab').forEach(b => b.classList.remove('on'));
  if (btn) btn.classList.add('on');
  if (tab === 'roles') NABZ._renderCrisisRoles();
  else if (tab === 'tasks') NABZ._renderCrisisTasks();
  else if (tab === 'evac') NABZ._renderCrisisEvac();
};

NABZ._renderCrisisRoles = function() {
  const { roles, session } = NABZ._crisisData;
  const priorityLabel = { 1: 'بحرانی', 2: 'بالا', 3: 'متوسط' };
  let h = '';
  for (const r of roles.roles.sort((a, b) => a.priority - b.priority)) {
    const cls = r.status === 'filled' ? 'filled' : r.status === 'pending' ? 'pending' : 'unfilled';
    h += '<div class="crisis-role-card ' + cls + '">';
    h += '<div style="display:flex;align-items:center;gap:12px">';
    h += '<div style="font-size:28px">' + (r.icon || '🎖️') + '</div>';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:900;font-size:13px">' + NABZ._esc(r.label) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">';
    if (r.current) h += NABZ._esc(r.current.staffName);
    else h += 'بدون مسئول';
    h += '</div></div>';
    h += '<span class="pill ' + (cls === 'filled' ? 'ok' : cls === 'pending' ? 'warn' : 'dng') + '">' + (cls === 'filled' ? 'فعال' : cls === 'pending' ? 'در انتظار' : 'خالی') + '</span>';
    h += '</div>';
    if (r.status !== 'filled') {
      h += '<button class="btn btn-block" style="margin-top:10px;padding:10px;font-size:12px" onclick="NABZ._assignRole(\'' + r.code + '\')">' + (r.current ? 'تغییر مسئول' : 'انتخاب مسئول') + '</button>';
    }
    h += '</div>';
  }
  document.getElementById('crisisTabContent').innerHTML = h;
};

NABZ._assignRole = async function(roleCode) {
  const d = await NABZ._api('/api/clinical/patients').catch(() => ({ items: [] }));
  const staff = await NABZ._api('/api/bedboard/stats').catch(() => ({ staffCount: 0 }));
  // Get staff from wf_staff via home search - use a simpler approach
  const all = await NABZ._api('/api/_modules');
  // Fallback: just show text field for staff ID
  const staffId = prompt('شناسه پرسنل (مثلاً staff_1 تا staff_107):');
  if (!staffId) return;
  try {
    await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/roles/assign', {
      method: 'POST',
      body: JSON.stringify({ roleCode, staffId })
    });
    NABZ.showCrisis();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._renderCrisisTasks = function() {
  const { tasks, session } = NABZ._crisisData;
  let h = '<button class="btn btn-primary btn-block" style="margin-bottom:10px" onclick="NABZ._openTaskForm()">➕ وظیفه جدید</button>';
  if (!(tasks.items || []).length) {
    h += '<div class="empty">وظیفه‌ای تعریف نشده</div>';
  } else {
    for (const t of tasks.items) {
      const cls = t.status === 'completed' ? 'completed' : t.status === 'confirmed' ? 'confirmed' : t.priority === 'critical' ? 'critical' : '';
      h += '<div class="crisis-task ' + cls + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-weight:900;font-size:13px">' + NABZ._esc(t.title) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(t.assignedName || '') + ' · ' + t.status + '</div>';
      h += '</div>';
      h += '<span class="pill ' + (t.priority === 'critical' ? 'dng' : t.priority === 'high' ? 'warn' : 'info') + '">' + t.priority + '</span>';
      h += '</div>';
      if (t.status === 'pending') {
        h += '<div style="display:flex;gap:6px;margin-top:10px">';
        h += '<button class="btn" style="flex:1;padding:8px;font-size:11px" onclick="NABZ._taskAction(\'' + t.id + '\',\'confirm\')">✅ تأیید</button>';
        h += '<button class="btn" style="flex:1;padding:8px;font-size:11px;color:var(--dng)" onclick="NABZ._taskAction(\'' + t.id + '\',\'decline\')">❌ رد</button>';
        h += '</div>';
      } else if (t.status === 'confirmed') {
        h += '<button class="btn btn-primary btn-block" style="margin-top:10px;padding:8px;font-size:11px" onclick="NABZ._taskAction(\'' + t.id + '\',\'complete\')">✅ تکمیل</button>';
      }
      h += '</div>';
    }
  }
  document.getElementById('crisisTabContent').innerHTML = h;
};

NABZ._taskAction = async function(tid, action) {
  const s = NABZ._crisisData.session.id;
  try {
    await NABZ._api('/api/crisis/' + s + '/tasks/' + tid + '/' + action, { method:'POST', body: '{}' });
    const refreshed = await NABZ._api('/api/crisis/' + s + '/tasks');
    NABZ._crisisData.tasks = refreshed;
    NABZ._renderCrisisTasks();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._openTaskForm = function() {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">➕ وظیفه جدید</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<form class="bs-form" id="taskForm">';
  h += '<div class="bs-field"><label>عنوان *</label><input name="title" required></div>';
  h += '<div class="bs-field"><label>شرح</label><textarea name="description" rows="2"></textarea></div>';
  h += '<div class="bs-field"><label>شناسه پرسنل</label><input name="assignedTo" placeholder="staff_1"></div>';
  h += '<div class="bs-field"><label>اولویت</label><select name="priority"><option value="critical">بحرانی</option><option value="high" selected>بالا</option><option value="medium">متوسط</option></select></div>';
  h += '<button type="submit" class="bs-submit">✅ ایجاد</button></form>';
  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  c.querySelector('#taskForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    try {
      await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/tasks', {
        method: 'POST',
        body: JSON.stringify({
          title: fd.get('title'),
          description: fd.get('description') || '',
          assignedTo: fd.get('assignedTo') || 'staff_1',
          priority: fd.get('priority')
        })
      });
      sheet.remove();
      const refreshed = await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/tasks');
      NABZ._crisisData.tasks = refreshed;
      NABZ._renderCrisisTasks();
    } catch (e) { alert('❌ ' + e.message); }
  };
};

NABZ._renderCrisisEvac = function() {
  const { evac } = NABZ._crisisData;
  if (!(evac.items || []).length) {
    document.getElementById('crisisTabContent').innerHTML = '<div class="empty">لیست تخلیه خالی است</div>';
    return;
  }
  let h = '';
  const sorted = evac.items.sort((a, b) => {
    const order = { critical:0, high:1, medium:2, low:3 };
    return (order[a.priority]||9) - (order[b.priority]||9);
  });
  for (const e of sorted) {
    const cls = e.status === 'moved' ? 'moved' : e.priority === 'critical' ? 'critical' : '';
    h += '<div class="crisis-evac ' + cls + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-weight:800;font-size:12.5px">' + NABZ._esc(e.patientName) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + NABZ._esc(e.wardCode) + ' · تخت ' + NABZ._esc(e.bedNumber || '—') + '</div>';
    h += '</div>';
    h += '<span class="pill ' + (e.priority === 'critical' ? 'dng' : e.status === 'moved' ? 'ok' : 'warn') + '">' + e.priority + '</span>';
    h += '</div>';
    if (e.status !== 'moved') {
      h += '<button class="btn" style="margin-top:8px;padding:8px;font-size:11px;width:100%" onclick="NABZ._evacMove(\'' + e.patientId + '\')">✅ منتقل شد</button>';
    }
    h += '</div>';
  }
  document.getElementById('crisisTabContent').innerHTML = h;
};

NABZ._evacMove = async function(patientId) {
  try {
    await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/evacuation/' + patientId, {
      method: 'PUT',
      body: JSON.stringify({ status: 'moved', destination: 'خارج از بیمارستان' })
    });
    const refreshed = await NABZ._api('/api/crisis/' + NABZ._crisisData.session.id + '/evacuation');
    NABZ._crisisData.evac = refreshed;
    NABZ._renderCrisisEvac();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._deactivateCrisis = async function(id) {
  if (!confirm('⚠️ بحران پایان یابد؟ تمام نقش‌ها و وظایف آرشیو می‌شوند.')) return;
  try {
    await NABZ._api('/api/crisis/' + id + '/deactivate', { method:'POST', body: '{}' });
    if (NABZ._crisisTimerId) { clearInterval(NABZ._crisisTimerId); NABZ._crisisTimerId = null; }
    NABZ.showCrisis();
  } catch (e) { alert('❌ ' + e.message); }
};
