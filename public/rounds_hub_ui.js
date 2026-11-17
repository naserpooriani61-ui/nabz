(function() {
  'use strict';
  var RH = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _cache: null,
    _tab: 'queue',
    _drafts: {},
    _open: function(html) {
      var s = document.createElement('div'); s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s) s.remove(); };
      var c = document.createElement('div'); c.className = 'bs-sheet';
      c.style.maxHeight = '96vh'; c.style.overflowY = 'auto'; c.innerHTML = html;
      s.appendChild(c); document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
    },
    _close: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e){e.remove();}); },

    show: async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await RH._api('/api/rounds/queue');
        RH._cache = d;
        RH._render(p);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + RH._esc(e.message) + '</div>';
      }
    },

    _render: function(p) {
      var d = RH._cache || { items: [], stats: {} };
      var m = document.getElementById('content');
      var h = '<div class="sec-hd"><span>✍️ راند پزشکی</span><span class="rd-mini">' + d.items.length + ' بیمار</span></div>';
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat ' + (d.stats.withSepsis > 0 ? 'dng' : 'ok') + '"><div class="v">' + (d.stats.withSepsis || 0) + '</div><div class="l">سپسیس</div></div>';
      h += '<div class="rd-stat ' + (d.stats.withCriticalLab > 0 ? 'dng' : '') + '"><div class="v">' + (d.stats.withCriticalLab || 0) + '</div><div class="l">آزمایش بحرانی</div></div>';
      h += '<div class="rd-stat ' + ((d.stats.withoutRound24h || 0) > 0 ? 'warn' : 'ok') + '"><div class="v">' + (d.stats.withoutRound24h || 0) + '</div><div class="l">بدون راند</div></div>';
      h += '<div class="rd-stat info"><div class="v">' + (d.stats.newPatients || 0) + '</div><div class="l">بیمار جدید</div></div>';
      h += '</div>';
      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      h += '<button class="crisis-tab' + (RH._tab === 'queue' ? ' on' : '') + '" onclick="NABZ.rounds._setTab(\'queue\')">صف راند</button>';
      h += '<button class="crisis-tab' + (RH._tab === 'mine' ? ' on' : '') + '" onclick="NABZ.rounds._setTab(\'mine\')">راندهای من</button>';
      h += '<button class="crisis-tab' + (RH._tab === 'cosign' ? ' on' : '') + '" onclick="NABZ.rounds._setTab(\'cosign\')">منتظر تأیید</button>';
      h += '</div>';
      h += '<div id="rhContent"></div>';
      m.innerHTML = h;
      if (RH._tab === 'queue') RH._renderQueue();
      else RH._renderMine();
      NABZ.state.current = p ? p.id : 'rounds_hub.hub';
    },

    _setTab: function(t) { RH._tab = t; RH._render(null); },

    _renderQueue: function() {
      var el = document.getElementById('rhContent');
      if (!el) return;
      var items = (RH._cache || {}).items || [];
      if (!items.length) {
        el.innerHTML = '<div class="card" style="text-align:center;padding:30px"><div style="font-size:40px">✅</div><div style="font-weight:900;margin-top:8px">صف راند خالی است</div></div>';
        return;
      }
      var h = '';
      items.forEach(function(p) {
        var lvl = p.hasSepsis ? 'dng' : (p.news2 >= 7 || p.hasCriticalLab) ? 'dng' : p.news2 >= 5 ? 'warn' : 'ok';
        var badges = [];
        if (p.hasSepsis) badges.push('🦠');
        if (p.hasCriticalLab) badges.push('🧪');
        if (p.allergies && p.allergies.length) badges.push('⚠️');
        h += '<div class="card" style="padding:10px;margin-bottom:4px;border-right:3px solid var(--' + lvl + ');cursor:pointer" onclick="NABZ.rounds.openSoap(\'' + p.id + '\')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:12.5px;font-weight:900">' + badges.join(' ') + ' ' + RH._esc(p.name) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + (p.age||'?') + ' سال / ' + RH._esc(p.ward||'') + ' / تخت ' + RH._esc(p.bed||'') + '</div>';
        if (p.diagnosis) h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:1px">' + RH._esc(p.diagnosis.slice(0, 55)) + '</div>';
        h += '<div style="font-size:10px;color:var(--primary);margin-top:3px;font-weight:800">' + p.reason + (p.hoursSinceRound !== null ? ' / ' + p.hoursSinceRound + 'h از راند قبل' : '') + '</div>';
        h += '</div>';
        h += '<div style="text-align:left">';
        if (p.news2) h += '<span class="pill ' + (p.news2 >= 7 ? 'dng' : p.news2 >= 5 ? 'warn' : 'info') + '" style="font-size:9px">NEWS ' + p.news2 + '</span> ';
        h += '<span class="pill ' + (p.riskLevel === 'hi' ? 'dng' : p.riskLevel === 'md' ? 'warn' : 'ok') + '" style="font-size:9px">' + p.riskScore + '%</span>';
        h += '</div></div></div>';
      });
      el.innerHTML = h;
    },

    _renderMine: async function() {
      var el = document.getElementById('rhContent');
      if (!el) return;
      el.innerHTML = '<div style="text-align:center;padding:20px"><span class="spinner"></span></div>';
      try {
        var r = await RH._api('/api/enc/rounds?authorId=' + encodeURIComponent(NABZ.state.user.id));
        var items = r.items || [];
        if (!items.length) { el.innerHTML = '<div class="empty">هنوز راندی ثبت نکرده‌اید</div>'; return; }
        var h = '';
        items.slice(0, 30).forEach(function(r2) {
          var stMap = { draft: 'پیش‌نویس', pending_cosign: 'در انتظار تأیید', signed: 'امضا شده' };
          var stCls = { draft: 'warn', pending_cosign: 'info', signed: 'ok' };
          h += '<div class="card" style="padding:10px;margin-bottom:4px;cursor:pointer" onclick="NABZ.rounds._openRound(\'' + r2.id + '\')">';
          h += '<div style="display:flex;justify-content:space-between;align-items:center">';
          h += '<div><div style="font-size:12.5px;font-weight:900">' + RH._esc(r2.patientName) + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2)">' + RH._esc(r2.wardCode) + ' / ' + (r2.subtype || '') + '</div></div>';
          h += '<span class="pill ' + (stCls[r2.status] || 'info') + '">' + (stMap[r2.status] || r2.status) + '</span>';
          h += '</div></div>';
        });
        el.innerHTML = h;
      } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + RH._esc(e.message) + '</div>'; }
    },

    _openRound: function(id) {
      if (NABZ.enc && typeof NABZ.enc.openRound === 'function') return NABZ.enc.openRound(id);
      alert('ماژول encounters در دسترس نیست');
    },

    openSoap: async function(pid) {
      try {
        var results = await Promise.all([
          RH._api('/api/rounds/context/' + pid),
          RH._api('/api/rounds/suggest/' + pid)
        ]);
        RH._current = { pid: pid, context: results[0], suggestions: results[1] };
        RH._renderSoapEditor();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderSoapEditor: function() {
      var c = RH._current;
      var ctx = c.context;
      var p = ctx.patient;
      var s = c.suggestions;
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">✍️ ' + RH._esc(p.name) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Header
      h += '<div style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05));border-radius:10px;padding:10px;margin-bottom:10px">';
      h += '<div style="font-size:14px;font-weight:900">' + RH._esc(p.name) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:2px">' + (p.age||'?') + ' سال / ' + RH._esc(p.ward||'') + ' / تخت ' + RH._esc(p.bed||'') + '</div>';
      if (p.diagnosis) h += '<div style="font-size:11.5px;margin-top:4px;font-weight:700">' + RH._esc(p.diagnosis) + '</div>';
      if (p.allergies.length) h += '<div style="font-size:11px;color:var(--dng);margin-top:4px;font-weight:800">⚠️ ' + RH._esc(p.allergies.join(' / ')) + '</div>';
      h += '</div>';

      // Quick facts
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px">';
      h += '<div class="card" style="padding:8px;text-align:center"><div style="font-size:16px;font-weight:900;color:var(--primary)">' + (ctx.risk.score || 0) + '%</div><div style="font-size:9.5px;color:var(--fg-2)">ریسک</div></div>';
      h += '<div class="card" style="padding:8px;text-align:center;' + (ctx.criticalLabs.length > 0 ? 'border-color:var(--dng)' : '') + '"><div style="font-size:16px;font-weight:900;color:' + (ctx.criticalLabs.length > 0 ? 'var(--dng)' : 'inherit') + '">' + ctx.criticalLabs.length + '</div><div style="font-size:9.5px;color:var(--fg-2)">آزمایش بحرانی</div></div>';
      h += '<div class="card" style="padding:8px;text-align:center"><div style="font-size:16px;font-weight:900">' + ctx.mar.missed + '</div><div style="font-size:9.5px;color:var(--fg-2)">MAR missed</div></div>';
      h += '</div>';

      // S
      h += '<div class="sec-hd" style="margin:10px 0 6px"><span>📌 S — ذهنی</span></div>';
      h += '<textarea id="rh_s" rows="2" placeholder="شکایت اصلی..." style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px;font-family:inherit">' + RH._esc(ctx.autoFill.chiefComplaint) + '</textarea>';
      h += '<textarea id="rh_sh" rows="2" placeholder="تاریخچه..." style="width:100%;padding:8px;margin-top:4px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px;font-family:inherit">' + RH._esc(ctx.autoFill.history) + '</textarea>';

      // O
      h += '<div class="sec-hd" style="margin:10px 0 6px"><span>📊 O — عینی</span></div>';
      h += '<div class="hint info" style="font-size:11px;margin-bottom:4px;padding:6px">' + RH._esc(ctx.autoFill.vitalsText) + '</div>';
      h += '<textarea id="rh_o" rows="3" placeholder="معاینه فیزیکی..." style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px;font-family:inherit"></textarea>';

      // A
      h += '<div class="sec-hd" style="margin:10px 0 6px"><span>🔍 A — ارزیابی</span></div>';
      h += '<textarea id="rh_a" rows="2" placeholder="ارزیابی بالینی..." style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px;font-family:inherit">' + RH._esc(ctx.autoFill.impression) + '</textarea>';

      // P
      h += '<div class="sec-hd" style="margin:10px 0 6px"><span>📋 P — پلن</span></div>';
      h += '<textarea id="rh_p" rows="2" placeholder="پلن درمان..." style="width:100%;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-size:12px;font-family:inherit"></textarea>';

      // Order set suggestions
      if (s.items.length > 0) {
        h += '<div class="sec-hd" style="margin:14px 0 6px"><span>💊 بسته‌های درمانی پیشنهادی (' + s.items.length + ')</span></div>';
        s.items.forEach(function(set) {
          var critical = set.timeCritical;
          h += '<div class="card" style="padding:10px;margin-bottom:4px;border-color:var(--' + (critical ? 'dng' : 'primary') + ')">';
          h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">';
          h += '<div style="flex:1;min-width:0">';
          h += '<div style="font-weight:900;font-size:12.5px">' + (set.icon||'💊') + ' ' + RH._esc(set.name) + (critical ? ' ⏱' : '') + '</div>';
          h += '<div style="font-size:10.5px;color:var(--ok);margin-top:2px">✓ ' + RH._esc(set.reasons.join(' / ')) + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + set.totalMeds + ' دارو</div>';
          h += '</div>';
          h += '<button class="btn btn-sm" style="padding:6px 10px;font-size:10.5px;color:var(--primary);border-color:var(--primary);font-weight:800" onclick="NABZ.rounds._applySet(\'' + set.id + '\')">اعمال</button>';
          h += '</div></div>';
        });
      }

      // Actions
      h += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
      h += '<button class="btn" style="flex:1;padding:12px;font-size:12px" onclick="NABZ.rounds._saveDraft()">💾 پیش‌نویس</button>';
      h += '<button class="btn btn-primary" style="flex:1;padding:12px;font-size:12px;font-weight:900" onclick="NABZ.rounds._sign()">✍️ امضا</button>';
      h += '</div>';

      RH._close();
      RH._open(h);
    },

    _applySet: async function(setId) {
      var c = RH._current;
      if (!c) return;
      if (!confirm('بسته ' + setId + ' اعمال شود؟')) return;
      try {
        var r = await RH._api('/api/enc/ordersets/' + setId + '/apply', { method: 'POST', body: JSON.stringify({ patientId: c.pid }) });
        NABZ._toast('✅ ' + (r.total || 0) + ' مورد اعمال شد');
        var ta = document.getElementById('rh_p');
        if (ta) ta.value += '\n[Order Set: ' + setId + ']';
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _collectSoap: function() {
      return {
        subjective: {
          chiefComplaint: (document.getElementById('rh_s') || {}).value || '',
          history: (document.getElementById('rh_sh') || {}).value || '',
          reviewOfSystems: ''
        },
        objective: {
          physicalExam: (document.getElementById('rh_o') || {}).value || ''
        },
        assessment: {
          diagnoses: [],
          clinicalImpression: (document.getElementById('rh_a') || {}).value || ''
        },
        plan: {
          medications: [], labs: [], imaging: [], consults: [], nursing: [],
          diet: RH._current.context.autoFill.planDiet,
          activity: RH._current.context.autoFill.planActivity
        }
      };
    },

    _saveDraft: async function() {
      var c = RH._current;
      if (!c) return;
      var soap = RH._collectSoap();
      try {
        var roundId = RH._drafts[c.pid];
        if (roundId) {
          await RH._api('/api/enc/round/' + roundId, { method: 'PUT', body: JSON.stringify(soap) });
        } else {
          var created = await RH._api('/api/enc/round', { method: 'POST', body: JSON.stringify({ patientId: c.pid, subtype: 'morning', ...soap }) });
          RH._drafts[c.pid] = created.id;
          roundId = created.id;
        }
        NABZ._toast('💾 پیش‌نویس ذخیره شد');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _sign: async function() {
      var c = RH._current;
      if (!c) return;
      var soap = RH._collectSoap();
      if (!soap.subjective.chiefComplaint && !soap.assessment.clinicalImpression) {
        return alert('حداقل شکایت اصلی یا ارزیابی بالینی لازم است');
      }
      try {
        var roundId = RH._drafts[c.pid];
        if (!roundId) {
          var created = await RH._api('/api/enc/round', { method: 'POST', body: JSON.stringify({ patientId: c.pid, subtype: 'morning', ...soap }) });
          roundId = created.id;
          RH._drafts[c.pid] = roundId;
        } else {
          await RH._api('/api/enc/round/' + roundId, { method: 'PUT', body: JSON.stringify(soap) });
        }
        var signed = await RH._api('/api/enc/round/' + roundId + '/sign', { method: 'POST', body: '{}' });
        RH._close();
        alert('✅ راند امضا شد\n\n' + (signed.status === 'pending_cosign' ? 'در انتظار تأیید استاد' : 'نهایی'));
        delete RH._drafts[c.pid];
        RH.show(null, null);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.rounds = RH;

  var tries = 0;
  (function tryReg() {
    if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('rounds_hub', function(p, d) { return RH.show(p, d); });
      console.log('[rounds-hub-ui] registered');
      return;
    }
    if (++tries > 60) { console.warn('[rounds-hub] timeout'); return; }
    setTimeout(tryReg, 100);
  })();
  console.log('[rounds-hub-ui] loaded');
})();
