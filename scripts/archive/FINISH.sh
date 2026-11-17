#!/data/data/com.termux/files/usr/bin/bash
set -e
[ ! -f core/server.js ] && { echo "❌ از ریشهٔ پروژه"; exit 1; }

echo "🏁 NABZ — نصب نهایی فرانت shift_assistant"
echo ""

# ═══════════════════════════════════════════════════════════
#  public/sa.js
# ═══════════════════════════════════════════════════════════
cat > public/sa.js << 'EOF_SA'
// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Frontend UI
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const WEEKDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const SHIFT_FA = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴ساعته' };
  const SHIFT_ICON = { M:'🌅', E:'🌆', N:'🌙', L:'📏', EN:'🌗', H24:'⏰' };
  const SHIFT_BG = { M:'rgba(59,130,246,0.15)', E:'rgba(245,158,11,0.15)', N:'rgba(139,92,246,0.15)', L:'rgba(16,185,129,0.15)', EN:'rgba(168,85,247,0.15)', H24:'rgba(239,68,68,0.15)' };
  const SHIFT_FG = { M:'#3b82f6', E:'#f59e0b', N:'#8b5cf6', L:'#10b981', EN:'#a855f7', H24:'#ef4444' };
  const REQ_FA = { MORNING:'صبح', EVENING:'عصر', NIGHT:'شب', LONG:'لانگ', EVENING_NIGHT:'عصر+شب', H24:'۲۴ساعته', LEAVE:'مرخصی', SICK:'استعلاجی', HALF_M:'نیم‌روز صبح', HALF_E:'نیم‌روز عصر', REST:'استراحت' };
  const REQ_ICON = { MORNING:'🌅', EVENING:'🌆', NIGHT:'🌙', LONG:'📏', EVENING_NIGHT:'🌗', H24:'⏰', LEAVE:'🏖️', SICK:'🤒', HALF_M:'🌅', HALF_E:'🌆', REST:'💤' };
  const ATT_FA = { scheduled:'در انتظار', checked_in:'حاضر', checked_out:'پایان', late:'تأخیر', absent:'غیبت' };
  const ATT_CLS = { scheduled:'info', checked_in:'ok', checked_out:'info', late:'warn', absent:'dng' };
  const CAT_FA = { matron:'مترون', supervisor:'سوپروایزر', clinical_supervisor:'سوپروایزر بالینی', head_nurse:'سرپرستار', rn:'پرستار', support:'کمک‌پرستار', beh_yar:'بهیار', anesthesia:'هوشبری', or_tech:'اتاق عمل', or_specialist:'کارشناس اتاق عمل', midwife:'ماما', ecg:'نوارنگار', secretary:'منشی', patient_care:'بیماریار', wound_specialist:'کارشناس زخم', assistant:'کمک‌بهیار' };

  const Sa = {
    ui: { section:'home', wardId:null, rosterTab:'solve', reqBuffer:[] },
    _cache: { wards: null, period: null },

    _api(p, o) { return NABZ._api(p, o); },
    _esc(s) { return NABZ._esc(s); },
    _fmt(n) { return new Intl.NumberFormat('fa-IR').format(Math.round(n||0)); },
    _pad(n) { return String(n).padStart(2,'0'); },

    async _getPeriod() {
      if (this._cache.period) return this._cache.period;
      try { const p = await this._api('/api/sa/period'); this._cache.period = p; return p; }
      catch (e) { return null; }
    },
    _invalidate() { this._cache = { wards: null, period: null }; },

    // ═══ MANAGER DASHBOARD ═══
    async showDashboard(p, d) {
      const m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        try { d = await this._api('/api/sa/wards'); }
        catch (e) { m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>'; return; }
      }
      this._cache.wards = d;
      await this._render();
    },

    async _render() {
      const m = document.getElementById('content');
      const section = this.ui.section || 'home';
      try {
        let html = '';
        if (section === 'wards') html = await this._wards();
        else if (section === 'ward_detail') html = await this._wardDetail();
        else if (section === 'attendance') html = await this._attendance();
        else if (section === 'requests') html = await this._requests();
        else if (section === 'fairness') html = await this._fairnessList();
        else if (section === 'payroll') html = await this._payroll();
        else if (section === 'audit') html = await this._audit();
        else html = await this._home();
        m.innerHTML = html;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    async _home() {
      const period = await this._getPeriod();
      const wards = (this._cache.wards || {}).items || [];
      const active = wards.filter(w => !w.isManagement);
      const totalStaff = wards.reduce((s,w) => s + (w.staffCount||0), 0);
      const avgCov = active.length ? Math.round(active.reduce((s,w)=>s+w.coverage,0)/active.length) : 0;
      const totalShort = wards.reduce((s,w)=>s+(w.shortages||0),0);

      let h = '<div class="sec-hd"><span>🏥 دستیار شیفت</span>';
      if (period) h += '<span style="font-size:11px;color:var(--fg-2)">' + MONTHS[period.jm-1] + ' ' + period.jy + '</span>';
      h += '</div>';

      h += '<div class="grid-4" style="margin-bottom:16px">';
      h += '<div class="stat"><div class="v">' + active.length + '</div><div class="l">بخش</div></div>';
      h += '<div class="stat"><div class="v">' + totalStaff + '</div><div class="l">پرسنل</div></div>';
      h += '<div class="stat ' + (avgCov>=95?'ok':avgCov>=80?'warn':'dng') + '"><div class="v">' + avgCov + '%</div><div class="l">پوشش</div></div>';
      h += '<div class="stat ' + (totalShort===0?'ok':'dng') + '"><div class="v">' + totalShort + '</div><div class="l">کمبود</div></div>';
      h += '</div>';

      h += '<div class="sec-hd"><span>⚡ اقدامات</span></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">';
      const acts = [['wards','📋','بخش‌ها'],['attendance','📍','حضور امروز'],['requests','📥','درخواست‌ها'],['fairness','📊','عدالت']];
      for (const [k, ico, lbl] of acts) {
        h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.sa.go(\'' + k + '\')"><span style="font-size:20px">' + ico + '</span><span style="font-size:11px;font-weight:800">' + lbl + '</span></button>';
      }
      h += '</div>';

      const critical = active.filter(w => w.coverage < 85 || w.shortages > 0).slice(0, 5);
      if (critical.length) {
        h += '<div class="sec-hd"><span>⚠️ نیاز به توجه</span></div>';
        for (const w of critical) {
          const cls = w.coverage >= 95 ? 'ok' : w.coverage >= 80 ? 'warn' : 'dng';
          h += '<div class="row ' + (cls==='dng'?'hi':cls==='warn'?'md':'') + '" onclick="NABZ.sa.openWard(' + w.id + ')">';
          h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + w.coverage + '%</span></div>';
          h += '<div class="row-meta">' + w.staffCount + ' پرسنل · ' + (w.headNurse||'—') + (w.shortages>0?' · ⚠️ '+w.shortages+' کمبود':'') + '</div></div>';
        }
      }

      h += '<div class="sec-hd"><span>🚀 تولید همه بخش‌ها</span></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:16px;font-size:14px" onclick="NABZ.sa.solveAll()">⚡ حل یکجا</button>';
      return h;
    },

    go(section) { this.ui.section = section; this._render(); window.scrollTo({top:0,behavior:'smooth'}); },

    async _wards() {
      const wards = (this._cache.wards || {}).items || [];
      const groups = { critical:[], surgical:[], internal:[], neuro:[], special:[], er:[], mgmt:[] };
      for (const w of wards) {
        if (w.isManagement) groups.mgmt.push(w);
        else if (w.code.startsWith('ICU') || w.code === 'CCU') groups.critical.push(w);
        else if (w.code === 'ER') groups.er.push(w);
        else if (['SUR1','SUR2','VAS1','VAS2','MAXF','NSGF','NSGM','ORTF','ORTM','KID1','KID2','TRANS','ORG','ORE'].includes(w.code)) groups.surgical.push(w);
        else if (['INTM','INTF'].includes(w.code)) groups.internal.push(w);
        else if (['NEUM','NEUF','MS1','MS2','MS3','ICUN'].includes(w.code)) groups.neuro.push(w);
        else groups.special.push(w);
      }
      const GL = { critical:'💔 ویژه', surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورولوژی', special:'✨ ویژه', er:'🚨 اورژانس', mgmt:'🏛 دفتری' };
      let h = '<div class="sec-hd"><span>🏥 بخش‌ها</span><span style="font-size:11px;color:var(--fg-2)">' + wards.length + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      for (const [grp, list] of Object.entries(groups)) {
        if (!list.length) continue;
        h += '<div style="font-size:12px;font-weight:900;color:var(--fg-2);margin:12px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--border)">' + GL[grp] + '</div>';
        for (const w of list) {
          const cls = w.coverage >= 95 ? 'ok' : w.coverage >= 80 ? 'warn' : 'dng';
          h += '<div class="row ' + (cls==='dng'?'hi':cls==='warn'?'md':'lo') + '" onclick="NABZ.sa.openWard(' + w.id + ')">';
          h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + w.coverage + '%</span></div>';
          h += '<div class="row-meta">' + (w.headNurse||'—') + ' · ' + w.staffCount + ' پرسنل · عدالت: ' + w.fairness + '</div>';
          h += '<div class="progress" style="margin-top:6px"><div class="progress-fill ' + cls + '" style="width:' + w.coverage + '%"></div></div></div>';
        }
      }
      return h;
    },

    openWard(id) { this.ui.wardId = id; this.ui.section = 'ward_detail'; this.ui.rosterTab = 'solve'; this._render(); },

    async _wardDetail() {
      const wid = this.ui.wardId;
      if (!wid) return '<div class="empty">بخش انتخاب نشده</div>';
      const ward = ((this._cache.wards||{}).items||[]).find(w => w.id === wid);
      if (!ward) return '<div class="empty">بخش یافت نشد</div>';
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const tab = this.ui.rosterTab || 'solve';
      const stats = await this._api('/api/sa/fairness?wardId=' + wid + '&periodId=' + period.id).catch(() => null);

      let h = '<div class="sec-hd"><span>✍️ ' + this._esc(ward.label) + '</span><span style="font-size:11px;color:var(--fg-2)">' + (ward.headNurse||'') + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'wards\')">← بازگشت</button>';

      if (stats) {
        h += '<div class="grid-4" style="margin-bottom:12px">';
        h += '<div class="stat ' + (stats.coverage>=95?'ok':stats.coverage>=80?'warn':'dng') + '"><div class="v">' + stats.coverage + '%</div><div class="l">پوشش</div></div>';
        h += '<div class="stat"><div class="v">' + stats.fairness.total + '</div><div class="l">عدالت</div></div>';
        h += '<div class="stat"><div class="v">' + stats.prefSat + '%</div><div class="l">رضایت</div></div>';
        h += '<div class="stat ' + (stats.shortages.length?'dng':'ok') + '"><div class="v">' + stats.shortages.length + '</div><div class="l">کمبود</div></div>';
        h += '</div>';
      }

      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      for (const [k, lbl] of [['demand','📋 نیازسنجی'],['solve','🚀 چیدمان'],['preview','👁 پیش‌نمایش'],['fairness','📊 عدالت']]) {
        h += '<button class="crisis-tab' + (tab===k?' on':'') + '" onclick="NABZ.sa.setTab(\'' + k + '\')">' + lbl + '</button>';
      }
      h += '</div>';

      if (tab === 'demand') return h + await this._demandTab(wid, period);
      if (tab === 'solve') return h + await this._solveTab(wid);
      if (tab === 'preview') return h + await this._previewTab(wid, period, stats);
      return h + this._fairnessTab(stats);
    },

    setTab(t) { this.ui.rosterTab = t; this._render(); },

    async _demandTab(wid, period) {
      const d = await this._api('/api/sa/demands?wardId=' + wid + '&periodId=' + period.id).catch(() => ({items:[]}));
      const dm = new Map();
      for (const x of d.items || []) dm.set(x.date + '|' + x.shift, x);
      const days = this._monthDays(period.jy, period.jm);

      let h = '<div class="hint info" style="margin-bottom:12px">حداقل / هدف</div>';
      h += '<div class="scroll-x" style="margin-bottom:12px"><table style="min-width:500px;font-size:11px">';
      h += '<thead><tr><th style="padding:6px">ت</th><th style="padding:6px">روز</th>';
      for (const s of ['M','E','N']) h += '<th style="padding:6px">' + SHIFT_ICON[s] + '</th>';
      h += '</tr></thead><tbody>';
      for (const dd of days) {
        h += '<tr><td style="padding:4px;font-weight:800">' + dd.jd + '</td><td style="padding:4px;font-size:10px;color:var(--fg-2)">' + WEEKDAYS[dd.wd].slice(0,2) + '</td>';
        for (const s of ['M','E','N']) {
          const r = dm.get(dd.date + '|' + s) || {minRn:0,minSup:0,targetRn:0,targetSup:0};
          h += '<td style="padding:3px"><div style="display:flex;gap:2px;flex-direction:column">';
          h += '<div style="display:flex;gap:2px"><input type="number" min="0" max="10" value="' + r.minRn + '" data-sadm="' + dd.date + '|' + s + '|minRn" style="width:30px;padding:2px;text-align:center;font-size:11px"><input type="number" min="0" max="10" value="' + r.targetRn + '" data-sadm="' + dd.date + '|' + s + '|targetRn" style="width:30px;padding:2px;text-align:center;font-size:11px"></div>';
          h += '<div style="display:flex;gap:2px"><input type="number" min="0" max="10" value="' + r.minSup + '" data-sadm="' + dd.date + '|' + s + '|minSup" style="width:30px;padding:2px;text-align:center;font-size:11px"><input type="number" min="0" max="10" value="' + r.targetSup + '" data-sadm="' + dd.date + '|' + s + '|targetSup" style="width:30px;padding:2px;text-align:center;font-size:11px"></div>';
          h += '</div></td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      h += '<button class="btn btn-primary btn-block" onclick="NABZ.sa.saveDemands(' + wid + ',\'' + period.id + '\')">💾 ذخیره</button>';
      return h;
    },

    async saveDemands(wid, periodId) {
      const inputs = document.querySelectorAll('[data-sadm]');
      const ups = new Map();
      for (const inp of inputs) {
        const [date, shift, field] = inp.dataset.sadm.split('|');
        const k = date + '|' + shift;
        if (!ups.has(k)) ups.set(k, {date, shift, minRn:0, minSup:0, targetRn:0, targetSup:0});
        ups.get(k)[field] = Math.max(0, +inp.value || 0);
      }
      const items = Array.from(ups.values()).filter(x => x.minRn || x.minSup || x.targetRn || x.targetSup);
      try {
        const r = await this._api('/api/sa/demands', { method:'POST', body: JSON.stringify({periodId, wardId:wid, items}) });
        NABZ._toast('✅ ' + r.saved + ' ردیف');
        this._invalidate(); this._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _solveTab(wid) {
      const cfg = await this._api('/api/sa/config').catch(() => ({weights:{coverage:100,pref:50,fair:30,rest:15},limits:{maxConsecutiveNights:2,maxConsecutiveWorkDays:6},rest:{minMinutes:720}}));
      let h = '<div class="hint info" style="margin-bottom:12px">وزن‌ها را تنظیم کنید</div>';
      for (const [k, lbl] of [['coverage','پوشش'],['pref','ترجیحات'],['fair','عدالت'],['rest','استراحت']]) {
        h += '<div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">';
        h += '<label style="font-size:12px;font-weight:800;min-width:60px">' + lbl + '</label>';
        h += '<input type="range" min="0" max="200" value="' + (cfg.weights[k]||0) + '" data-saw="' + k + '" style="flex:1;height:6px">';
        h += '<span style="font-size:13px;font-weight:900;color:var(--primary);min-width:36px;text-align:center;background:var(--primary-soft);padding:2px 6px;border-radius:6px">' + (cfg.weights[k]||0) + '</span>';
        h += '</div>';
      }
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      h += '<div class="bs-field" style="margin:0"><label>حداکثر شب متوالی</label><input type="number" min="1" max="7" value="' + (cfg.limits?.maxConsecutiveNights||2) + '" data-sal="maxConsecutiveNights"></div>';
      h += '<div class="bs-field" style="margin:0"><label>حداکثر روز متوالی</label><input type="number" min="1" max="14" value="' + (cfg.limits?.maxConsecutiveWorkDays||6) + '" data-sal="maxConsecutiveWorkDays"></div>';
      h += '</div>';
      h += '<button class="btn btn-primary btn-block" style="padding:16px;font-size:14px" onclick="NABZ.sa.runSolve(' + wid + ')">🚀 تولید برنامه</button>';
      return h;
    },

    async runSolve(wid) {
      const period = await this._getPeriod();
      if (!period) return;
      const w = {};
      document.querySelectorAll('[data-saw]').forEach(i => w[i.dataset.saw] = +i.value);
      NABZ._toast('در حال حل...');
      try {
        const r = await this._api('/api/sa/solve', { method:'POST', body: JSON.stringify({wardId:wid, periodId:period.id, weights:w}) });
        NABZ._toast('✅ ' + r.saved + ' تخصیص — پوشش ' + r.coverage + '%');
        this._invalidate();
        this.ui.rosterTab = 'preview';
        this._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _previewTab(wid, period, stats) {
      const a = await this._api('/api/sa/assignments?wardId=' + wid + '&periodId=' + period.id).catch(() => ({items:[]}));
      const dem = await this._api('/api/sa/demands?wardId=' + wid + '&periodId=' + period.id).catch(() => ({items:[]}));
      const days = this._monthDays(period.jy, period.jm);
      const dm = new Map(); for (const x of dem.items||[]) dm.set(x.date + '|' + x.shift, x);
      const am = new Map(); for (const x of a.items||[]) { const k = x.date + '|' + x.shift; if (!am.has(k)) am.set(k, []); am.get(k).push(x); }

      let h = '<div class="scroll-x"><table style="min-width:340px;font-size:10px">';
      h += '<thead><tr><th>ت</th><th>ر</th>';
      for (const s of ['M','E','N']) h += '<th>' + SHIFT_ICON[s] + '</th>';
      h += '</tr></thead><tbody>';
      for (const d of days) {
        h += '<tr><td style="padding:2px;font-weight:800">' + d.jd + '</td><td style="padding:2px;font-size:9px;color:var(--fg-2)">' + WEEKDAYS[d.wd].slice(0,2) + '</td>';
        for (const s of ['M','E','N']) {
          const dd = dm.get(d.date + '|' + s) || {minRn:0,minSup:0};
          const need = (dd.minRn||0) + (dd.minSup||0);
          const arr = am.get(d.date + '|' + s) || [];
          const got = arr.length;
          const ci = arr.filter(x => ['checked_in','checked_out'].includes(x.state)).length;
          const color = got >= need && need > 0 ? 'var(--ok)' : got > 0 ? 'var(--warn)' : need > 0 ? 'var(--dng)' : 'var(--fg-3)';
          h += '<td style="padding:2px;text-align:center"><div onclick="NABZ.sa.cellDetail(' + wid + ',\'' + d.date + '\',\'' + s + '\')" style="cursor:pointer;padding:4px;border-radius:4px;background:' + color + '20;color:' + color + ';font-weight:900;min-height:22px;display:flex;align-items:center;justify-content:center;position:relative">';
          h += (need || got) ? got + '/' + need : '—';
          if (ci > 0) h += '<span style="position:absolute;top:1px;left:1px;width:5px;height:5px;border-radius:50%;background:var(--ok)"></span>';
          h += '</div></td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      if (stats && stats.shortages.length) {
        h += '<div class="card" style="border-color:var(--dng);margin-top:12px"><div class="card-title">⚠️ ' + stats.shortages.length + ' کمبود</div>';
        for (const s of stats.shortages.slice(0, 8)) h += '<div style="font-size:11.5px;padding:3px 0">' + s.date + ' — ' + SHIFT_FA[s.shift] + ': ' + s.filled + '/' + s.need + '</div>';
        h += '</div>';
      }
      return h;
    },

    async cellDetail(wid, date, shift) {
      const period = await this._getPeriod();
      if (!period) return;
      const a = await this._api('/api/sa/assignments?wardId=' + wid + '&periodId=' + period.id + '&date=' + date).catch(() => ({items:[]}));
      const filtered = (a.items||[]).filter(x => x.shift === shift);
      const staff = await this._api('/api/sa/staff?wardId=' + wid + '&limit=200').catch(() => ({items:[]}));

      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
      let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">' + date + ' — ' + SHIFT_FA[shift] + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="bs-body"><div class="sec-hd" style="margin:0 0 8px"><span>تخصیصی (' + filtered.length + ')</span></div>';
      if (!filtered.length) h += '<div class="empty" style="padding:12px">هیچ‌کس</div>';
      else for (const x of filtered) {
        const sr = (staff.items||[]).find(s => s.id === x.staffId) || {name:'?'};
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:4px;font-size:12px">';
        h += '<div><b>' + this._esc(sr.name) + '</b> <span class="pill ' + (ATT_CLS[x.state]||'info') + '" style="font-size:9px;margin-right:4px">' + (ATT_FA[x.state]||'—') + '</span></div>';
        h += '<button class="btn" style="padding:2px 8px;font-size:11px" onclick="NABZ.sa.removeAssignment(' + x.id + ')">✗</button></div>';
      }
      h += '<div class="sec-hd" style="margin:12px 0 8px"><span>➕ افزودن</span></div><div style="max-height:200px;overflow-y:auto">';
      for (const s of (staff.items||[]).filter(x => !filtered.find(f => f.staffId === x.id))) {
        h += '<button class="btn" style="width:100%;margin-bottom:2px;padding:8px;font-size:11px;justify-content:space-between;display:flex" onclick="NABZ.sa.addAssignment(' + wid + ',\'' + date + '\',\'' + shift + '\',' + s.id + ')"><span>' + this._esc(s.name) + '</span><small style="color:var(--fg-2)">' + (CAT_FA[s.category]||'') + '</small></button>';
      }
      h += '</div></div>';
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
    },

    async addAssignment(wid, date, shift, staffId) {
      const period = await this._getPeriod();
      if (!period) return;
      try {
        await this._api('/api/sa/assignments', { method:'POST', body: JSON.stringify({periodId:period.id, staffId, wardId:wid, date, shift}) });
        NABZ._toast('✅ افزوده شد');
        document.querySelector('.bs-backdrop')?.remove();
        this._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async removeAssignment(id) {
      try {
        await this._api('/api/sa/assignments/' + id, { method:'DELETE' });
        NABZ._toast('✅ حذف');
        document.querySelector('.bs-backdrop')?.remove();
        this._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _fairnessTab(stats) {
      if (!stats) return '<div class="empty">آماری نیست</div>';
      let h = '<div class="sec-hd"><span>📊 عدالت</span></div><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
      const metrics = [['Gini شب','nightGini',.1,.2],['CV جمعه','weekendCV',.15,.3],['CV ساعت','hourCV',.1,.2]];
      for (const [lbl, key, good, warn] of metrics) {
        const v = stats.fairness[key];
        const cls = v <= good ? 'ok' : v <= warn ? 'warn' : 'dng';
        h += '<div class="stat ' + cls + '" style="padding:10px"><div class="v" style="font-size:18px">' + v + '</div><div class="l">' + lbl + '</div></div>';
      }
      h += '</div><div class="sec-hd"><span>👥 پرسنل</span></div><div class="scroll-x"><table><thead><tr><th>نام</th><th>سمت</th><th>شب</th><th>شیفت</th><th>ساعت</th></tr></thead><tbody>';
      const sorted = (stats.staffStats||[]).sort((a,b) => b.hours - a.hours);
      for (const s of sorted) {
        h += '<tr><td>' + this._esc(s.name) + '</td><td style="font-size:10px;color:var(--fg-2)">' + (CAT_FA[s.category]||'—') + '</td>';
        h += '<td style="color:var(--violet)">' + s.nights + '</td><td>' + s.shifts + '</td><td>' + Math.round(s.hours) + 'h</td></tr>';
      }
      h += '</tbody></table></div>';
      return h;
    },

    async _fairnessList() {
      const active = ((this._cache.wards||{}).items||[]).filter(w => !w.isManagement);
      let h = '<div class="sec-hd"><span>📊 عدالت همه بخش‌ها</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      for (const w of active.sort((a,b) => b.fairness - a.fairness)) {
        const cls = w.fairness >= 0.8 ? 'ok' : w.fairness >= 0.6 ? 'warn' : 'dng';
        h += '<div class="row ' + (cls==='dng'?'hi':cls==='warn'?'md':'lo') + '" onclick="NABZ.sa.openWard(' + w.id + ')">';
        h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + w.fairness + '</span></div>';
        h += '<div class="row-meta">پوشش: ' + w.coverage + '% · ' + w.staffCount + ' پرسنل</div>';
        h += '<div class="progress" style="margin-top:6px"><div class="progress-fill ' + cls + '" style="width:' + Math.round(w.fairness*100) + '%"></div></div></div>';
      }
      return h;
    },

    async _requests() {
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const p = await this._api('/api/sa/preferences?periodId=' + period.id + '&status=submitted').catch(() => ({items:[]}));
      let h = '<div class="sec-hd"><span>📥 درخواست‌ها</span><span style="font-size:11px;color:var(--fg-2)">' + (p.items||[]).length + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      if (!(p.items||[]).length) return h + '<div class="empty">درخواستی نیست</div>';
      const gr = {};
      for (const x of p.items) { if (!gr[x.staffId]) gr[x.staffId] = []; gr[x.staffId].push(x); }
      for (const [sid, list] of Object.entries(gr)) {
        h += '<div class="card" style="margin-bottom:8px"><div class="card-title">👤 پرسنل #' + sid + ' — ' + list.length + '</div>';
        for (const x of list.slice(0, 8)) {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;border-top:1px solid var(--border)">';
          h += '<span>' + x.date + ' — ' + REQ_FA[x.requestType] + '</span>';
          h += '<span><button class="btn btn-ok btn-xs" style="padding:3px 8px;font-size:10px" onclick="NABZ.sa.approvePref(' + x.id + ',true)">✓</button> <button class="btn btn-dng btn-xs" style="padding:3px 8px;font-size:10px" onclick="NABZ.sa.approvePref(' + x.id + ',false)">✗</button></span></div>';
        }
        h += '</div>';
      }
      return h;
    },

    async approvePref(id, ok) {
      try {
        await this._api('/api/sa/preferences/' + id + '/approve', { method:'POST', body: JSON.stringify({approve: ok}) });
        NABZ._toast(ok ? '✅ تأیید' : '❌ رد');
        this._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _attendance() {
      const t = await this._api('/api/sa/attendance/today').catch(() => ({byWard:{}, totalAssignments:0}));
      const wards = (this._cache.wards||{}).items||[];
      const by = t.byWard||{};
      let tot=0, pre=0, late=0, abs=0;
      for (const w of wards) { const d = by[w.id]||{total:0,checked_in:0,checked_out:0,late:0,absent:0}; tot+=d.total; pre+=d.checked_in+d.checked_out; late+=d.late; abs+=d.absent; }
      let h = '<div class="sec-hd"><span>📍 حضور امروز</span><span style="font-size:11px;color:var(--fg-2)">' + (t.date||'') + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      h += '<div class="grid-4" style="margin-bottom:16px">';
      h += '<div class="stat"><div class="v">' + tot + '</div><div class="l">کل</div></div>';
      h += '<div class="stat ok"><div class="v">' + pre + '</div><div class="l">حاضر</div></div>';
      h += '<div class="stat warn"><div class="v">' + late + '</div><div class="l">تأخیر</div></div>';
      h += '<div class="stat dng"><div class="v">' + abs + '</div><div class="l">غیبت</div></div>';
      h += '</div>';
      for (const w of wards) {
        if (!by[w.id] || !by[w.id].total) continue;
        const d = by[w.id];
        const cls = d.absent > 0 ? 'dng' : d.late > 0 ? 'warn' : 'ok';
        h += '<div class="row ' + (cls==='dng'?'hi':cls==='warn'?'md':'') + '">';
        h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + (d.checked_in+d.checked_out) + '/' + d.total + '</span></div>';
        h += '<div class="row-meta">' + (d.late? '⚠️ ' + d.late + ' · ':'') + (d.absent? '❌ ' + d.absent + ' · ':'') + '⏳ ' + d.scheduled + '</div></div>';
      }
      return h;
    },

    async _payroll() {
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const d = await this._api('/api/sa/payroll?periodId=' + period.id).catch(() => ({items:[]}));
      let h = '<div class="sec-hd"><span>💰 کارانه</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      if (!(d.items||[]).length) return h + '<div class="empty">داده‌ای نیست</div>';
      h += '<div class="scroll-x"><table><thead><tr><th>نام</th><th>بخش</th><th>ساعت</th><th>خالص</th></tr></thead><tbody>';
      for (const p of (d.items||[]).sort((a,b) => b.net - a.net).slice(0, 100)) {
        h += '<tr><td>' + this._esc(p.staffName) + '</td><td style="font-size:10px">' + this._esc(p.wardLabel) + '</td>';
        h += '<td>' + Math.round(p.totalMin/60) + 'h</td><td style="color:var(--ok);font-weight:800">' + this._fmt(p.net) + '</td></tr>';
      }
      h += '</tbody></table></div>';
      return h;
    },

    async _audit() {
      const c = await this._api('/api/sa/audit?limit=50').catch(() => ({items:[]}));
      const v = await this._api('/api/sa/audit/verify').catch(() => ({ok:true,count:0}));
      let h = '<div class="sec-hd"><span>🔐 Audit</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      h += '<div class="card" style="border-color:var(--' + (v.ok?'ok':'dng') + ')"><div style="text-align:center;font-size:16px;font-weight:900;color:var(--' + (v.ok?'ok':'dng') + ')">' + (v.ok?'✅ سالم':'❌ شکسته') + '</div><div style="text-align:center;font-size:11px;color:var(--fg-2);margin-top:4px">' + v.count + ' رکورد</div></div>';
      for (const a of (c.items||[]).slice(0,20)) {
        h += '<div class="card" style="padding:10px;margin-bottom:4px"><div style="font-size:11px;font-weight:800">' + this._esc(a.action) + '</div><div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + (a.actor?.name||'?') + ' · ' + new Date(a.at).toLocaleString('fa-IR') + '</div></div>';
      }
      return h;
    },

    async solveAll() {
      if (!confirm('همه بخش‌ها حل شوند؟')) return;
      NABZ._toast('در حال حل...');
      try {
        const r = await this._api('/api/sa/solve-all', { method:'POST', body:'{}' });
        const ok = (r.results||[]).filter(x => !x.error).length;
        NABZ._toast('✅ ' + ok + ' بخش');
        this._invalidate();
        this._render();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═══ STAFF VIEW ═══
    async staffHome() {
      const user = NABZ.state.user;
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const period = await this._getPeriod();
        const a = await this._api('/api/sa/assignments?staffId=' + user.staffId + (period?'&periodId='+period.id:'')).catch(() => ({items:[]}));
        const today = this._todayJ();
        const tA = (a.items||[]).find(x => x.date === today);
        let h = '<div class="sec-hd"><span>👋 ' + this._esc(user.fullName||user.username) + '</span></div>';
        if (period) h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        if (tA) {
          const st = tA.state||'scheduled';
          h += '<div class="card" style="border-color:var(--primary);margin-bottom:12px"><div class="card-title">📍 امروز</div>';
          h += '<div style="font-size:18px;font-weight:900;margin:6px 0">' + SHIFT_ICON[tA.shift] + ' ' + SHIFT_FA[tA.shift] + '</div>';
          h += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:10px">' + (ATT_FA[st]||'—') + '</div>';
          if (st === 'scheduled') {
            h += '<div style="display:flex;gap:6px">';
            h += '<button class="btn btn-ok" style="flex:1;padding:10px" onclick="NABZ.sa.staffCheckIn(' + tA.id + ')">✅ ورود</button>';
            h += '<button class="btn btn-warn" style="flex:1;padding:10px" onclick="NABZ.sa.staffLate(' + tA.id + ')">⏰ تأخیر</button>';
            h += '</div>';
          } else if (st === 'checked_in') {
            h += '<button class="btn btn-primary" style="width:100%;padding:10px" onclick="NABZ.sa.staffCheckOut(' + tA.id + ')">🚪 پایان</button>';
          }
          h += '</div>';
        } else {
          h += '<div class="hint info" style="margin-bottom:12px">امروز شیفتی نیست</div>';
        }
        const tot = (a.items||[]).reduce((s,x) => s+(x.actualMinutes||0),0);
        const nights = (a.items||[]).filter(x => ['N','EN'].includes(x.shift)).length;
        h += '<div class="grid-4" style="margin-bottom:16px">';
        h += '<div class="stat"><div class="v">' + (a.items||[]).length + '</div><div class="l">شیفت</div></div>';
        h += '<div class="stat"><div class="v">' + Math.round(tot/60) + 'h</div><div class="l">کارکرد</div></div>';
        h += '<div class="stat"><div class="v">' + nights + '</div><div class="l">شب</div></div>';
        h += '<div class="stat ok"><div class="v">' + (a.items||[]).filter(x => x.state==='checked_in').length + '</div><div class="l">حاضر</div></div>';
        h += '</div>';
        h += '<div class="sec-hd"><span>📅 شیفت‌های ماه</span></div>';
        for (const x of (a.items||[]).sort((p,q) => p.date < q.date ? -1 : 1).slice(0, 20)) {
          h += '<div class="row lo" style="padding:10px"><div class="row-hd"><div class="row-title" style="font-size:13px">' + x.date + '</div>';
          h += '<span class="pill" style="background:' + SHIFT_BG[x.shift] + ';color:' + SHIFT_FG[x.shift] + '">' + SHIFT_ICON[x.shift] + ' ' + SHIFT_FA[x.shift] + '</span></div></div>';
        }
        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    async staffCheckIn(id) {
      try { await this._api('/api/sa/attendance/' + id + '/checkin', { method:'POST', body:'{}' }); NABZ._toast('✅ ورود'); this.staffHome(); }
      catch (e) { alert('خطا: ' + e.message); }
    },
    async staffCheckOut(id) {
      try { await this._api('/api/sa/attendance/' + id + '/checkout', { method:'POST', body:'{}' }); NABZ._toast('🚪 پایان'); this.staffHome(); }
      catch (e) { alert('خطا: ' + e.message); }
    },
    async staffLate(id) {
      const r = prompt('دلیل تأخیر:') || '';
      try { await this._api('/api/sa/attendance/' + id + '/late', { method:'POST', body: JSON.stringify({reason:r}) }); NABZ._toast('⚠️'); this.staffHome(); }
      catch (e) { alert('خطا: ' + e.message); }
    },

    async staffRequest() {
      const user = NABZ.state.user;
      const m = document.getElementById('content');
      try {
        const period = await this._getPeriod();
        if (!period) return;
        const days = this._monthDays(period.jy, period.jm);
        const prefs = await this._api('/api/sa/preferences?staffId=' + user.staffId + '&periodId=' + period.id).catch(() => ({items:[]}));
        const pm = new Map(); for (const p of prefs.items||[]) pm.set(p.date, p);
        this.ui.reqBuffer = (prefs.items||[]).filter(p => p.status==='draft').map(p => ({date:p.date, requestType:p.requestType}));
        const bm = new Map(); for (const b of this.ui.reqBuffer) bm.set(b.date, b);

        let h = '<div class="sec-hd"><span>📝 درخواست</span></div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        h += '<div class="card" style="padding:8px"><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">';
        for (const w of ['ش','ی','د','س','چ','پ','ج']) h += '<div style="text-align:center;font-size:9px;font-weight:900;color:var(--fg-2);padding:4px 0">' + w + '</div>';
        h += '</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
        for (let i = 0; i < days[0].wd; i++) h += '<div></div>';
        for (const d of days) {
          const b = bm.get(d.date);
          const ex = pm.get(d.date);
          let bg = 'var(--bg-2)', fg = 'var(--fg)';
          if (ex) { bg = 'rgba(139,92,246,0.15)'; fg = 'var(--violet)'; }
          if (b) { bg = 'rgba(6,182,212,0.2)'; fg = 'var(--primary)'; }
          if (d.isFri) bg = 'rgba(239,68,68,0.08)';
          h += '<div onclick="NABZ.sa.staffPick(\'' + d.date + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid var(--border);border-radius:4px;padding:4px;min-height:40px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center">';
          h += '<div style="font-size:11px;font-weight:800">' + d.jd + '</div>';
          if (b) h += '<div style="font-size:8px">' + REQ_ICON[b.requestType] + '</div>';
          else if (ex) h += '<div style="font-size:8px">' + REQ_ICON[ex.requestType] + '</div>';
          h += '</div>';
        }
        h += '</div></div>';
        h += '<div style="display:flex;gap:6px;margin-top:12px">';
        h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.sa.staffSave(\'draft\')">💾 پیش‌نویس</button>';
        h += '<button class="btn btn-primary" style="flex:2;padding:12px" onclick="NABZ.sa.staffSave(\'submitted\')">📤 ارسال</button>';
        h += '</div>';
        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    staffPick(date) {
      const ex = this.ui.reqBuffer.find(b => b.date === date);
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
      let h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">' + date + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div><div class="bs-body">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin-bottom:8px">شیفت</div>';
      for (const [c,l,i] of [['MORNING','صبح','🌅'],['EVENING','عصر','🌆'],['NIGHT','شب','🌙'],['LONG','لانگ','📏'],['EVENING_NIGHT','عصر+شب','🌗'],['H24','۲۴ساعته','⏰']])
        h += '<button class="btn" style="width:100%;margin-bottom:4px;padding:12px;justify-content:flex-start;text-align:right" onclick="NABZ.sa.staffSet(\'' + date + '\',\'' + c + '\')">' + i + ' ' + l + '</button>';
      h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin:12px 0 8px">مرخصی</div>';
      for (const [c,l,i] of [['LEAVE','مرخصی','🏖️'],['SICK','استعلاجی','🤒'],['REST','استراحت','💤']])
        h += '<button class="btn" style="width:100%;margin-bottom:4px;padding:12px;justify-content:flex-start;text-align:right" onclick="NABZ.sa.staffSet(\'' + date + '\',\'' + c + '\')">' + i + ' ' + l + '</button>';
      if (ex) h += '<button class="btn btn-dng" style="width:100%;margin-top:12px;padding:10px" onclick="NABZ.sa.staffClear(\'' + date + '\')">🗑 حذف</button>';
      h += '</div>';
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
    },

    staffSet(date, type) {
      this.ui.reqBuffer = this.ui.reqBuffer.filter(b => b.date !== date);
      this.ui.reqBuffer.push({date, requestType: type});
      document.querySelector('.bs-backdrop')?.remove();
      this.staffRequest();
    },
    staffClear(date) {
      this.ui.reqBuffer = this.ui.reqBuffer.filter(b => b.date !== date);
      document.querySelector('.bs-backdrop')?.remove();
      this.staffRequest();
    },

    async staffSave(status) {
      const user = NABZ.state.user;
      const period = await this._getPeriod();
      if (!period) return;
      try {
        await this._api('/api/sa/preferences', { method:'POST', body: JSON.stringify({periodId:period.id, staffId:user.staffId, items:this.ui.reqBuffer, status}) });
        NABZ._toast(status==='submitted' ? '✅ ارسال' : '💾 ذخیره');
        this.staffHome();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async staffSchedule() {
      const user = NABZ.state.user;
      const m = document.getElementById('content');
      try {
        const period = await this._getPeriod();
        if (!period) return;
        const a = await this._api('/api/sa/assignments?staffId=' + user.staffId + '&periodId=' + period.id).catch(() => ({items:[]}));
        const sorted = (a.items||[]).sort((p,q) => p.date < q.date ? -1 : 1);
        let h = '<div class="sec-hd"><span>📅 برنامه من</span></div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        if (!sorted.length) h += '<div class="empty">برنامه‌ای نیست</div>';
        else for (const x of sorted) {
          h += '<div class="row lo" style="padding:10px"><div class="row-hd"><div class="row-title" style="font-size:13px">' + x.date + '</div>';
          h += '<span class="pill" style="background:' + SHIFT_BG[x.shift] + ';color:' + SHIFT_FG[x.shift] + '">' + SHIFT_ICON[x.shift] + ' ' + SHIFT_FA[x.shift] + '</span></div>';
          h += '<div class="row-meta">' + (ATT_FA[x.state]||'—') + '</div></div>';
        }
        m.innerHTML = h;
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>'; }
    },

    staffView(view) {
      if (view === 'request') this.staffRequest();
      else if (view === 'schedule') this.staffSchedule();
      else this.staffHome();
    },

    _todayJ() {
      const n = new Date();
      const y = n.getFullYear(), m = n.getMonth()+1, d = n.getDate();
      // Fast J→G approximation (server is authoritative for edge cases)
      const jy = y - 621, jm = m <= 3 ? m + 9 : m - 3, jd = d;
      return jy + '/' + this._pad(jm) + '/' + this._pad(jd);
    },

    _monthDays(jy, jm) {
      const ml = jm <= 6 ? 31 : jm <= 11 ? 30 : 29;
      const days = [];
      // Approximate weekday — server authoritative
      for (let d = 1; d <= ml; d++) {
        const gd = new Date(jy+621, jm<=10?jm+2:jm-10, d);
        const wd = (gd.getDay() + 1) % 7;
        days.push({ jd: d, date: jy + '/' + this._pad(jm) + '/' + this._pad(d), wd, isFri: wd === 6 });
      }
      return days;
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.sa = Sa;
  console.log('[sa] loaded ✓');
})();
EOF_SA
echo "✅ public/sa.js ($(wc -l < public/sa.js) lines)"

# ═══════════════════════════════════════════════════════════
#  public/sa-init.js
# ═══════════════════════════════════════════════════════════
cat > public/sa-init.js << 'EOF_INIT'
// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Bootstrap
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ─── 1) Wrap NABZ.show for sa_dashboard ───
  function patchShow() {
    if (!window.NABZ || typeof NABZ.show !== 'function') return setTimeout(patchShow, 200);
    if (NABZ.show._saWrapped) return;
    const orig = NABZ.show;
    NABZ.show = async function(id) {
      if (id === 'shift_assistant.dashboard' && NABZ.sa) {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
        document.getElementById('content').innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        try {
          const d = await NABZ._api('/api/sa/wards');
          await NABZ.sa.showDashboard(null, d);
        } catch (e) {
          document.getElementById('content').innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
        }
        return;
      }
      const p = NABZ.state.panels.find(x => x.id === id);
      if (p && p.kind === 'sa_dashboard' && NABZ.sa) {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
        try {
          const d = await NABZ._api(p.api);
          await NABZ.sa.showDashboard(p, d);
        } catch (e) {
          document.getElementById('content').innerHTML = '<div class="empty">خطا: ' + NABZ._esc(e.message) + '</div>';
        }
        return;
      }
      return orig.call(NABZ, id);
    };
    NABZ.show._saWrapped = true;
    console.log('[sa-init] show wrapped ✓');
  }
  patchShow();

  // ─── 2) Wrap NABZ.showHome for shift_staff ───
  function patchHome() {
    if (!window.NABZ || typeof NABZ.showHome !== 'function') return setTimeout(patchHome, 200);
    if (NABZ.showHome._saWrapped) return;
    const orig = NABZ.showHome;
    NABZ.showHome = async function() {
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff' && NABZ.sa) {
        return NABZ.sa.staffHome();
      }
      return orig.call(this);
    };
    NABZ.showHome._saWrapped = true;
    console.log('[sa-init] showHome wrapped ✓');
  }
  patchHome();

  // ─── 3) Wrap NABZ.boot for shift_staff nav ───
  function patchBoot() {
    if (!window.NABZ || typeof NABZ.boot !== 'function') return setTimeout(patchBoot, 200);
    if (NABZ.boot._saWrapped) return;
    const orig = NABZ.boot;
    NABZ.boot = async function() {
      const r = await orig.call(this);
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff') setTimeout(patchStaffNav, 80);
      return r;
    };
    NABZ.boot._saWrapped = true;
    console.log('[sa-init] boot wrapped ✓');
  }
  patchBoot();

  function patchStaffNav() {
    const s = document.getElementById('sidebar');
    if (!s || s.dataset.saPatched) return;
    s.dataset.saPatched = '1';
    s.innerHTML = [
      '<button class="bn-tab on" onclick="NABZ.sa.staffView(\'home\');NABZ._markTab(this)"><span class="bn-icon">🏠</span><span class="bn-label">خانه</span></button>',
      '<button class="bn-tab" onclick="NABZ.sa.staffView(\'checkin\');NABZ._markTab(this)"><span class="bn-icon">📍</span><span class="bn-label">حضور</span></button>',
      '<button class="bn-tab" onclick="NABZ.sa.staffView(\'request\');NABZ._markTab(this)"><span class="bn-icon">📝</span><span class="bn-label">درخواست</span></button>',
      '<button class="bn-tab" onclick="NABZ.sa.staffView(\'schedule\');NABZ._markTab(this)"><span class="bn-icon">📅</span><span class="bn-label">برنامه</span></button>',
      '<button class="bn-tab" onclick="NABZ.logout()"><span class="bn-icon">⏻</span><span class="bn-label">خروج</span></button>'
    ].join('');
    console.log('[sa-init] staff nav ✓');
  }

  NABZ._markTab = function(btn) {
    document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  };

  // ─── 4) PIN login tab ───
  function injectPin() {
    const tabs = document.querySelector('.lg-tabs');
    if (!tabs || tabs.querySelector('[data-pin]')) return !!tabs;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.pin = '1';
    btn.textContent = '🏥 دستیار';
    btn.onclick = () => switchPin(btn);
    tabs.appendChild(btn);
    return true;
  }
  function tryPin() { if (!injectPin()) setTimeout(tryPin, 400); }

  function switchPin(btn) {
    document.querySelectorAll('.lg-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const form = document.getElementById('lgf');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const code = String(fd.get('u')||'').trim();
      const pin = String(fd.get('p')||'').trim();
      const sb = form.querySelector('button');
      if (sb) { sb.disabled = true; sb.textContent = '...'; }
      try {
        const r = await fetch('/api/sa/auth/pin', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({code, pin}) }).then(x => x.json());
        if (!r.ok) throw new Error(r.error || 'failed');
        localStorage.setItem('nabz_tk', r.data.token);
        localStorage.setItem('nabz_u', JSON.stringify({
          id: 'sa_' + r.data.staff.id,
          username: r.data.staff.code,
          role: 'shift_staff',
          fullName: r.data.staff.name,
          ward: null, staffId: r.data.staff.id, wardId: r.data.staff.wardId
        }));
        location.reload();
      } catch (err) {
        document.getElementById('le').textContent = 'کد یا PIN نادرست';
        if (sb) { sb.disabled = false; sb.textContent = '🔐 ورود'; }
      }
    };
    const ins = form.querySelectorAll('input');
    if (ins[0]) { ins[0].placeholder = 'کد پرسنلی'; ins[0].type = 'text'; ins[0].value = ''; }
    if (ins[1]) { ins[1].placeholder = 'PIN (۴ رقم آخر)'; ins[1].type = 'password'; ins[1].value = ''; }
  }

  // ─── 5) Boot ───
  function boot() {
    const tk = localStorage.getItem('nabz_tk');
    if (!tk) tryPin();
    else setTimeout(() => {
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff') patchStaffNav();
    }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
EOF_INIT
echo "✅ public/sa-init.js ($(wc -l < public/sa-init.js) lines)"

# ═══════════════════════════════════════════════════════════
#  Fix sw.js — handle both STATIC and STATIC_ASSETS
# ═══════════════════════════════════════════════════════════
echo "═══ sw.js ═══"
node << 'EOF_SW'
const fs = require('fs');
const F = 'public/sw.js';
let src = fs.readFileSync(F, 'utf8');
let changed = 0;

// Ensure /sa.js is in the static array — no matter what it's called
if (!src.includes("'/sa.js'")) {
  // Try STATIC_ASSETS first (Part 16 rewrite)
  let matched = false;
  const arrRx = /const (STATIC_ASSETS|STATIC)\s*=\s*\[([\s\S]*?)\];/;
  const m = src.match(arrRx);
  if (m) {
    const varName = m[1];
    let inner = m[2].replace(/[\s,]+$/, '');
    const fixed = 'const ' + varName + ' = [' + inner + ",\n  '/sa.js',\n  '/sa-init.js'\n];";
    src = src.replace(m[0], fixed);
    matched = true;
    changed++;
    console.log('✅ STATIC array (' + varName + ') + /sa.js, /sa-init.js');
  }
  if (!matched) {
    // Fallback: insert before </body> comment or anywhere in SW — this won't work
    console.log('❌ static array pattern not matched — inspecting...');
    const anyArr = src.match(/const \w+\s*=\s*\[[^\]]*\.(?:js|css|html|webmanifest)[^\]]*\]/);
    if (anyArr) console.log('   possible array: ' + anyArr[0].slice(0, 120));
  }
} else {
  console.log('ℹ️  /sa.js already in sw.js');
}

// Bump version
const vm = src.match(/const VERSION = (\d+);/);
if (vm) {
  const nv = parseInt(vm[1]) + 1;
  src = src.replace(vm[0], 'const VERSION = ' + nv + ';');
  console.log('✅ VERSION ' + vm[1] + ' → ' + nv);
  changed++;
}

if (changed > 0) fs.writeFileSync(F, src);
EOF_SW
echo ""

# ═══════════════════════════════════════════════════════════
#  Verify
# ═══════════════════════════════════════════════════════════
echo "═══ VERIFY ═══"
node << 'EOF_V'
const fs = require('fs');
let p=0, f=0;
function c(l, ok) { console.log((ok?'✅':'❌')+' '+l); ok?p++:f++; }

const app = fs.readFileSync('public/app.js', 'utf8');
const html = fs.readFileSync('public/index.html', 'utf8');
const sw = fs.readFileSync('public/sw.js', 'utf8');
const neu = fs.readFileSync('core/neural.js', 'utf8');

c('neural.alerts()', /alerts\(actor\)/.test(neu));
c('neural.cohort()', /cohort\(\)\s*\{/.test(neu));
c('MOD_META has shift_assistant', /shift_assistant:/.test(app));
c('modOrder has shift_assistant', /modOrder\s*=\s*\[[^\]]*'shift_assistant'/.test(app));
c('index.html has /sa.js', html.includes('/sa.js'));
c('index.html has /sa-init.js', html.includes('/sa-init.js'));
c('sw.js has /sa.js', sw.includes("'/sa.js'"));
c('public/sa.js exists', fs.existsSync('public/sa.js'));
c('public/sa-init.js exists', fs.existsSync('public/sa-init.js'));
c('modules/shift_assistant.js exists', fs.existsSync('modules/shift_assistant.js'));

const m = require('./modules/shift_assistant.js');
c('module routes > 0 (' + m.routes.length + ')', m.routes.length > 0);
c('module panels > 0 (' + m.panels.length + ')', m.panels.length > 0);

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(p + ' PASS / ' + f + ' FAIL');
process.exit(f > 0 ? 1 : 0);
EOF_V

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ کامل شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "🔄 سرور:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "⚠️  مرورگر — پاکسازی حتمی:"
echo "  F12 → Application → Service Workers → Unregister ALL"
echo "  F12 → Application → Storage → Clear site data"
echo "  Ctrl+Shift+R × 2"
echo ""
echo "🎯 سپس:"
echo "  admin / nabz@2026 → منو ☰ → 🏥 دستیار شیفت"
echo ""
