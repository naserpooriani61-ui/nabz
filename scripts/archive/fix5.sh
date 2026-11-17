
# ═══════════════════════════════════════════════════════════════
#  Complete rewrite of app.js — Mobile-first, no regex
# ═══════════════════════════════════════════════════════════════

cat > public/app.js << 'APP_EOF'
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
    await boot();
  }

  function logout() {
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
      if (S.panels.length) show(S.panels[0].id);
      poll();
      setInterval(poll, 30000);
    } catch (e) {
      if (String(e.message).includes('unauthorized')) logout();
      else showErr(e.message);
    }
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

  const MOD_META = {
    clinical:{l:'بالینی',i:'🩺'}, emergency:{l:'اورژانس',i:'🚨'},
    workflow:{l:'گردش کار',i:'🔄'}, paraclinical:{l:'پاراکلینیک',i:'🧪'},
    safety:{l:'ایمنی',i:'⚠️'}, surgical:{l:'جراحی',i:'🔪'},
    ops:{l:'عملیات',i:'⚙️'}, education:{l:'آموزش',i:'🎓'},
    quality:{l:'کیفیت',i:'⭐'}, rights:{l:'حقوق بیمار',i:'⚖️'},
    advanced_hr:{l:'منابع انسانی',i:'💰'}, admin:{l:'مدیریت',i:'🛡️'},
    qr_pulse:{l:'QR نبضی',i:'📱'}, crisis:{l:'بحران',i:'🔥'}
  };

  function renderNav() {
    const byModule = {};
    for (const p of S.panels) {
      if (!byModule[p.module]) byModule[p.module] = [];
      byModule[p.module].push(p);
    }
    const modOrder = ['clinical','emergency','workflow','paraclinical','safety','surgical','ops','education','quality','rights','advanced_hr','admin','qr_pulse','crisis'];

    const tabs = [
      { icon:'🏠', label:'خانه', action:'NABZ.showNeural()' },
      { icon:'🚨', label:'اورژانس', action: byModule.emergency ? "NABZ.show('"+byModule.emergency[0].id+"')" : 'NABZ.showDrawer()' },
      { icon:'🩺', label:'بالینی', action: byModule.clinical ? "NABZ.show('"+byModule.clinical[0].id+"')" : 'NABZ.showDrawer()' },
      { icon:'🧠', label:'عصبی', action:'NABZ.showNeural()' },
      { icon:'☰', label:'منو', action:'NABZ.showDrawer()' }
    ];

    let dh = '<div class="drawer-hd"><div class="drawer-logo">🫀 <strong>نبض</strong></div><button class="drawer-close" onclick="NABZ.hideDrawer()">✕</button></div>';
    for (const m of modOrder) {
      if (!byModule[m]) continue;
      const info = MOD_META[m] || { l: m, i: '📄' };
      dh += '<div class="drawer-sec"><div class="drawer-sec-hd">' + info.i + ' ' + info.l + '</div>';
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
    const p = S.panels.find(x => x.id === id);
    if (!p) return;
    S.current = id;
    document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
    const m = document.getElementById('content');
    m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
    try {
      const d = await api(p.api);
      if (p.kind === 'action') renderAction(p, d);
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
      html += '<div class="bs-hd"><div class="bs-title">' + (p.icon || '') + ' ' + esc(p.title) + '</div>'
        + '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      html += '<div class="bs-body">';
      for (const [k, v] of Object.entries(item)) {
        if (v == null || v === '' || k === '_trans' || k === 'lastSignatureId') continue;
        let valHtml;
        if (typeof v === 'object') valHtml = '<code>' + esc(JSON.stringify(v, null, 2)) + '</code>';
        else valHtml = esc(String(v));
        html += '<div class="bs-row"><div class="bs-key">' + esc(k) + '</div><div class="bs-val">' + valHtml + '</div></div>';
      }
      html += '</div>';
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

  return { boot, show, showNeural, showAlerts, refresh, logout, showItem, openForm, showDrawer, hideDrawer, state: S };
})();

NABZ.boot();
APP_EOF

echo "✅ app.js completely rewritten (mobile-first, no regex)"

# ─── Fix HTML: --fg2 → --fg-2 ───
sed -i 's/var(--fg2)/var(--fg-2)/g' public/index.html
echo "✅ HTML var fix"

# ─── Free port ───
for i in 1 2 3; do
  PID=$(pgrep -f "core/server.js" 2>/dev/null | head -1)
  if [ -z "$PID" ]; then break; fi
  kill -9 "$PID" 2>/dev/null
  sleep 1
done
echo "✅ Port free"

echo ""
echo "Now: npm start"
