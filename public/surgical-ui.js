// ═══════════════════════════════════════════════════════════
//  NABZ — Surgical UI (WHO checklist, PACU, CSSD)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const WHO_LABELS = {
    signin: [
      ['patientIdentity', 'تأیید هویت بیمار'],
      ['siteMarked', 'علامت‌گذاری محل جراحی'],
      ['consentSigned', 'رضایت‌نامه امضا شده'],
      ['allergiesChecked', 'بررسی آلرژی‌ها'],
      ['anesthesiaSafety', 'ایمنی بیهوشی']
    ],
    timeout: [
      ['teamIntroduced', 'معرفی تیم جراحی'],
      ['procedureConfirmed', 'تأیید نوع و محل عمل'],
      ['antibioticGiven', 'آنتی‌بیوتیک پروفیلاکسی داده شد'],
      ['imagingDisplayed', 'تصاویر نمایش داده شد'],
      ['instrumentSterility', 'استریل بودن ابزار تأیید شد']
    ],
    signout: [
      ['procedureRecorded', 'ثبت نوع عمل انجام‌شده'],
      ['instrumentCountCorrect', 'شمارش ابزار صحیح'],
      ['specimenLabeled', 'نمونه برچسب‌گذاری شده'],
      ['equipmentIssuesNoted', 'مشکلات تجهیزات ثبت شد'],
      ['recoveryPlan', 'برنامه ریکاوری مشخص شد']
    ]
  };
  const PHASE_FA = { signin:'Sign In (قبل بیهوشی)', timeout:'Time Out (قبل برش)', signout:'Sign Out (قبل خروج)' };
  const STATUS_FA = { scheduled:'برنامه‌ریزی‌شده', in_progress:'در حال انجام', completed:'پایان' };
  const STATUS_CLS = { scheduled:'info', in_progress:'warn', completed:'ok' };

  const SURG = {
    _api: p => NABZ._api(p),
    _esc: s => NABZ._esc(s),
    _time: iso => { try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },
    _date: iso => { try { return new Date(iso).toLocaleDateString('fa-IR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },
    _closeAll: () => document.querySelectorAll('.bs-backdrop').forEach(e => e.remove()),
    _openSheet(html) {
      const s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = e => { if (e.target === s) s.remove(); };
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '95vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(() => s.classList.add('show'));
      return { sheet:s, content:c };
    },
    _flowBar(steps, current) {
      let h = '<div class="sur-flow">';
      steps.forEach((s,i) => {
        const cls = i < current ? 'done' : i === current ? 'active' : '';
        h += '<div class="sur-flow-step ' + cls + '">' + s + '</div>';
      });
      h += '</div>';
      return h;
    },
    _pickPatient: async title => {
      if (NABZ.enc && NABZ.enc.pickPatient) return NABZ.enc.pickPatient(title);
      const d = await SURG._api('/api/clinical/patients');
      const items = (d.items||[]).filter(p => ['in_care','admitted'].includes(p.status));
      if (!items.length) { alert('بیمار بستری نیست'); return null; }
      return new Promise(resolve => {
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">👤 انتخاب بیمار</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        items.forEach(p => {
          h += '<button class="btn" style="width:100%;text-align:right;padding:12px;margin-bottom:4px" onclick="window._sp(\'' + p.id + '\')">';
          h += '<b>' + NABZ._esc(p.firstName+' '+p.lastName) + '</b><br>';
          h += '<small style="color:var(--fg-2)">' + NABZ._esc(p.wardCode||'') + ' · ' + NABZ._esc(p.diagnosis||'') + '</small></button>';
        });
        const s = SURG._openSheet(h);
        window._sp = pid => { s.sheet.remove(); resolve(pid); };
      });
    },

    // ═══ ROOMS ═══
    async rooms() {
      try {
        const d = await SURG._api('/api/or/rooms');
        const groups = { GEN:'جراحی جنرال', URO:'اورولوژی', EMG:'اورژانس' };
        let h = '<div class="sec-hd"><span>🔪 اتاق‌های عمل</span><span class="rd-mini">' + d.total + '</span></div>';
        for (const [k,label] of Object.entries(groups)) {
          const rooms = (d.items||[]).filter(r => r.group === k);
          if (!rooms.length) continue;
          h += '<div class="sur-group-title">' + label + ' (' + rooms.length + ')</div>';
          h += '<div class="sur-rooms-grid">';
          rooms.forEach(r => {
            const cls = r.status === 'occupied' ? 'busy' : r.status === 'cleaning' ? 'clean' : 'free';
            const icon = r.status === 'occupied' ? '🔴' : r.status === 'cleaning' ? '🧹' : '🟢';
            h += '<div class="sur-room ' + cls + '" onclick="NABZ.surg.viewRoom(\'' + r.id + '\')">';
            h += '<div class="sur-room-code">' + SURG._esc(r.code) + '</div>';
            h += '<div class="sur-room-icon">' + icon + '</div>';
            h += '</div>';
          });
          h += '</div>';
        }
        h += SURG._fab([
          ['📅','برنامه','NABZ.show(\'surgical.schedule\')'],
          ['🛏️','PACU','NABZ.show(\'surgical.pacu\')'],
          ['🧼','CSSD','NABZ.show(\'surgical.cssd_sets\')']
        ]);
        const m = document.getElementById('content');
        m.innerHTML = h;
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async viewRoom(roomId) {
      try {
        const d = await SURG._api('/api/or/rooms');
        const room = (d.items||[]).find(r => r.id === roomId);
        if (!room) return alert('اتاق یافت نشد');
        // اگر مشغول، case را باز کن
        if (room.currentCaseId) return SURG.viewCase(room.currentCaseId);
        // اگر آزاد، امکان برنامه‌ریزی
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">' + SURG._esc(room.code) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="text-align:center;padding:20px">';
        h += '<div style="font-size:52px">' + (room.status === 'cleaning' ? '🧹' : '🟢') + '</div>';
        h += '<div style="font-weight:900;margin-top:8px">' + (room.status === 'cleaning' ? 'در حال تمیزکاری' : 'آزاد') + '</div>';
        h += '</div>';
        if (room.status === 'available') {
          h += '<button class="btn btn-primary btn-block" style="padding:12px;margin-top:8px" onclick="NABZ.surg.newCase(null,\'' + roomId + '\')">📅 برنامه‌ریزی جراحی</button>';
        }
        SURG._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ NEW CASE ═══
    async newCase(patientId, presetRoomId) {
      if (!patientId) {
        patientId = await SURG._pickPatient('برنامه‌ریزی جراحی');
        if (!patientId) return;
      }
      try {
        const d = await SURG._api('/api/or/rooms');
        const rooms = (d.items||[]).filter(r => r.status === 'available');
        if (!rooms.length) return alert('اتاق عمل آزاد نیست');
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔪 برنامه‌ریزی جراحی</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="wf-field"><label>اتاق عمل *</label><select id="surRoom">';
        rooms.forEach(r => {
          h += '<option value="' + r.id + '"' + (r.id === presetRoomId ? ' selected' : '') + '>' + SURG._esc(r.code) + '</option>';
        });
        h += '</select></div>';
        h += '<div class="wf-field"><label>نام عمل *</label><input type="text" id="surProc" placeholder="مثلاً: Appendectomy"></div>';
        h += '<div class="wf-field"><label>تخصص</label><input type="text" id="surSpec" value="general"></div>';
        h += '<div class="wf-field"><label>مدت تخمینی (دقیقه)</label><input type="number" id="surDur" value="90" min="15"></div>';
        h += '<div class="wf-field"><label>اولویت</label><select id="surPriority">';
        h += '<option value="elective">انتخابی</option>';
        h += '<option value="urgent">فوری</option>';
        h += '<option value="emergency">اورژانسی</option>';
        h += '</select></div>';
        h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.surg._submitCase(\'' + patientId + '\')">✅ ثبت</button>';
        SURG._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async _submitCase(patientId) {
      const proc = document.getElementById('surProc').value.trim();
      if (!proc) return alert('نام عمل الزامی است');
      try {
        const r = await SURG._api('/api/or/schedule', {
          method:'POST',
          body: JSON.stringify({
            patientId, roomId: document.getElementById('surRoom').value,
            procedure: proc, specialty: document.getElementById('surSpec').value,
            estimatedDurationMin: parseInt(document.getElementById('surDur').value) || 90,
            priority: document.getElementById('surPriority').value,
            scheduledDate: new Date().toISOString().slice(0,10),
            scheduledStart: new Date().toISOString()
          })
        });
        SURG._closeAll();
        NABZ._toast('✅ جراحی برنامه‌ریزی شد');
        SURG.viewCase(r.id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ VIEW CASE ═══
    async viewCase(id) {
      try {
        const d = await SURG._api('/api/or/schedule');
        const c = (d.items||[]).find(x => x.id === id);
        if (!c) return alert('جراحی یافت نشد');
        const steps = ['برنامه', 'Sign In', 'Time Out', 'شروع', 'Sign Out', 'پایان'];
        let stepIdx = 0;
        if (c.checklist?.signIn) stepIdx = 1;
        if (c.checklist?.timeOut) stepIdx = 2;
        if (c.status === 'in_progress') stepIdx = 3;
        if (c.checklist?.signOut) stepIdx = 4;
        if (c.status === 'completed') stepIdx = 5;
        
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔪 ' + SURG._esc(c.procedure) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div style="margin-bottom:8px"><span class="pill ' + (STATUS_CLS[c.status]||'info') + '">' + (STATUS_FA[c.status]||c.status) + '</span>';
        if (c.priority === 'emergency') h += ' <span class="pill dng">اورژانسی</span>';
        else if (c.priority === 'urgent') h += ' <span class="pill warn">فوری</span>';
        h += '</div>';
        h += SURG._flowBar(steps, stepIdx);
        
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-weight:900">' + SURG._esc(c.patientName) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">' + SURG._esc(c.roomCode) + ' · ' + SURG._esc(c.wardCode) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2)">مدت تخمینی: ' + c.estimatedDurationMin + ' دقیقه</div>';
        if (c.surgeon) h += '<div style="font-size:12px;color:var(--fg-2)">جراح: ' + SURG._esc(c.surgeon) + '</div>';
        h += '</div>';
        
        // Checklists
        const phases = [
          { key:'signIn', phase:'signin', label:'✍️ Sign In', done: !!c.checklist?.signIn },
          { key:'timeOut', phase:'timeout', label:'⏱ Time Out', done: !!c.checklist?.timeOut },
          { key:'signOut', phase:'signout', label:'✅ Sign Out', done: !!c.checklist?.signOut }
        ];
        h += '<div class="sec-hd" style="margin:12px 0 8px"><span>📋 WHO Safety Checklist</span></div>';
        phases.forEach(ph => {
          const cls = ph.done ? 'sur-check-done' : 'sur-check-todo';
          h += '<div class="sur-check ' + cls + '">';
          h += '<div class="sur-check-hd">';
          h += '<span class="sur-check-title">' + ph.label + '</span>';
          h += '<span class="pill ' + (ph.done ? 'ok' : 'warn') + '">' + (ph.done ? 'انجام شده' : 'ناقص') + '</span>';
          h += '</div>';
          if (ph.done) {
            const data = c.checklist[ph.key];
            if (data.signedAt) h += '<div class="sur-check-meta">' + SURG._time(data.signedAt) + '</div>';
          } else {
            const canDo = (ph.phase === 'signin' && c.status === 'scheduled') ||
                          (ph.phase === 'timeout' && c.checklist?.signIn && c.status === 'scheduled') ||
                          (ph.phase === 'signout' && c.status === 'in_progress');
            if (canDo) {
              h += '<button class="btn btn-sm" style="margin-top:6px;padding:8px 12px;font-size:11.5px" onclick="NABZ.surg.doChecklist(\'' + c.id + '\',\'' + ph.phase + '\')">▶ انجام چک‌لیست</button>';
            } else if (!c.checklist?.signIn && ph.phase === 'timeout') {
              h += '<div class="hint warn" style="margin-top:6px;font-size:10.5px">ابتدا Sign In</div>';
            } else if (c.status === 'scheduled' && ph.phase === 'signout') {
              h += '<div class="hint info" style="margin-top:6px;font-size:10.5px">پس از شروع جراحی</div>';
            }
          }
          h += '</div>';
        });
        
        // Action buttons
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:14px;margin-bottom:20px">';
        if (c.status === 'scheduled' && c.checklist?.signIn && c.checklist?.timeOut) {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px;font-weight:900" onclick="NABZ.surg._startCase(\'' + c.id + '\')">▶️ شروع جراحی</button>';
        }
        if (c.status === 'in_progress' && c.checklist?.signOut) {
          h += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px;font-weight:900" onclick="NABZ.surg._endCase(\'' + c.id + '\')">⏹ پایان جراحی</button>';
        }
        if (c.status === 'completed') {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.surg.pacuAdmit(\'' + c.id + '\')">🛏️ پذیرش PACU</button>';
        }
        h += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        SURG._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    doChecklist(caseId, phase) {
      const items = WHO_LABELS[phase] || [];
      let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📋 ' + PHASE_FA[phase] + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="hint warn" style="margin-bottom:12px">همه موارد باید تأیید شوند</div>';
      items.forEach(([key,label], i) => {
        h += '<label class="sur-chk-item">';
        h += '<input type="checkbox" id="chk_' + key + '" style="width:20px;height:20px;accent-color:var(--primary)">';
        h += '<span>' + SURG._esc(label) + '</span></label>';
      });
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.surg._submitChecklist(\'' + caseId + '\',\'' + phase + '\')">✅ تأیید و امضا</button>';
      SURG._openSheet(h);
    },

    async _submitChecklist(caseId, phase) {
      const items = WHO_LABELS[phase] || [];
      const body = {};
      let missing = [];
      for (const [key,label] of items) {
        const el = document.getElementById('chk_' + key);
        if (el && el.checked) body[key] = true;
        else missing.push(label);
      }
      if (missing.length) return alert('موارد تأیید نشده:\n• ' + missing.join('\n• '));
      try {
        await SURG._api('/api/or/schedule/' + caseId + '/checklist/' + phase, {
          method:'POST', body: JSON.stringify(body)
        });
        NABZ._toast('✅ ' + PHASE_FA[phase] + ' امضا شد');
        SURG._closeAll();
        SURG.viewCase(caseId);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async _startCase(id) {
      if (!confirm('شروع جراحی؟')) return;
      try {
        await SURG._api('/api/or/schedule/' + id + '/start', { method:'POST', body:'{}' });
        NABZ._toast('▶️ جراحی شروع شد');
        SURG._closeAll();
        SURG.viewCase(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async _endCase(id) {
      if (!confirm('پایان جراحی؟')) return;
      try {
        await SURG._api('/api/or/schedule/' + id + '/end', { method:'POST', body:'{}' });
        NABZ._toast('⏹ جراحی پایان یافت');
        SURG._closeAll();
        SURG.viewCase(id);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ PACU ═══
    async pacuAdmit(caseId) {
      let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🛏️ پذیرش در PACU</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>Aldrete Score (۰-۱۰، حداقل ۸ برای پذیرش)</label>';
      h += '<input type="number" id="aldrete" value="8" min="0" max="10" style="font-size:24px;text-align:center;font-weight:900"></div>';
      h += '<div class="hint info">Activity + Respiration + Circulation + Consciousness + O₂ Saturation</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px" onclick="NABZ.surg._submitPacuAdmit(\'' + caseId + '\')">✅ پذیرش</button>';
      SURG._closeAll();
      SURG._openSheet(h);
    },

    async _submitPacuAdmit(caseId) {
      const score = parseInt(document.getElementById('aldrete').value);
      if (isNaN(score) || score < 0 || score > 10) return alert('امتیاز نامعتبر');
      if (score < 8) return alert('Aldrete باید ≥ ۸ باشد');
      try {
        await SURG._api('/api/or/pacu/' + caseId + '/admit', {
          method:'POST', body: JSON.stringify({ aldreteScore: score })
        });
        NABZ._toast('✅ پذیرش PACU');
        SURG._closeAll();
        NABZ.show('surgical.pacu');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async viewPacu(pacuId) {
      try {
        const d = await SURG._api('/api/or/pacu');
        const p = (d.items||[]).find(x => x.id === pacuId);
        if (!p) return alert('PACU یافت نشد');
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🛏️ PACU — ' + SURG._esc(p.patientName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:12px;text-align:center">';
        h += '<div style="font-size:48px;font-weight:900;color:var(--' + (p.aldreteScore >= 9 ? 'ok' : 'warn') + ')">' + p.aldreteScore + '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2)">Aldrete Score</div>';
        h += '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">پذیرش: ' + SURG._time(p.admittedAt) + '</div>';
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">';
        if (p.aldreteScore < 9) h += '<div class="hint warn" style="flex:1">حداقل Aldrete ۹ برای ترخیص</div>';
        if (p.aldreteScore >= 9 && p.status === 'active') {
          h += '<button class="btn btn-ok" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.surg._dischargePacu(\'' + p.id + '\')">✅ ترخیص PACU</button>';
        }
        h += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        SURG._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async _dischargePacu(pacuId) {
      if (!confirm('ترخیص از PACU؟')) return;
      try {
        await SURG._api('/api/or/pacu/' + pacuId + '/discharge', { method:'POST', body:'{}' });
        NABZ._toast('✅ ترخیص شد');
        SURG._closeAll();
        NABZ.show('surgical.pacu');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ CSSD ═══
    async viewCSSDSet(setId) {
      try {
        const d = await SURG._api('/api/cssd/sets');
        const set = (d.items||[]).find(x => x.id === setId);
        if (!set) return alert('ست یافت نشد');
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🧼 ' + SURG._esc(set.setName) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:12px;color:var(--fg-2)">بخش: ' + SURG._esc(set.department) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:2px">' + set.itemCount + ' آیتم · روش: ' + SURG._esc(set.method) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2)">Indicator: Class ' + set.indicatorClass + '</div>';
        h += '</div>';
        const statusMap = { prepared:'آماده‌سازی', sterilizing:'در حال استریل', sterilized:'استریل', issued:'ارسال شده', recalled:'فراخوان' };
        h += '<div style="margin-bottom:12px"><span class="pill ' + (set.status === 'sterilized' ? 'ok' : set.status === 'issued' ? 'info' : set.status === 'recalled' ? 'dng' : 'warn') + '">' + (statusMap[set.status]||set.status) + '</span></div>';
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">';
        if (set.status === 'sterilized') {
          h += '<button class="btn btn-primary" style="flex:1;min-width:140px;padding:12px" onclick="NABZ.surg._issueSet(\'' + set.id + '\')">📤 ارسال</button>';
        }
        h += '<button class="btn" style="flex:1;min-width:100px;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        SURG._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async _issueSet(setId) {
      if (!confirm('ارسال ست؟')) return;
      try {
        await SURG._api('/api/cssd/sets/' + setId + '/issue', { method:'POST', body:'{}' });
        NABZ._toast('✅ ارسال شد');
        SURG._closeAll();
        NABZ.show('surgical.cssd_sets');
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async viewCycle(cycleId) {
      try {
        const d = await SURG._api('/api/cssd/cycles');
        const c = (d.items||[]).find(x => x.id === cycleId);
        if (!c) return alert('چرخه یافت نشد');
        let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">🔄 چرخه ' + SURG._esc(c.cycleNumber) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:12px">';
        h += '<div style="font-size:12px;color:var(--fg-2)">دستگاه: ' + SURG._esc(c.sterilizerCode) + ' · روش: ' + SURG._esc(c.method) + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2)">ست‌ها: ' + (c.setIds||[]).length + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2)">شروع: ' + SURG._date(c.startedAt) + '</div>';
        h += '</div>';
        h += '<div class="sec-hd" style="margin:12px 0 8px"><span>🧪 Indicators</span></div>';
        ['biological', 'chemical'].forEach(t => {
          const v = c.indicators?.[t] || 'pending';
          const label = t === 'biological' ? 'بیولوژیک' : 'شیمیایی';
          const cls = v === 'pass' ? 'ok' : v === 'fail' ? 'dng' : 'warn';
          const lfa = v === 'pass' ? 'قبول' : v === 'fail' ? 'رد' : 'در انتظار';
          h += '<div class="sur-indicator">';
          h += '<span>' + label + '</span>';
          h += '<span class="pill ' + cls + '">' + lfa + '</span>';
          if (v === 'pending' && c.status !== 'closed') {
            h += '<div style="display:flex;gap:4px;margin-top:6px">';
            h += '<button class="btn btn-ok btn-xs" style="padding:4px 10px;font-size:11px;flex:1" onclick="NABZ.surg._setIndicator(\'' + c.id + '\',\'' + t + '\',\'pass\')">✓ Pass</button>';
            h += '<button class="btn btn-dng btn-xs" style="padding:4px 10px;font-size:11px;flex:1" onclick="NABZ.surg._setIndicator(\'' + c.id + '\',\'' + t + '\',\'fail\')">✗ Fail</button>';
            h += '</div>';
          }
          h += '</div>';
        });
        h += '<button class="btn" style="width:100%;padding:12px;margin-top:14px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        SURG._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    async _setIndicator(cycleId, type, result) {
      if (!confirm('Indicator ' + type + ' = ' + result + '؟')) return;
      try {
        await SURG._api('/api/cssd/cycles/' + cycleId + '/indicator', {
          method:'POST', body: JSON.stringify({ type, result })
        });
        NABZ._toast('✅ ثبت شد');
        SURG._closeAll();
        SURG.viewCycle(cycleId);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══ Patient buttons ═══
    patientButtons(patientId) {
      return '<div style="margin-top:8px"><button class="btn btn-block" style="background:var(--violet-soft);color:var(--violet);border-color:var(--violet);padding:10px;font-size:12px" onclick="NABZ.surg.newCase(\'' + patientId + '\')">🔪 برنامه‌ریزی جراحی</button></div>';
    },

    // ═══ FAB helper ═══
    _fab(items) {
      let h = '<div class="rd-fab">';
      items.forEach(it => h += '<button class="rd-fab-btn" onclick="' + it[2] + '"><span>' + it[0] + '</span><span>' + it[1] + '</span></button>');
      h += '</div>';
      return h;
    }
  };

  // ═══ Bootstrap ═══
  let waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[sur-ui] timeout');
    setTimeout(() => ready(fn), 100);
  }

  ready(function() {
    NABZ.surg = SURG;

    // Wrap showItem (chain)
    const prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'surgical.rooms') return SURG.viewRoom(iid);
      if (pid === 'surgical.schedule') return SURG.viewCase(iid);
      if (pid === 'surgical.pacu') return SURG.viewPacu(iid);
      if (pid === 'surgical.cssd_sets') return SURG.viewCSSDSet(iid);
      if (pid === 'surgical.cssd_cycles') return SURG.viewCycle(iid);
      return prevShowItem.apply(NABZ, arguments);
    };

    // Wrap _docButtonsFor (chain)
    const prevDocBtns = NABZ._docButtonsFor;
    NABZ._docButtonsFor = function(pid, item) {
      const orig = prevDocBtns.apply(NABZ, arguments) || '';
      if (pid === 'clinical.patients' && item && item.id) return orig + SURG.patientButtons(item.id);
      return orig;
    };

    // FAB for rooms panel
    const fab = document.createElement('button');
    fab.id = 'surgFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(239,68,68,0.5);cursor:pointer;z-index:47;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);

    const FAB_MAP = {
      'surgical.schedule': { label: '➕ جراحی جدید', fn: () => SURG.newCase() },
      'surgical.rooms': { label: '➕ جراحی جدید', fn: () => SURG.newCase() }
    };
    function updateFab() {
      const pid = NABZ.state && NABZ.state.current;
      const cfg = pid && FAB_MAP[pid];
      if (!cfg) { fab.style.display = 'none'; return; }
      if (document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = cfg.label;
      fab.onclick = cfg.fn;
    }
    const content = document.getElementById('content');
    if (content) new MutationObserver(updateFab).observe(content, { childList:true, subtree:false });
    setInterval(updateFab, 500);

    console.log('[sur-ui] loaded ✓');
  });
})();
