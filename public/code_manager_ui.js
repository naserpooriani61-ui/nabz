(function() {
  'use strict';

  var CM = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _ui: { selectedPath: null, content: '', originalContent: '', dirty: false, mode: 'edit' },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _openSheet: function(html) {
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet:s, content:c };
    },

    async show(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        var files = await CM._api('/api/cm/files');
        CM._files = files;
        CM._render();
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + CM._esc(e.message) + '</div>'; }
    },

    _render() {
      var m = document.getElementById('content');
      var files = CM._files.files || {};
      var h = '<div class="sec-hd"><span>💻 ویرایشگر کد</span><span class="rd-mini">' + CM._files.total + ' فایل</span></div>';
      
      // Tabs
      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      var tabs = [['edit','📝 ویرایش'],['backups','📚 پشتیبان‌ها']];
      tabs.forEach(function(t) {
        h += '<button class="crisis-tab' + (CM._ui.mode === t[0] ? ' on' : '') + '" onclick="NABZ.cmUI.setMode(\'' + t[0] + '\')">' + t[1] + '</button>';
      });
      h += '</div>';

      if (CM._ui.mode === 'backups') { CM._renderBackups(h, m); return; }

      // File browser
      if (!CM._ui.selectedPath) {
        Object.keys(files).forEach(function(dir) {
          h += '<div style="font-size:12px;font-weight:900;color:var(--primary);margin:14px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--primary)">📁 ' + dir + '/ (' + files[dir].length + ')</div>';
          files[dir].forEach(function(f) {
            var icon = f.ext === '.js' ? '📜' : f.ext === '.css' ? '🎨' : f.ext === '.html' ? '📄' : f.ext === '.json' ? '📋' : '📄';
            h += '<div class="row lo" style="padding:8px 12px;cursor:pointer" onclick="NABZ.cmUI.openFile(\'' + f.path + '\')">';
            h += '<div class="row-hd"><div class="row-title" style="font-size:12px">' + icon + ' ' + CM._esc(f.name) + '</div>';
            h += '<span class="pill ' + (f.editable ? 'info' : 'warn') + '">' + f.sizeKB + 'KB</span></div>';
            h += '<div class="row-meta" style="font-size:10px">' + f.lines ? '' : '';
            h += new Date(f.modifiedAt).toLocaleString('fa-IR', { month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit' });
            h += '</div></div>';
          });
        });
        h += '<div class="hint info" style="margin-top:16px">⚠️ هر تغییر، نسخه پشتیبان قبلی را ذخیره می‌کند. پس از ذخیره، برای اعمال باید سرور restart شود.</div>';
        m.innerHTML = h;
      } else {
        CM._renderEditor(h, m);
      }
    },

    _renderEditor(h, m) {
      var path = CM._ui.selectedPath;
      var content = CM._ui.content;
      var dirty = CM._ui.dirty;
      var ext = path.split('.').pop();
      
      h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:8px">';
      h += '<button class="btn btn-sm" style="padding:6px 12px" onclick="NABZ.cmUI.backToFiles()">← بازگشت</button>';
      h += '<div style="flex:1;font-family:monospace;font-size:11px;color:var(--fg-2)">' + CM._esc(path) + '</div>';
      if (dirty) h += '<span class="pill warn">تغییر نشده</span>';
      h += '</div>';
      
      // Buttons
      h += '<div style="display:flex;gap:6px;margin-bottom:8px">';
      h += '<button class="btn btn-primary btn-sm" style="flex:1;padding:8px" onclick="NABZ.cmUI.save()">💾 ذخیره</button>';
      h += '<button class="btn btn-sm" style="flex:1;padding:8px" onclick="NABZ.cmUI.validate()">✓ بررسی syntax</button>';
      h += '<button class="btn btn-sm" style="padding:8px;color:var(--dng)" onclick="NABZ.cmUI.revert()">↺ بازگشت به نسخه اصلی</button>';
      h += '</div>';
      
      // Info bar
      h += '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--fg-2);margin-bottom:6px;font-family:monospace">';
      h += '<span>' + CM._ui.content.split('\n').length + ' خط</span>';
      h += '<span id="cmLineInfo">1:1</span>';
      h += '<span>' + CM._ui.content.length + ' کاراکتر</span>';
      h += '</div>';
      
      // Editor
      h += '<div style="position:relative">';
      h += '<textarea id="cmEditor" spellcheck="false" autocorrect="off" autocapitalize="off" ';
      h += 'style="width:100%;min-height:60vh;padding:12px;background:var(--bg);color:var(--fg);border:1.5px solid var(--border-2);border-radius:8px;font-family:var(--mono);font-size:11px;line-height:1.6;resize:vertical;outline:none" ';
      h += 'oninput="NABZ.cmUI._onInput(this)" onkeydown="NABZ.cmUI._onKeyDown(event, this)" ';
      h += 'onclick="NABZ.cmUI._updateCursor(this)" onkeyup="NABZ.cmUI._updateCursor(this)">' + CM._esc(content) + '</textarea>';
      h += '</div>';
      
      // Syntax validation result
      h += '<div id="cmSyntaxResult" style="margin-top:8px"></div>';
      
      // Restart button
      h += '<div class="hint warn" style="margin-top:12px">⚠️ بعد از ذخیره، برای اعمال تغییرات در سرور، restart کنید</div>';
      h += '<button class="btn btn-dng btn-block" style="padding:12px;margin-top:8px;font-weight:900" onclick="NABZ.cmUI.restartServer()">🔄 ذخیره + Restart سرور</button>';
      
      m.innerHTML = h;
    },

    _renderBackups(h, m) {
      CM._api('/api/cm/backups').then(function(d) {
        var h2 = h;
        if (!d.items || !d.items.length) {
          h2 += '<div class="empty">هیچ نسخه پشتیبانی نیست</div>';
          m.innerHTML = h2;
          return;
        }
        h2 += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + d.total + ' نسخه پشتیبان</div>';
        d.items.forEach(function(b) {
          h2 += '<div class="row lo" style="padding:10px 12px;margin-bottom:4px">';
          h2 += '<div class="row-hd"><div class="row-title" style="font-family:monospace;font-size:11px">' + CM._esc(b.originalPath) + '</div>';
          h2 += '<span class="pill">' + b.sizeKB + 'KB</span></div>';
          h2 += '<div class="row-meta" style="font-size:10px">' + new Date(b.backupAt).toLocaleString('fa-IR') + '</div>';
          h2 += '<div style="display:flex;gap:6px;margin-top:6px">';
          h2 += '<button class="btn btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.cmUI.restoreBackup(\'' + CM._esc(b.name) + '\')">↺ بازیابی</button>';
          h2 += '<button class="btn btn-sm" style="flex:1;padding:6px;font-size:10.5px" onclick="NABZ.cmUI.viewBackup(\'' + CM._esc(b.name) + '\')">👁 پیش‌نمایش</button>';
          h2 += '<button class="btn btn-sm" style="padding:6px;font-size:10.5px;color:var(--dng)" onclick="NABZ.cmUI.deleteBackup(\'' + CM._esc(b.name) + '\')">🗑</button>';
          h2 += '</div></div>';
        });
        m.innerHTML = h2;
      }).catch(function(e) {
        h += '<div class="empty">خطا: ' + CM._esc(e.message) + '</div>';
        m.innerHTML = h;
      });
    },

    setMode(m) { CM._ui.mode = m; CM._render(); },

    async openFile(path) {
      try {
        var d = await CM._api('/api/cm/file?path=' + encodeURIComponent(path));
        CM._ui.selectedPath = path;
        CM._ui.content = d.content;
        CM._ui.originalContent = d.content;
        CM._ui.dirty = false;
        CM._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    backToFiles() {
      if (CM._ui.dirty && !confirm('تغییرات ذخیره نشده — خارج می‌شوید؟')) return;
      CM._ui.selectedPath = null;
      CM._ui.content = '';
      CM._ui.dirty = false;
      CM._render();
    },

    _onInput(el) {
      CM._ui.content = el.value;
      CM._ui.dirty = el.value !== CM._ui.originalContent;
    },

    _updateCursor(el) {
      var pos = el.selectionStart;
      var before = el.value.substring(0, pos);
      var lines = before.split('\n');
      var line = lines.length;
      var col = lines[lines.length - 1].length + 1;
      var info = document.getElementById('cmLineInfo');
      if (info) info.textContent = line + ':' + col;
    },

    _onKeyDown(e, el) {
      // Tab = 2 spaces
      if (e.key === 'Tab') {
        e.preventDefault();
        var start = el.selectionStart, end = el.selectionEnd;
        el.value = el.value.substring(0, start) + '  ' + el.value.substring(end);
        el.selectionStart = el.selectionEnd = start + 2;
        CM._onInput(el);
      }
      // Ctrl+S = save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        CM.save();
      }
    },

    async validate() {
      var res = document.getElementById('cmSyntaxResult');
      if (!res) return;
      res.innerHTML = '<div style="text-align:center;padding:6px"><span class="spinner" style="width:18px;height:18px"></span></div>';
      try {
        var d = await CM._api('/api/cm/validate', {
          method:'POST',
          body: JSON.stringify({ path: CM._ui.selectedPath, content: CM._ui.content })
        });
        if (d.ok) {
          res.innerHTML = '<div class="hint success">✅ Syntax درست است</div>';
        } else {
          res.innerHTML = '<div class="hint danger">❌ Syntax error' + (d.line ? ' — خط ' + d.line : '') + ':<br><code style="font-size:10px;word-break:break-all">' + CM._esc(d.error || '') + '</code></div>';
        }
      } catch (e) {
        res.innerHTML = '<div class="hint danger">❌ ' + CM._esc(e.message) + '</div>';
      }
    },

    async save() {
      if (!CM._ui.dirty) { NABZ._toast('تغییری نیست'); return; }
      if (!confirm('ذخیره شود؟ (نسخه قبلی در backups نگه داشته می‌شود)')) return;
      try {
        var d = await CM._api('/api/cm/file', {
          method:'POST',
          body: JSON.stringify({ path: CM._ui.selectedPath, content: CM._ui.content })
        });
        if (!d.ok) {
          if (d.error === 'syntax_error') {
            var force = confirm('خطای syntax: ' + (d.detail && d.detail.error) + '\n\nبا اجبار ذخیره شود؟');
            if (!force) return;
            d = await CM._api('/api/cm/file', {
              method:'POST',
              body: JSON.stringify({ path: CM._ui.selectedPath, content: CM._ui.content, force: true })
            });
          } else {
            throw new Error(d.message || d.error || 'save failed');
          }
        }
        CM._ui.originalContent = CM._ui.content;
        CM._ui.dirty = false;
        NABZ._toast('✅ ذخیره شد — backup: ' + (d.backupFile || '—'));
        CM._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    revert() {
      if (!confirm('به نسخه اصلی برگردد؟ (تغییرات از دست می‌رود)')) return;
      CM._ui.content = CM._ui.originalContent;
      CM._ui.dirty = false;
      CM._render();
    },

    async restartServer() {
      if (!confirm('سرور restart شود؟ اتصال شما ۲-۳ ثانیه قطع می‌شود.')) return;
      try {
        var d = await CM._api('/api/cm/restart', { method:'POST', body: JSON.stringify({ confirm: true }) });
        NABZ._toast('🔄 سرور در حال restart...');
        setTimeout(function() {
          NABZ._toast('✅ سرور آماده — صفحه refresh می‌شود');
          setTimeout(function() { location.reload(); }, 1500);
        }, 3000);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async restoreBackup(name) {
      if (!confirm('بازیابی شود؟ نسخه فعلی هم backup می‌شود')) return;
      try {
        var d = await CM._api('/api/cm/restore', { method:'POST', body: JSON.stringify({ backupName: name }) });
        NABZ._toast('✅ بازیابی شد — ' + d.restored);
        setTimeout(function() {
          if (confirm('سرور restart شود؟')) CM.restartServer();
        }, 500);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async viewBackup(name) {
      // Simple preview — read raw backup content
      try {
        var resp = await fetch('/api/cm/backups', {
          headers: { 'Authorization': 'Bearer ' + localStorage.getItem('nabz_tk') }
        });
        var d = await resp.json();
        var b = (d.data && d.data.items || []).find(function(x) { return x.name === name; });
        if (!b) return alert('یافت نشد');
        // Read file directly (won't work — need endpoint)
        alert('مسیر: ' + b.originalPath + '\nاندازه: ' + b.sizeKB + 'KB\nتاریخ: ' + b.backupAt);
      } catch (e) { alert(e.message); }
    },

    async deleteBackup(name) {
      if (!confirm('پشتیبان حذف شود؟')) return;
      try {
        await CM._api('/api/cm/backups/' + encodeURIComponent(name), { method:'DELETE' });
        NABZ._toast('حذف شد');
        CM._render();
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return;
    setTimeout(function() { ready(fn); }, 100);
  }
  ready(function() {
    NABZ.cmUI = CM;
    if (NABZ.registerKind) {
      NABZ.registerKind('code_manager', CM.show);
    }
    console.log('[cmUI] registered as code_manager');
  });
})();
