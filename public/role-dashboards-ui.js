// ═══════════════════════════════════════════════════════════
//  NABZ — Role Dashboards UI
//  داشبورد اختصاصی برای هر نقش — wrap NABZ.showHome
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const ROLE_FA = {
    nurse:'پرستار', nurse_aide:'کمک‌پرستار', assistant_nurse:'کمک‌پرستار',
    head_nurse:'سرپرستار', resident:'رزیدنت', intern:'اینترن',
    attending:'استاد', specialist:'متخصص', surgeon:'جراح', physician:'پزشک',
    matron:'مترون', nursing_director:'مدیر پرستاری', medical_director:'مدیر پزشکی',
    supervisor:'سوپروایزر', clinical_supervisor:'سوپروایزر بالینی',
    pharmacist:'داروساز', lab_tech:'تکنسین آزمایشگاه',
    radiology_tech:'تکنسین تصویربرداری', receptionist:'پذیرش', admin:'مدیر سیستم'
  };
  const SHIFT_FA = { morning:'صبح', evening:'عصر', night:'شب' };

  const RD = {
    _api: p => NABZ._api(p),
    _esc: s => NABZ._esc(s),
    _time: iso => { try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },

    async show(dash) {
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const d = await RD._api('/api/rd/' + dash);
        if (d.error) return m.innerHTML = '<div class="empty">' + RD._esc(d.error === 'no_ward' ? d.message : d.error) + '</div>';
        const renderer = RD['render_' + dash] || RD.render_generic;
        m.innerHTML = renderer(d);
        document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
        const homeTab = document.querySelector('.bn-tab');
        if (homeTab) homeTab.classList.add('on');
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + RD._esc(e.message) + '</div>';
      }
    },

    _header(d, title) {
      const user = NABZ.state.user;
      const hour = new Date().getHours();
      const greeting = hour < 12 ? 'صبح بخیر' : hour < 18 ? 'ظهر بخیر' : 'عصر بخیر';
      const date = new Date().toLocaleDateString('fa-IR', { weekday:'long', day:'numeric', month:'long' });
      let h = '<div class="rd-header">';
      h += '<div class="rd-greeting">' + greeting + ' ' + RD._esc((user && user.fullName) || 'کاربر') + ' 👋</div>';
      h += '<div class="rd-sub">' + ROLE_FA[user.role] + ' · ' + RD._esc(title || d.ward || '') + ' · ' + date + '</div>';
      if (d.shift) h += '<span class="rd-shift-badge">' + SHIFT_FA[d.shift.code] + '</span>';
      h += '</div>';
      return h;
    },

    _statCard(value, label, color, onclick) {
      const cls = color ? ' rd-stat-' + color : '';
      const act = onclick ? ' onclick="' + onclick + '" style="cursor:pointer"' : '';
      return '<div class="rd-stat' + cls + '"' + act + '><div class="v">' + value + '</div><div class="l">' + label + '</div></div>';
    },

    _alertBox(icon, title, items, action) {
      if (!items || !items.length) return '';
      let h = '<div class="rd-alert-block">';
      h += '<div class="rd-alert-head"><span>' + icon + ' ' + title + '</span><span class="rd-alert-count">' + items.length + '</span></div>';
      items.forEach(it => { h += '<div class="rd-alert-item" onclick="' + (it.onclick || '') + '">' + it.html + '</div>'; });
      h += '</div>';
      return h;
    },

    // ═══ NURSE ═══
    render_nurse(d) {
      const s = d.stats;
      let h = RD._header(d);
      if (s.criticalVitals || s.criticalLabs || s.missedMar) {
        let alerts = [];
        if (d.criticalVitals.length) {
          d.criticalVitals.forEach(v => alerts.push({
            html: '<b>' + RD._esc(v.patientName) + '</b> — NEWS2 ' + v.news2 + ' <span class="rd-time">' + RD._time(v.recordedAt) + '</span>',
            onclick: ''
          }));
        }
        if (d.criticalLabs.length) {
          d.criticalLabs.forEach(l => alerts.push({
            html: '🧪 <b>' + RD._esc(l.patientName) + '</b> — ' + RD._esc(l.panel) + ' بحرانی',
            onclick: 'NABZ.cw&&NABZ.cw.viewLab&&NABZ.cw.viewLab(\'' + l.id + '\')'
          }));
        }
        if (s.missedMar) alerts.push({ html: '💊 <b>' + s.missedMar + ' دوز missed</b> در بخش', onclick: 'NABZ.show(\'clinical.mar\')' });
        h += RD._alertBox('🚨', 'بحرانی — توجه فوری', alerts);
      }
      h += '<div class="rd-stats">';
      h += RD._statCard(s.totalPatients, 'بیمار بخش', 'ok', 'NABZ.show(\'clinical.patients\')');
      h += RD._statCard(s.marDue, 'MAR دیرکرد', s.marDue > 0 ? 'warn' : '', 'NABZ.show(\'clinical.mar\')');
      h += RD._statCard(s.pendingOrders, 'دستور تأییدنشده', s.pendingOrders > 0 ? 'warn' : '', 'NABZ.show(\'clinical.kardex\')');
      h += RD._statCard(s.consultsReady, 'مشاوره پاسخ‌داده', s.consultsReady > 0 ? 'info' : '', 'NABZ.show(\'workflow.consult\')');
      h += '</div>';
      
      if (d.marDue.length) {
        h += '<div class="sec-hd"><span>⏰ MAR نزدیک</span><span class="rd-mini">' + d.marDue.length + '</span></div>';
        d.marDue.forEach(m => {
          const cls = m.isHighAlert ? 'hi' : '';
          h += '<div class="row ' + cls + '" onclick="NABZ.show(\'clinical.mar\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(m.drugName) + ' — ' + RD._esc(m.dose) + '</div>';
          h += '<span class="pill ' + (m.isHighAlert ? 'dng' : 'info') + '">' + RD._time(m.scheduledAt) + '</span></div>';
          h += '<div class="row-meta">' + RD._esc(m.patientName) + ' · ' + RD._esc(m.route || '') + (m.isHighAlert ? ' · ⚠️ پرخطر' : '') + '</div>';
          h += '</div>';
        });
      }
      
      h += '<div class="sec-hd"><span>📋 بیماران بخش</span><span class="rd-mini">' + d.patients.length + '</span></div>';
      d.patients.forEach(p => {
        const lvl = p.news2 >= 7 ? 'hi' : p.news2 >= 5 ? 'md' : 'lo';
        const newsCls = p.news2 >= 7 ? 'dng' : p.news2 >= 5 ? 'warn' : 'ok';
        h += '<div class="row ' + lvl + '" onclick="NABZ.showItem(\'clinical.patients\',\'' + p.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + RD._esc(p.name) + '</div>';
        h += '<span class="pill ' + newsCls + '">NEWS2 ' + p.news2 + '</span></div>';
        h += '<div class="row-meta">تخت ' + RD._esc(p.bed) + ' · ' + (p.age || '—') + ' سال · ' + RD._esc(p.diagnosis || '') + (p.marDue ? ' · 💊' + p.marDue : '') + '</div>';
        if (p.allergies.length) h += '<div class="row-meta" style="color:var(--dng);font-weight:800">⚠️ ' + RD._esc(p.allergies.join('، ')) + '</div>';
        h += '</div>';
      });
      
      h += RD._fab([['📝','ثبت ویتال','NABZ.show(\'clinical.vitals\')'],['💊','MAR','NABZ.show(\'clinical.mar\')'],['📞','تحویل شیفت','NABZ.show(\'workflow.handover\')']]);
      return h;
    },

    // ═══ HEAD NURSE ═══
    render_head_nurse(d) {
      const s = d.stats;
      let h = RD._header(d);
      if (s.staffAbsent > 0 || s.incidents > 0 || s.pendingRequests > 0) {
        let alerts = [];
        if (s.staffAbsent > 0) alerts.push({ html: '<b>' + s.staffAbsent + ' نفر</b> در شیفت حاضر نیستند', onclick: 'NABZ.show(\'ops.attendance\')' });
        if (s.pendingRequests > 0) alerts.push({ html: '<b>' + s.pendingRequests + ' درخواست</b> در انتظار تأیید', onclick: 'NABZ.show(\'shift_assistant.dashboard\')' });
        if (s.incidents > 0) alerts.push({ html: '<b>' + s.incidents + ' حادثه</b> امروز', onclick: 'NABZ.show(\'safety.incidents\')' });
        h += RD._alertBox('⚠️', 'نیاز به توجه', alerts);
      }
      h += '<div class="rd-stats">';
      h += RD._statCard(s.staffPresent + '/' + s.staffTotal, 'حاضر / کل', 'ok', 'NABZ.show(\'ops.attendance\')');
      h += RD._statCard(s.marCompliance + '%', 'MAR compliance', s.marCompliance >= 95 ? 'ok' : s.marCompliance >= 80 ? 'warn' : 'dng', 'NABZ.show(\'clinical.mar\')');
      h += RD._statCard(s.patients, 'بیمار بخش', '', 'NABZ.show(\'clinical.patients\')');
      h += RD._statCard(s.bedOccupancy + '%', 'اشغال تخت', s.bedOccupancy >= 95 ? 'dng' : s.bedOccupancy >= 80 ? 'warn' : 'ok', 'NABZ.show(\'bedboard.wards\')');
      h += '</div>';
      if (d.pendingRequests.length) {
        h += '<div class="sec-hd"><span>📥 درخواست‌های در انتظار</span><span class="rd-mini">' + d.pendingRequests.length + '</span></div>';
        d.pendingRequests.forEach(p => {
          h += '<div class="row md" onclick="NABZ.show(\'shift_assistant.dashboard\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(p.date) + '</div>';
          h += '<span class="pill warn">' + RD._esc(p.requestType) + '</span></div>';
          h += '</div>';
        });
      }
      h += '<div class="sec-hd"><span>👥 پرسنل شیفت</span></div>';
      const presentStaff = d.staff.filter(s => s.state === 'checked_in');
      const absentStaff = d.staff.filter(s => s.state === 'absent');
      presentStaff.slice(0,10).forEach(s => {
        h += '<div class="row lo" style="padding:8px 12px"><div class="row-hd"><div class="row-title" style="font-size:13px">' + RD._esc(s.name) + '</div><span class="pill ok">حاضر</span></div>';
        if (s.checkInAt) h += '<div class="row-meta">' + RD._time(s.checkInAt) + '</div>';
        h += '</div>';
      });
      if (absentStaff.length) {
        h += '<div class="rd-mini-title">غایبین (' + absentStaff.length + ')</div>';
        absentStaff.slice(0,5).forEach(s => {
          h += '<div class="row hi" style="padding:6px 12px"><div class="row-hd"><div class="row-title" style="font-size:12px">' + RD._esc(s.name) + '</div><span class="pill dng">غایب</span></div></div>';
        });
      }
      h += RD._fab([['📊','چیدمان','NABZ.sa&&NABZ.sa.go(\'roster\')'],['📥','درخواست‌ها','NABZ.show(\'shift_assistant.dashboard\')'],['👥','پرسنل','NABZ.show(\'ops.staff\')']]);
      return h;
    },

    // ═══ RESIDENT ═══
    render_resident(d) {
      const s = d.stats;
      let h = RD._header(d);
      if (s.myDrafts || s.myPendingCosign || s.criticalLabs) {
        let alerts = [];
        if (s.myDrafts > 0) alerts.push({ html: '<b>' + s.myDrafts + ' راند پیش‌نویس</b> — امضا کنید', onclick: 'NABZ.show(\'encounters.rounds\')' });
        if (s.criticalLabs > 0) alerts.push({ html: '<b>' + s.criticalLabs + ' آزمایش بحرانی</b>', onclick: 'NABZ.show(\'paraclinical.labs\')' });
        h += RD._alertBox('📝', 'کارهای شما', alerts);
      }
      h += '<div class="rd-stats">';
      h += RD._statCard(s.myDrafts, 'راند پیش‌نویس', s.myDrafts ? 'warn' : '', 'NABZ.show(\'encounters.rounds\')');
      h += RD._statCard(s.myPendingCosign, 'منتظر استاد', s.myPendingCosign ? 'info' : '', 'NABZ.show(\'encounters.rounds\')');
      h += RD._statCard(s.newAdmissions, 'پذیرش جدید', s.newAdmissions ? 'dng' : '', 'NABZ.show(\'clinical.patients\')');
      h += RD._statCard(s.wardConsults, 'مشاوره بخش', s.wardConsults ? 'warn' : '', 'NABZ.show(\'workflow.consult\')');
      h += '</div>';
      if (d.newAdmissions.length) {
        h += '<div class="sec-hd"><span>👤 پذیرش‌های جدید ۲۴ ساعت</span></div>';
        d.newAdmissions.forEach(p => {
          h += '<div class="row hi" onclick="NABZ.showItem(\'clinical.patients\',\'' + p.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(p.name) + '</div><span class="pill info">تخت ' + RD._esc(p.bed) + '</span></div>';
          h += '<div class="row-meta">' + RD._esc(p.diagnosis || '') + ' · ' + RD._time(p.admittedAt) + '</div>';
          h += '</div>';
        });
      }
      if (d.wardConsults.length) {
        h += '<div class="sec-hd"><span>🩺 مشاوره‌های بخش</span></div>';
        d.wardConsults.forEach(c => {
          h += '<div class="row md" onclick="NABZ.wf&&NABZ.wf.viewConsult&&NABZ.wf.viewConsult(\'' + c.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(c.patientName) + '</div>';
          h += '<span class="pill ' + (c.type === 'emergency' ? 'dng' : c.type === 'urgent' ? 'warn' : 'info') + '">' + RD._esc(c.type) + '</span></div>';
          h += '<div class="row-meta">' + RD._esc(c.service) + ' — ' + RD._esc((c.question || '').slice(0,60)) + '</div>';
          h += '</div>';
        });
      }
      h += RD._fab([['🩺','راند جدید','NABZ.enc&&NABZ.enc.newRound()'],['📋','بیماران','NABZ.show(\'clinical.patients\')'],['🧪','آزمایشگاه','NABZ.show(\'paraclinical.labs\')']]);
      return h;
    },

    // ═══ ATTENDING ═══
    render_attending(d) {
      const s = d.stats;
      let h = RD._header(d);
      const totalApprovals = s.pendingCosign + s.pendingConsultApproval + s.pendingDischarge;
      if (totalApprovals > 0) {
        let alerts = [];
        if (s.pendingCosign > 0) alerts.push({ html: '<b>' + s.pendingCosign + ' راند</b> منتظر تأیید شما', onclick: 'NABZ.show(\'encounters.pending_cosign\')' });
        if (s.pendingConsultApproval > 0) alerts.push({ html: '<b>' + s.pendingConsultApproval + ' مشاوره</b> منتظر تأیید', onclick: 'NABZ.show(\'workflow.consult\')' });
        if (s.pendingDischarge > 0) alerts.push({ html: '<b>' + s.pendingDischarge + ' خلاصه ترخیص</b> منتظر تأیید', onclick: 'NABZ.show(\'workflow.discharge\')' });
        h += RD._alertBox('🔴', 'منتظر تأیید شما — ' + totalApprovals, alerts);
      }
      h += '<div class="rd-stats">';
      h += RD._statCard(s.pendingCosign, 'راند cosign', s.pendingCosign ? 'dng' : 'ok', 'NABZ.show(\'encounters.pending_cosign\')');
      h += RD._statCard(s.pendingConsultApproval, 'مشاوره', s.pendingConsultApproval ? 'warn' : 'ok', 'NABZ.show(\'workflow.consult\')');
      h += RD._statCard(s.wardCensus, 'بیماران بخش', '', 'NABZ.show(\'clinical.patients\')');
      h += RD._statCard(s.teamSize, 'تیم', '', 'NABZ.show(\'ops.staff\')');
      h += '</div>';
      if (d.pendingCosign.length) {
        h += '<div class="sec-hd"><span>✍️ راند منتظر تأیید</span></div>';
        d.pendingCosign.forEach(r => {
          h += '<div class="row hi" onclick="NABZ.enc&&NABZ.enc.openRound&&NABZ.enc.openRound(\'' + r.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(r.patientName) + '</div>';
          h += '<span class="pill dng">' + RD._time(r.signedAt) + '</span></div>';
          h += '<div class="row-meta">' + RD._esc(r.signedByName) + ' — ' + RD._esc(r.chiefComplaint || '') + '</div>';
          h += '</div>';
        });
      }
      if (d.pendingConsultApproval.length) {
        h += '<div class="sec-hd"><span>🩺 مشاوره منتظر تأیید</span></div>';
        d.pendingConsultApproval.forEach(c => {
          h += '<div class="row md" onclick="NABZ.wf&&NABZ.wf.viewConsult&&NABZ.wf.viewConsult(\'' + c.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(c.patientName) + '</div>';
          h += '<span class="pill warn">' + RD._esc(c.service) + '</span></div>';
          h += '</div>';
        });
      }
      if (d.pendingDischarge.length) {
        h += '<div class="sec-hd"><span>🚪 ترخیص منتظر تأیید</span></div>';
        d.pendingDischarge.forEach(x => {
          h += '<div class="row md" onclick="NABZ.wf&&NABZ.wf.viewDischarge&&NABZ.wf.viewDischarge(\'' + x.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(x.patientName) + '</div></div>';
          h += '</div>';
        });
      }
      h += RD._fab([['✍️','cosign','NABZ.show(\'encounters.pending_cosign\')'],['👥','بیماران','NABZ.show(\'clinical.patients\')'],['📊','عدالت','NABZ.show(\'analytics\')']]);
      return h;
    },

    // ═══ MATRON ═══
    render_matron(d) {
      const s = d.stats;
      let h = RD._header(d);
      const alerts = [];
      d.alerts.codes.forEach(c => alerts.push({ html: '🚨 <b>' + RD._esc(c.label) + '</b> — ' + RD._esc(c.patientName), onclick: 'NABZ.em&&NABZ.em.viewCode&&NABZ.em.viewCode(\'' + c.id + '\')' }));
      d.alerts.mci.forEach(m => alerts.push({ html: '🌐 <b>MCI</b> ' + RD._esc(m.type) + ' — ' + RD._esc(m.level), onclick: 'NABZ.em&&NABZ.em.viewMCI&&NABZ.em.viewMCI(\'' + m.id + '\')' }));
      d.alerts.crisis.forEach(c => alerts.push({ html: '🔥 <b>' + RD._esc(c.label) + '</b> — ' + RD._esc(c.reason), onclick: 'NABZ.show(\'crisis.active\')' }));
      if (alerts.length) h += RD._alertBox('🚨', 'حوادث فعال', alerts);
      
      h += '<div class="rd-stats">';
      h += RD._statCard(s.wards, 'بخش', 'ok', 'NABZ.show(\'shift_assistant.dashboard\')');
      h += RD._statCard(s.totalPatients, 'بیماران', '', 'NABZ.show(\'bedboard.wards\')');
      h += RD._statCard(s.occupancy + '%', 'اشغال', s.occupancy >= 90 ? 'dng' : s.occupancy >= 75 ? 'warn' : 'ok', 'NABZ.show(\'bedboard.wards\')');
      h += RD._statCard(s.pendingSupervisorRequests, 'درخواست سوپروایزر', s.pendingSupervisorRequests ? 'warn' : '', 'NABZ.show(\'shift_assistant.dashboard\')');
      h += '</div>';
      
      h += '<div class="sec-hd"><span>🏥 بخش‌ها</span></div>';
      const sorted = d.wards.slice().sort((a,b) => b.assignedToday - a.assignedToday);
      sorted.slice(0, 12).forEach(w => {
        const cls = w.assignedToday === 0 ? 'hi' : w.assignedToday < 3 ? 'md' : 'lo';
        h += '<div class="row ' + cls + '">';
        h += '<div class="row-hd"><div class="row-title">' + RD._esc(w.label) + '</div>';
        h += '<span class="pill ' + (w.assignedToday === 0 ? 'dng' : w.assignedToday < 3 ? 'warn' : 'ok') + '">' + w.assignedToday + ' شیفت</span></div>';
        h += '<div class="row-meta">' + RD._esc(w.headNurse || '—') + ' · ' + w.staffCount + ' پرسنل</div>';
        h += '</div>';
      });
      h += RD._fab([['🏥','بخش‌ها','NABZ.show(\'shift_assistant.dashboard\')'],['📊','عدالت','NABZ.show(\'shift_assistant.dashboard\')'],['🚨','حوادث','NABZ.show(\'safety.incidents\')']]);
      return h;
    },

    // ═══ SUPERVISOR ═══
    render_supervisor(d) {
      const s = d.stats;
      let h = RD._header(d);
      const alerts = [];
      d.alerts.codes.forEach(c => alerts.push({ html: '🚨 <b>' + RD._esc(c.label) + '</b> — ' + RD._esc(c.patientName), onclick: 'NABZ.em&&NABZ.em.viewCode&&NABZ.em.viewCode(\'' + c.id + '\')' }));
      d.alerts.mci.forEach(m => alerts.push({ html: '🌐 <b>MCI</b> ' + RD._esc(m.type), onclick: 'NABZ.em&&NABZ.em.viewMCI&&NABZ.em.viewMCI(\'' + m.id + '\')' }));
      d.alerts.crisis.forEach(c => alerts.push({ html: '🔥 <b>' + RD._esc(c.label) + '</b>', onclick: 'NABZ.show(\'crisis.active\')' }));
      if (alerts.length) h += RD._alertBox('🚨', 'حوادث فعال', alerts);
      
      h += '<div class="rd-stats">';
      h += RD._statCard(s.patients, 'بیماران', '', 'NABZ.show(\'bedboard.wards\')');
      h += RD._statCard(s.present, 'حاضر', 'ok', 'NABZ.show(\'ops.attendance\')');
      h += RD._statCard(s.bedsOccupied + '/' + s.bedsTotal, 'تخت', '', 'NABZ.show(\'bedboard.wards\')');
      h += RD._statCard(s.activeCodes + s.activeMCI + s.activeCrisis, 'حوادث', (s.activeCodes+s.activeMCI+s.activeCrisis) ? 'dng' : 'ok', '');
      h += '</div>';
      
      if (d.recentEvents.length) {
        h += '<div class="sec-hd"><span>📡 رویدادهای زنده — ۱ ساعت اخیر</span></div>';
        d.recentEvents.forEach(e => {
          h += '<div class="row lo" style="padding:8px 12px"><div class="row-hd">';
          h += '<div class="row-title" style="font-size:12px">' + RD._esc(e.event) + '</div>';
          h += '<span class="rd-mini">' + RD._time(e.at) + '</span></div>';
          if (e.actor) h += '<div class="row-meta">' + RD._esc(e.actor) + '</div>';
          h += '</div>';
        });
      }
      h += RD._fab([['🚨','کد جدید','NABZ.em&&NABZ.em.activateCode()'],['🔄','انتقال','NABZ.show(\'workflow.transfer\')'],['📊','بخش‌ها','NABZ.show(\'bedboard.wards\')']]);
      return h;
    },

    // ═══ PHARMACIST ═══
    render_pharmacist(d) {
      const s = d.stats;
      let h = RD._header(d);
      if (s.interactionAlerts) {
        h += RD._alertBox('⚠️', 'تداخل دارویی', d.interactionAlerts.map(a => ({
          html: '<b>' + RD._esc(a.patientName) + '</b> — ' + RD._esc(a.drug) + ' + ' + RD._esc(a.other),
          onclick: 'NABZ.show(\'cdss.alerts\')'
        })));
      }
      h += '<div class="rd-stats">';
      h += RD._statCard(s.pendingVerify, 'منتظر تأیید', s.pendingVerify ? 'warn' : '', 'NABZ.show(\'paraclinical.dispenses\')');
      h += RD._statCard(s.readyToDispense, 'آماده تحویل', s.readyToDispense ? 'info' : '', 'NABZ.show(\'paraclinical.dispenses\')');
      h += RD._statCard(s.interactionAlerts, 'تداخل دارویی', s.interactionAlerts ? 'dng' : 'ok', '');
      h += '</div>';
      if (d.pendingVerify.length) {
        h += '<div class="sec-hd"><span>⏳ منتظر تأیید</span></div>';
        d.pendingVerify.slice(0,10).forEach(x => {
          h += '<div class="row md"><div class="row-hd"><div class="row-title">' + RD._esc(x.drugName) + ' — ' + RD._esc(x.dose) + '</div><span class="pill warn">' + RD._esc(x.patientName) + '</span></div></div>';
        });
      }
      h += RD._fab([['💊','داروخانه','NABZ.show(\'paraclinical.dispenses\')']]);
      return h;
    },

    // ═══ LAB TECH ═══
    render_lab_tech(d) {
      const s = d.stats;
      let h = RD._header(d);
      if (s.criticals) {
        h += RD._alertBox('🚨', 'نتایج بحرانی — اطلاع پزشک', d.criticals.map(c => ({
          html: '<b>' + RD._esc(c.patientName) + '</b> — ' + RD._esc(c.panel) + ' (' + c.flags.length + ' مقدار)',
          onclick: 'NABZ.cw&&NABZ.cw.viewLab&&NABZ.cw.viewLab(\'' + c.id + '\')'
        })));
      }
      h += '<div class="rd-stats">';
      h += RD._statCard(s.awaitingResult, 'منتظر ورود نتیجه', s.awaitingResult ? 'warn' : '', 'NABZ.show(\'paraclinical.labs\')');
      h += RD._statCard(s.awaitingVerify, 'منتظر تأیید', s.awaitingVerify ? 'info' : '', 'NABZ.show(\'paraclinical.labs\')');
      h += RD._statCard(s.criticals, 'بحرانی', s.criticals ? 'dng' : 'ok', '');
      h += '</div>';
      if (d.awaitingResult.length) {
        h += '<div class="sec-hd"><span>🧪 نمونه‌های آماده</span></div>';
        d.awaitingResult.slice(0,10).forEach(l => {
          h += '<div class="row ' + (l.priority === 'stat' ? 'hi' : 'md') + '" onclick="NABZ.cw&&NABZ.cw.enterLabResult&&NABZ.cw.enterLabResult(\'' + l.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(l.panel) + ' — ' + RD._esc(l.patientName) + '</div>';
          h += '<span class="pill ' + (l.priority === 'stat' ? 'dng' : 'info') + '">' + RD._esc(l.priority) + '</span></div></div>';
        });
      }
      h += RD._fab([['🧪','آزمایشگاه','NABZ.show(\'paraclinical.labs\')']]);
      return h;
    },

    // ═══ RADIOLOGY ═══
    render_radiology_tech(d) {
      const s = d.stats;
      let h = RD._header(d);
      h += '<div class="rd-stats">';
      h += RD._statCard(s.awaitingReport, 'منتظر گزارش', s.awaitingReport ? 'warn' : '', 'NABZ.show(\'paraclinical.radiology\')');
      h += RD._statCard(s.awaitingVerify, 'منتظر تأیید', s.awaitingVerify ? 'info' : '', 'NABZ.show(\'paraclinical.radiology\')');
      h += RD._statCard(s.criticals, 'بحرانی', s.criticals ? 'dng' : 'ok', '');
      h += '</div>';
      if (d.awaitingReport.length) {
        h += '<div class="sec-hd"><span>🩻 منتظر گزارش</span></div>';
        d.awaitingReport.slice(0,10).forEach(r => {
          h += '<div class="row ' + (r.priority === 'stat' ? 'hi' : 'md') + '" onclick="NABZ.cw&&NABZ.cw.enterImagingReport&&NABZ.cw.enterImagingReport(\'' + r.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(r.modality) + ' ' + RD._esc(r.bodyPart) + ' — ' + RD._esc(r.patientName) + '</div>';
          h += '<span class="pill ' + (r.priority === 'stat' ? 'dng' : 'info') + '">' + RD._esc(r.priority) + '</span></div></div>';
        });
      }
      h += RD._fab([['🩻','تصویربرداری','NABZ.show(\'paraclinical.radiology\')']]);
      return h;
    },

    // ═══ RECEPTIONIST ═══
    render_receptionist(d) {
      const s = d.stats;
      let h = RD._header(d);
      h += '<div class="rd-stats">';
      h += RD._statCard(s.availableBeds, 'تخت آزاد', s.availableBeds ? 'ok' : 'dng', 'NABZ.show(\'bedboard.wards\')');
      h += RD._statCard(s.recentAdmissions, 'پذیرش ۲۴ ساعت', '', 'NABZ.show(\'clinical.patients\')');
      h += RD._statCard(s.waitingED, 'منتظر تریاژ', s.waitingED ? 'warn' : '', 'NABZ.show(\'emergency.ed\')');
      h += '</div>';
      if (d.waitingED.length) {
        h += '<div class="sec-hd"><span>⏳ منتظر تریاژ</span></div>';
        d.waitingED.slice(0,10).forEach(v => {
          h += '<div class="row md" onclick="NABZ.em&&NABZ.em.viewED&&NABZ.em.viewED(\'' + v.id + '\')">';
          h += '<div class="row-hd"><div class="row-title">' + RD._esc(v.patientName) + '</div><span class="pill warn">' + RD._time(v.arrivalAt) + '</span></div>';
          h += '<div class="row-meta">' + RD._esc(v.chiefComplaint) + '</div></div>';
        });
      }
      h += RD._fab([['👤','پذیرش','NABZ.show(\'clinical.patients\')'],['🛏️','تخت','NABZ.show(\'bedboard.wards\')']]);
      return h;
    },

    // ═══ ADMIN ═══
    render_admin(d) {
      const s = d.stats;
      let h = RD._header(d);
      h += '<div class="rd-stats">';
      h += RD._statCard(s.users, 'کاربران', '', 'NABZ.show(\'admin.users\')');
      h += RD._statCard(s.patients, 'بیماران', 'ok', 'NABZ.show(\'clinical.patients\')');
      h += RD._statCard(s.uptimeMin + 'm', 'Uptime', 'ok', 'NABZ.show(\'ops2.health\')');
      h += RD._statCard(s.memoryMB + 'MB', 'RAM', s.memoryMB > 300 ? 'warn' : 'ok', 'NABZ.show(\'ops2.health\')');
      h += '</div>';
      if (d.recentAudit.length) {
        h += '<div class="sec-hd"><span>📋 Audit اخیر</span></div>';
        d.recentAudit.forEach(a => {
          h += '<div class="row lo" style="padding:6px 10px"><div class="row-hd"><div class="row-title" style="font-size:12px">' + RD._esc(a.module) + '.' + RD._esc(a.action) + '</div>';
          h += '<span class="rd-mini">' + RD._time(a.at) + '</span></div>';
          h += '<div class="row-meta">' + RD._esc(a.actorName) + '</div></div>';
        });
      }
      h += RD._fab([['💚','سلامت','NABZ.show(\'ops2.health\')'],['👥','کاربران','NABZ.show(\'admin.users\')'],['📋','Audit','NABZ.show(\'ops2.audit\')']]);
      return h;
    },

    // ═══ Generic fallback ═══
    render_generic(d) {
      let h = RD._header(d, 'داشبورد');
      h += '<div class="empty">برای نقش شما داشبورد اختصاصی تعریف نشده — از منو استفاده کنید</div>';
      return h;
    },

    // ═══ FAB ═══
    _fab(items) {
      let h = '<div class="rd-fab">';
      items.forEach((it, i) => {
        h += '<button class="rd-fab-btn" onclick="' + it[2] + '"><span>' + it[0] + '</span><span>' + it[1] + '</span></button>';
      });
      h += '</div>';
      return h;
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[rd-ui] timeout');
    setTimeout(() => ready(fn), 100);
  }

  ready(function() {
    NABZ.rd = RD;
    const origShowHome = NABZ.showHome;
    NABZ.showHome = async function() {
      if (!NABZ.state.user) return origShowHome.call(NABZ);
      try {
        const r = await NABZ._api('/api/rd/router');
        if (r && r.dashboard && r.dashboard !== 'generic') {
          return RD.show(r.dashboard);
        }
      } catch (e) { /* fall through */ }
      return origShowHome.call(NABZ);
    };
    console.log('[rd-ui] loaded ✓ — role dashboards');
  });
})();
