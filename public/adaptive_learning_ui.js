
// ═══════════════════════════════════════════════════════════
//  NABZ — Adaptive Learning UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const CAT_FA = {
    medication:'ایمنی دارویی', clinical:'بالینی', documentation:'مستندسازی',
    infection:'کنترل عفونت', emergency:'اورژانس'
  };
  const SOURCE_FA = {
    cdss_interactions: 'CDSS · تداخل دارویی',
    nanda_noc: 'NANDA · تشخیص پرستاری',
    mar_error: 'MAR · خطای واقعی شما',
    high_alert_reinforce: 'MAR · تقویت High-Alert',
    sepsis_3h: 'Sepsis · bundle ۳h',
    incident_fall: 'Incident · سقوط'
  };
  const DIFF_CLS = { easy:'ok', medium:'warn', hard:'dng' };
  const DIFF_FA = { easy:'آسان', medium:'متوسط', hard:'سخت' };

  const L = {
    _api: (p, o) => NABZ._api(p, o),
    _esc: s => NABZ._esc(s),
    _state: { currentDrill: null, currentScenario: null },
    _closeAll() { document.querySelectorAll('.bs-backdrop').forEach(el => el.remove()); },
    _openSheet(html, opts) {
      opts = opts || {};
      const s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = e => { if (e.target === s && !opts.noClose) s.remove(); };
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(() => s.classList.add('show'));
      return { sheet: s, content: c };
    },

    // ═══════════════════════════════════════════════════
    //  DAILY DUE
    // ═══════════════════════════════════════════════════
    async showDaily(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await L._api('/api/learn/due?limit=5');
        L._renderDaily(d);
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + L._esc(e.message) + '</div>'; }
    },

    _renderDaily(d) {
      const m = document.getElementById('content');
      let h = '<div class="sec-hd"><span>🧠 یادگیری روزانه</span>';
      h += '<span class="rd-mini">' + d.total + ' کارت</span></div>';

      if (!d.items.length) {
        h += '<div class="card" style="text-align:center;padding:30px">';
        h += '<div style="font-size:48px">🎉</div>';
        h += '<div style="font-weight:900;font-size:16px;margin-top:8px">همه کارت‌ها مرور شد</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:6px">دفعه بعد: طبق SM-2 در تاریخ‌های آینده</div>';
        h += '</div>';
        h += '<div class="rd-stats" style="margin-top:14px">';
        h += '<div class="rd-stat"><div class="v">' + (d.dueCount || 0) + '</div><div class="l">Due</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + (d.newCount || 0) + '</div><div class="l">جدید</div></div>';
        h += '</div>';
        m.innerHTML = h;
        return;
      }

      h += '<div class="hint info" style="margin-bottom:12px">🎯 ' + d.total + ' کارت — هر کدام ۳۰-۶۰ ثانیه. تکرار در زمان درست (SM-2)</div>';

      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-bottom:12px;font-weight:900;font-size:14px" onclick="NABZ.learnUI.startSession()">▶ شروع مرور</button>';

      // Preview cards
      d.items.forEach((it, idx) => {
        const c = it.card;
        h += '<div class="card" style="margin-bottom:8px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
        h += '<div style="flex:1">';
        h += '<div style="font-size:10px;color:var(--fg-2);font-weight:800">' + (SOURCE_FA[c.source] || c.source) + '</div>';
        h += '<div style="font-size:12.5px;font-weight:800;margin-top:4px">' + L._esc(c.fa_question) + '</div>';
        h += '</div>';
        h += '<span class="pill ' + (DIFF_CLS[c.difficulty] || 'info') + '">' + (DIFF_FA[c.difficulty] || c.difficulty) + '</span>';
        h += '</div>';
        h += '</div>';
      });

      // Progress link
      h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="NABZ.learnUI.showProgress()">📊 پیشرفت من</button>';

      m.innerHTML = h;
      L._state.dueItems = d.items;
      NABZ.state.current = p ? p.id : 'adaptive_learning.daily';
    },

    async showProgress() {
      try {
        const d = await L._api('/api/learn/progress');
        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📊 پیشرفت یادگیری</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        const o = d.overall;
        h += '<div class="rd-stats" style="grid-template-columns:repeat(2,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat ok"><div class="v">' + o.totalAttempts + '</div><div class="l">کل مرور</div></div>';
        h += '<div class="rd-stat ' + (o.overallCorrectPct >= 70 ? 'ok' : 'warn') + '"><div class="v">' + o.overallCorrectPct + '%</div><div class="l">صحت</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + o.last7Days + '</div><div class="l">۷ روز</div></div>';
        h += '<div class="rd-stat ' + (o.dueNow > 0 ? 'warn' : '') + '"><div class="v">' + o.dueNow + '</div><div class="l">Due</div></div>';
        h += '</div>';

        if (o.streak > 0) {
          h += '<div class="hint success" style="margin-bottom:12px">🔥 Streak: ' + o.streak + ' روز</div>';
        }

        if (d.byCategory.length) {
          h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin:12px 0 6px">به تفکیک دسته</div>';
          d.byCategory.forEach(c => {
            const color = c.accuracyPct >= 70 ? 'ok' : c.accuracyPct >= 50 ? 'warn' : 'dng';
            h += '<div style="margin-bottom:8px">';
            h += '<div style="display:flex;justify-content:space-between;font-size:11.5px"><span>' + (CAT_FA[c.category] || c.category) + '</span>';
            h += '<b style="color:var(--' + color + ')">' + c.accuracyPct + '%</b></div>';
            h += '<div class="progress" style="margin-top:2px;height:4px"><div class="progress-fill ' + color + '" style="width:' + c.accuracyPct + '%"></div></div>';
            h += '<div style="font-size:9.5px;color:var(--fg-3);margin-top:2px">' + c.correct + '/' + c.total + '</div>';
            h += '</div>';
          });
        }

        h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        L._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  SESSION (swipe cards)
    // ═══════════════════════════════════════════════════
    startSession() {
      if (!L._state.dueItems || !L._state.dueItems.length) return alert('کارتی نیست');
      L._state.sessionIdx = 0;
      L._state.sessionAnswers = {};
      L._renderSessionCard();
    },

    _renderSessionCard() {
      const items = L._state.dueItems;
      const idx = L._state.sessionIdx;
      if (idx >= items.length) return L._finishSession();

      const it = items[idx];
      const c = it.card;
      const startMs = Date.now();

      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🧠 ' + (idx + 1) + ' از ' + items.length + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Source badge
      h += '<div style="margin-bottom:10px">';
      h += '<span class="pill info" style="font-size:10px">' + (SOURCE_FA[c.source] || c.source) + '</span> ';
      h += '<span class="pill ' + (DIFF_CLS[c.difficulty] || 'info') + '">' + (DIFF_FA[c.difficulty] || c.difficulty) + '</span>';
      h += '</div>';

      // Question
      h += '<div class="card" style="margin-bottom:14px;background:linear-gradient(135deg,rgba(6,182,212,.08),rgba(139,92,246,.04))">';
      h += '<div style="font-size:14px;font-weight:900;line-height:1.5">' + L._esc(c.fa_question) + '</div>';
      h += '</div>';

      // Options
      c.options.forEach(opt => {
        h += '<button class="btn btn-block" style="padding:14px;margin-bottom:6px;text-align:right;font-size:13px;justify-content:flex-start" onclick="NABZ.learnUI._answer(\'' + opt.id + '\',' + startMs + ')">';
        h += '<span style="color:var(--primary);font-weight:900;margin-left:6px">' + opt.id.toUpperCase() + '</span> ';
        h += L._esc(opt.text);
        h += '</button>';
      });

      h += '<div id="answerResult" style="margin-top:12px"></div>';

      L._openSheet(h, { noClose: true });
    },

    async _answer(optionId, startMs) {
      const items = L._state.dueItems;
      const it = items[L._state.sessionIdx];
      const responseMs = Date.now() - startMs;
      try {
        const r = await L._api('/api/learn/review', {
          method: 'POST',
          body: JSON.stringify({ cardId: it.card.id, optionId, responseMs })
        });
        // Disable all option buttons
        document.querySelectorAll('.bs-sheet .btn-block').forEach(b => {
          if (b.textContent.trim() && !b.textContent.includes('ادامه') && !b.textContent.includes('پایان')) {
            b.disabled = true;
            b.style.opacity = '0.5';
          }
        });
        // Show result
        const resultEl = document.getElementById('answerResult');
        let h = '<div class="card" style="border-color:var(--' + (r.correct ? 'ok' : 'dng') + ');padding:14px">';
        h += '<div style="text-align:center;font-size:32px">' + (r.correct ? '✅' : '❌') + '</div>';
        h += '<div style="text-align:center;font-size:14px;font-weight:900;color:var(--' + (r.correct ? 'ok' : 'dng') + ');margin-top:4px">' + (r.correct ? 'درست' : 'نادرست') + '</div>';
        if (!r.correct && r.correctOptionId) {
          const correctOpt = it.card.options.find(o => o.id === r.correctOptionId);
          if (correctOpt) h += '<div style="text-align:center;font-size:11.5px;color:var(--fg-2);margin-top:4px">پاسخ درست: <b>' + L._esc(correctOpt.text) + '</b></div>';
        }
        h += '<div style="margin-top:10px;padding:10px;background:var(--bg-3);border-radius:8px;font-size:12px;line-height:1.6">';
        h += L._esc(r.explanation_fa || '');
        h += '</div>';
        if (r.reference) h += '<div style="font-size:10px;color:var(--fg-3);margin-top:6px;font-family:monospace">📚 ' + L._esc(r.reference) + '</div>';
        h += '<div style="font-size:10px;color:var(--fg-3);margin-top:6px">🔁 مرور بعدی: ' + (r.srs.nextDue ? new Date(r.srs.nextDue).toLocaleDateString('fa-IR') : '—') + ' (فاصله ' + r.srs.interval + ' روز)</div>';
        h += '</div>';
        h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:10px;font-weight:900" onclick="NABZ.learnUI._nextCard()">ادامه →</button>';
        resultEl.innerHTML = h;
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _nextCard() {
      L._state.sessionIdx++;
      L._closeAll();
      L._renderSessionCard();
    },

    _finishSession() {
      L._closeAll();
      NABZ._toast('✅ جلسه تمام شد — SM-2 کارت‌ها را زمان‌بندی کرد');
      L.showDaily(null, null);
    },

    // ═══════════════════════════════════════════════════
    //  SCENARIOS
    // ═══════════════════════════════════════════════════
    async showScenarios(p, d) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await L._api('/api/learn/scenarios');
        L._renderScenarios(d);
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + L._esc(e.message) + '</div>'; }
    },

    _renderScenarios(d) {
      const m = document.getElementById('content');
      let h = '<div class="sec-hd"><span>🎮 سناریوهای بالینی</span>';
      h += '<span class="rd-mini">' + d.total + '</span></div>';

      h += '<div class="hint info" style="margin-bottom:12px">هر سناریو ۴-۵ دقیقه · یادگیری تصمیم‌گیری واقعی بدون خطر بیمار</div>';

      d.items.forEach(s => {
        h += '<div class="card" style="margin-bottom:10px;cursor:pointer" onclick="NABZ.learnUI.startScenario(\'' + s.id + '\')">';
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start">';
        h += '<div style="flex:1">';
        h += '<div style="font-weight:900;font-size:14px">🎯 ' + L._esc(s.fa) + '</div>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:4px">' + (CAT_FA[s.category] || s.category) + ' · ' + s.stepCount + ' تصمیم · ~' + s.estimatedMin + ' دقیقه</div>';
        h += '</div>';
        h += '<span class="pill ' + (DIFF_CLS[s.difficulty] || 'info') + '">' + (DIFF_FA[s.difficulty] || s.difficulty) + '</span>';
        h += '</div></div>';
      });

      h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="NABZ.learnUI.scenarioHistory()">📚 تاریخچه</button>';

      m.innerHTML = h;
      NABZ.state.current = p ? p.id : 'adaptive_learning.scenarios';
    },

    async scenarioHistory() {
      try {
        const d = await L._api('/api/learn/scenarios/history');
        let h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📚 تاریخچه سناریو</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        if (!d.items.length) {
          h += '<div class="empty">هنوز سناریویی اجرا نکرده‌اید</div>';
        } else {
          d.items.forEach(a => {
            const oc = { excellent:'ok', ok:'info', partial:'warn', fail:'dng' }[a.outcome] || 'info';
            h += '<div style="padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:4px;font-size:11.5px">';
            h += '<div style="display:flex;justify-content:space-between"><b>' + L._esc(a.scenarioFa) + '</b>';
            h += '<span class="pill ' + oc + '">' + (a.outcome || '?') + '</span></div>';
            h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">' + new Date(a.completedAt).toLocaleString('fa-IR') + ' · امتیاز ' + a.finalScore + '/' + a.maxScore + '</div>';
            h += '</div>';
          });
        }
        h += '<button class="btn btn-block" style="padding:10px;margin-top:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        L._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async startScenario(id) {
      try {
        const r = await L._api('/api/learn/scenarios/' + id + '/start', {
          method: 'POST', body: '{}'
        });
        L._state.currentScenario = { attempt: r.attempt, clinicalCase: r.clinicalCase };
        L._renderScenarioStep(r.step, r.clinicalCase, r.attempt);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _renderScenarioStep(step, clinicalCase, attempt) {
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">🎮 سناریو</div>';
      h += '<button class="bs-close" onclick="if(confirm(\'خروج؟\'))this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Case
      if (clinicalCase) {
        h += '<div class="card" style="margin-bottom:12px;background:var(--primary-soft);font-size:12px;line-height:1.7">';
        h += '<div style="font-size:10px;font-weight:900;color:var(--primary);margin-bottom:4px">📋 Case</div>';
        h += L._esc(clinicalCase);
        h += '</div>';
      }

      if (step.terminal) {
        const oc = step.outcome;
        const color = { excellent:'ok', ok:'info', partial:'warn', fail:'dng' }[oc] || 'info';
        h += '<div class="card" style="border-color:var(--' + color + ');margin-bottom:12px">';
        h += '<div style="text-align:center;font-size:40px">' + (oc === 'excellent' ? '🏆' : oc === 'ok' ? '✅' : oc === 'partial' ? '⚠️' : '❌') + '</div>';
        h += '<div style="text-align:center;font-size:14px;font-weight:900;color:var(--' + color + ');margin-top:8px">' + L._esc(step.title) + '</div>';
        h += '<div style="margin-top:10px;padding:10px;background:var(--bg-3);border-radius:8px;font-size:12px;line-height:1.6">' + L._esc(step.explanation) + '</div>';
        if (step.reference) h += '<div style="font-size:10px;color:var(--fg-3);margin-top:6px;font-family:monospace">📚 ' + L._esc(step.reference) + '</div>';
        h += '<div style="text-align:center;margin-top:10px;font-size:16px;font-weight:900">امتیاز: ' + attempt.score + '/' + (attempt.path.length * 10) + '</div>';
        h += '</div>';
        h += '<button class="btn btn-primary btn-block" style="padding:14px;font-weight:900" onclick="this.closest(\'.bs-backdrop\').remove();NABZ.learnUI.showScenarios(null,null)">پایان</button>';
      } else {
        // Progress
        h += '<div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--fg-2);margin-bottom:8px">';
        h += '<span>مرحله ' + (attempt.path.length + 1) + '</span>';
        h += '<span>امتیاز: ' + attempt.score + '</span>';
        h += '</div>';

        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:13px;font-weight:900;line-height:1.5">' + L._esc(step.question) + '</div>';
        h += '</div>';

        step.choices.forEach(ch => {
          h += '<button class="btn btn-block" style="padding:12px;margin-bottom:6px;text-align:right;font-size:12.5px;justify-content:flex-start" onclick="NABZ.learnUI._scenarioDecide(\'' + attempt.id + '\',\'' + ch.id + '\')">';
          h += '<span style="color:var(--primary);font-weight:900;margin-left:6px">' + ch.id.toUpperCase() + '</span> ';
          h += L._esc(ch.text);
          h += '</button>';
        });
      }

      L._openSheet(h, { noClose: true });
    },

    async _scenarioDecide(attemptId, choiceId) {
      try {
        const r = await L._api('/api/learn/scenarios/attempt/' + attemptId + '/decide', {
          method: 'POST', body: JSON.stringify({ choiceId })
        });
        L._state.currentScenario = { attempt: r.attempt, clinicalCase: L._state.currentScenario.clinicalCase };
        L._renderScenarioStep(r.step, L._state.currentScenario.clinicalCase, r.attempt);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 60) return;
    setTimeout(() => ready(fn), 100);
  }
  ready(() => {
    NABZ.learnUI = L;
    if (typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('learn_daily', (p, d) => L.showDaily(p, d));
      NABZ.registerKind('learn_scenarios', (p, d) => L.showScenarios(p, d));
    }
    console.log('[learn-ui] loaded ✓');
  });
})();
