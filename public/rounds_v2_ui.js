// ═══════════════════════════════════════════════════════════
//  NABZ — Rounds Mode v2 UI (S3)
//  Flat functions — no object literal wrapping (avoids S2 close-brace bug)
// ═══════════════════════════════════════════════════════════
(function(){
'use strict';
const state = { tab: 'queue', data: null, queue: null, cosign: null, mine: null };
const cache = {};

function _api(p, o) { return NABZ._api(p, o); }
function _esc(s) { return NABZ._esc(s); }
function _close() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); }
function _sheet(html) {
  const s = document.createElement('div'); s.className = 'bs-backdrop';
  s.onclick = e => { if (e.target === s) s.remove(); };
  const c = document.createElement('div'); c.className = 'bs-sheet';
  c.style.maxHeight = '96vh'; c.innerHTML = html;
  s.appendChild(c); document.body.appendChild(s);
  requestAnimationFrame(() => s.classList.add('show'));
  return { sheet: s, content: c };
}
function _time(iso) { if (!iso) return '—'; try { return new Date(iso).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' }); } catch (_) { return '—'; } }
function _pad(n) { return String(n).padStart(2, '0'); }

async function show(p, d) {
  const m = document.getElementById('content');
  m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
  try {
    const results = await Promise.all([
      d || _api('/api/rv2/queue'),
      _api('/api/rv2/pending-cosign').catch(() => ({ items: [], total: 0 })),
      _api('/api/rv2/my-rounds').catch(() => ({ items: [], total: 0 }))
    ]);
    state.queue = results[0]; state.cosign = results[1]; state.mine = results[2];
    _render(p); _subscribeLive();
  } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + _esc(e.message) + '</div>'; }
}

function _render(p) {
  const m = document.getElementById('content');
  const q = state.queue || { items: [], total: 0, stats: {} };
  const cosign = state.cosign || { total: 0 };
  const mine = state.mine || { total: 0 };
  const scope = q.scope || { kind: 'none' };
  let h = '<div class="sec-hd"><span>📝 راند پزشکی</span><span class="rd-mini">' + q.total + ' بیمار</span></div>';
  if (scope.kind === 'none') {
    h += '<div class="card" style="background:var(--warn-soft);border-color:var(--warn);padding:20px;text-align:center"><div style="font-size:36px">⚠️</div><div style="font-weight:900;margin-top:8px">بخش/سرویس شما تعریف نشده</div><div style="font-size:11.5px;color:var(--fg-2);margin-top:6px">با مدیر سیستم تماس بگیرید</div></div>';
    m.innerHTML = h; return;
  }
  h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
  h += '<div class="rd-stat ' + (q.stats.critical > 0 ? 'dng' : 'ok') + '"><div class="v">' + (q.stats.critical || 0) + '</div><div class="l">بحرانی</div></div>';
  h += '<div class="rd-stat ' + (q.stats.high > 0 ? 'warn' : '') + '"><div class="v">' + (q.stats.high || 0) + '</div><div class="l">پرخطر</div></div>';
  h += '<div class="rd-stat info"><div class="v">' + (cosign.total || 0) + '</div><div class="l">cosign</div></div>';
  h += '<div class="rd-stat"><div class="v">' + (mine.total || 0) + '</div><div class="l">راند من</div></div>';
  h += '</div>';
  const tabs = [['queue','📋 صف راند (' + q.total + ')'],['cosign','✍️ cosign (' + (cosign.total || 0) + ')'],['mine','📝 راندهای من (' + (mine.total || 0) + ')']];
  h += '<div class="crisis-tabs" style="margin-bottom:12px;flex-wrap:wrap">';
  tabs.forEach(([k, l]) => { h += '<button class="crisis-tab' + (state.tab === k ? ' on' : '') + '" onclick="NABZ.roundsV2.setTab(\'' + k + '\')">' + l + '</button>'; });
  h += '</div>';
  h += '<div id="rv2Content"></div>';
  m.innerHTML = h;
  if (state.tab === 'queue') _renderQueue();
  else if (state.tab === 'cosign') _renderCosign();
  else _renderMine();
  NABZ.state.current = p ? p.id : 'rounds_v2.hub';
}

function setTab(t) { state.tab = t; _render(null); }

function _renderQueue() {
  const el = document.getElementById('rv2Content'); if (!el) return;
  const items = (state.queue && state.queue.items) || [];
  if (!items.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">صف راند خالی است</div></div>'; return; }
  const ICONS = { critical: '🚨', high: '⚠️', medium: '📋', low: '○' };
  let h = '';
  items.forEach(it => {
    const pr = it.priority;
    const cls = pr.level === 'critical' ? 'dng' : pr.level === 'high' ? 'warn' : 'info';
    h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.roundsV2.openSoap(\'' + it.id + '\')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
    h += '<div style="flex:1;min-width:0">';
    h += '<div style="font-size:12.5px;font-weight:900">' + ICONS[pr.level] + ' ' + _esc(it.name) + ' <span style="font-size:10px;color:var(--fg-3);font-weight:400">' + pr.score + '</span></div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + (it.age||'?') + ' سال · ' + _esc(it.ward||'') + ' · تخت ' + _esc(it.bed||'') + '</div>';
    if (it.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + _esc(it.diagnosis.slice(0,50)) + '</div>';
    if (pr.reasons && pr.reasons.length) h += '<div style="font-size:10px;color:var(--' + cls + ');margin-top:2px;font-weight:800">' + _esc(pr.reasons.slice(0,3).join(' · ')) + '</div>';
    h += '</div><div style="text-align:left;min-width:50px">';
    if (it.lastVital && it.lastVital.news2 !== null) h += '<span class="pill ' + (it.lastVital.news2 >= 7 ? 'dng' : it.lastVital.news2 >= 5 ? 'warn' : 'info') + '" style="font-size:9px">NEWS ' + it.lastVital.news2 + '</span>';
    if (it.lastRound) h += '<div style="font-size:9px;color:var(--fg-3);margin-top:3px">' + (pr.hoursSinceLastRound !== null ? pr.hoursSinceLastRound + 'h' : '—') + '</div>';
    h += '</div></div></div>';
  });
  el.innerHTML = h;
}

function _renderCosign() {
  const el = document.getElementById('rv2Content'); if (!el) return;
  const items = (state.cosign && state.cosign.items) || [];
  if (!items.length) { el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">هیچ راندی منتظر تأیید نیست</div></div>'; return; }
  let h = '';
  items.forEach(r => {
    h += '<div class="card" style="padding:10px;margin-bottom:4px;cursor:pointer" onclick="NABZ.roundsV2._viewRound(\'' + r.id + '\')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px"><div style="flex:1">';
    h += '<div style="font-size:12.5px;font-weight:900">' + _esc(r.patientName) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + _esc(r.signedByName||'') + ' · ' + _time(r.signedAt) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + _esc((r.subjective && r.subjective.chiefComplaint) || '').slice(0, 60) + '</div>';
    h += '</div><span class="pill warn" style="font-size:9px">cosign</span></div></div>';
  });
  el.innerHTML = h;
}

function _renderMine() {
  const el = document.getElementById('rv2Content'); if (!el) return;
  const items = (state.mine && state.mine.items) || [];
  if (!items.length) { el.innerHTML = '<div class="empty">هنوز راندی ثبت نکرده‌اید</div>'; return; }
  const ST = { draft:'پیش‌نویس', pending_cosign:'در انتظار تأیید', signed:'امضا شده' };
  const CLS = { draft:'warn', pending_cosign:'info', signed:'ok' };
  let h = '';
  items.forEach(r => {
    h += '<div class="card" style="padding:10px;margin-bottom:4px;cursor:pointer" onclick="NABZ.roundsV2._viewRound(\'' + r.id + '\')">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px"><div style="flex:1">';
    h += '<div style="font-size:12.5px;font-weight:900">' + _esc(r.patientName) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2)">' + _esc(r.wardCode||'') + ' · ' + _time(r.createdAt) + '</div>';
    h += '</div><span class="pill ' + (CLS[r.status]||'info') + '" style="font-size:9px">' + (ST[r.status]||r.status) + '</span></div></div>';
  });
  el.innerHTML = h;
}

async function openSoap(patientId, roundId) {
  try {
    const ctxData = await _api('/api/rv2/context/' + patientId);
    cache['ctx_' + patientId] = ctxData;
    let existing = null;
    if (roundId) { try { const rs = await _api('/api/rv2/patient/' + patientId + '/rounds'); existing = (rs.items || []).find(r => r.id === roundId); } catch (_) {} }
    _renderSoap(ctxData, existing);
  } catch (e) { alert('خطا: ' + e.message); }
}

function _renderSoap(ctx, existing) {
  const p = ctx.patient;
  const af = ctx.autoFill;
  const pr = ctx.priority;
  const isEdit = !!existing;
  const isDraft = !existing || existing.status === 'draft';
  const sub = (existing && existing.subjective) || af.subjective;
  const obj = (existing && existing.objective) || af.objective;
  const asmt = (existing && existing.assessment) || af.assessment;
  const plan = (existing && existing.plan) || af.plan;
  const flags = asmt.flags || [];

  let h = '<div class="bs-handle"></div>';
  h += '<div class="bs-hd"><div class="bs-title">📝 ' + (isEdit ? 'ویرایش راند' : 'راند جدید') + ' — ' + _esc(p.name) + '</div>';
  h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

  // Header
  h += '<div class="card" style="margin-bottom:10px;background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(139,92,246,.06));border-color:var(--' + (pr.level === 'critical' ? 'dng' : pr.level === 'high' ? 'warn' : 'primary') + ')">';
  h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
  h += '<div><div style="font-size:14px;font-weight:900">' + _esc(p.name) + '</div>';
  h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + (p.age||'?') + ' سال · ' + _esc(p.ward||'') + ' · تخت ' + _esc(p.bed||'') + '</div>';
  if (p.diagnosis) h += '<div style="font-size:11px;font-weight:700;margin-top:3px">' + _esc(p.diagnosis) + '</div>';
  if (p.allergies && p.allergies.length) h += '<div style="font-size:11px;color:var(--dng);margin-top:3px;font-weight:900">⚠️ ' + _esc(p.allergies.join('، ')) + '</div>';
  if (ctx.isolation) h += '<div style="font-size:10.5px;color:var(--warn);margin-top:2px">🧼 ایزوله ' + _esc(ctx.isolation.type) + '</div>';
  if (ctx.sepsisActive) h += '<div style="font-size:10.5px;color:var(--dng);margin-top:2px;font-weight:900">🦠 سپسیس فعال</div>';
  h += '</div><div style="text-align:left"><div style="font-size:24px;font-weight:900;color:var(--' + (pr.level === 'critical' ? 'dng' : pr.level === 'high' ? 'warn' : 'primary') + ')">' + pr.score + '</div><div style="font-size:8.5px;color:var(--fg-2)">اولویت</div></div>';
  h += '</div></div>';

  // Auto-fill flags
  if (flags.length) {
    h += '<div style="background:var(--dng-soft);border:1px solid var(--dng);border-radius:8px;padding:8px;margin-bottom:10px">';
    h += '<div style="font-size:11px;font-weight:900;color:var(--dng);margin-bottom:3px">🚨 هشدارهای خودکار</div>';
    flags.forEach(f => { h += '<div style="font-size:11px;padding:1px 0">• ' + _esc(f.text) + '</div>'; });
    h += '</div>';
  }

  // Vitals one-liner
  if (obj.vitalsLine) h += '<div class="hint info" style="margin-bottom:8px;font-size:11px">' + _esc(obj.vitalsLine) + '</div>';

  // S
  h += '<div class="sec-hd" style="margin:10px 0 4px"><span style="font-size:12px">📌 S — ذهنی</span></div>';
  if (sub.intervalHistory) h += '<div class="hint success" style="margin-bottom:4px;font-size:10.5px;white-space:pre-wrap">📋 تاریخچه اینتروال از پرستاری:\n' + _esc(sub.intervalHistory) + '</div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">شکایت اصلی</label><textarea id="rv2_cc" rows="2" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px">' + _esc(sub.chiefComplaint) + '</textarea></div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">تاریخچه</label><textarea id="rv2_hist" rows="2" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px">' + _esc(sub.history) + '</textarea></div>';

  // O
  h += '<div class="sec-hd" style="margin:10px 0 4px"><span style="font-size:12px">📊 O — عینی</span></div>';
  if (obj.newLabs && obj.newLabs.length) {
    h += '<div class="hint info" style="margin-bottom:4px;font-size:10.5px">🧪 ' + obj.newLabs.length + ' lab جدید از راند قبلی:</div>';
    obj.newLabs.forEach(l => {
      const cls = l.critical ? 'dng' : 'fg-2';
      h += '<div style="font-size:10.5px;padding:3px 6px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;border-right:2px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.cw&&NABZ.cw.viewLab&&NABZ.cw.viewLab(\'' + l.id + '\')">' + _esc(l.panel) + (l.critical ? ' ⚠️ بحرانی' : '') + ' · ' + _time(l.at) + '</div>';
    });
  }
  if (obj.newImaging && obj.newImaging.length) {
    h += '<div class="hint info" style="margin-top:4px;margin-bottom:4px;font-size:10.5px">🩻 ' + obj.newImaging.length + ' تصویر جدید:</div>';
    obj.newImaging.forEach(r => {
      const cls = r.critical ? 'dng' : 'fg-2';
      h += '<div style="font-size:10.5px;padding:3px 6px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;border-right:2px solid var(--' + cls + ');cursor:pointer" onclick="NABZ.cw&&NABZ.cw.viewImaging&&NABZ.cw.viewImaging(\'' + r.id + '\')">' + _esc(r.modality + ' ' + r.bodyPart) + (r.critical ? ' ⚠️ بحرانی' : '') + '</div>';
    });
  }
  if (obj.marAdherence) {
    h += '<div style="font-size:10.5px;color:var(--fg-2);padding:4px;background:var(--bg-2);border-radius:4px;margin-bottom:4px">💊 MAR از راند قبل: ' + obj.marAdherence.given + ' given';
    if (obj.marAdherence.missed) h += ' · <span style="color:var(--dng);font-weight:900">' + obj.marAdherence.missed + ' missed</span>';
    if (obj.marAdherence.highAlert) h += ' · <span style="color:var(--warn)">' + obj.marAdherence.highAlert + ' High-Alert</span>';
    h += '</div>';
  }
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">معاینه فیزیکی</label><textarea id="rv2_pe" rows="3" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px">' + _esc(obj.physicalExam || '') + '</textarea></div>';

  // A
  h += '<div class="sec-hd" style="margin:10px 0 4px"><span style="font-size:12px">🔍 A — ارزیابی</span></div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">تشخیص‌ها (با کاما)</label><input type="text" id="rv2_dx" value="' + _esc((asmt.diagnoses || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px"></div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">ارزیابی بالینی</label><textarea id="rv2_imp" rows="3" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px">' + _esc(asmt.clinicalImpression || '') + '</textarea></div>';

  // P
  h += '<div class="sec-hd" style="margin:10px 0 4px"><span style="font-size:12px">📋 P — پلن</span></div>';
  const pMeds = (plan.medications || []).map(m => typeof m === 'string' ? m : (m.drug || '') + ' ' + (m.dose || '')).join('\n');
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">داروها (هر خط)</label><textarea id="rv2_meds" rows="3" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px">' + _esc(pMeds) + '</textarea></div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">آزمایش</label><input type="text" id="rv2_labs" value="' + _esc((plan.labs || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px"></div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">تصویر</label><input type="text" id="rv2_imaging" value="' + _esc((plan.imaging || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px"></div>';
  h += '<div class="wf-field" style="margin-bottom:6px"><label style="font-size:10.5px">مشاوره</label><input type="text" id="rv2_consults" value="' + _esc((plan.consults || []).join(', ')) + '" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px"></div>';
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">';
  h += '<div class="wf-field" style="margin:0"><label style="font-size:10.5px">رژیم</label><input type="text" id="rv2_diet" value="' + _esc(plan.diet||'') + '" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px"></div>';
  h += '<div class="wf-field" style="margin:0"><label style="font-size:10.5px">فعالیت</label><input type="text" id="rv2_activity" value="' + _esc(plan.activity||'') + '" ' + (isDraft ? '' : 'disabled') + ' style="font-size:12px"></div>';
  h += '</div>';

  // OrderSet quick picker
  if (isDraft) {
    h += '<div class="sec-hd" style="margin:12px 0 6px"><span style="font-size:12px">💊 بسته درمانی</span></div>';
    h += '<button class="btn btn-block" style="padding:10px;background:var(--violet-soft);color:var(--violet);border-color:var(--violet);margin-bottom:6px" onclick="NABZ.roundsV2._openSetPicker(\'' + p.id + '\',' + (isEdit ? "'" + existing.id + "'" : 'null') + ')">➕ اعمال Order Set</button>';
  }

  // Actions
  h += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
  if (isDraft) {
    h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.roundsV2._saveRound(\'' + p.id + '\',' + (isEdit ? "'" + existing.id + "'" : 'null') + ',false)">💾 ذخیره</button>';
    h += '<button class="btn btn-primary" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.roundsV2._saveRound(\'' + p.id + '\',' + (isEdit ? "'" + existing.id + "'" : 'null') + ',true)">✍️ امضا</button>';
  } else {
    h += '<div style="flex:1;text-align:center;padding:12px;background:var(--ok-soft);border-radius:8px;color:var(--ok);font-weight:900">' + (existing.status === 'signed' ? '✅ امضا شده' : '⏳ در انتظار cosign') + '</div>';
  }
  h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.roundsV2._timeline(\'' + p.id + '\')">📅 تایم‌لاین</button>';
  h += '</div>';

  _sheet(h);
}

async function _saveRound(patientId, roundId, sign) {
  const body = {
    subtype: 'morning',
    subjective: { chiefComplaint: document.getElementById('rv2_cc').value, history: document.getElementById('rv2_hist').value },
    objective: { physicalExam: document.getElementById('rv2_pe').value },
    assessment: { diagnoses: document.getElementById('rv2_dx').value.split(',').map(s => s.trim()).filter(Boolean), clinicalImpression: document.getElementById('rv2_imp').value },
    plan: { medications: document.getElementById('rv2_meds').value.split('\n').filter(Boolean), labs: document.getElementById('rv2_labs').value.split(',').map(s => s.trim()).filter(Boolean), imaging: document.getElementById('rv2_imaging').value.split(',').map(s => s.trim()).filter(Boolean), consults: document.getElementById('rv2_consults').value.split(',').map(s => s.trim()).filter(Boolean), diet: document.getElementById('rv2_diet').value, activity: document.getElementById('rv2_activity').value }
  };
  try {
    let rid = roundId;
    if (rid) { await _api('/api/rv2/' + rid, { method:'PUT', body: JSON.stringify(body) }); }
    else { body.patientId = patientId; const r = await _api('/api/rv2/create', { method:'POST', body: JSON.stringify(body) }); rid = r.id; }
    if (sign) {
      const s = await _api('/api/rv2/' + rid + '/sign', { method:'POST', body:'{}' });
      NABZ._toast(s.status === 'pending_cosign' ? '✅ ارسال برای cosign' : '✅ راند امضا شد');
    } else { NABZ._toast('💾 ذخیره شد'); }
    _close(); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _viewRound(roundId) {
  try {
    const rounds = await _api('/api/rv2/patient/' + (cache._lastPid || '') + '/rounds').catch(() => ({ items: [] }));
    let r = (rounds.items || []).find(x => x.id === roundId);
    if (!r) { for (const pid of Object.keys(cache).filter(k => k.startsWith('ctx_'))) { const rs = await _api('/api/rv2/patient/' + pid.slice(4) + '/rounds').catch(() => ({ items: [] })); const found = (rs.items || []).find(x => x.id === roundId); if (found) { r = found; break; } } }
    if (!r) { alert('راند یافت نشد'); return; }
    const p = r;
    const canCosign = r.status === 'pending_cosign' && ['attending','specialist','admin'].includes(NABZ.state.user && NABZ.state.user.role) && r.signedBy !== (NABZ.state.user && NABZ.state.user.id);
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 ' + _esc(r.patientName) + '</div>';
    h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + _esc(r.authorName) + ' · ' + _time(r.createdAt) + ' · ' + _esc(r.status) + '</div>';
    ['S','O','A','P'].forEach((sec, i) => {
      const labels = { S:'📌 S — ذهنی', O:'📊 O — عینی', A:'🔍 A — ارزیابی', P:'📋 P — پلن' };
      const keys = { S:'subjective', O:'objective', A:'assessment', P:'plan' };
      const data = r[keys[sec]] || {};
      h += '<div class="card" style="margin-bottom:6px;padding:8px"><div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:4px">' + labels[sec] + '</div>';
      Object.entries(data).forEach(([k, v]) => {
        if (!v || (Array.isArray(v) && !v.length)) return;
        const label = { chiefComplaint:'شکایت', history:'تاریخچه', physicalExam:'معاینه', diagnoses:'تشخیص', clinicalImpression:'ارزیابی', medications:'دارو', labs:'آزمایش', imaging:'تصویر', consults:'مشاوره', diet:'رژیم', activity:'فعالیت' }[k] || k;
        const val = Array.isArray(v) ? v.join('، ') : String(v);
        if (!val) return;
        h += '<div style="font-size:11px;margin-bottom:2px"><b>' + label + ':</b> ' + _esc(val).slice(0, 200) + '</div>';
      });
      h += '</div>';
    });
    if (canCosign) h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.roundsV2._cosign(\'' + r.id + '\')">✅ تأیید نهایی (cosign)</button>';
    if (r.status === 'signed' && r.cosignedByName) h += '<div class="hint success" style="margin-top:8px">✅ cosigned توسط ' + _esc(r.cosignedByName) + ' — ' + _time(r.cosignedAt) + '</div>';
    h += '<div style="margin-top:12px;margin-bottom:20px"><button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';
    _sheet(h);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _cosign(roundId) {
  if (!confirm('تأیید نهایی این راند؟')) return;
  try { await _api('/api/rv2/' + roundId + '/cosign', { method:'POST', body:'{}' }); NABZ._toast('✅ cosigned'); _close(); show(null, null); }
  catch (e) { alert('خطا: ' + e.message); }
}

async function _openSetPicker(patientId, roundId) {
  try {
    const [sug, all] = await Promise.all([_api('/api/rounds/suggest/' + patientId).catch(() => ({ items: [] })), _api('/api/enc/ordersets').catch(() => ({ items: [] }))]);
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">💊 انتخاب بسته درمانی</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    if ((sug.items || []).length) {
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:8px 0 6px">🎯 پیشنهاد برای بیمار</div>';
      sug.items.forEach(s => { h += '<div class="card" style="padding:8px;margin-bottom:4px;border-color:var(--primary);cursor:pointer" onclick="NABZ.roundsV2._applySet(\'' + s.id + '\',' + (roundId ? "'" + roundId + "'" : 'null') + ',\'' + patientId + '\')"><div style="font-weight:900;font-size:12px">' + (s.icon||'💊') + ' ' + _esc(s.name) + ' <span style="font-size:9px;color:var(--fg-3)">score ' + s.score + '</span></div><div style="font-size:10px;color:var(--ok)">✓ ' + _esc((s.reasons||[]).join(' · ')) + '</div></div>'; });
    }
    h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin:12px 0 6px">📚 کل کاتالوگ (' + (all.items || []).length + ')</div>';
    (all.items || []).forEach(s => { h += '<button class="btn btn-sm" style="width:100%;text-align:right;padding:6px 10px;margin-bottom:3px;font-size:11px;justify-content:flex-start" onclick="NABZ.roundsV2._applySet(\'' + s.id + '\',' + (roundId ? "'" + roundId + "'" : 'null') + ',\'' + patientId + '\')"><b>' + (s.icon||'💊') + ' ' + _esc(s.name) + '</b><span style="color:var(--fg-2);font-weight:400;margin-right:8px">(' + (s.meds||[]).length + ' دارو)</span></button>'; });
    h += '<div style="margin-bottom:20px;margin-top:10px"><button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';
    _sheet(h);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _applySet(setId, roundId, patientId) {
  if (!roundId) { alert('ابتدا راند را ذخیره کنید (ذخیره draft)، سپس Order Set را اعمال کنید'); return; }
  if (!confirm('بسته ' + setId + ' اعمال شود؟')) return;
  try {
    const r = await _api('/api/rv2/' + roundId + '/orderset', { method:'POST', body: JSON.stringify({ setId }) });
    NABZ._toast('✅ ' + r.total + ' دستور ایجاد شد');
    _close(); show(null, null);
  } catch (e) { alert('خطا: ' + e.message); }
}

async function _timeline(patientId) {
  try {
    const d = await _api('/api/rv2/timeline/' + patientId);
    let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📅 تایم‌لاین — ' + _esc(d.patient.name) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + _esc(d.patient.ward) + ' · تخت ' + _esc(d.patient.bed||'') + ' · ' + d.total + ' رویداد</div>';
    if (!d.events.length) { h += '<div class="empty">رویدادی نیست</div>'; }
    else {
      h += '<div class="cw-timeline">';
      d.events.slice(0, 60).forEach(ev => {
        const cls = ev.color ? 'color:var(--' + ev.color + ')' : '';
        h += '<div class="cw-tl-item" style="' + cls + '"><div class="cw-tl-dot">' + ev.icon + '</div><div class="cw-tl-body"><div class="cw-tl-title">' + _esc(ev.title) + '</div>';
        if (ev.detail) h += '<div class="cw-tl-detail">' + _esc(ev.detail) + '</div>';
        h += '<div class="cw-tl-time">' + _time(ev.at) + '</div></div></div>';
      });
      h += '</div>';
    }
    h += '<div style="margin-top:12px;margin-bottom:20px"><button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button></div>';
    _sheet(h);
  } catch (e) { alert('خطا: ' + e.message); }
}

let _liveSubscribed = false;
function _subscribeLive() {
  if (_liveSubscribed) return;
  if (!window.Live || typeof Live.on !== 'function') return;
  ['encounter.round.signed','encounter.round.cosigned','vitals.recorded','kardex.order.created','lab.verified'].forEach(evt => {
    Live.on(evt, () => { if (NABZ.state.current === 'rounds_v2.hub' && !document.querySelector('.bs-backdrop')) show(null, null); });
  });
  _liveSubscribed = true;
}

// ═══ Register ═══
window.NABZ = window.NABZ || {};
NABZ.roundsV2 = { show, setTab, openSoap, _saveRound, _viewRound, _cosign, _openSetPicker, _applySet, _timeline };
let tries = 0;
(function tryReg(){
  if (window.NABZ && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('rounds_v2', function(p, d){ return show(p, d); });
    console.log('[rounds-v2-ui] loaded ✓');
    return;
  }
  if (++tries > 60) return console.warn('[rounds-v2-ui] timeout');
  setTimeout(tryReg, 100);
})();
})();
