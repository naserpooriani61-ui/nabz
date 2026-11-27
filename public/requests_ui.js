// ═══════════════════════════════════════════════════════════
//  NABZ — Requests UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var RUI = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; } },
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
    _status_FA: { submitted:'ارسالی', approved:'تأیید', rejected:'رد', escalated:'ارجاع‌شده', cancelled:'لغو', draft:'پیش‌نویس' },
    _status_CLS: { submitted:'warn', approved:'ok', rejected:'dng', escalated:'info', cancelled:'', draft:'' },

    // ═══ INBOX ═══
    async showInbox(p, d) {
      var m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        d = await RUI._api('/api/req/inbox');
      }
      var stats = await RUI._api('/api/req/stats').catch(function() { return {inbox:{},mine:{}}; });
      var items = d.items || [];

      var h = '<div class="sec-hd"><span>📥 صندوق درخواست‌ها</span><span class="rd-mini">' + items.length + '</span></div>';
      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:14px">';
      h += '<div class="rd-stat"><div class="v">' + (stats.inbox.total || 0) + '</div><div class="l">کل</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + (stats.inbox.urgent || 0) + '</div><div class="l">فوری</div></div>';
      h += '<div class="rd-stat ' + ((stats.inbox.overdue||0) > 0 ? 'dng' : 'ok') + '"><div class="v">' + (stats.inbox.overdue || 0) + '</div><div class="l">گذشته SLA</div></div>';
      h += '</div>';

      if (!items.length) {
        h += '<div class="empty" style="padding:40px">✅ صندوق خالی است</div>';
      } else {
        items.forEach(function(r) {
          var cls = r.overdue ? 'hi' : r.priority === 'urgent' ? 'hi' : 'lo';
          h += '<div class="row ' + cls + '" onclick="NABZ.reqUI.viewRequest(\'' + r.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + (r.icon || '📄') + ' ' + RUI._esc(r.typeLabel) + '</div>';
          h += '<span class="pill ' + (r.overdue ? 'dng' : 'warn') + '">' + (r.overdue ? 'SLA' : 'جدید') + '</span></div>';
          h += '<div class="row-meta">' + RUI._esc(r.requestedByName) + ' · ' + RUI._esc(r.requestedByWard || '—') + '</div>';
          if (r.subject) h += '<div class="row-meta">' + RUI._esc(r.subject) + '</div>';
          h += '<div class="row-meta" style="font-size:10.5px">' + RUI._time(r.createdAt) + '</div>';
          h += '</div>';
        });
      }
      m.innerHTML = h;
    },

    // ═══ MINE ═══
    async showMine(p, d) {
      var m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        d = await RUI._api('/api/req/mine');
      }
      var items = d.items || [];
      var h = '<div class="sec-hd"><span>📤 درخواست‌های من</span><span class="rd-mini">' + items.length + '</span></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px" onclick="NABZ.reqUI.newRequest()">➕ درخواست جدید</button>';

      if (!items.length) {
        h += '<div class="empty">هنوز درخواستی ندارید</div>';
      } else {
        items.forEach(function(r) {
          h += '<div class="row lo" onclick="NABZ.reqUI.viewRequest(\'' + r.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + (r.icon || '📄') + ' ' + RUI._esc(r.typeLabel) + '</div>';
          h += '<span class="pill ' + (RUI._status_CLS[r.status] || 'info') + '">' + (RUI._status_FA[r.status] || r.status) + '</span></div>';
          h += '<div class="row-meta">' + RUI._esc(r.subject) + '</div>';
          h += '<div class="row-meta" style="font-size:10.5px">' + RUI._time(r.createdAt) + ' · ' + RUI._esc(r.approverName || '—') + '</div>';
          h += '</div>';
        });
      }
      m.innerHTML = h;
    },

    // ═══ NEW ═══
    async newRequest() {
      var types = await RUI._api('/api/req/types');
      var grouped = {};
      (types.items || []).forEach(function(t) {
        if (!grouped[t.category]) grouped[t.category] = [];
        grouped[t.category].push(t);
      });
      var CAT = { personnel:'👤 پرسنلی', education:'🎓 آموزشی', logistics:'🔧 تجهیزات', safety:'⚠️ ایمنی', quality:'⭐ کیفیت', admin:'📄 اداری', clinical:'🩺 بالینی' };

      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">➕ درخواست جدید</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      Object.keys(grouped).forEach(function(cat) {
        h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin:12px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border)">' + (CAT[cat] || cat) + '</div>';
        h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px">';
        grouped[cat].forEach(function(t) {
          h += '<button class="btn" style="padding:10px;display:flex;flex-direction:column;align-items:center;gap:4px;font-size:11px;text-align:center" onclick="NABZ.reqUI._pickType(\'' + t.code + '\')">';
          h += '<span style="font-size:20px">' + t.icon + '</span>';
          h += '<span style="font-weight:800">' + RUI._esc(t.label) + '</span>';
          h += '<span style="font-size:9px;color:var(--fg-2)">SLA ' + t.sla + 'h</span>';
          h += '</button>';
        });
        h += '</div>';
      });

      RUI._openSheet(h);
    },

    async _pickType(typeCode) {
      var types = await RUI._api('/api/req/types');
      var t = (types.items || []).find(function(x) { return x.code === typeCode; });
      if (!t) return alert('نوع نامعتبر');
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">' + t.icon + ' ' + RUI._esc(t.label) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint info" style="margin-bottom:12px">SLA: ' + t.sla + ' ساعت · مسیر: ' + t.route + '</div>';
      h += '<div class="wf-field"><label>موضوع *</label><input type="text" id="rqSubject" value="' + RUI._esc(t.label) + '"></div>';
      h += '<div class="wf-field"><label>توضیح</label><textarea id="rqDesc" rows="3"></textarea></div>';
      if (t.requiresReason) {
        h += '<div class="wf-field"><label>دلیل *</label><textarea id="rqReason" rows="2"></textarea></div>';
      }
      if (t.requiresDate) {
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        h += '<div class="wf-field"><label>از تاریخ *</label><input type="date" id="rqFrom"></div>';
        h += '<div class="wf-field"><label>تا تاریخ</label><input type="date" id="rqTo"></div>';
        h += '</div>';
      }
      if (typeCode === 'leave' || typeCode === 'sick' || typeCode === 'overtime') {
        h += '<div class="wf-field"><label>مقدار/تعداد</label><input type="number" id="rqAmount" placeholder="مثلاً ۲ روز"></div>';
      }
      h += '<div class="wf-field"><label>اولویت</label><select id="rqPriority">';
      h += '<option value="normal">معمولی</option>';
      h += '<option value="urgent"' + (t.urgent ? ' selected' : '') + '>فوری</option>';
      h += '</select></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.reqUI._submit(\'' + typeCode + '\')">📤 ارسال</button>';
      RUI._closeAll();
      RUI._openSheet(h);
    },

    async _submit(typeCode) {
      var body = {
        type: typeCode,
        subject: (document.getElementById('rqSubject') || {}).value || '',
        description: (document.getElementById('rqDesc') || {}).value || '',
        priority: (document.getElementById('rqPriority') || {}).value || 'normal'
      };
      if (document.getElementById('rqReason')) body.reason = document.getElementById('rqReason').value;
      if (document.getElementById('rqFrom')) body.fromDate = document.getElementById('rqFrom').value;
      if (document.getElementById('rqTo')) body.toDate = document.getElementById('rqTo').value;
      if (document.getElementById('rqAmount')) body.amount = parseFloat(document.getElementById('rqAmount').value) || null;

      try {
        var r = await RUI._api('/api/req/create', { method:'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ ارسال شد به ' + (r.approverName || r.approverRole));
        RUI._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══ VIEW ═══
    async viewRequest(reqId) {
      try {
        var r = await RUI._api('/api/req/' + reqId);
        var isApprover = r.approverId === (NABZ.state.user && NABZ.state.user.id) ||
                         r.approverRole === (NABZ.state.user && NABZ.state.user.role);
        var isRequester = r.requestedBy === (NABZ.state.user && NABZ.state.user.id);
        var canAct = isApprover && ['submitted','escalated'].includes(r.status);

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">' + (r.icon||'📄') + ' ' + RUI._esc(r.typeLabel) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">';
        h += '<span class="pill ' + (RUI._status_CLS[r.status] || 'info') + '">' + (RUI._status_FA[r.status] || r.status) + '</span>';
        if (r.priority === 'urgent') h += '<span class="pill dng">🚨 فوری</span>';
        h += '</div>';

        // Requester
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:12px;color:var(--fg-2)">درخواست‌دهنده</div>';
        h += '<div style="font-weight:900;font-size:14px">' + RUI._esc(r.requestedByName) + '</div>';
        h += '<div style="font-size:11.5px;color:var(--fg-2)">' + RUI._esc(r.requestedByRole) + (r.requestedByWard ? ' · ' + RUI._esc(r.requestedByWard) : '') + '</div>';
        h += '</div>';

        // Content
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div class="card-title">📋 جزئیات</div>';
        h += '<div style="font-size:13px;font-weight:900;margin-bottom:4px">' + RUI._esc(r.subject) + '</div>';
        if (r.description) h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:6px">' + RUI._esc(r.description) + '</div>';
        if (r.reason) h += '<div style="font-size:12px;margin-top:6px"><b>دلیل:</b> ' + RUI._esc(r.reason) + '</div>';
        if (r.fromDate) h += '<div style="font-size:12px;margin-top:4px"><b>از:</b> ' + RUI._esc(r.fromDate) + (r.toDate ? ' — <b>تا:</b> ' + RUI._esc(r.toDate) : '') + '</div>';
        if (r.amount) h += '<div style="font-size:12px;margin-top:4px"><b>مقدار:</b> ' + r.amount + '</div>';
        h += '</div>';

        // Approver info
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div class="card-title">🎯 تأییدکننده</div>';
        h += '<div style="font-size:12.5px">' + RUI._esc(r.approverName || 'در انتظار') + ' (' + RUI._esc(r.approverRole) + ')</div>';
        if (r.dueAt) {
          var overdue = new Date(r.dueAt).getTime() < Date.now() && ['submitted','escalated'].includes(r.status);
          h += '<div style="font-size:11.5px;color:var(--' + (overdue ? 'dng' : 'fg-2') + ');margin-top:4px">SLA: ' + RUI._time(r.dueAt) + (overdue ? ' ⚠️ گذشته' : '') + '</div>';
        }
        h += '</div>';

        // Timeline
        if (r.timeline && r.timeline.length) {
          h += '<div class="card" style="margin-bottom:12px">';
          h += '<div class="card-title">📅 تاریخچه</div>';
          r.timeline.forEach(function(t) {
            h += '<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">';
            h += '<span style="color:var(--primary);font-weight:900">' + (RUI._status_FA[t.status] || t.status) + '</span>';
            h += '<span style="color:var(--fg-2);flex:1">' + RUI._esc(t.byName || '') + (t.note ? ' — ' + RUI._esc(t.note) : '') + '</span>';
            h += '<span style="color:var(--fg-3);font-size:10px">' + RUI._time(t.at) + '</span>';
            h += '</div>';
          });
          h += '</div>';
        }

        // Actions
        if (canAct) {
          h += '<div style="display:flex;gap:6px;margin-top:12px">';
          h += '<button class="btn btn-ok" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.reqUI._approve(\'' + r.id + '\')">✅ تأیید</button>';
          h += '<button class="btn btn-dng" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.reqUI._reject(\'' + r.id + '\')">❌ رد</button>';
          h += '<button class="btn" style="padding:12px" onclick="NABZ.reqUI._escalate(\'' + r.id + '\')">⬆️ ارجاع</button>';
          h += '</div>';
        }
        if (isRequester && ['submitted','escalated'].includes(r.status)) {
          h += '<div style="margin-top:8px"><button class="btn btn-block" style="padding:10px;color:var(--dng)" onclick="NABZ.reqUI._cancel(\'' + r.id + '\')">لغو درخواست</button></div>';
        }

        RUI._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _approve(id) {
      var note = (await NABZ.dialog.form({ icon: '📝', title: 'توضیح (اختیاری)', fields: [{ key: 'v', label: 'توضیح', type: 'textarea' }], submitLabel: 'تأیید' }).then(d => d && d.v)) || '';
      try {
        await RUI._api('/api/req/' + id + '/approve', { method:'POST', body: JSON.stringify({ note: note }) });
        NABZ._toast('✅ تأیید شد');
        RUI._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _reject(id) {
      var reason = await NABZ.dialog.form({ icon: '❌', title: 'دلیل رد', fields: [{ key: 'v', label: 'دلیل رد (اجباری)', required: true, type: 'textarea' }], submitLabel: 'رد' }).then(d => d && d.v);
      if (!reason) return;
      try {
        await RUI._api('/api/req/' + id + '/reject', { method:'POST', body: JSON.stringify({ reason: reason }) });
        NABZ._toast('❌ رد شد');
        RUI._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _escalate(id) {
      if (!confirm('به سطح بالاتر ارجاع شود؟')) return;
      try {
        var r = await RUI._api('/api/req/' + id + '/escalate', { method:'POST', body: '{}' });
        NABZ._toast('⬆️ به ' + r.approverRole + ' ارجاع شد');
        RUI._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _cancel(id) {
      if (!confirm('درخواست لغو شود؟')) return;
      try {
        await RUI._api('/api/req/' + id + '/cancel', { method:'POST', body: '{}' });
        NABZ._toast('لغو شد');
        RUI._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
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
    NABZ.reqUI = RUI;
    var origShow = NABZ.show;
    NABZ.show = async function(id) {
      var p = NABZ.state.panels.find(function(x) { return x.id === id; });
      if (p && p.kind === 'requests_inbox') {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
        return RUI.showInbox(p, null);
      }
      if (p && p.kind === 'requests_mine') {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(function(b) { b.classList.remove('on'); });
        return RUI.showMine(p, null);
      }
      return origShow.call(NABZ, id);
    };
    console.log('[reqUI] loaded ✓');
  });
})();
