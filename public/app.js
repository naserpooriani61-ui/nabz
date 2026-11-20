console.log('🔥 NABZ UI v19 LOADED');
console.log('🔥 APP.JS V18 LOADED');
const NABZ = (() => {
  const S = {
    token: localStorage.getItem('nabz_tk'),
    user: JSON.parse(localStorage.getItem('nabz_u') || 'null'),
    panels: [], current: null, alerts: []
  };

  async function api(p, o = {}) {
    const h = { 'Content-Type': 'application/json', ...(o.headers || {}) };
    if (S.token) h.Authorization = 'Bearer ' + S.token;
    const r = await fetch(p, { ...o, headers: h });
    const b = await r.json();
    if (!r.ok || !b.ok) throw new Error(b.error || 'HTTP ' + r.status);
    return b.data;
  }

  async function login(u, p) {
    const d = await api('/api/auth/login', { method:'POST', body: JSON.stringify({ username: u, password: p }) });
    S.token = d.token; S.user = d.user;
    localStorage.setItem('nabz_tk', d.token);
    localStorage.setItem('nabz_u', JSON.stringify(d.user));
    if (d.forcePasswordChangeActive && d.user && d.user.mustChangePassword) {
      document.body.classList.add('auth');
      document.getElementById('header').style.display = 'flex';
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      setTimeout(function() {
        if (window.NABZ && typeof NABZ.openPasswordChange === 'function') NABZ.openPasswordChange(true);
        else alert('از منو گزینه تغییر رمز را بزنید');
      }, 200);
      return;
    }
    await boot();
  }

  function logout() {
  try { if (window.NABZ_LIVE) window.NABZ_LIVE.disconnect(); } catch(_) {}
  try { if (window.Live) window.Live.disconnect(); } catch(_) {}
    S.token = null; S.user = null;
    localStorage.removeItem('nabz_tk');
    localStorage.removeItem('nabz_u');
    location.reload();
  }

  async function boot() {
    if (!S.token) { showLogin(); return; }
    try {
      const d = await api('/api/_modules');
      S.panels = d.panels || [];
      renderNav();
      document.body.classList.add('auth');
      document.getElementById('header').style.display = 'flex';
      document.getElementById('loginView').style.display = 'none';
      document.getElementById('content').style.display = 'block';
      // ── URL-first routing (override showHome when /kind/... in URL) ──
      var _urlPath = (location && location.pathname) || '';
      var _match = _urlPath.match(/^\/kind\/([^\/\?]+)/);
      if (_match && typeof NABZ.show === 'function') {
        var _qpid = new URLSearchParams(location.search).get('patientId');
        try {
          if (_qpid) await NABZ.show(_match[1], { patientId: _qpid });
          else await NABZ.show(_match[1]);
        } catch (e) {
          console.warn('[boot] URL route failed:', e.message);
          if (NABZ.showHome) await NABZ.showHome();
        }
      } else if (NABZ.showHome) await NABZ.showHome();
      else if (S.panels.length) show(S.panels[0].id);
      poll();
      setInterval(poll, 30000);
    } catch (e) {
      if (String(e.message).includes('unauthorized')) logout();
      else showErr(e.message);
    }
    // Init nav system after boot
    try { if (window.NABZ_NAV && typeof window.NABZ_NAV.init === 'function') window.NABZ_NAV.init(); } catch (_) {}
  }

  function showLogin() {
    document.body.classList.remove('auth');
    document.getElementById('loginView').style.display = 'grid';
    document.getElementById('header').style.display = 'none';
    document.getElementById('content').style.display = 'none';
    document.getElementById('sidebar').innerHTML = '';
    document.getElementById('lf').onsubmit = async (e) => {
      e.preventDefault();
      const b = e.target.querySelector('button');
      b.disabled = true; b.textContent = '...';
      try {
        await login(document.getElementById('u').value.trim(), document.getElementById('p').value);
      } catch (err) {
        document.getElementById('le').textContent = 'نام کاربری یا رمز اشتباه';
        b.disabled = false; b.textContent = 'ورود';
      }
    };
  }

  
const PANEL_ADDONS = {
  'clinical.patients': { label: '➕ پذیرش بیمار', fn: 'NABZ.openAdmission()' },
  'bedboard.wards': { label: '➕ پذیرش', fn: 'NABZ.openAdmission()' },
  'flow.pipeline': { label: '➕ پذیرش بیمار', fn: 'NABZ.openAdmission()' }
};

const MOD_META = {
    ops2:{l:'Operations',i:'🛡️'},
    bedboard:{l:'تخت',i:'🛏️'},
    home:{l:'خانه',i:'🏠'}, nursing_report:{l:'گزارش پرستاری',i:'📝'},
    clinical:{l:'بالینی',i:'🩺'},supervisor:{l:'سوپروایزر',i:'🏛️'}, emergency:{l:'اورژانس',i:'🚨'},
    workflow:{l:'گردش کار',i:'🔄'}, paraclinical:{l:'پاراکلینیک',i:'🧪'},
    safety:{l:'ایمنی',i:'⚠️'}, surgical:{l:'جراحی',i:'🔪'},
    ops:{l:'عملیات',i:'⚙️'}, education:{l:'آموزش',i:'🎓'},
    quality:{l:'کیفیت',i:'⭐'}, rights:{l:'حقوق بیمار',i:'⚖️'},
    advanced_hr:{l:'منابع انسانی',i:'💰'}, admin:{l:'مدیریت',i:'🛡️'},
    qr_pulse:{l:'QR نبضی',i:'📱'}, crisis:{l:'بحران',i:'🔥'},
    cdss:{l:'موتور بالینی',i:'🧠'},
    shift_assistant:{l:'دستیار شیفت',i:'🏥'},
    encounters:{l:'راند و درمان',i:'🩺'},
    education_studio:{l:'استودیوی آموزش',i:'🎓'}
  };

  function renderNav() {
    const byModule = {};
    for (const p of S.panels) {
      if (!byModule[p.module]) byModule[p.module] = [];
      byModule[p.module].push(p);
    }
    const modOrder = ['ops2','home','bedboard','nursing_report','nursing_report','clinical','encounters','cdss','emergency','workflow','paraclinical','safety','surgical','ops','education','education_studio','quality','rights','advanced_hr','admin','qr_pulse','crisis','supervisor','shift_assistant'];

    const tabs = [
      { icon:'🏠', label:'خانه', action:'(NABZ.showHome||NABZ.showNeural)()' },
      { icon:'🚨', label:'اورژانس', action: byModule.emergency ? "NABZ.show('"+byModule.emergency[0].id+"')" : 'NABZ.showDrawer()' },
      { icon:'🩺', label:'بالینی', action: byModule.clinical ? "NABZ.show('"+byModule.clinical[0].id+"')" : 'NABZ.showDrawer()' },
      { icon:'🧠', label:'عصبی', action:'NABZ.showNeural()' },
      { icon:'☰', label:'منو', action:'NABZ.showDrawer()' }
    ];

    let dh = '<div class="drawer-hd"><div class="drawer-logo">🫀 <strong>نبض</strong></div><button class="drawer-close" onclick="NABZ.hideDrawer()">✕</button></div>';
    for (const m of modOrder) {
      if (!byModule[m]) continue;
      const info = MOD_META[m] || { l: m, i: '📄' };
      dh += '<div class="drawer-sec" data-module="' + m + '"><div class="drawer-sec-hd">' + info.i + ' ' + info.l + '</div>';
      for (const p of byModule[m]) {
        dh += '<button class="drawer-item" onclick="NABZ.show(\'' + p.id + '\');NABZ.hideDrawer()">'
          + '<span class="di-ico">' + (p.icon || '📄') + '</span>'
          + '<span class="di-lbl">' + esc(p.title) + '</span></button>';
      }
      dh += '</div>';
    }
    dh += '<div class="drawer-sec" style="border-top:1px solid var(--border);margin-top:8px">';
    dh += '<button class="drawer-item" onclick="NABZ.showNeural();NABZ.hideDrawer()"><span class="di-ico">🧠</span><span class="di-lbl">موتور عصبی</span></button>';
    dh += '<button class="drawer-item" style="color:var(--dng)" onclick="NABZ.logout()"><span class="di-ico">⏻</span><span class="di-lbl">خروج</span></button>';
    dh += '</div>';

    document.getElementById('sidebar').innerHTML = tabs.map(t =>
      '<button class="bn-tab" onclick="' + t.action + '">'
      + '<span class="bn-icon">' + t.icon + '</span>'
      + '<span class="bn-label">' + t.label + '</span></button>'
    ).join('');

    let old = document.getElementById('drawer');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend',
      '<div id="drawer" class="drawer" style="display:none" onclick="if(event.target===this)NABZ.hideDrawer()"><div class="drawer-panel">' + dh + '</div></div>');
  }

  function showDrawer() { const d = document.getElementById('drawer'); if (d) d.style.display = 'flex'; }
  function hideDrawer() { const d = document.getElementById('drawer'); if (d) d.style.display = 'none'; }

  async function show(id) {
  if (NABZ._crisisTimerId) { clearInterval(NABZ._crisisTimerId); NABZ._crisisTimerId = null; }
    const p = S.panels.find(x => x.id === id);
    if (!p) return;
    S.current = id;
    document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
    const m = document.getElementById('content');
    m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    try {
      const d = await api(p.api);
      if (p.kind === 'action') renderAction(p, d);
      else if (p.kind === 'pipeline' && NABZ.showPipeline) await NABZ.showPipeline(p, d);
      else if (p.kind === 'health' && NABZ.showHealth) await NABZ.showHealth(p, d);
      else if (p.kind === 'backup' && NABZ.showBackup) await NABZ.showBackup(p, d);
      else if (p.kind === 'audit' && NABZ.showAudit) await NABZ.showAudit(p, d);
      else if (p.kind === 'crisis' && NABZ.showCrisis) await NABZ.showCrisis(p, d);
      else if (p.kind === 'analytics' && NABZ.showAnalytics) await NABZ.showAnalytics(p, d);
      else if (p.kind === 'bedboard' && NABZ.showBedboard) await NABZ.showBedboard(p, d);
      else if (p.kind === 'nursing' && NABZ.showNursing) await NABZ.showNursing(p, d);
      else if (p.kind === 'sa_dashboard' && NABZ.sa) await NABZ.sa.showDashboard(p, d);
      else if (p.kind === 'sa_staff' && NABZ.sa) await NABZ.sa.staffSchedule();
      else if (p.kind === 'chart') renderChart(p, d);
      else if (p.kind === 'list') renderList(p, d);
      else if (p.kind === 'stats') renderStats(p, d);
      else m.innerHTML = '<pre style="font-size:11px;overflow-x:auto;padding:12px;background:var(--bg-2);border-radius:8px">' + esc(JSON.stringify(d, null, 2)) + '</pre>';
    } catch (e) {
      m.innerHTML = '<div class="empty">خطا: ' + esc(e.message) + '</div>';
    }
  }

  function renderList(p, d) {
    const items = d.items || [];
    let h = '<div class="sec-hd"><span>' + (p.icon || '') + ' ' + esc(p.title) + '</span><span style="font-size:11px;color:var(--fg-2)">' + items.length + '</span></div>';
    if (p.form) {
      h += '<div style="margin-bottom:10px"><button class="btn btn-primary btn-block" onclick="NABZ.openForm(\'' + p.id + '\')">➕ جدید</button></div>';
    }
    if (PANEL_ADDONS[p.id] && (!p.form || true)) {
      h += '<div style="margin-bottom:10px"><button class="btn btn-primary btn-block" style="padding:14px" onclick="' + PANEL_ADDONS[p.id].fn + '">' + PANEL_ADDONS[p.id].label + '</button></div>';
    }
    if (!items.length) {
      h += '<div class="empty">موردی نیست</div>';
    } else {
      for (const it of items) {
        const lv = it.newsLevel || it.status || 'lo';
        const c = (lv === 'critical' || lv === 'pending' || lv === 'active') ? 'hi' : (lv === 'high' || lv === 'due') ? 'md' : 'lo';
        h += '<div class="row ' + c + '" onclick="NABZ.showItem(\'' + p.id + '\',\'' + it.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + fmtTitle(it) + '</div>';
        h += '<span class="pill ' + (c === 'hi' ? 'dng' : c === 'md' ? 'warn' : 'ok') + '">' + esc(lv) + '</span></div>';
        h += '<div class="row-meta">' + fmtMeta(p, it) + '</div></div>';
      }
    }
    document.getElementById('content').innerHTML = h;
  }

  function renderAction(p, d) {
    const code = d.code || d.value || JSON.stringify(d);
    document.getElementById('content').innerHTML =
      '<div class="sec-hd"><span>' + (p.icon || '') + ' ' + esc(p.title) + '</span></div>'
      + '<div class="action-card">'
      + '<div style="font-size:44px;margin-bottom:16px">📱</div>'
      + '<div class="action-code">' + esc(code) + '</div>'
      + (d.ward ? '<div class="row-meta" style="margin-top:14px">بخش: ' + esc(d.ward) + '</div>' : '')
      + (d.expiresAt ? '<div class="row-meta">اعتبار تا: ' + new Date(d.expiresAt).toLocaleTimeString('fa-IR') + '</div>' : '')
      + '<button class="btn btn-primary btn-block" style="margin-top:18px" onclick="NABZ.show(\'' + p.id + '\')">🔄 تازه‌سازی</button>'
      + '</div>';
  }

  function renderChart(p, d) {
  let h = '<div class="sec-hd"><span>' + (p.icon || '📊') + ' ' + esc(p.title) + '</span></div>';
  h += '<div class="card" style="padding:16px;overflow-x:auto">';
  if (!d.series || !d.series.length) {
    h += '<div class="empty">داده‌ای نیست</div>';
  } else {
    h += renderSVGChart(d);
  }
  h += '</div>';
  document.getElementById('content').innerHTML = h;
}

function renderSVGChart(d) {
  const W = 400, H = 180, PAD = 30;
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:100%;height:auto;min-width:320px">';
  if (d.type === 'bars') {
    const series = d.series;
    const n = series[0].values.length;
    const max = Math.max(...series.flatMap(s => s.values), 1);
    const gw = (W - PAD * 2) / n;
    const bw = gw / (series.length + 1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < series.length; j++) {
        const v = series[j].values[i];
        const bh = (v / max) * (H - PAD * 2);
        const x = PAD + i * gw + j * bw + 4;
        const y = H - PAD - bh;
        svg += '<rect x="' + x + '" y="' + y + '" width="' + (bw - 6) + '" height="' + bh + '" fill="' + series[j].color + '" rx="2"/>';
      }
    }
    // Legend
    let lx = PAD;
    for (const s of series) {
      svg += '<rect x="' + lx + '" y="8" width="10" height="10" fill="' + s.color + '" rx="2"/>';
      svg += '<text x="' + (lx + 14) + '" y="17" font-size="9" fill="#8b95ab">' + esc(s.name) + '</text>';
      lx += 60;
    }
  } else if (d.type === 'line' || d.type === 'multiline') {
    const series = d.series.filter(s => s.values && s.values.length);
    if (!series.length) return '<div class="empty">داده نیست</div>';
    const allVals = series.flatMap(s => s.values.map(p => p.y));
    const max = Math.max(...allVals, 1);
    const min = Math.min(...allVals, 0);
    const range = max - min || 1;
    for (const s of series) {
      const pts = s.values.map((p, i) => {
        const x = PAD + (i / Math.max(1, s.values.length - 1)) * (W - PAD * 2);
        const y = H - PAD - ((p.y - min) / range) * (H - PAD * 2);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      svg += '<polyline points="' + pts + '" fill="none" stroke="' + (s.color || '#0ea5e9') + '" stroke-width="2"/>';
    }
    // Target line
    if (series[0].target) {
      const ty = H - PAD - ((series[0].target - min) / range) * (H - PAD * 2);
      svg += '<line x1="' + PAD + '" y1="' + ty + '" x2="' + (W - PAD) + '" y2="' + ty + '" stroke="#f59e0b" stroke-dasharray="4,4" stroke-width="1"/>';
    }
  }
  svg += '</svg>';
  return svg;
}

function renderStats(p, d) {
    let h = '<div class="sec-hd"><span>' + (p.icon || '') + ' ' + esc(p.title) + '</span></div><div class="grid-4">';
    for (const [k, v] of Object.entries(d)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        const s = Object.values(v).reduce((a, b) => a + (Number(b) || 0), 0);
        h += '<div class="stat"><div class="v">' + s + '</div><div class="l">' + esc(k) + '</div></div>';
      } else {
        h += '<div class="stat"><div class="v">' + esc(String(v)) + '</div><div class="l">' + esc(k) + '</div></div>';
      }
    }
    h += '</div>';
    h += '<div class="card" style="margin-top:12px"><div class="card-title">📋 جزئیات کامل</div>'
      + '<pre style="font-size:10.5px;overflow-x:auto;white-space:pre-wrap;word-break:break-all">' + esc(JSON.stringify(d, null, 2)) + '</pre></div>';
    document.getElementById('content').innerHTML = h;
  }

  async function showItem(pid, iid) {
    const p = S.panels.find(x => x.id === pid);
    if (!p) return;
    try {
      const d = await api(p.api);
      const item = (d.items || []).find(x => x.id === iid) || d;
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
      let html = '<div class="bs-handle"></div>';
      html += '<div class="bs-hd"><div class="bs-title">' + (p.icon || '') + ' ' + esc(p.title) + ' <span style="background:red;color:white;padding:2px 6px;border-radius:4px;font-size:10px;">V21</span></div>'
        + '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="bs-body">';

                      if (item && item.id && String(item.id).startsWith('pat_') && (item.firstName || item.mrn)) {
        try {
          html += _renderClinicalCard(item);
        } catch(err) {
          html += '<div style="background:red;color:white;padding:10px;margin:10px;border-radius:8px;direction:ltr;font-family:monospace;">Card Error: ' + err.message + '</div>';
        }
      } else {
        for (const [k, v] of Object.entries(item)) {
          if (v == null || v === '' || k === '_trans' || k === 'lastSignatureId') continue;
          let valHtml;
          if (typeof v === 'object') valHtml = '<code>' + esc(JSON.stringify(v, null, 2)) + '</code>';
          else valHtml = esc(String(v));
          html += '<div class="bs-row"><div class="bs-key">' + esc(k) + '</div><div class="bs-val">' + valHtml + '</div></div>';
        }
      }
      html += '</div>';
      // ─── Document actions ───
      const docBtns = _docButtonsFor(pid, item);
      if (docBtns) html += docBtns;
      // ─── Actions ───
      try {
        const coll = p.api.split('/').filter(Boolean).pop();
        const acts = await api('/api/actions/' + coll + '/' + iid);
        if (acts.items && acts.items.length) {
          html += '<div class="bs-hd" style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);border-bottom:none;padding-bottom:8px"><div class="bs-title">⚡ اقدامات</div></div>';
          html += '<div id="bsActs" style="display:flex;flex-direction:column;gap:8px;padding-bottom:8px">';
          for (let ai = 0; ai < acts.items.length; ai++) {
            const a = acts.items[ai];
            html += '<button class="btn" data-idx="' + ai + '" style="padding:14px;font-size:13px;background:var(--grad-primary);color:#fff;border:none" onclick="NABZ.runAction(this,\'' + iid + '\',\'' + pid + '\',\'' + coll + '\')">' + esc(a.label) + '</button>';
          }
          html += '</div>';
          window._bsActions = acts.items;
        }
      } catch(_) {}
      const content = document.createElement('div');
      content.className = 'bs-sheet';
      content.innerHTML = html;
      sheet.appendChild(content);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
    } catch (e) { alert(e.message); }
  }

  function openForm(pid) {
    const p = S.panels.find(x => x.id === pid);
    if (!p || !p.form) return;
    const sheet = document.createElement('div');
    sheet.className = 'bs-backdrop';
    sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
    let html = '<div class="bs-handle"></div>';
    html += '<div class="bs-hd"><div class="bs-title">➕ ' + esc(p.title) + '</div>'
      + '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
    html += '<form class="bs-form" id="dynForm">';
    for (const f of (p.form.fields || [])) {
      html += '<div class="bs-field"><label>' + esc(f.label) + (f.required ? ' <span style="color:var(--dng)">*</span>' : '') + '</label>';
      if (f.type === 'number') html += '<input type="number" name="' + f.name + '" step="any"' + (f.required ? ' required' : '') + '>';
      else if (f.options) {
        html += '<select name="' + f.name + '"' + (f.required ? ' required' : '') + '>';
        for (const o of f.options) html += '<option value="' + esc(o) + '">' + esc(o) + '</option>';
        html += '</select>';
      } else if (f.textarea) html += '<textarea name="' + f.name + '" rows="3"' + (f.required ? ' required' : '') + '></textarea>';
      else html += '<input type="text" name="' + f.name + '"' + (f.required ? ' required' : '') + '>';
      html += '</div>';
    }
    html += '<button type="submit" class="bs-submit">✅ ثبت</button></form>';
    const content = document.createElement('div');
    content.className = 'bs-sheet';
    content.innerHTML = html;
    content.querySelector('#dynForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const data = {};
      for (const [k, v] of fd.entries()) {
        if (v === '') continue;
        const n = Number(v);
        data[k] = (isNaN(n) || v === 'true' || v === 'false') ? (v === 'true' ? true : v === 'false' ? false : v) : n;
      }
      try {
        await api(p.form.api || p.api, { method: p.form.method || 'POST', body: JSON.stringify(data) });
        sheet.remove();
        show(pid);
      } catch (e) { alert('❌ ' + e.message); }
    };
    sheet.appendChild(content);
    document.body.appendChild(sheet);
    requestAnimationFrame(() => sheet.classList.add('show'));
  }

  async function runAction(btn, iid, pid, coll) {
  const idx = Number(btn.dataset.idx);
  const acts = window._bsActions || [];
  const a = acts[idx];
  if (!a) return;
  const sheet = btn.closest('.bs-backdrop');
  let data = {};
  if (a.requires) {
    // Build mini-form
    const form = document.createElement('form');
    form.className = 'bs-form';
    form.style.cssText = 'margin-top:16px;padding-top:16px;border-top:1px solid var(--border)';
    let fh = '<div style="font-size:13px;font-weight:900;margin-bottom:8px">ورودی‌های ' + esc(a.label) + '</div>';
    for (const [k, spec] of Object.entries(a.requires)) {
      fh += '<div class="bs-field"><label>' + esc(k) + '</label>';
      if (spec.type === 'five_rights') {
        fh += '<div style="padding:10px;background:var(--bg);border-radius:8px">';
        for (const r of ['patient','drug','dose','route','time']) {
          fh += '<label style="display:flex;gap:8px;padding:6px 0;font-size:12px"><input type="checkbox" data-right="' + r + '" style="width:18px;height:18px"><span>' + r + '</span></label>';
        }
        fh += '</div>';
      } else if (spec.type === 'select') {
        fh += '<select name="' + k + '">';
        for (const o of spec.options) fh += '<option value="' + esc(o) + '">' + esc(o) + '</option>';
        fh += '</select>';
      } else if (spec.type === 'checkbox') {
        fh += '<input type="checkbox" name="' + k + '">';
      } else {
        fh += '<input type="text" name="' + k + '">';
      }
      fh += '</div>';
    }
    fh += '<button type="submit" class="bs-submit">✅ اجرا</button>';
    form.innerHTML = fh;
    form.onsubmit = async (ev) => {
      ev.preventDefault();
      const fd = new FormData(ev.target);
      const payload = {};
      for (const [k, v] of fd.entries()) {
        if (a.requires[k] && a.requires[k].type === 'checkbox') payload[k] = v === 'on';
        else if (v !== '') payload[k] = v;
      }
      // Five rights
      const rights = {};
      ev.target.querySelectorAll('[data-right]').forEach(cb => rights[cb.dataset.right] = cb.checked);
      if (Object.keys(rights).length) payload.fiveRights = rights;
      try {
        await api(a.path, { method: a.method, body: JSON.stringify(payload) });
        sheet.remove();
        show(pid);
      } catch (e) { alert('❌ ' + e.message); }
    };
    sheet.querySelector('.bs-sheet').appendChild(form);
    return;
  }
  // No requires — direct call
  if (!confirm(a.label + '؟')) return;
  try {
    await api(a.path, { method: a.method, body: '{}' });
    sheet.remove();
    show(pid);
  } catch (e) { alert('❌ ' + e.message); }
}



function _renderClinicalCard(p) {
  console.log('🎨 _renderClinicalCard called for', p.id);
  const fullName = ((p.firstName || '') + ' ' + (p.lastName || '')).trim() || 'بیمار';
  const initial = (p.firstName || p.lastName || '?').trim().charAt(0);
  const age = p.age != null ? p.age + ' ساله' : '—';
  const sexFa = p.sex === 'male' ? 'مرد' : p.sex === 'female' ? 'زن' : (p.sex || '—');
  const ward = p.wardCode || '—';
  const bed = p.bedNumber || p.bedId || '—';
  const mrn = p.mrn || '—';
  const diagnosis = p.diagnosis || '';
  const comorbidities = Array.isArray(p.comorbidities) ? p.comorbidities : [];
  const allergies = Array.isArray(p.allergies) ? p.allergies : [];
  const codeStatus = p.codeStatus || '';
  const admissionType = p.admissionType || '';

  let admittedStr = '—';
  if (p.admittedAt) {
    try {
      const d = new Date(p.admittedAt);
      admittedStr = d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch(_) { admittedStr = String(p.admittedAt).slice(0, 10); }
  }

  const BADGE = 'display:inline-block;padding:5px 10px;border-radius:12px;font-size:11px;font-weight:800;line-height:1.4;';
  const allergyBadge = allergies.length
    ? '<span style="' + BADGE + 'background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;">🩸 آلرژی: ' + allergies.map(x => esc(String(x))).join(' · ') + '</span>'
    : '<span style="' + BADGE + 'background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;">🩸 بدون آلرژی</span>';

  const codeStatusBadge = codeStatus
    ? '<span style="' + BADGE + 'background:' + (codeStatus === 'full' ? '#ede9fe' : '#fecaca') + ';color:' + (codeStatus === 'full' ? '#5b21b6' : '#991b1b') + ';border:1px solid ' + (codeStatus === 'full' ? '#c4b5fd' : '#fca5a5') + ';">⚕️ ' + (codeStatus === 'full' ? 'Full Code' : codeStatus === 'dnr' ? 'DNR' : esc(String(codeStatus))) + '</span>'
    : '';

  const admissionBadge = admissionType
    ? '<span style="' + BADGE + 'background:#ffedd5;color:#9a3412;border:1px solid #fdba74;">' + (admissionType === 'emergency' ? '🚨 اورژانسی' : admissionType === 'elective' ? '📋 الکتیو' : esc(String(admissionType))) + '</span>'
    : '';

  let h = '';
  h += '<div style="background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 100%);border-radius:16px;padding:18px;border:1px solid #bae6fd;margin-bottom:12px;">';

  // Header
  h += '<div style="display:flex;gap:14px;align-items:center;margin-bottom:14px;">';
  h += '<div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:900;box-shadow:0 4px 12px rgba(2,132,199,0.3);flex-shrink:0;">' + esc(initial) + '</div>';
  h += '<div style="flex:1;min-width:0;">';
  h += '<div style="font-size:18px;font-weight:900;color:#0c4a6e;line-height:1.2;">' + esc(fullName) + '</div>';
  h += '<div style="font-size:12px;color:#075985;margin-top:4px;">' + esc(mrn) + ' · ' + esc(age) + ' · ' + esc(sexFa) + '</div>';
  h += '</div></div>';

  // Location
  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">';
  h += '<div style="background:#fff;border-radius:10px;padding:8px 10px;border:1px solid #e0f2fe;"><div style="color:#0369a1;font-weight:700;font-size:10px;margin-bottom:2px;">🏥 بخش</div><div style="color:#0c4a6e;font-weight:900;font-size:13px;">' + esc(ward) + '</div></div>';
  h += '<div style="background:#fff;border-radius:10px;padding:8px 10px;border:1px solid #e0f2fe;"><div style="color:#0369a1;font-weight:700;font-size:10px;margin-bottom:2px;">🛏 تخت</div><div style="color:#0c4a6e;font-weight:900;font-size:13px;">' + esc(bed) + '</div></div>';
  h += '</div>';

  h += '<div style="font-size:11px;color:#075985;margin-bottom:12px;font-weight:700;">📅 بستری: ' + esc(admittedStr) + '</div>';

  // Badges
  h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">';
  h += allergyBadge;
  if (codeStatusBadge) h += codeStatusBadge;
  if (admissionBadge) h += admissionBadge;
  h += '</div>';

  // Diagnosis
  if (diagnosis) {
    h += '<div style="background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #e0f2fe;margin-bottom:8px;">';
    h += '<div style="color:#0369a1;font-weight:700;font-size:10px;margin-bottom:4px;">📝 تشخیص</div>';
    h += '<div style="color:#0c4a6e;font-weight:700;font-size:13px;line-height:1.5;">' + esc(diagnosis) + '</div>';
    h += '</div>';
  }

  // Comorbidities
  if (comorbidities.length) {
    h += '<div style="background:#fff;border-radius:10px;padding:10px 12px;border:1px solid #e0f2fe;">';
    h += '<div style="color:#0369a1;font-weight:700;font-size:10px;margin-bottom:6px;">🧬 بیماری‌های همراه</div>';
    h += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
    for (const c of comorbidities) {
      h += '<span style="background:#f0f9ff;color:#0369a1;padding:3px 8px;border-radius:8px;border:1px solid #bae6fd;font-weight:700;font-size:11px;">' + esc(String(c)) + '</span>';
    }
    h += '</div></div>';
  }

  h += '</div>';
  return h;
}

if (typeof window !== "undefined") window._renderClinicalCard = _renderClinicalCard;

function _docButtonsFor(panelId, item) {
  if (!item) return '';
  const btn = function(label, type, val) {
    return '<button class="btn btn-block" style="margin-top:6px;background:var(--bg-3);padding:10px;font-size:12px" onclick="NABZ.openDoc(\'' + type + '\',\'' + val + '\')">' + label + '</button>';
  };
  let html = '';
  if (panelId === 'clinical.patients' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:12px;font-weight:900;margin-bottom:8px">📄 اسناد</div>' +
      '<button class="btn btn-block" style="margin-top:6px;background:var(--bg-3);padding:10px;font-size:12px" onclick="NABZ.openKardexInteractive(\'' + item.id + '\')">📋 کاردکس (تعاملی)</button>' +
      '<button class="btn btn-block" style="margin-top:6px;background:var(--bg-3);padding:10px;font-size:12px" onclick="NABZ.openMarInteractive(\'' + item.id + '\')">💊 MAR (تعاملی)</button>' +
      '<button class="btn btn-block" style="margin-top:6px;background:var(--bg-3);padding:10px;font-size:12px" onclick="NABZ.openVitalsInteractive(\'' + item.id + '\')">📈 علائم حیاتی (تعاملی)</button>' +
      btn('🖨️ چاپ نمودار ویتال', 'vitalsChart', item.id) +
      '</div>';
  } else if (panelId === 'workflow.discharge' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('🚪 خلاصه ترخیص', 'discharge', item.id) + '</div>';
  } else if (panelId === 'workflow.handover' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('📄 چاپ تحویل', 'handover', item.id) + '</div>';
  } else if (panelId === 'nursing_report.nursing' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('📄 چاپ گزارش', 'nursingReport', item.id) + '</div>';
  } else if (panelId === 'bedboard.wards' && item.code) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('👥 لیست بخش', 'wardCensus', item.code) + '</div>';
  }
  return html;
}

async function showNeural() {
    document.getElementById('content').innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    try {
      const [st, al, co] = await Promise.all([
        api('/api/neural/stats'), api('/api/neural/alerts'), api('/api/neural/cohort')
      ]);
      let h = '<div class="sec-hd"><span>🧠 موتور عصبی</span></div><div class="grid-4">';
      h += '<div class="stat"><div class="v">' + st.eventsIngested + '</div><div class="l">رویداد</div></div>';
      h += '<div class="stat ok"><div class="v">' + st.baselinesTracked + '</div><div class="l">Baseline</div></div>';
      h += '<div class="stat warn"><div class="v">' + st.anomaliesDetected + '</div><div class="l">آنومالی</div></div>';
      h += '<div class="stat"><div class="v">' + Object.keys(st.baselines || {}).length + '</div><div class="l">متریک</div></div>';
      h += '</div>';
      if (al.length) {
        h += '<div class="sec-hd"><span>🚨 هشدارها</span></div>';
        for (const a of al.slice(0, 10)) {
          h += '<div class="alert ' + a.severity + '"><div class="row-title">' + a.icon + ' ' + esc(a.title) + '</div><div class="row-meta">' + esc(a.message || '') + '</div></div>';
        }
      }
      if (co.length) {
        h += '<div class="sec-hd"><span>📊 Cohort Risk</span></div>';
        for (const c of co.slice(0, 10)) {
          h += '<div class="row ' + (c.critical > 0 ? 'hi' : 'lo') + '">';
          h += '<div class="row-title">' + esc(c.wardCode) + '</div>';
          h += '<div class="row-meta">' + c.total + ' بیمار · ' + c.critical + ' بحرانی · ' + c.high + ' پرخطر</div>';
          if (c.topRisks && c.topRisks[0]) h += '<div class="row-meta">بالاترین: ' + esc(c.topRisks[0].name) + ' → ' + c.topRisks[0].score + '%</div>';
          h += '</div>';
        }
      }
      document.getElementById('content').innerHTML = h;
    } catch (e) {
      document.getElementById('content').innerHTML = '<div class="empty">خطا: ' + esc(e.message) + '</div>';
    }
  }

  async function poll() {
    try {
      S.alerts = await api('/api/neural/alerts');
      const b = document.getElementById('nc');
      if (b) {
        if (S.alerts.length) { b.textContent = S.alerts.length; b.style.display = 'grid'; }
        else b.style.display = 'none';
      }
    } catch (_) {}
  }

  function showAlerts() {
    const a = S.alerts || [];
    if (!a.length) { alert('اعلانی نیست'); return; }
    let m = '🚨 ' + a.length + ' اعلان:\n\n';
    for (const x of a.slice(0, 10)) m += x.icon + ' ' + x.title + '\n  ' + x.message + '\n\n';
    alert(m);
  }

  function refresh() { if (S.current) show(S.current); else poll(); }
  function showErr(m) { document.getElementById('content').innerHTML = '<div class="empty">خطا: ' + esc(m) + '</div>'; }

  function fmtTitle(it) {
    if (it.patientName) return esc(it.patientName);
    if (it.drugName) return esc(it.drugName);
    if (it.codeLabel) return esc(it.codeLabel + (it.patientName ? ' — ' + it.patientName : ''));
    if (it.firstName) return esc(it.firstName + ' ' + it.lastName);
    if (it.alertLevel) return esc(it.alertLevel);
    if (it.title) return esc(it.title);
    if (it.name) return esc(it.name);
    if (it.fullName) return esc(it.fullName);
    return esc(JSON.stringify(it).slice(0, 50));
  }

  function fmtMeta(p, it) {
    const parts = [];
    for (const f of (p.fields || [])) {
      if (f === 'patientName' && it.patientName) continue;
      if (f === 'firstName' && it.firstName) continue;
      if (f === 'drugName' && it.drugName) continue;
      if (f === 'codeLabel' && it.codeLabel) continue;
      const v = it[f];
      if (v != null && v !== '') parts.push(f + ': ' + esc(String(v)).slice(0, 40));
    }
    return parts.join(' · ') || '—';
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, runAction, state: S , _docButtonsFor };
})();

NABZ.boot();

// expose NABZ to window for inline onclick handlers
window.NABZ = NABZ;
