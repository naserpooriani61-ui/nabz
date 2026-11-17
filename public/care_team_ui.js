
// ═══════════════════════════════════════════════════════════
//  NABZ — Care Team UI
//  Injected into patient modal via _docButtonsFor
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var CT = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
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

    _fmtTime: function(iso) {
      if (!iso) return '';
      var ms = Date.now() - new Date(iso).getTime();
      var min = Math.floor(ms / 60000);
      if (min < 1) return 'الان';
      if (min < 60) return min + 'د';
      var hr = Math.floor(min / 60);
      if (hr < 24) return hr + 'س';
      return Math.floor(hr / 24) + ' روز';
    },

    // ═══════════════════════════════════════════════════
    //  Open team panel (from patient modal)
    // ═══════════════════════════════════════════════════
    async openTeam(patientId) {
      try {
        NABZ._toast('در حال بارگذاری...');
        var r = await this._api('/api/team/' + patientId);
        this._renderTeam(patientId, r);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderTeam: function(patientId, data) {
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">👥 تیم مراقبت — ' + this._esc(data.patientName) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Tabs
      this._currentTab = this._currentTab || 'team';
      h += '<div style="display:flex;gap:4px;margin-bottom:12px">';
      var tabs = [
        ['team', '👥 تیم (' + data.members.length + ')'],
        ['thread', '💬 گفتگو'],
        ['signout', '📋 Sign-out']
      ];
      for (var i = 0; i < tabs.length; i++) {
        var tab = tabs[i];
        var active = this._currentTab === tab[0];
        h += '<button style="flex:1;padding:8px 4px;font-size:11px;font-weight:800;border-radius:6px;border:1px solid ' + (active ? 'var(--primary)' : 'var(--border-2)') + ';background:' + (active ? 'var(--primary-soft)' : 'var(--bg-2)') + ';color:' + (active ? 'var(--primary)' : 'var(--fg-2)') + ';cursor:pointer;font-family:inherit" onclick="NABZ.careTeamUI._switchTab(\'' + tab[0] + '\',\'' + patientId + '\')">' + tab[1] + '</button>';
      }
      h += '</div>';

      if (this._currentTab === 'team') h += this._renderTeamTab(patientId, data);
      else if (this._currentTab === 'thread') h += '<div id="threadContainer" style="text-align:center;padding:20px"><span class="spinner"></span></div>';
      else if (this._currentTab === 'signout') h += '<div id="signoutContainer" style="text-align:center;padding:20px"><span class="spinner"></span></div>';

      this._openSheet(h);

      // Load async content
      var self = this;
      if (this._currentTab === 'thread') setTimeout(function() { self._loadThread(patientId); }, 100);
      if (this._currentTab === 'signout') setTimeout(function() { self._loadSignOutForm(patientId); }, 100);
    },

    _switchTab: function(tab, patientId) {
      this._currentTab = tab;
      this._closeAll();
      this.openTeam(patientId);
    },

    // ═══════════════════════════════════════════════════
    //  TEAM TAB
    // ═══════════════════════════════════════════════════
    _renderTeamTab: function(patientId, data) {
      var h = '';

      // Missing required
      if (data.missingRequired.length > 0) {
        h += '<div style="background:var(--warn-soft);border:1px solid var(--warn);border-radius:8px;padding:10px;margin-bottom:10px">';
        h += '<div style="font-size:11.5px;font-weight:900;color:var(--warn);margin-bottom:4px">⚠️ نقش‌های الزامی خالی (' + data.missingRequired.length + ')</div>';
        for (var i = 0; i < data.missingRequired.length; i++) {
          var m = data.missingRequired[i];
          h += '<div style="font-size:11px">• ' + m.icon + ' ' + m.fa + '</div>';
        }
        h += '</div>';
      }

      // Current members
      if (data.members.length > 0) {
        h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">اعضای فعلی (' + data.members.length + ')</div>';
        for (var j = 0; j < data.members.length; j++) {
          var mem = data.members[j];
          h += '<div style="padding:8px 10px;background:var(--bg-2);border-radius:8px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-size:12px;font-weight:800">' + this._esc(mem.fullName) + (mem.active ? '' : ' <span style="color:var(--dng);font-size:10px">(غیرفعال)</span>') + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2);margin-top:1px">' + this._esc(mem.roleFa) + (mem.service ? ' · ' + this._esc(mem.service) : '') + '</div>';
          h += '</div>';
          h += '<button style="padding:4px 8px;font-size:10px;color:var(--dng);background:transparent;border:1px solid var(--dng);border-radius:6px;cursor:pointer;font-family:inherit" onclick="NABZ.careTeamUI._removeMember(\'' + patientId + '\',\'' + mem.id + '\')">✕</button>';
          h += '</div>';
        }
      } else {
        h += '<div class="empty" style="padding:20px">هنوز عضوی تخصیص نیافته</div>';
      }

      // Add member button
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:12px;font-weight:900" onclick="NABZ.careTeamUI._openAddMember(\'' + patientId + '\')">➕ افزودن عضو</button>';
      return h;
    },

    async _openAddMember(patientId) {
      try {
        var data = await this._api('/api/team/' + patientId);
        var users = await this._api('/api/admin/pa/users').catch(function() { return { items: [] }; });

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">➕ افزودن عضو تیم</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        // Role picker
        h += '<div class="wf-field"><label>نقش</label>';
        h += '<select id="addRole" style="font-weight:800">';
        var roles = data.rolesCatalog;
        for (var r in roles) {
          h += '<option value="' + r + '">' + roles[r].icon + ' ' + roles[r].fa + (roles[r].required ? ' *' : '') + '</option>';
        }
        h += '</select></div>';

        // User picker
        h += '<div class="wf-field"><label>کاربر</label>';
        h += '<input type="search" id="addUserSearch" placeholder="جستجو..." oninput="NABZ.careTeamUI._filterUsers(this.value)" style="width:100%;padding:8px;margin-bottom:4px;border:1px solid var(--border-2);border-radius:6px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:12px">';
        h += '<div id="addUserList" style="max-height:40vh;overflow-y:auto">';
        var userItems = (users.items || []).filter(function(u) { return u.active !== false; });
        if (userItems.length === 0) {
          h += '<div class="empty" style="padding:16px">هیچ کاربر فعالی نیست</div>';
        } else {
          for (var i = 0; i < userItems.length && i < 100; i++) {
            var u = userItems[i];
            h += '<button class="add-user-btn" data-search="' + (u.fullName || u.username || '').toLowerCase() + '" style="width:100%;padding:8px;margin-bottom:3px;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;font-family:inherit;color:var(--fg);cursor:pointer;text-align:right;font-size:11.5px" onclick="NABZ.careTeamUI._assignMember(\'' + patientId + '\',\'' + u.id + '\')">';
            h += '<div style="font-weight:800">' + this._esc(u.fullName || u.username) + '</div>';
            h += '<div style="font-size:9.5px;color:var(--fg-2)">' + this._esc(u.role) + (u.ward ? ' · ' + this._esc(u.ward) : '') + '</div>';
            h += '</button>';
          }
        }
        h += '</div></div>';

        this._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _filterUsers: function(q) {
      q = String(q || '').toLowerCase().trim();
      document.querySelectorAll('.add-user-btn').forEach(function(b) {
        b.style.display = !q || b.dataset.search.includes(q) ? '' : 'none';
      });
    },

    async _assignMember(patientId, userId) {
      var role = document.getElementById('addRole').value;
      try {
        await this._api('/api/team/' + patientId + '/member', {
          method: 'POST',
          body: JSON.stringify({ userId: userId, role: role })
        });
        this._closeAll();
        NABZ._toast('✅ عضو اضافه شد');
        this._currentTab = 'team';
        this.openTeam(patientId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _removeMember(patientId, memberId) {
      if (!confirm('حذف این عضو؟')) return;
      try {
        await this._api('/api/team/' + patientId + '/member/' + memberId, { method: 'DELETE' });
        this._closeAll();
        NABZ._toast('✅ حذف شد');
        this._currentTab = 'team';
        this.openTeam(patientId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  THREAD TAB
    // ═══════════════════════════════════════════════════
    async _loadThread(patientId) {
      var el = document.getElementById('threadContainer');
      if (!el) return;
      try {
        var t = await this._api('/api/team/' + patientId + '/thread');
        var h = '';

        if (t.messages.length === 0) {
          h += '<div class="empty" style="padding:20px">هنوز پیامی نیست — اولین پیام را بفرستید</div>';
        } else {
          for (var i = 0; i < t.messages.length; i++) {
            var m = t.messages[i];
            var pCls = m.priority === 'critical' ? 'dng' : m.priority === 'urgent' ? 'warn' : '';
            h += '<div style="padding:10px;background:var(--bg-2);border-radius:8px;margin-bottom:6px;' + (pCls ? 'border-right:3px solid var(--' + pCls + ');' : '') + '">';
            h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
            h += '<div style="font-size:11.5px;font-weight:900">' + this._esc(m.authorName) + ' <span style="color:var(--fg-3);font-weight:600;font-size:10px">· ' + this._esc(m.authorRole) + '</span></div>';
            h += '<div style="font-size:10px;color:var(--fg-3)">' + this._fmtTime(m.postedAt) + '</div>';
            h += '</div>';
            h += '<div style="font-size:12px;margin-top:4px;line-height:1.5">' + this._esc(m.text) + '</div>';
            if (m.replies && m.replies.length > 0) {
              h += '<div style="margin-top:6px;padding-right:12px;border-right:2px solid var(--border)">';
              for (var j = 0; j < m.replies.length; j++) {
                var r = m.replies[j];
                h += '<div style="font-size:11px;margin-bottom:3px"><b>' + this._esc(r.authorName) + ':</b> ' + this._esc(r.text) + '</div>';
              }
              h += '</div>';
            }
            h += '</div>';
          }
        }

        // Input
        h += '<div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
        h += '<div class="wf-field"><label>پیام جدید</label>';
        h += '<textarea id="threadText" rows="2" placeholder="پیام به تیم..." style="font-size:12px"></textarea></div>';
        h += '<div style="display:flex;gap:4px;margin-top:6px">';
        h += '<button class="btn" style="flex:1;padding:6px;font-size:10px" onclick="NABZ.careTeamUI._postMessage(\'' + patientId + '\',\'normal\')">📤 عادی</button>';
        h += '<button class="btn" style="flex:1;padding:6px;font-size:10px;color:var(--warn);border-color:var(--warn)" onclick="NABZ.careTeamUI._postMessage(\'' + patientId + '\',\'urgent\')">⚠️ فوری</button>';
        h += '<button class="btn" style="flex:1;padding:6px;font-size:10px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.careTeamUI._postMessage(\'' + patientId + '\',\'critical\')">🚨 بحرانی</button>';
        h += '</div></div>';

        el.innerHTML = h;
      } catch (e) {
        el.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    async _postMessage(patientId, priority) {
      var text = document.getElementById('threadText').value.trim();
      if (!text) return alert('متن پیام لازم است');
      try {
        await this._api('/api/team/' + patientId + '/thread', {
          method: 'POST',
          body: JSON.stringify({ text: text, priority: priority })
        });
        NABZ._toast('✅ پیام ارسال شد');
        this._loadThread(patientId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  SIGN-OUT TAB
    // ═══════════════════════════════════════════════════
    async _loadSignOutForm(patientId) {
      var el = document.getElementById('signoutContainer');
      if (!el) return;
      try {
        // Check for existing sign-outs to/from me
        var received = await this._api('/api/team/signouts?type=received').catch(function() { return { items: [] }; });
        var sent = await this._api('/api/team/signouts?type=sent').catch(function() { return { items: [] }; });

        var h = '';

        // Existing received
        if (received.items.length > 0) {
          h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">📥 Sign-out دریافت‌شده (' + received.items.length + ')</div>';
          for (var i = 0; i < Math.min(received.items.length, 3); i++) {
            var so = received.items[i];
            h += this._renderSignOutCard(so);
          }
          h += '<div style="margin-bottom:14px"></div>';
        }

        // Create new
        h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin-bottom:6px">➕ Sign-out جدید</div>';
        h += '<div class="wf-field"><label>به پزشک (On-call)</label>';
        h += '<input type="text" id="soToUserId" placeholder="user_id" style="font-family:monospace">';
        h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">مثال: usr_admin</div></div>';
        h += '<div class="wf-field"><label>تا شیفت</label>';
        h += '<select id="soShift"><option value="tonight">امشب</option><option value="weekend">آخر هفته</option><option value="week">کل هفته</option></select></div>';
        h += '<div class="wf-field"><label>بیمار</label>';
        h += '<input type="text" id="soPatientId" value="' + patientId + '" readonly style="font-family:monospace;background:var(--bg-3)"></div>';
        h += '<div class="wf-field"><label>یادداشت</label>';
        h += '<textarea id="soNotes" rows="2" placeholder="نکات مهم برای پزشک on-call"></textarea></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:8px;font-weight:900" onclick="NABZ.careTeamUI._submitSignOut(\'' + patientId + '\')">📋 ارسال Sign-out</button>';

        el.innerHTML = h;
      } catch (e) {
        el.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    _renderSignOutCard: function(so) {
      var statusCls = so.status === 'acknowledged' ? 'ok' : 'warn';
      var statusFa = so.status === 'acknowledged' ? 'تأییدشده' : 'در انتظار';
      var h = '<div style="padding:10px;background:var(--bg-2);border-radius:8px;margin-bottom:6px;border-right:3px solid var(--' + statusCls + ')">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
      h += '<div style="font-size:11.5px;font-weight:900">از ' + this._esc(so.fromUserName) + '</div>';
      h += '<span class="pill ' + statusCls + '">' + statusFa + '</span>';
      h += '</div>';
      h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + (so.patients || []).length + ' بیمار · شیفت ' + this._esc(so.untilShift) + '</div>';
      if (so.status === 'pending' && so.toUserId === (NABZ.state.user && NABZ.state.user.id)) {
        h += '<button class="btn btn-ok btn-block" style="padding:8px;margin-top:6px;font-size:11px;font-weight:900" onclick="NABZ.careTeamUI._ackSignOut(\'' + so.id + '\')">✅ دریافت و تأیید</button>';
      }
      h += '</div>';
      return h;
    },

    async _submitSignOut(patientId) {
      var toUserId = document.getElementById('soToUserId').value.trim();
      var shift = document.getElementById('soShift').value;
      var notes = document.getElementById('soNotes').value;
      if (!toUserId) return alert('شناسه پزشک on-call لازم است');
      try {
        await this._api('/api/team/signout', {
          method: 'POST',
          body: JSON.stringify({
            patientIds: [patientId],
            toUserId: toUserId,
            untilShift: shift,
            notes: notes
          })
        });
        NABZ._toast('✅ Sign-out ارسال شد');
        this._loadSignOutForm(patientId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _ackSignOut: function(signoutId) {
      var synthesis = prompt('Synthesis (S در I-PASS) — خلاصه درک خود را بنویسید:');
      if (!synthesis) return;
      this._api('/api/team/signout/' + signoutId + '/acknowledge', {
        method: 'POST',
        body: JSON.stringify({ synthesis: synthesis })
      }).then(function() {
        NABZ._toast('✅ تأیید شد');
      }).catch(function(e) { alert('خطا: ' + e.message); });
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[care-team-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.careTeamUI = CT;

    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('team_my_patients', function(p, d) {
        return CT.openMyPatients(p, d);
      });
    }

    // Wrap _docButtonsFor to add team button
    var prevDocBtns = NABZ._docButtonsFor;
    if (typeof prevDocBtns === 'function') {
      NABZ._docButtonsFor = function(pid, item) {
        var orig = prevDocBtns.apply(NABZ, arguments) || '';
        if (pid === 'clinical.patients' && item && item.id) {
          return orig + '<div style="margin-top:8px"><button class="btn btn-block" style="background:var(--violet-soft);color:var(--violet);border-color:var(--violet);padding:10px;font-size:12px;font-weight:900" onclick="NABZ.careTeamUI.openTeam(\'' + item.id + '\')">👥 تیم مراقبت + گفتگو</button></div>';
        }
        return orig;
      };
    }

    // My patients view
    CT.openMyPatients = async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await CT._api('/api/team/my-patients');
        var h = '<div class="sec-hd"><span>👥 بیماران تیم من</span><span class="rd-mini">' + d.total + '</span></div>';
        if (d.items.length === 0) {
          h += '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">👥</div><div style="font-weight:900;margin-top:8px">هنوز به تیم بیمارستانی اضافه نشده‌اید</div><div style="font-size:11px;color:var(--fg-2);margin-top:4px">از داخل هر بیمار → «تیم مراقبت» اضافه شوید</div></div>';
        } else {
          for (var i = 0; i < d.items.length; i++) {
            var pt = d.items[i];
            var cls = pt.news2 >= 7 ? 'hi' : pt.news2 >= 5 ? 'md' : 'lo';
            h += '<div class="row ' + cls + '" style="margin-bottom:4px;cursor:pointer" onclick="NABZ.showItem(\'clinical.patients\',\'' + pt.id + '\')">';
            h += '<div class="row-hd"><div class="row-title">' + CT._esc(pt.name) + '</div>';
            if (pt.roleInTeam) h += '<span class="pill violet">' + CT._esc(pt.roleInTeam) + '</span>';
            h += '</div>';
            h += '<div class="row-meta">' + (pt.age || '—') + ' سال · ' + CT._esc(pt.wardCode || '') + ' · تخت ' + CT._esc(pt.bedNumber || '—') + '</div>';
            h += '<div class="row-meta" style="font-size:10.5px">' + CT._esc(pt.diagnosis || '') + (pt.news2 > 0 ? ' · NEWS2 ' + pt.news2 : '') + '</div>';
            h += '</div>';
          }
        }
        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + CT._esc(e.message) + '</div>';
      }
    };

    console.log('[care-team-ui] loaded');
  });
})();
