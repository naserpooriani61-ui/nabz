
// ═══════════════════════════════════════════════════════════
//  NABZ — Backup Operations Console
//  Production-grade UI for backup_manager
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var BU = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _state: { data: null, health: null, refreshTimer: null, loading: false },

    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(el) { el.remove(); }); },

    _openSheet: function(html, opts) {
      opts = opts || {};
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s && !opts.noClose) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet: s, content: c };
    },

    _fmtAge: function(iso) {
      if (!iso) return '—';
      var ms = Date.now() - new Date(iso).getTime();
      var min = Math.floor(ms / 60000);
      if (min < 1) return 'همین الان';
      if (min < 60) return min + ' دقیقه پیش';
      var hr = Math.floor(min / 60);
      if (hr < 24) return hr + ' ساعت پیش';
      var d = Math.floor(hr / 24);
      return d + ' روز پیش';
    },

    _fmtSize: function(mb) {
      if (mb == null) return '—';
      if (mb < 1) return Math.round(mb * 1024) + ' KB';
      return Math.round(mb * 10) / 10 + ' MB';
    },

    // ═══════════════════════════════════════════════════
    //  MAIN
    // ═══════════════════════════════════════════════════
    async show(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var results = await Promise.all([
          d || this._api('/api/backup/status'),
          this._api('/api/backup/health')
        ]);
        this._state.data = results[0];
        this._state.health = results[1];
        this._render(p);
        this._startAutoRefresh();
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    _startAutoRefresh: function() {
      if (this._state.refreshTimer) clearInterval(this._state.refreshTimer);
      var self = this;
      this._state.refreshTimer = setInterval(function() {
        if (NABZ.state.current === 'backup_manager.dashboard' && !document.querySelector('.bs-backdrop')) {
          self.show(null, null).catch(function() {});
        }
      }, 30000);
    },

    _render: function(p) {
      var m = document.getElementById('content');
      var data = this._state.data;
      var health = this._state.health;

      var h = '';
      h += '<div class="sec-hd"><span>💾 پشتیبان‌گیری و بازیابی</span></div>';
      h += this._renderHealthCard(health);
      h += this._renderActionsBar();
      h += this._renderBackupList(data);

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'backup_manager.dashboard';
    },

    // ═══════════════════════════════════════════════════
    //  HEALTH CARD
    // ═══════════════════════════════════════════════════
    _renderHealthCard: function(health) {
      if (!health) return '';
      var statusColor = health.status === 'healthy' ? 'ok' : health.status === 'warning' ? 'warn' : 'dng';
      var statusIcon = health.status === 'healthy' ? '✅' : health.status === 'warning' ? '⚠️' : '🚨';
      var statusFa = health.status === 'healthy' ? 'سالم' : health.status === 'warning' ? 'نیاز به توجه' : 'بحرانی';

      var dataMB = health.disk.dataMB;
      var backupMB = health.disk.backupMB;
      var maxMB = (this._state.data && this._state.data.config.maxTotalMB) || 200;
      var diskPct = Math.min(100, Math.round((backupMB / maxMB) * 100));
      var diskColor = diskPct >= 90 ? 'dng' : diskPct >= 70 ? 'warn' : 'ok';

      var h = '';
      h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.12),rgba(139,92,246,.06));border-color:var(--' + statusColor + ');margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">';
      h += '<div>';
      h += '<div style="font-size:11px;color:var(--fg-2);font-weight:800">وضعیت سیستم</div>';
      h += '<div style="font-size:22px;font-weight:900;color:var(--' + statusColor + ');line-height:1.1">' + statusIcon + ' ' + statusFa + '</div>';
      if (health.warnings.length) {
        h += '<div style="font-size:11px;color:var(--' + statusColor + ');margin-top:4px;font-weight:800">' + health.warnings.join(' · ') + '</div>';
      }
      h += '</div>';
      h += '<div style="text-align:left;font-size:10.5px;color:var(--fg-2);line-height:1.7;font-family:monospace">';
      h += '<div>Uptime: <b>' + health.uptimeHuman + '</b></div>';
      h += '<div>RAM: <b>' + health.memory.rssMB + 'MB</b></div>';
      h += '<div>Data: <b>' + this._fmtSize(dataMB) + '</b></div>';
      h += '</div></div>';

      // Disk usage bar
      h += '<div style="margin-top:12px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--fg-2)"><span>فضای پشتیبان</span><span><b>' + this._fmtSize(backupMB) + '</b> / ' + maxMB + 'MB</span></div>';
      h += '<div class="progress" style="margin-top:4px;height:6px"><div class="progress-fill ' + diskColor + '" style="width:' + diskPct + '%"></div></div>';
      h += '</div>';

      // Backup summary
      h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:12px">';
      h += '<div style="text-align:center;padding:8px;background:var(--bg-2);border-radius:6px">';
      h += '<div style="font-size:18px;font-weight:900;color:var(--primary)">' + health.backup.count + '</div>';
      h += '<div style="font-size:9.5px;color:var(--fg-2)">تعداد</div>';
      h += '</div>';
      h += '<div style="text-align:center;padding:8px;background:var(--bg-2);border-radius:6px">';
      var ageColor = health.backup.lastAgeHours == null ? 'fg-2' : health.backup.lastAgeHours > 3 ? 'dng' : health.backup.lastAgeHours > 1.5 ? 'warn' : 'ok';
      h += '<div style="font-size:11px;font-weight:900;color:var(--' + ageColor + ')">' + this._fmtAge(health.backup.lastAt) + '</div>';
      h += '<div style="font-size:9.5px;color:var(--fg-2)">آخرین</div>';
      h += '</div>';
      h += '<div style="text-align:center;padding:8px;background:var(--bg-2);border-radius:6px">';
      h += '<div style="font-size:11px;font-weight:900;color:' + (health.backup.enabled ? 'var(--ok)' : 'var(--dng)') + '">' + (health.backup.enabled ? '✓ فعال' : '✗ غیرفعال') + '</div>';
      h += '<div style="font-size:9.5px;color:var(--fg-2)">خودکار</div>';
      h += '</div>';
      h += '</div>';

      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  ACTIONS BAR
    // ═══════════════════════════════════════════════════
    _renderActionsBar: function() {
      var h = '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap">';
      h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px;font-weight:900" onclick="NABZ.backupUI.runBackup()">💾 بکاپ فوری</button>';
      h += '<button class="btn" style="flex:1;min-width:120px;padding:12px;font-size:12px" onclick="NABZ.backupUI.openConfig()">⚙️ تنظیمات</button>';
      h += '<button class="btn" style="flex:1;min-width:120px;padding:12px;font-size:12px" onclick="NABZ.backupUI.refresh()">🔄 بازخوانی</button>';
      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  BACKUP LIST
    // ═══════════════════════════════════════════════════
    _renderBackupList: function(data) {
      var backups = (data && data.backups) || [];
      var h = '<div class="sec-hd" style="margin-top:16px"><span>📚 لیست پشتیبان‌ها</span>';
      h += '<span class="rd-mini">' + backups.length + '</span></div>';

      if (backups.length === 0) {
        h += '<div class="card" style="text-align:center;padding:30px">';
        h += '<div style="font-size:40px">📭</div>';
        h += '<div style="font-weight:900;margin-top:8px">هیچ پشتیبانی نیست</div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:4px">اولین بکاپ در ۶۰ ثانیه آینده خودکار ساخته می‌شود</div>';
        h += '</div>';
        return h;
      }

      backups.forEach(function(b, i) {
        h += BU._renderBackupRow(b, i);
      });
      return h;
    },

    _renderBackupRow: function(b, idx) {
      var verifiedIcon = b.verified ? '✅' : '⚠️';
      var verifiedCls = b.verified ? 'ok' : 'warn';
      var reasonFa = {
        'scheduled_initial': '🎬 شروع',
        'scheduled_hourly': '⏰ ساعتی',
        'pre_restore': '🛡️ پیش از بازیابی'
      }[b.reason] || (b.reason && b.reason.indexOf('manual_') === 0 ? '👤 دستی' : (b.reason || '—'));

      var h = '';
      h += '<div class="card" style="padding:12px;margin-bottom:6px">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:12px;font-weight:900;font-family:monospace;color:var(--primary);word-break:break-all">' + BU._esc(b.id) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">' + reasonFa + ' · ' + BU._fmtAge(b.createdAt) + ' · <span style="color:var(--' + verifiedCls + ')">' + verifiedIcon + ' ' + (b.verified ? 'معتبر' : 'هشدار') + '</span></div>';
      h += '</div>';
      h += '<div style="text-align:left;font-size:11px;color:var(--fg-2);font-family:monospace;line-height:1.5">';
      h += '<div>' + b.records + ' رکورد</div>';
      h += '<div>' + BU._fmtSize(b.MB) + ' · ' + b.files + ' فایل</div>';
      h += '</div>';
      h += '</div>';

      // Actions
      h += '<div style="display:flex;gap:4px;margin-top:10px">';
      h += '<button class="btn btn-sm" style="flex:1;padding:6px 8px;font-size:10.5px;font-weight:800;background:var(--primary-soft);color:var(--primary);border-color:var(--primary)" onclick="NABZ.backupUI.previewRestore(\'' + BU._esc(b.id) + '\')">🔍 بررسی</button>';
      h += '<button class="btn btn-sm" style="flex:1;padding:6px 8px;font-size:10.5px;font-weight:800;color:var(--warn);border-color:var(--warn)" onclick="NABZ.backupUI.restore(\'' + BU._esc(b.id) + '\')">↩️ بازیابی</button>';
      h += '<button class="btn btn-sm" style="padding:6px 10px;font-size:10.5px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.backupUI.deleteBackup(\'' + BU._esc(b.id) + '\')" title="حذف">🗑</button>';
      h += '</div>';
      h += '</div>';
      return h;
    },

    // ═══════════════════════════════════════════════════
    //  ACTIONS
    // ═══════════════════════════════════════════════════
    async refresh() {
      if (this._state.loading) return;
      this._state.loading = true;
      try {
        await this.show(null, null);
        NABZ._toast('✅ بازخوانی شد');
      } finally { this._state.loading = false; }
    },

    async runBackup() {
      try {
        NABZ._toast('در حال ساخت backup...');
        var r = await this._api('/api/backup/run', { method: 'POST', body: '{}' });
        NABZ._toast('✅ بکاپ ساخته شد · ' + r.meta.records + ' رکورد · ' + Math.round(r.meta.bytes / 1024) + 'KB');
        await this.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async previewRestore(id) {
      try {
        NABZ._toast('در حال بررسی...');
        var r = await this._api('/api/backup/preview/' + encodeURIComponent(id));
        this._renderPreviewModal(id, r);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderPreviewModal: function(id, preview) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🔍 بررسی بازیابی</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      h += '<div class="card" style="background:var(--info-soft);border-color:var(--info);margin-bottom:12px">';
      h += '<div style="font-size:11px;color:var(--fg-2)">Backup ID</div>';
      h += '<div style="font-size:11.5px;font-weight:900;font-family:monospace;word-break:break-all">' + this._esc(id) + '</div>';
      if (preview.meta) {
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">';
        h += this._fmtAge(preview.meta.createdAt) + ' · ' + preview.meta.records + ' رکورد';
        h += '</div>';
      }
      h += '</div>';

      var changes = preview.changes || [];
      if (changes.length === 0) {
        h += '<div class="empty">هیچ فایلی تغییر نمی‌کند</div>';
      } else {
        var willChange = changes.filter(function(c) { return c.diff !== 0; });
        h += '<div class="hint ' + (willChange.length > 0 ? 'warn' : 'info') + '" style="margin-bottom:12px">';
        h += '📊 ' + willChange.length + ' مجموعه تغییر می‌کند از ' + changes.length + ' مجموعه';
        h += '</div>';

        h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">📋 جزئیات تغییرات</div>';
        changes.forEach(function(c) {
          var diffCls = c.diff > 0 ? 'ok' : c.diff < 0 ? 'dng' : 'fg-2';
          var diffStr = c.diff === 0 ? 'بدون تغییر' : (c.diff > 0 ? '+' + c.diff : String(c.diff));
          h += '<div style="padding:6px 10px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;font-size:11px">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<span style="font-family:monospace;font-weight:800">' + this._esc(c.collection) + '</span>';
          h += '<span style="color:var(--' + diffCls + ');font-weight:900">' + diffStr + '</span>';
          h += '</div>';
          h += '<div style="font-size:9.5px;color:var(--fg-3);margin-top:2px">';
          h += 'backup: ' + c.backupRecords + ' · current: ' + c.currentRecords;
          h += '</div>';
          h += '</div>';
        });
      }

      h += '<div class="hint danger" style="margin-top:12px;margin-bottom:12px">⚠️ قبل از بازیابی، از وضعیت فعلی یک بکاپ امنیتی خودکار گرفته می‌شود</div>';

      h += '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;font-weight:900" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.backupUI.restore(\'' + this._esc(id) + '\')">↩️ ادامه بازیابی</button>';
      h += '<button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">انصراف</button>';
      h += '</div>';

      this._openSheet(h);
    },

    async restore(id) {
      var confirmWord = 'RESTORE';
      var typed = prompt(
        '⚠️ بازیابی کامل از این backup\n\n' +
        'این عمل همه داده‌های فعلی را با نسخه پشتیبان جایگزین می‌کند.\n' +
        'قبل از بازیابی، از وضعیت فعلی backup امنیتی گرفته می‌شود.\n\n' +
        'برای تأیید، کلمه RESTORE را تایپ کنید:'
      );
      if (typed !== confirmWord) {
        if (typed !== null) alert('کلمه تأیید اشتباه است. عملیات لغو شد.');
        return;
      }

      try {
        NABZ._toast('در حال بازیابی...');
        var r = await this._api('/api/backup/restore/' + encodeURIComponent(id), {
          method: 'POST',
          body: JSON.stringify({ confirm: true })
        });
        var msg = '✅ ' + r.restored.length + ' مجموعه بازیابی شد';
        if (r.preRestoreBackup) msg += '\n\nبکاپ امنیتی: ' + r.preRestoreBackup;
        alert(msg);
        await this.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async deleteBackup(id) {
      if (!confirm('این پشتیبان حذف شود؟\n\n' + id)) return;
      try {
        await this._api('/api/backup/' + encodeURIComponent(id), { method: 'DELETE' });
        NABZ._toast('✅ حذف شد');
        await this.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  CONFIG MODAL
    // ═══════════════════════════════════════════════════
    openConfig: function() {
      var cfg = (this._state.data && this._state.data.config) || {};
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">⚙️ تنظیمات بکاپ</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      h += '<div class="wf-field"><label>فعال بودن بکاپ خودکار</label>';
      h += '<label style="display:flex;align-items:center;gap:8px;padding:10px;background:var(--bg-2);border-radius:8px;cursor:pointer">';
      h += '<input type="checkbox" id="bkEnabled" ' + (cfg.enabled !== false ? 'checked' : '') + ' style="width:20px;height:20px;accent-color:var(--primary)">';
      h += '<span style="font-weight:800">فعال</span>';
      h += '</label></div>';

      h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:14px 0 6px">نگهداری</div>';
      var ret = cfg.retention || {};
      h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
      h += '<div class="wf-field" style="margin:0"><label>ساعتی</label>';
      h += '<input type="number" id="bkHourly" value="' + (ret.hourly || 6) + '" min="1" max="48" style="text-align:center;font-weight:900"></div>';
      h += '<div class="wf-field" style="margin:0"><label>روزانه</label>';
      h += '<input type="number" id="bkDaily" value="' + (ret.daily || 3) + '" min="1" max="30" style="text-align:center;font-weight:900"></div>';
      h += '<div class="wf-field" style="margin:0"><label>هفتگی</label>';
      h += '<input type="number" id="bkWeekly" value="' + (ret.weekly || 2) + '" min="1" max="12" style="text-align:center;font-weight:900"></div>';
      h += '</div>';

      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">';
      h += '<div class="wf-field" style="margin:0"><label>حداکثر حجم (MB)</label>';
      h += '<input type="number" id="bkMaxMB" value="' + (cfg.maxTotalMB || 200) + '" min="50" max="5000" style="text-align:center;font-weight:900"></div>';
      h += '<div class="wf-field" style="margin:0"><label>هشدار بعد از (ساعت)</label>';
      h += '<input type="number" id="bkAlertH" value="' + (cfg.alertAfterHours || 3) + '" min="1" max="72" style="text-align:center;font-weight:900"></div>';
      h += '</div>';

      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:14px;font-weight:900" onclick="NABZ.backupUI.saveConfig()">💾 ذخیره</button>';

      this._openSheet(h);
    },

    async saveConfig() {
      var body = {
        enabled: document.getElementById('bkEnabled').checked,
        retention: {
          hourly: parseInt(document.getElementById('bkHourly').value) || 6,
          daily: parseInt(document.getElementById('bkDaily').value) || 3,
          weekly: parseInt(document.getElementById('bkWeekly').value) || 2
        },
        maxTotalMB: parseInt(document.getElementById('bkMaxMB').value) || 200,
        alertAfterHours: parseInt(document.getElementById('bkAlertH').value) || 3
      };
      try {
        await this._api('/api/backup/config', { method: 'POST', body: JSON.stringify(body) });
        this._closeAll();
        NABZ._toast('✅ تنظیمات ذخیره شد');
        await this.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[backup-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.backupUI = BU;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('backup_dashboard', function(p, d) { return BU.show(p, d); });
    }

    // Cleanup refresh timer when navigating away
    var origShow = NABZ.show;
    if (typeof origShow === 'function') {
      NABZ.show = async function(id) {
        if (BU._state.refreshTimer && id !== 'backup_manager.dashboard') {
          clearInterval(BU._state.refreshTimer);
          BU._state.refreshTimer = null;
        }
        return origShow.call(NABZ, id);
      };
    }

    console.log('[backup-ui] loaded ✓');
  });
})();
