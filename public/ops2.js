// ═══════════════════════════════════════════════════════════
//  NABZ Ops2 — Backup, Health, Audit
// ═══════════════════════════════════════════════════════════

// ─── Health Dashboard ───
NABZ.showHealth = async function(p, d) {
  if (!d) d = await NABZ._api('/api/ops2/health');
  let h = '<div class="sec-hd"><span>💚 سلامت سیستم</span></div>';

  h += '<div class="grid-4" style="margin-bottom:16px">';
  h += '<div class="stat ok"><div class="v">' + d.uptime.human + '</div><div class="l">Uptime</div></div>';
  h += '<div class="stat"><div class="v">' + d.memory.rssMB + 'MB</div><div class="l">RAM</div></div>';
  h += '<div class="stat"><div class="v">' + d.storage.totalRecords + '</div><div class="l">رکورد</div></div>';
  h += '<div class="stat ' + (d.audit.ok ? 'ok' : 'dng') + '"><div class="v">' + (d.audit.ok ? '✓' : '⚠') + '</div><div class="l">Audit</div></div>';
  h += '</div>';

  h += '<div class="card"><div class="card-title">📦 ذخیره‌سازی</div>';
  h += '<div class="row-meta">' + d.storage.collections + ' collection · ' + d.storage.totalMB + ' MB</div>';
  for (const c of d.storage.topCollections) {
    h += '<div style="margin-top:10px"><div style="display:flex;justify-content:space-between;font-size:11.5px"><span style="font-family:monospace">' + NABZ._esc(c.name) + '</span><span style="font-weight:800">' + c.records + ' · ' + (Math.round(c.bytes / 1024 * 10) / 10) + ' KB</span></div>';
    const pct = Math.min(100, (c.bytes / Math.max(1, d.storage.topCollections[0].bytes)) * 100);
    h += '<div class="progress" style="margin-top:4px"><div class="progress-fill" style="width:' + pct + '%"></div></div></div>';
  }
  h += '</div>';

  h += '<div class="card"><div class="card-title">📋 Audit Chain</div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px"><span>وضعیت:</span><span style="font-weight:800;color:var(--' + (d.audit.ok ? 'ok' : 'dng') + ')">' + (d.audit.ok ? '✅ سالم' : '❌ شکسته') + '</span></div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px"><span>تعداد رکورد:</span><span style="font-weight:800">' + (d.audit.count || 0) + '</span></div>';
  h += '</div>';

  h += '<div class="card"><div class="card-title">💾 پشتیبان‌ها</div>';
  h += '<div style="display:flex;justify-content:space-between;font-size:12px"><span>تعداد:</span><span style="font-weight:800">' + d.backups.count + '</span></div>';
  if (d.backups.latest) {
    h += '<div style="font-size:11px;color:var(--fg-2);margin-top:6px">آخرین: ' + NABZ._esc(d.backups.latest.filename) + ' · ' + new Date(d.backups.latest.modifiedAt).toLocaleString('fa-IR', {hour:'2-digit',minute:'2-digit'}) + '</div>';
  }
  h += '</div>';

  h += '<div class="card"><div class="card-title">🖥 سیستم</div>';
  h += '<div style="font-family:monospace;font-size:11px;line-height:1.8;color:var(--fg-2)">';
  h += 'Node.js ' + NABZ._esc(d.versions.node) + '<br>';
  h += NABZ._esc(d.versions.platform) + ' · ' + NABZ._esc(d.versions.arch) + '<br>';
  h += 'Heap: ' + d.memory.heapMB + 'MB';
  h += '</div></div>';

  h += '<button class="btn btn-primary btn-block" style="padding:14px" onclick="NABZ.showHealth()">🔄 بازخوانی</button>';
  document.getElementById('content').innerHTML = h;
};

// ─── Backup Panel ───
NABZ.showBackup = async function(p, d) {
  if (!d) d = await NABZ._api('/api/ops2/backup/list');
  let h = '<div class="sec-hd"><span>💾 پشتیبان‌گیری</span><span style="font-size:11px;color:var(--fg-2)">' + d.total + '</span></div>';

  h += '<div class="card" style="background:linear-gradient(135deg,rgba(16,185,129,0.08),rgba(6,182,212,0.05));border-color:rgba(16,185,129,0.3)">';
  h += '<div style="font-size:14px;font-weight:900;margin-bottom:6px">🔐 رمزگذاری AES-256</div>';
  h += '<div style="font-size:11.5px;color:var(--fg-2);line-height:1.6;margin-bottom:12px">فایل پشتیبان با رمز شما رمزنگاری می‌شود. رمز را فراموش نکنید — بازیابی بدون رمز غیرممکن است.</div>';
  h += '<button class="btn btn-primary btn-block" style="padding:14px" onclick="NABZ._openBackupExport()">📤 ایجاد پشتیبان جدید</button>';
  h += '</div>';

  h += '<div class="sec-hd"><span>📚 پشتیبان‌های موجود</span></div>';
  if (!d.items.length) {
    h += '<div class="empty">هنوز پشتیبانی ساخته نشده</div>';
  } else {
    for (const b of d.items) {
      const size = (b.bytes / 1024 / 1024).toFixed(2);
      const date = new Date(b.modifiedAt).toLocaleString('fa-IR', {year:'2-digit',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      h += '<div class="row ' + (b.auto ? 'md' : 'lo') + '">';
      h += '<div class="row-hd"><div class="row-title" style="font-family:monospace;font-size:11px">' + NABZ._esc(b.filename) + '</div>';
      h += '<span class="pill ' + (b.auto ? 'warn' : 'ok') + '">' + (b.auto ? 'auto' : 'manual') + '</span></div>';
      h += '<div class="row-meta">' + b.records + ' رکورد · ' + size + ' MB · ' + NABZ._esc(b.createdBy) + '</div>';
      h += '<div class="row-meta">' + date + '</div>';
      h += '<div style="display:flex;gap:6px;margin-top:8px">';
      h += '<button class="btn" style="flex:1;padding:8px;font-size:11px" onclick="NABZ._downloadBackup(\'' + NABZ._esc(b.filename) + '\')">⬇️ دانلود</button>';
      h += '<button class="btn" style="flex:1;padding:8px;font-size:11px;color:var(--dng)" onclick="NABZ._deleteBackup(\'' + NABZ._esc(b.filename) + '\')">🗑 حذف</button>';
      h += '</div></div>';
    }
  }

  h += '<div class="sec-hd"><span>📥 بازیابی از فایل</span></div>';
  h += '<div class="card"><div style="font-size:11.5px;color:var(--fg-2);margin-bottom:10px;line-height:1.6">فایل <code style="font-family:monospace;font-size:10px">.nabz</code> را انتخاب کنید. قبل از بازیابی، به‌طور خودکار از وضعیت فعلی نسخه پشتیبان گرفته می‌شود.</div>';
  h += '<button class="btn btn-block" style="padding:14px" onclick="NABZ._openBackupImport()">📥 انتخاب فایل برای بازیابی</button>';
  h += '</div>';

  document.getElementById('content').innerHTML = h;
};

NABZ._openBackupExport = function() {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📤 پشتیبان جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<form class="bs-form" id="bkForm">';
  h += '<div class="bs-field"><label>رمز (حداقل ۸ کاراکتر) *</label><input type="password" name="password" required minlength="8" autocomplete="new-password"></div>';
  h += '<div class="bs-field"><label>تکرار رمز *</label><input type="password" name="confirm" required minlength="8" autocomplete="new-password"></div>';
  h += '<div style="background:rgba(245,158,11,0.1);border:1px solid var(--warn);border-radius:10px;padding:12px;font-size:11px;line-height:1.6;color:#92400e">⚠️ رمز را در جای امنی نگه دارید. بدون رمز، بازیابی ممکن نیست.</div>';
  h += '<button type="submit" class="bs-submit">🔐 ساخت</button></form>';
  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  c.querySelector('#bkForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const p1 = fd.get('password'), p2 = fd.get('confirm');
    if (p1 !== p2) { alert('رمزها یکسان نیستند'); return; }
    try {
      NABZ._toast('در حال رمزگذاری...');
      const r = await NABZ._api('/api/ops2/backup/export', { method:'POST', body: JSON.stringify({ password: p1 }) });
      sheet.remove();
      // Download the file
      const blob = new Blob([JSON.stringify(r)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = r.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      NABZ._toast('✅ پشتیبان ساخته و دانلود شد');
      NABZ.showBackup();
    } catch (e) { alert('❌ ' + e.message); }
  };
};

NABZ._downloadBackup = async function(filename) {
  try {
    const list = await NABZ._api('/api/ops2/backup/list');
    // For simplicity, we trigger the API to get the full backup with the stored passwordless... 
    // Actually the file is encrypted, so we can't decrypt without password. Just download from server by re-exporting.
    alert('برای دانلود فایل پشتیبان، از دکمه "ایجاد پشتیبان جدید" استفاده کنید. فایل قدیمی روی سرور است و از طریق file system قابل دسترسی است.');
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._deleteBackup = async function(filename) {
  if (!confirm('پشتیبان "' + filename + '" حذف شود؟')) return;
  try {
    await NABZ._api('/api/ops2/backup/' + encodeURIComponent(filename), { method:'DELETE' });
    NABZ._toast('✅ حذف شد');
    NABZ.showBackup();
  } catch (e) { alert('❌ ' + e.message); }
};

NABZ._openBackupImport = function() {
  const sheet = document.createElement('div');
  sheet.className = 'bs-backdrop';
  sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
  let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📥 بازیابی</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
  h += '<form class="bs-form" id="importForm">';
  h += '<div class="bs-field"><label>فایل پشتیبان *</label><input type="file" name="file" accept=".nabz,application/json" required></div>';
  h += '<div class="bs-field"><label>رمز فایل *</label><input type="password" name="password" required autocomplete="current-password"></div>';
  h += '<div class="bs-field"><label>حالت</label><select name="mode"><option value="replace">جایگزینی کامل (پاک‌کردن داده فعلی)</option><option value="merge">ادغام (نگه‌داشتن داده فعلی)</option></select></div>';
  h += '<div style="background:rgba(239,68,68,0.1);border:1px solid var(--dng);border-radius:10px;padding:12px;font-size:11px;line-height:1.6;color:var(--dng)">⚠️ قبل از بازیابی، به‌طور خودکار از وضعیت فعلی نسخه پشتیبان گرفته می‌شود.</div>';
  h += '<button type="submit" class="bs-submit">📥 بازیابی</button></form>';
  const c = document.createElement('div');
  c.className = 'bs-sheet';
  c.innerHTML = h;
  sheet.appendChild(c);
  document.body.appendChild(sheet);
  requestAnimationFrame(() => sheet.classList.add('show'));
  c.querySelector('#importForm').onsubmit = async (ev) => {
    ev.preventDefault();
    const fd = new FormData(ev.target);
    const file = fd.get('file');
    const password = fd.get('password');
    const mode = fd.get('mode');
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      if (!confirm('آیا مطمئن هستید؟ داده فعلی با ' + mode + ' بازیابی می‌شود.')) return;
      NABZ._toast('در حال بازیابی...');
      const r = await NABZ._api('/api/ops2/backup/import', {
        method:'POST',
        body: JSON.stringify({ password, payload: { salt: payload.salt, iv: payload.iv, tag: payload.tag, data: payload.data }, mode })
      });
      sheet.remove();
      alert('✅ بازیابی شد\n\n' + r.totalRecords + ' رکورد از ' + r.collections.length + ' collection\n\nAuto-backup: ' + r.autoBackup);
      NABZ.showHome();
    } catch (e) { alert('❌ ' + e.message); }
  };
};

// ─── Audit Viewer ───
NABZ.showAudit = async function(p, d) {
  if (!d) d = await NABZ._api('/api/ops2/audit?limit=50');
  let h = '<div class="sec-hd"><span>📋 Audit Trail</span><span style="font-size:11px;color:var(--fg-2)">' + d.total + '</span></div>';

  h += '<div class="card"><div style="font-size:11.5px;color:var(--fg-2);line-height:1.6">لاگ غیرقابل تغییر با SHA-256 chain. هر اقدام در سیستم به‌صورت زنجیره‌ای امضا می‌شود.</div></div>';

  h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
  h += '<select id="auditMod" onchange="NABZ._reloadAudit()" style="padding:10px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:10px;color:var(--fg);font-family:inherit;font-size:12px"><option value="">همه ماژول‌ها</option>';
  for (const m of d.modules) h += '<option value="' + NABZ._esc(m) + '">' + NABZ._esc(m) + '</option>';
  h += '</select>';
  h += '<select id="auditAct" onchange="NABZ._reloadAudit()" style="padding:10px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:10px;color:var(--fg);font-family:inherit;font-size:12px"><option value="">همه اقدامات</option>';
  for (const a of d.actions) h += '<option value="' + NABZ._esc(a) + '">' + NABZ._esc(a) + '</option>';
  h += '</select>';
  h += '</div>';

  h += '<div id="auditList">';
  for (const a of d.items) {
    h += '<div class="card" style="padding:12px;margin-bottom:6px">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
    h += '<div style="min-width:0;flex:1">';
    h += '<div style="font-weight:800;font-size:12px">' + NABZ._esc(a.module) + '.' + NABZ._esc(a.action) + '</div>';
    h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + NABZ._esc(a.entityId || '') + '</div>';
    h += '<div style="font-size:10px;color:var(--fg-3);margin-top:2px;font-family:monospace">' + NABZ._esc(a.actor ? a.actor.name : '?') + ' · ' + new Date(a.at).toLocaleString('fa-IR', {hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}) + '</div>';
    h += '</div>';
    h += '<div style="font-family:monospace;font-size:9px;color:var(--primary);padding:4px 8px;background:var(--primary-soft);border-radius:6px">' + NABZ._esc((a.hash || '').slice(0, 8)) + '</div>';
    h += '</div>';
    if (a.meta && Object.keys(a.meta).length) {
      h += '<div style="font-size:10px;color:var(--fg-3);margin-top:6px;padding:6px;background:var(--bg);border-radius:6px;font-family:monospace;overflow-x:auto">' + NABZ._esc(JSON.stringify(a.meta).slice(0, 120)) + '</div>';
    }
    h += '</div>';
  }
  h += '</div>';

  document.getElementById('content').innerHTML = h;
};

NABZ._reloadAudit = async function() {
  const mod = document.getElementById('auditMod')?.value || '';
  const act = document.getElementById('auditAct')?.value || '';
  const q = [];
  if (mod) q.push('module=' + encodeURIComponent(mod));
  if (act) q.push('action=' + encodeURIComponent(act));
  const d = await NABZ._api('/api/ops2/audit?limit=50&' + q.join('&'));
  NABZ.showAudit(null, d);
};
