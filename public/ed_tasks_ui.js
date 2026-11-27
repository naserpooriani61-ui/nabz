// public/ed_tasks_ui.js — Clinical Tasks UI (all roles)
(function () {
  'use strict';

  function apiCall(url, opts) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    return fetch(url, Object.assign({ headers: { 'Content-Type': 'application/json' }, credentials: 'include' }, opts || {}))
      .then(r => r.json().then(j => { if (!r.ok) throw new Error(j.error || r.status); return j; }));
  }

  const S = { timer: null, data: [] };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function slaView(dueAt) {
    if (!dueAt) return { label: '—', color: '#64748b', overdue: false };
    const min = Math.round((new Date(dueAt).getTime() - Date.now()) / 60000);
    if (min < 0) return { label: 'عقب‌افتاده ' + Math.abs(min) + 'د', color: '#dc2626', overdue: true };
    if (min < 5) return { label: min + 'د باقی', color: '#dc2626', overdue: false };
    if (min < 30) return { label: min + 'د باقی', color: '#f59e0b', overdue: false };
    return { label: min + 'د', color: '#16a34a', overdue: false };
  }

  const ICONS = {
    esi2_physician_see: '🩺', esi2_nurse_see: '💉',
    order_cosign: '✍️', attending_cosign: '👨‍⚕️',
    verbal_readback: '📢', verbal_cosign: '📝',
    lab_critical_alert: '🚨', lab_review: '🔬',
    consult_accept: '📞', consult_see: '👁', consult_attending_approve: '👨‍⚕️', consult_acknowledge: '✅',
    med_due_alert: '💊', med_overdue: '⏰',
    discharge_checklist: '📤', sbar_required: '📋', handoff_receiver_ack: '🤝',
    clinical_deterioration: '⚠️',
    bed_assignment_delay: '🛏', boarding_alert: '🚨', los_alert: '⏱'
  };
  const PRIORITY = { critical: '🔴 فوری', urgent: '🟠 مهم', routine: '🟢 عادی' };

  async function load() {
    const c = document.getElementById('content');
    if (!c) return;
    try {
      const res = await apiCall('/api/ed/tasks/my');
      const list = (res && res.data) ? res.data : (res || []);
      S.data = Array.isArray(list) ? list : [];
      render();
    } catch (e) {
      const msg = String(e.message || e);
      c.innerHTML = '<div style="padding:24px;text-align:center;color:#dc2626;direction:rtl">' +
        (msg.indexOf('forbidden') >= 0 || msg.indexOf('403') >= 0
          ? '⛔ شما دسترسی به کارتابل وظایف ندارید'
          : '❌ خطا در بارگذاری: ' + esc(msg)) + '</div>';
    }
  }

  function render() {
    const c = document.getElementById('content');
    if (!c) return;
    const groups = { critical: [], urgent: [], routine: [] };
    S.data.forEach(t => { (groups[t.priority] || groups.routine).push(t); });
    let h = '<div data-tasks-root style="direction:rtl;padding:16px;max-width:900px;margin:0 auto">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">' +
         '<div style="font-size:18px;font-weight:900">📋 کارتابل وظایف من (' + S.data.length + ')</div>' +
         '<button onclick="NABZ.show(\'ed_tasks\')" style="background:#0f172a;color:#fff;border:none;border-radius:10px;padding:8px 14px;font-weight:800;font-size:12px;cursor:pointer">⟳ بروزرسانی</button></div>';
    if (S.data.length === 0) {
      h += '<div style="text-align:center;padding:40px;color:#64748b;font-weight:700">🎉 هیچ وظیفه‌ای در انتظار شما نیست</div></div>';
      c.innerHTML = h;
      return;
    }
    ['critical','urgent','routine'].forEach(p => {
      if (groups[p].length === 0) return;
      h += '<div style="margin-bottom:18px"><div style="font-weight:900;font-size:14px;color:#0f172a;margin-bottom:8px">' + PRIORITY[p] + ' (' + groups[p].length + ')</div>';
      groups[p].forEach(t => {
        const sla = slaView(t.due_at);
        const icon = ICONS[t.type] || '📋';
        const escapedId = esc(t.id);
        const visitId = t.related && t.related.visit_id ? esc(t.related.visit_id) : null;
        h += '<div style="background:#fff;border:1px solid #e2e8f0;border-inline-start:6px solid ' + sla.color + ';border-radius:12px;padding:12px;margin-bottom:8px;box-shadow:0 1px 3px rgba(0,0,0,.04)">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><div style="flex:1;min-width:0">';
        h += '<div style="font-weight:800;font-size:14px">' + icon + ' ' + esc((t.context && t.context.summary) || t.type) + '</div>';
        if (t.context && t.context.patient_name) h += '<div style="font-size:11px;color:#64748b;margin-top:2px">👤 ' + esc(t.context.patient_name) + '</div>';
        h += '<div style="font-size:10px;color:#94a3b8;margin-top:4px">' + (t.status === 'escalated' ? '⬆️ Escalated — ' : '') + sla.label + '</div>';
        h += '</div><div style="display:flex;flex-direction:column;gap:4px">';
        if (t.status === 'open' || t.status === 'escalated') {
          h += '<button onclick="NABZ._taskAck(\'' + escapedId + '\')" style="background:#0891b2;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;font-size:11px;cursor:pointer">✓ دیدم</button>';
        }
        h += '<button onclick="NABZ._taskResolve(\'' + escapedId + '\')" style="background:#16a34a;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;font-size:11px;cursor:pointer">✓ حل شد</button>';
        if (visitId) {
          h += '<button onclick="(window.NABZ_NAV ? NABZ_NAV.toVisit(\'nursing\', \'' + visitId + '\') : NABZ.show(\'ed_nursing\'))" style="background:#0f172a;color:#fff;border:none;border-radius:8px;padding:6px 12px;font-weight:800;font-size:11px;cursor:pointer">→ بیمار</button>';
        }
        h += '</div></div></div>';
      });
      h += '</div>';
    });
    c.innerHTML = h + '</div>';
  }

  window.NABZ = window.NABZ || {};
  window.NABZ._taskAck = async function (id) {
    try { await apiCall('/api/ed/tasks/' + encodeURIComponent(id) + '/acknowledge', { method: 'POST', body: '{}' }); if (window.NABZ._toast) NABZ._toast('✅ دیدم'); load(); }
    catch (e) { alert('خطا: ' + e.message); }
  };
  window.NABZ._taskResolve = async function (id) {
    const note = await NABZ.dialog.form({ icon: '📝', title: 'یادداشت (اختیاری)', fields: [{ key: 'v', label: 'یادداشت', type: 'textarea' }], submitLabel: 'تأیید' }).then(d => d && d.v);
    try { await apiCall('/api/ed/tasks/' + encodeURIComponent(id) + '/resolve', { method: 'POST', body: JSON.stringify({ note: note }) }); if (window.NABZ._toast) NABZ._toast('✅ حل شد'); load(); }
    catch (e) { alert('خطا: ' + e.message); }
  };

  function show() {
    document.getElementById('content').innerHTML = '<div style="text-align:center;padding:40px">در حال بارگذاری...</div>';
    load();
    if (S.timer) clearInterval(S.timer);
    S.timer = setInterval(() => {
      const root = document.querySelector('[data-tasks-root]');
      if (root) load();
      else if (S.timer) { clearInterval(S.timer); S.timer = null; }
    }, 30000);
  }

  // Retry until NABZ available
  (function wait() {
    if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('ed_tasks', show);
      return;
    }
    if (window.__nav_task_retries == null) window.__nav_task_retries = 0;
    if (++window.__nav_task_retries > 100) { console.warn('[ed_tasks_ui] NABZ never available'); return; }
    setTimeout(wait, 50);
  })();
})();
