// ═══════════════════════════════════════════════════════════
//  NABZ — Permission Admin UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var PAU = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
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
    _ui: { tab:'perms', search:'' },

    async show(p, d) {
      var m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        d = await PAU._api('/api/pa/perms');
      }
      PAU._perms = d;
      var tab = PAU._ui.tab || 'perms';

      var h = '<div class="sec-hd"><span>🔐 مدیریت دسترسی‌ها</span></div>';
      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      for (var t of [['perms','🔑 مجوزها'],['roles','🎭 نقش‌ها'],['users','👥 کاربران']]) {
        h += '<button class="crisis-tab' + (tab === t[0] ? ' on' : '') + '" onclick="NABZ.permUI.setTab(\'' + t[0] + '\')">' + t[1] + '</button>';
      }
      h += '</div>';

      if (tab === 'perms') h += await PAU.renderPerms();
      else if (tab === 'roles') h += await PAU.renderRoles();
      else if (tab === 'users') h += await PAU.renderUsers();

      m.innerHTML = h;
    },

    setTab(tab) { PAU._ui.tab = tab; PAU.show(null, PAU._perms); },

    async renderPerms() {
      var all = PAU._perms.items || [];
      var q = (PAU._ui.search || '').toLowerCase();
      var filtered = q ? all.filter(function(x) { return x.perm.toLowerCase().includes(q); }) : all;

      // Group by prefix
      var groups = {};
      filtered.forEach(function(x) {
        var prefix = x.perm.split('.')[0];
        if (!groups[prefix]) groups[prefix] = [];
        groups[prefix].push(x);
      });

      var h = '<input type="search" placeholder="🔍 جستجوی مجوز..." value="' + PAU._esc(PAU._ui.search) + '" oninput="NABZ.permUI._search(this.value)" style="width:100%;padding:10px;margin-bottom:12px;border:1.5px solid var(--border-2);border-radius:8px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:13px">';

      // Super admin note
      h += '<div class="hint info" style="margin-bottom:12px">⚠️ Admin همیشه دسترسی کامل دارد — تغییرات روی بقیه نقش‌ها اعمال می‌شود</div>';

      Object.keys(groups).sort().forEach(function(g) {
        h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:14px 0 6px;padding:4px 8px;background:var(--primary-soft);border-radius:6px">' + g + ' (' + groups[g].length + ')</div>';
        groups[g].forEach(function(x) {
          var roleCount = x.roles.length;
          h += '<div class="row lo" style="padding:10px 12px;margin-bottom:4px">';
          h += '<div class="row-hd"><div class="row-title" style="font-size:12px;font-family:monospace">' + PAU._esc(x.perm) + '</div>';
          h += '<span class="pill ' + (x.isOverride ? 'warn' : 'info') + '">' + roleCount + ' نقش</span></div>';
          h += '<div class="row-meta" style="font-size:10.5px">' + PAU._esc(x.roles.slice(0, 5).join('، ')) + (roleCount > 5 ? '، +' + (roleCount - 5) : '') + '</div>';
          h += '<button class="btn btn-sm" style="margin-top:6px;padding:6px 12px;font-size:11px" onclick="NABZ.permUI.editPerm(\'' + x.perm + '\')">✎ ویرایش</button>';
          h += '</div>';
        });
      });
      return h;
    },

    _search: function(q) {
      PAU._ui.search = q;
      PAU.setTab('perms');
      setTimeout(function() {
        var inp = document.querySelector('input[type="search"]');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }, 30);
    },

    async editPerm(perm) {
      var all = await PAU._api('/api/pa/perms');
      var p = (all.items || []).find(function(x) { return x.perm === perm; });
      if (!p) return alert('مجوز یافت نشد');
      var roles = await PAU._api('/api/pa/roles');
      var selected = new Set(p.roles);

      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title" style="font-size:12px;font-family:monospace">' + PAU._esc(perm) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<input type="search" placeholder="🔍 نقش..." oninput="NABZ.permUI._filterRoles(this.value)" style="width:100%;padding:8px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:6px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:12px">';
      h += '<div id="roleList" style="max-height:60vh;overflow-y:auto">';
      (roles.items || []).forEach(function(r) {
        var checked = selected.has(r.code);
        var disabled = r.code === 'admin' ? 'checked disabled' : (checked ? 'checked' : '');
        h += '<label class="role-chk" data-code="' + r.code + '" data-text="' + (r.code + ' ' + (r.label || '')).toLowerCase() + '" style="display:flex;align-items:center;gap:10px;padding:8px 10px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;cursor:pointer;font-size:12px' + (checked ? ';border:1px solid var(--primary)' : '') + '">';
        h += '<input type="checkbox" data-role="' + r.code + '" ' + disabled + ' onchange="NABZ.permUI._toggleRole(this)" style="width:18px;height:18px;accent-color:var(--primary)">';
        h += '<span style="font-family:monospace;font-weight:800">' + r.code + '</span>';
        h += '<span style="color:var(--fg-2);flex:1">' + PAU._esc(r.label || '') + '</span>';
        h += '<span class="pill">L' + r.level + '</span>';
        h += '</label>';
      });
      h += '</div>';
      h += '<div style="display:flex;gap:6px;margin-top:12px;margin-bottom:20px">';
      h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.permUI._savePerm(\'' + perm + '\')">💾 ذخیره</button>';
      h += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">انصراف</button>';
      h += '</div>';
      PAU._openSheet(h);
    },

    _toggleRole: function(el) {
      var lbl = el.closest('.role-chk');
      if (lbl) lbl.style.border = el.checked ? '1px solid var(--primary)' : '';
    },

    _filterRoles: function(q) {
      q = q.toLowerCase();
      document.querySelectorAll('.role-chk').forEach(function(el) {
        el.style.display = el.dataset.text.includes(q) ? '' : 'none';
      });
    },

    async _savePerm(perm) {
      var roles = [];
      document.querySelectorAll('input[data-role]:checked').forEach(function(cb) {
        roles.push(cb.dataset.role);
      });
      if (!roles.includes('admin')) roles.unshift('admin');
      try {
        await PAU._api('/api/pa/perm', { method:'POST', body: JSON.stringify({ perm: perm, roles: roles }) });
        NABZ._toast('✅ ذخیره شد');
        PAU._closeAll();
        PAU.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async renderRoles() {
      var roles = await PAU._api('/api/pa/roles');
      var h = '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px" onclick="NABZ.permUI.newRole()">➕ نقش جدید</button>';
      (roles.items || []).forEach(function(r) {
        h += '<div class="row lo" style="padding:10px 12px">';
        h += '<div class="row-hd"><div class="row-title" style="font-family:monospace">' + r.code + '</div>';
        h += '<span class="pill info">L' + r.level + '</span>' + (r.crossWard ? ' <span class="pill ok">همه بخش‌ها</span>' : '') + (r.isCustom ? ' <span class="pill violet">سفارشی</span>' : '') + '</div>';
        h += '<div class="row-meta">' + r.permissionCount + ' مجوز';
        if (r.isCustom) h += ' <button class="btn btn-xs" style="padding:2px 8px;font-size:9px;color:var(--dng);margin-right:6px" onclick="NABZ.permUI._deleteRole(\'' + r.code + '\')">🗑</button>';
        h += '</div>';
        h += '</div>';
      });
      return h;
    },

    newRole: function() {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">➕ نقش جدید</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>کد (انگلیسی) *</label><input type="text" id="nrCode" placeholder="nurse_specialist" style="font-family:monospace"></div>';
      h += '<div class="wf-field"><label>نام فارسی *</label><input type="text" id="nrLabel" placeholder="پرستار متخصص"></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>سطح (۱-۱۰)</label><input type="number" id="nrLevel" value="5" min="1" max="10"></div>';
      h += '<div class="wf-field"><label><input type="checkbox" id="nrCross"> دسترسی همه بخش‌ها</label></div>';
      h += '</div>';
      h += '<div class="wf-field"><label>توضیح</label><textarea id="nrDesc" rows="2"></textarea></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.permUI._createRole()">✅ ساخت</button>';
      PAU._openSheet(h);
    },

    async _createRole() {
      var code = document.getElementById('nrCode').value.trim();
      var label = document.getElementById('nrLabel').value.trim();
      if (!code || !label) return alert('کد و نام الزامی');
      if (!/^[a-z_][a-z0-9_]*$/.test(code)) return alert('کد باید انگلیسی کوچک با _ باشد');
      try {
        await PAU._api('/api/pa/role', {
          method:'POST',
          body: JSON.stringify({
            code, label,
            level: parseInt(document.getElementById('nrLevel').value) || 5,
            crossWard: document.getElementById('nrCross').checked,
            description: document.getElementById('nrDesc').value
          })
        });
        NABZ._toast('✅ نقش ساخته شد');
        PAU._closeAll();
        PAU.setTab('roles');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _deleteRole(code) {
      if (!confirm('نقش ' + code + ' حذف شود؟ از همه مجوزها حذف می‌شود')) return;
      try {
        await PAU._api('/api/pa/role/' + code, { method:'DELETE' });
        NABZ._toast('حذف شد');
        PAU.setTab('roles');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async renderUsers() {
      var users = await PAU._api('/api/pa/users');
      var items = users.items || [];
      var h = '<div style="font-size:11px;color:var(--fg-2);margin-bottom:8px">' + items.length + ' کاربر</div>';
      items.forEach(function(u) {
        h += '<div class="row lo" style="padding:10px 12px" onclick="NABZ.permUI.editUser(\'' + u.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + PAU._esc(u.fullName || u.username) + '</div>';
        h += '<span class="pill ' + (u.active !== false ? 'ok' : 'dng') + '">' + (u.role || '?') + '</span></div>';
        h += '<div class="row-meta">' + PAU._esc(u.username) + (u.ward ? ' · ' + PAU._esc(u.ward) : '') + '</div>';
        h += '</div>';
      });
      return h;
    },

    async editUser(userId) {
      var users = await PAU._api('/api/pa/users');
      var u = (users.items || []).find(function(x) { return x.id === userId; });
      if (!u) return alert('کاربر یافت نشد');
      var roles = await PAU._api('/api/pa/roles');

      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">👤 ' + PAU._esc(u.fullName) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نقش</label><select id="euRole">';
      (roles.items || []).forEach(function(r) {
        h += '<option value="' + r.code + '"' + (u.role === r.code ? ' selected' : '') + '>' + r.code + ' — ' + PAU._esc(r.label || '') + '</option>';
      });
      h += '</select></div>';
      h += '<div class="wf-field"><label>بخش</label><input type="text" id="euWard" value="' + PAU._esc(u.ward || '') + '"></div>';
      h += '<div class="wf-field"><label><input type="checkbox" id="euActive" ' + (u.active !== false ? 'checked' : '') + '> فعال</label></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.permUI._saveUser(\'' + userId + '\')">💾 ذخیره</button>';
      PAU._openSheet(h);
    },

    async _saveUser(userId) {
      try {
        await PAU._api('/api/pa/user/' + userId, {
          method:'PUT',
          body: JSON.stringify({
            role: document.getElementById('euRole').value,
            ward: document.getElementById('euWard').value || null,
            active: document.getElementById('euActive').checked
          })
        });
        NABZ._toast('✅ ذخیره شد');
        PAU._closeAll();
        PAU.setTab('users');
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
    NABZ.permUI = PAU;
    var origShow = NABZ.show;
    NABZ.show = async function(id) {
      var p = NABZ.state.panels.find(function(x) { return x.id === id; });
      if (p && p.kind === 'pa_config') {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
        return PAU.show(p, null);
      }
      return origShow.call(NABZ, id);
    };
    console.log('[permUI] loaded ✓');
  });
})();
