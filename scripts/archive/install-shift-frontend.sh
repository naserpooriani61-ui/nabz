#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "🏥 NABZ Shift Assistant — Frontend Installer (Phase 2)"
echo ""

if [ ! -f "core/server.js" ] || [ ! -f "modules/shift_assistant.js" ]; then
  echo "❌ ابتدا Phase 1 (install-shift-assistant.sh) را اجرا کنید"
  exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/sa-fe-$STAMP"
mkdir -p "$BACKUP_DIR"
for f in public/app.js public/index.html public/sw.js public/style.css; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" 2>/dev/null || true
done
echo "📦 Backup → $BACKUP_DIR"
echo ""

# ═══════════════════════════════════════════════════════════
#  public/sa.js
# ═══════════════════════════════════════════════════════════
cat > public/sa.js << 'EOF_SA'
// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Full UI (dastyar integration)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const WEEKDAYS = ['شنبه','یکشنبه','دوشنبه','سه‌شنبه','چهارشنبه','پنجشنبه','جمعه'];
  const MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
  const SHIFT_FA = { M:'صبح', E:'عصر', N:'شب', L:'لانگ', EN:'عصر+شب', H24:'۲۴ساعته' };
  const SHIFT_ICON = { M:'🌅', E:'🌆', N:'🌙', L:'📏', EN:'🌗', H24:'⏰' };
  const SHIFT_COLORS = {
    M:  { bg:'rgba(59,130,246,0.15)',  fg:'#3b82f6' },
    E:  { bg:'rgba(245,158,11,0.15)',  fg:'#f59e0b' },
    N:  { bg:'rgba(139,92,246,0.15)',  fg:'#8b5cf6' },
    L:  { bg:'rgba(16,185,129,0.15)',  fg:'#10b981' },
    EN: { bg:'rgba(168,85,247,0.15)',  fg:'#a855f7' },
    H24:{ bg:'rgba(239,68,68,0.15)',   fg:'#ef4444' }
  };
  const REQ_FA = { MORNING:'صبح', EVENING:'عصر', NIGHT:'شب', LONG:'لانگ', EVENING_NIGHT:'عصر+شب', H24:'۲۴ساعته', LEAVE:'مرخصی', SICK:'استعلاجی', HALF_M:'نیم‌روز صبح', HALF_E:'نیم‌روز عصر', REST:'استراحت' };
  const REQ_SHORT = { MORNING:'ص', EVENING:'ع', NIGHT:'ش', LONG:'ل', EVENING_NIGHT:'عش', H24:'۲۴', LEAVE:'م', SICK:'ب', HALF_M:'نص', HALF_E:'نع', REST:'ا' };
  const REQ_ICON = { MORNING:'🌅', EVENING:'🌆', NIGHT:'🌙', LONG:'📏', EVENING_NIGHT:'🌗', H24:'⏰', LEAVE:'🏖️', SICK:'🤒', HALF_M:'🌅', HALF_E:'🌆', REST:'💤' };
  const ATT_FA = { scheduled:'در انتظار', checked_in:'حاضر', checked_out:'پایان', late:'تأخیر', absent:'غیبت' };
  const ATT_CLS = { scheduled:'info', checked_in:'ok', checked_out:'info', late:'warn', absent:'dng' };
  const CAT_FA = { matron:'مترون', supervisor:'سوپروایزر', clinical_supervisor:'سوپروایزر بالینی', head_nurse:'سرپرستار', rn:'پرستار', support:'کمک‌پرستار', beh_yar:'بهیار', anesthesia:'هوشبری', or_tech:'اتاق عمل', or_specialist:'کارشناس اتاق عمل', midwife:'ماما', ecg:'نوارنگار', secretary:'منشی', patient_care:'بیماریار', wound_specialist:'کارشناس زخم', assistant:'کمک‌بهیار' };

  const Sa = {
    ui: { section:'home', wardId:null, staffCat:'rn', rosterTab:'solve', reqTab:'routine', reqBuffer:[] },
    _cache: { wards: null, period: null },

    _api(p, o) { return NABZ._api(p, o); },
    _esc(s) { return NABZ._esc(s); },
    _fmtNum(n) { return new Intl.NumberFormat('fa-IR').format(Math.round(n||0)); },
    _pad(n) { return String(n).padStart(2,'0'); },

    // ─── Period helper ───
    async _getPeriod() {
      if (this._cache.period) return this._cache.period;
      try {
        const p = await this._api('/api/sa/period');
        this._cache.period = p;
        return p;
      } catch (e) { return null; }
    },
    _invalidate() { this._cache = { wards: null, period: null }; },

    // ═══════════════════════════════════════════════════════════
    //  MANAGER DASHBOARD (kind: sa_dashboard)
    // ═══════════════════════════════════════════════════════════
    async showDashboard(p, d) {
      const m = document.getElementById('content');
      if (!d) {
        m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
        try { d = await this._api('/api/sa/wards'); } catch (e) {
          m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
          return;
        }
      }
      this._cache.wards = d;
      this._renderSaManager();
    },

    async _renderSaManager() {
      const m = document.getElementById('content');
      const section = this.ui.section || 'home';
      const period = await this._getPeriod();
      try {
        let html = '';
        switch (section) {
          case 'home':       html = await this._saManagerHome(); break;
          case 'wards':      html = await this._saWardsList(); break;
          case 'ward_detail':html = await this._saWardDetail(); break;
          case 'requests':   html = await this._saRequests(); break;
          case 'attendance': html = await this._saTodayAttendance(); break;
          case 'fairness':   html = await this._saFairnessList(); break;
          case 'payroll':    html = await this._saPayroll(); break;
          case 'config':     html = await this._saConfig(); break;
          case 'audit':      html = await this._saAudit(); break;
          default:           html = await this._saManagerHome();
        }
        m.innerHTML = html;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    async _saManagerHome() {
      const period = await this._getPeriod();
      const wards = (this._cache.wards || {}).items || [];
      const totalStaff = wards.reduce((s, w) => s + (w.staffCount || 0), 0);
      const activeWards = wards.filter(w => !w.isManagement);
      const avgCov = activeWards.length ? Math.round(activeWards.reduce((s,w)=>s+w.coverage,0)/activeWards.length) : 0;
      const totalShort = wards.reduce((s,w)=>s+(w.shortages||0),0);
      const avgFair = activeWards.length ? (activeWards.reduce((s,w)=>s+w.fairness,0)/activeWards.length).toFixed(2) : '0';
      
      let h = '<div class="sec-hd"><span>🏥 دستیار شیفت</span>';
      if (period) h += '<span style="font-size:11px;color:var(--fg-2)">' + MONTHS[period.jm-1] + ' ' + period.jy + '</span>';
      h += '</div>';
      
      h += '<div class="grid-4" style="margin-bottom:16px">';
      h += '<div class="stat"><div class="v">' + activeWards.length + '</div><div class="l">بخش</div></div>';
      h += '<div class="stat"><div class="v">' + totalStaff + '</div><div class="l">پرسنل</div></div>';
      h += '<div class="stat ' + (avgCov>=95?'ok':avgCov>=80?'warn':'dng') + '"><div class="v">' + avgCov + '%</div><div class="l">میانگین پوشش</div></div>';
      h += '<div class="stat ' + (totalShort===0?'ok':'dng') + '"><div class="v">' + totalShort + '</div><div class="l">کمبود</div></div>';
      h += '</div>';
      
      h += '<div class="sec-hd"><span>⚡ اقدامات سریع</span></div>';
      h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:16px">';
      h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.sa.go(\'wards\')"><span style="font-size:20px">📋</span><span style="font-size:11px;font-weight:800">بخش‌ها</span></button>';
      h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.sa.go(\'attendance\')"><span style="font-size:20px">📍</span><span style="font-size:11px;font-weight:800">حضور امروز</span></button>';
      h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.sa.go(\'requests\')"><span style="font-size:20px">📥</span><span style="font-size:11px;font-weight:800">درخواست‌ها</span></button>';
      h += '<button class="btn" style="padding:14px;display:flex;flex-direction:column;gap:4px;align-items:center" onclick="NABZ.sa.go(\'fairness\')"><span style="font-size:20px">📊</span><span style="font-size:11px;font-weight:800">عدالت</span></button>';
      h += '</div>';
      
      // Wards needing attention
      const critical = activeWards.filter(w => w.coverage < 85 || w.shortages > 0).slice(0, 5);
      if (critical.length) {
        h += '<div class="sec-hd"><span>⚠️ نیاز به توجه</span></div>';
        for (const w of critical) {
          const cls = w.coverage >= 95 ? 'ok' : w.coverage >= 80 ? 'warn' : 'dng';
          h += '<div class="row ' + (cls === 'dng' ? 'hi' : cls === 'warn' ? 'md' : '') + '" onclick="NABZ.sa.openWard(' + w.id + ')">';
          h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + w.coverage + '%</span></div>';
          h += '<div class="row-meta">' + w.staffCount + ' پرسنل · ' + (w.headNurse || '—') + (w.shortages > 0 ? ' · ⚠️ ' + w.shortages + ' کمبود' : '') + '</div>';
          h += '</div>';
        }
      }
      
      // Top staff
      h += '<div class="sec-hd"><span>🚀 تولید کامل (همه بخش‌ها)</span></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:16px;font-size:14px" onclick="NABZ.sa.solveAll()">⚡ حل یکجا برای همه بخش‌ها</button>';
      
      return h;
    },

    go(section) {
      this.ui.section = section;
      this._renderSaManager();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },

    async _saWardsList() {
      const wards = (this._cache.wards || {}).items || [];
      const period = await this._getPeriod();
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
      const groupLabels = { critical:'💔 مراقبت ویژه', surgical:'🔪 جراحی', internal:'🏥 داخلی', neuro:'🧠 نورولوژی', special:'✨ ویژه', er:'🚨 اورژانس', mgmt:'🏛 دفتری' };
      let h = '<div class="sec-hd"><span>🏥 بخش‌ها</span><span style="font-size:11px;color:var(--fg-2)">' + wards.length + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      for (const [grp, list] of Object.entries(groups)) {
        if (!list.length) continue;
        h += '<div style="font-size:12px;font-weight:900;color:var(--fg-2);margin:12px 0 8px;padding-bottom:6px;border-bottom:2px solid var(--border)">' + groupLabels[grp] + '</div>';
        for (const w of list) {
          const cls = w.coverage >= 95 ? 'ok' : w.coverage >= 80 ? 'warn' : 'dng';
          h += '<div class="row ' + (cls === 'dng' ? 'hi' : cls === 'warn' ? 'md' : 'lo') + '" onclick="NABZ.sa.openWard(' + w.id + ')">';
          h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + w.coverage + '%</span></div>';
          h += '<div class="row-meta">' + (w.headNurse || '—') + ' · ' + w.staffCount + ' پرسنل · عدالت: ' + w.fairness + (w.shortages>0 ? ' · ⚠️ ' + w.shortages : '') + '</div>';
          h += '<div class="progress" style="margin-top:6px"><div class="progress-fill ' + cls + '" style="width:' + w.coverage + '%"></div></div>';
          h += '</div>';
        }
      }
      return h;
    },

    async openWard(wardId) {
      this.ui.wardId = wardId;
      this.ui.section = 'ward_detail';
      this.ui.rosterTab = 'solve';
      this._renderSaManager();
    },

    async _saWardDetail() {
      const wardId = this.ui.wardId;
      if (!wardId) return '<div class="empty">بخش انتخاب نشده</div>';
      const ward = ((this._cache.wards || {}).items || []).find(w => w.id === wardId);
      if (!ward) return '<div class="empty">بخش یافت نشد</div>';
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      
      const tab = this.ui.rosterTab || 'solve';
      const stats = await this._api('/api/sa/fairness?wardId=' + wardId + '&periodId=' + period.id).catch(() => null);
      
      let h = '<div class="sec-hd"><span>✍️ ' + this._esc(ward.label) + '</span><span style="font-size:11px;color:var(--fg-2)">' + (ward.headNurse || '') + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'wards\')">← بازگشت به بخش‌ها</button>';
      
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
        h += '<button class="crisis-tab' + (tab === k ? ' on' : '') + '" onclick="NABZ.sa.setTab(\'' + k + '\')">' + lbl + '</button>';
      }
      h += '</div>';
      
      const body = await this._saWardTab(wardId, period.id, tab, stats);
      return h + body;
    },

    setTab(tab) { this.ui.rosterTab = tab; this._renderSaManager(); },

    async _saWardTab(wardId, periodId, tab, stats) {
      if (tab === 'demand') return this._saDemandTab(wardId, periodId);
      if (tab === 'solve') return this._saSolveTab(wardId);
      if (tab === 'preview') return this._saPreviewTab(wardId, periodId, stats);
      return this._saFairnessTab(stats);
    },

    async _saDemandTab(wardId, periodId) {
      const d = await this._api('/api/sa/demands?wardId=' + wardId + '&periodId=' + periodId).catch(() => ({ items: [] }));
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const dm = new Map();
      for (const x of d.items || []) dm.set(x.date + '|' + x.shift, x);
      
      const days = this._monthDays(period.jy, period.jm);
      let h = '<div class="hint info" style="margin-bottom:12px">حداقل / هدف برای پرستار و کمک‌پرستار</div>';
      h += '<div class="scroll-x" style="margin-bottom:12px"><table style="min-width:600px;font-size:11px">';
      h += '<thead><tr><th style="padding:6px 4px">تاریخ</th><th style="padding:6px 4px">روز</th>';
      for (const s of ['M','E','N']) h += '<th style="padding:6px 4px;text-align:center">' + SHIFT_ICON[s] + ' ' + SHIFT_FA[s] + '<br><small style="font-size:9px;opacity:.7">min/target</small></th>';
      h += '</tr></thead><tbody>';
      for (const d of days) {
        h += '<tr><td style="padding:4px;font-size:11px;font-weight:800">' + d.jd + '</td>';
        h += '<td style="padding:4px;font-size:10px;color:var(--fg-2)">' + WEEKDAYS[d.wd].slice(0,2) + '</td>';
        for (const s of ['M','E','N']) {
          const row = dm.get(d.date + '|' + s) || { minRn:0, minSup:0, targetRn:0, targetSup:0 };
          h += '<td style="padding:4px"><div style="display:flex;gap:2px;justify-content:center;flex-direction:column">';
          h += '<div style="display:flex;gap:2px"><input type="number" min="0" max="10" value="' + row.minRn + '" data-sadm="' + d.date + '|' + s + '|minRn" style="width:32px;padding:3px;text-align:center;font-size:11px">';
          h += '<input type="number" min="0" max="10" value="' + row.targetRn + '" data-sadm="' + d.date + '|' + s + '|targetRn" style="width:32px;padding:3px;text-align:center;font-size:11px"></div>';
          h += '<div style="display:flex;gap:2px"><input type="number" min="0" max="10" value="' + row.minSup + '" data-sadm="' + d.date + '|' + s + '|minSup" style="width:32px;padding:3px;text-align:center;font-size:11px">';
          h += '<input type="number" min="0" max="10" value="' + row.targetSup + '" data-sadm="' + d.date + '|' + s + '|targetSup" style="width:32px;padding:3px;text-align:center;font-size:11px"></div>';
          h += '</div></td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      h += '<button class="btn btn-primary btn-block" onclick="NABZ.sa.saveDemands(' + wardId + ',\'' + periodId + '\')">💾 ذخیره نیازها</button>';
      return h;
    },

    async saveDemands(wardId, periodId) {
      const inputs = document.querySelectorAll('[data-sadm]');
      const updates = new Map();
      for (const inp of inputs) {
        const [date, shift, field] = inp.dataset.sadm.split('|');
        const key = date + '|' + shift;
        if (!updates.has(key)) updates.set(key, { date, shift, minRn:0, minSup:0, targetRn:0, targetSup:0 });
        updates.get(key)[field] = Math.max(0, +inp.value || 0);
      }
      const items = Array.from(updates.values()).filter(x => x.minRn || x.minSup || x.targetRn || x.targetSup);
      try {
        const r = await this._api('/api/sa/demands', {
          method: 'POST',
          body: JSON.stringify({ periodId, wardId, items })
        });
        NABZ._toast('✅ ' + r.saved + ' ردیف ذخیره شد');
        this._invalidate();
        this._renderSaManager();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _saSolveTab(wardId) {
      const cfg = await this._api('/api/sa/config').catch(() => ({ weights: { coverage:100,pref:50,fair:30,rest:15,random:2 }, limits:{maxConsecutiveNights:2,maxConsecutiveWorkDays:6}, rest:{minMinutes:720} }));
      const w = cfg.weights || {};
      let h = '<div class="hint info" style="margin-bottom:12px">وزن‌ها را تنظیم کنید — مجموع تأثیر بر الگوریتم</div>';
      const weights = [['coverage','پوشش',100],['pref','ترجیحات',50],['fair','عدالت',30],['rest','استراحت',15]];
      for (const [k, lbl] of weights) {
        h += '<div style="background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:8px;display:flex;align-items:center;gap:10px">';
        h += '<label style="font-size:12px;font-weight:800;min-width:60px">' + lbl + '</label>';
        h += '<input type="range" min="0" max="200" value="' + (w[k]||0) + '" data-saw="' + k + '" style="flex:1;height:6px">';
        h += '<span style="font-size:13px;font-weight:900;color:var(--primary);min-width:36px;text-align:center;background:var(--primary-soft);padding:2px 6px;border-radius:6px" data-saw-val="' + k + '">' + (w[k]||0) + '</span>';
        h += '</div>';
      }
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">';
      h += '<div class="bs-field" style="margin:0"><label>حداکثر شب متوالی</label><input type="number" min="1" max="7" value="' + (cfg.limits?.maxConsecutiveNights||2) + '" data-sal="maxConsecutiveNights"></div>';
      h += '<div class="bs-field" style="margin:0"><label>حداکثر روز متوالی</label><input type="number" min="1" max="14" value="' + (cfg.limits?.maxConsecutiveWorkDays||6) + '" data-sal="maxConsecutiveWorkDays"></div>';
      h += '</div>';
      h += '<div class="bs-field" style="margin-bottom:12px"><label>حداقل استراحت (دقیقه)</label><input type="number" value="' + (cfg.rest?.minMinutes||720) + '" data-sar="minMinutes"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:16px;font-size:14px;margin-bottom:8px" onclick="NABZ.sa.runSolve(' + wardId + ')">🚀 تولید برنامه</button>';
      h += '<button class="btn" style="width:100%;padding:12px;margin-bottom:8px" onclick="NABZ.sa.saveConfigAndSolve(' + wardId + ')">💾 ذخیره تنظیمات و اجرا</button>';
      return h;
    },

    async _collectConfig() {
      const weights = {};
      document.querySelectorAll('[data-saw]').forEach(inp => weights[inp.dataset.saw] = +inp.value);
      const limits = {};
      document.querySelectorAll('[data-sal]').forEach(inp => limits[inp.dataset.sal] = +inp.value);
      const rest = {};
      document.querySelectorAll('[data-sar]').forEach(inp => rest[inp.dataset.sar] = +inp.value);
      return { weights, limits, rest };
    },

    async runSolve(wardId) {
      const period = await this._getPeriod();
      if (!period) return;
      const cfg = await this._collectConfig();
      NABZ._toast('در حال حل...');
      try {
        const r = await this._api('/api/sa/solve', {
          method: 'POST',
          body: JSON.stringify({ wardId, periodId: period.id, weights: cfg.weights })
        });
        NABZ._toast('✅ ' + r.saved + ' تخصیص — پوشش ' + r.coverage + '%');
        this._invalidate();
        this.ui.rosterTab = 'preview';
        this._renderSaManager();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async saveConfigAndSolve(wardId) {
      const cfg = await this._collectConfig();
      try {
        await this._api('/api/sa/config', { method: 'POST', body: JSON.stringify(cfg) });
        await this.runSolve(wardId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _saPreviewTab(wardId, periodId, stats) {
      const assigns = await this._api('/api/sa/assignments?wardId=' + wardId + '&periodId=' + periodId).catch(() => ({ items: [] }));
      const demands = await this._api('/api/sa/demands?wardId=' + wardId + '&periodId=' + periodId).catch(() => ({ items: [] }));
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const days = this._monthDays(period.jy, period.jm);
      const dm = new Map();
      for (const x of demands.items || []) dm.set(x.date + '|' + x.shift, x);
      const am = new Map();
      for (const a of assigns.items || []) {
        const k = a.date + '|' + a.shift;
        if (!am.has(k)) am.set(k, []);
        am.get(k).push(a);
      }
      
      let h = '<div class="hint info" style="margin-bottom:10px">کلیک روی هر سلول = جزئیات</div>';
      h += '<div class="scroll-x"><table style="min-width:340px;font-size:10px">';
      h += '<thead><tr><th style="padding:4px">ت</th><th style="padding:4px">ر</th>';
      for (const s of ['M','E','N']) h += '<th style="padding:4px">' + SHIFT_ICON[s] + '</th>';
      h += '</tr></thead><tbody>';
      for (const d of days) {
        h += '<tr><td style="padding:2px;font-size:10px;font-weight:800">' + d.jd + '</td>';
        h += '<td style="padding:2px;font-size:9px;color:var(--fg-2)">' + WEEKDAYS[d.wd].slice(0,2) + '</td>';
        for (const s of ['M','E','N']) {
          const demand = dm.get(d.date + '|' + s) || { minRn:0, minSup:0 };
          const needed = (demand.minRn||0) + (demand.minSup||0);
          const arr = am.get(d.date + '|' + s) || [];
          const assigned = arr.length;
          const checkedIn = arr.filter(a => ['checked_in','checked_out'].includes(a.state)).length;
          let cls = 'empty';
          if (assigned >= needed && needed > 0) cls = 'ok';
          else if (assigned > 0) cls = 'warn';
          else if (needed > 0) cls = 'dng';
          const color = cls === 'ok' ? 'var(--ok)' : cls === 'warn' ? 'var(--warn)' : cls === 'dng' ? 'var(--dng)' : 'var(--fg-3)';
          h += '<td style="padding:2px;text-align:center">';
          h += '<div onclick="NABZ.sa.cellDetail(' + wardId + ',\'' + d.date + '\',\'' + s + '\')" style="cursor:pointer;padding:4px;border-radius:4px;background:' + color + '20;color:' + color + ';font-weight:900;min-height:24px;display:flex;align-items:center;justify-content:center;position:relative">';
          if (needed || assigned) h += assigned + '/' + needed;
          else h += '—';
          if (checkedIn > 0) h += '<span style="position:absolute;top:1px;left:1px;width:5px;height:5px;border-radius:50%;background:var(--ok)"></span>';
          h += '</div></td>';
        }
        h += '</tr>';
      }
      h += '</tbody></table></div>';
      
      if (stats && stats.shortages.length) {
        h += '<div class="card" style="border-color:var(--dng);margin-top:12px">';
        h += '<div class="card-title">⚠️ ' + stats.shortages.length + ' کمبود</div>';
        for (const s of stats.shortages.slice(0, 10)) {
          h += '<div style="font-size:11.5px;padding:3px 0">' + s.date + ' — ' + SHIFT_FA[s.shift] + ': ' + s.filled + '/' + s.need + '</div>';
        }
        h += '</div>';
      }
      return h;
    },

    async cellDetail(wardId, date, shift) {
      const period = await this._getPeriod();
      if (!period) return;
      const assigns = await this._api('/api/sa/assignments?wardId=' + wardId + '&periodId=' + period.id + '&date=' + date).catch(() => ({ items: [] }));
      const filtered = (assigns.items || []).filter(a => a.shift === shift);
      const staff = await this._api('/api/sa/staff?wardId=' + wardId + '&limit=200').catch(() => ({ items: [] }));
      
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">' + date + ' — ' + SHIFT_FA[shift] + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="bs-body">';
      h += '<div class="sec-hd" style="margin:0 0 8px"><span>تخصیص‌یافته (' + filtered.length + ')</span></div>';
      if (!filtered.length) h += '<div class="empty" style="padding:12px">هیچ‌کس</div>';
      else {
        for (const a of filtered) {
          const staffRec = (staff.items || []).find(s => s.id === a.staffId) || { name: '?' };
          const attCls = ATT_CLS[a.state] || 'info';
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px;background:var(--bg-2);border-radius:8px;margin-bottom:4px;font-size:12px">';
          h += '<div><b>' + this._esc(staffRec.name) + '</b> <span class="pill ' + attCls + '" style="font-size:9px;margin-right:4px">' + (ATT_FA[a.state]||'—') + '</span>' + (a.locked ? ' 🔒' : '') + '</div>';
          h += '<div><button class="btn" style="padding:2px 8px;font-size:11px" onclick="NABZ.sa.removeAssignment(' + a.id + ')">✗</button></div>';
          h += '</div>';
        }
      }
      h += '<div class="sec-hd" style="margin:12px 0 8px"><span>➕ افزودن</span></div>';
      h += '<div style="max-height:200px;overflow-y:auto">';
      for (const s of (staff.items || []).filter(x => !filtered.find(a => a.staffId === x.id))) {
        h += '<button class="btn" style="width:100%;margin-bottom:2px;padding:8px;font-size:11px;justify-content:space-between;display:flex" onclick="NABZ.sa.addAssignment(' + wardId + ',\'' + date + '\',\'' + shift + '\',' + s.id + ')"><span>' + this._esc(s.name) + '</span><small style="color:var(--fg-2)">' + (CAT_FA[s.category] || '') + '</small></button>';
      }
      h += '</div></div>';
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
    },

    async addAssignment(wardId, date, shift, staffId) {
      const period = await this._getPeriod();
      if (!period) return;
      try {
        await this._api('/api/sa/assignments', {
          method: 'POST',
          body: JSON.stringify({ periodId: period.id, staffId, wardId, date, shift })
        });
        NABZ._toast('✅ افزوده شد');
        document.querySelector('.bs-backdrop')?.remove();
        this._renderSaManager();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async removeAssignment(id) {
      try {
        await this._api('/api/sa/assignments/' + id, { method: 'DELETE' });
        NABZ._toast('✅ حذف شد');
        document.querySelector('.bs-backdrop')?.remove();
        this._renderSaManager();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _saFairnessTab(stats) {
      if (!stats) return '<div class="empty">آماری نیست</div>';
      let h = '<div class="sec-hd"><span>📊 شاخص‌های عدالت</span></div>';
      const metrics = [
        { k:'nightGini', label:'Gini شب', good:.1, warn:.2, val:stats.fairness.nightGini },
        { k:'weekendCV', label:'CV جمعه', good:.15, warn:.3, val:stats.fairness.weekendCV },
        { k:'hourCV', label:'CV ساعت', good:.1, warn:.2, val:stats.fairness.hourCV }
      ];
      h += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px">';
      for (const m of metrics) {
        const cls = m.val <= m.good ? 'ok' : m.val <= m.warn ? 'warn' : 'dng';
        h += '<div class="stat ' + cls + '" style="padding:10px"><div class="v" style="font-size:18px">' + m.val + '</div><div class="l">' + m.label + '</div></div>';
      }
      h += '</div>';
      h += '<div class="sec-hd"><span>👥 پرسنل</span></div>';
      h += '<div class="scroll-x"><table style="min-width:400px"><thead><tr><th>نام</th><th>سمت</th><th>شب</th><th>شیفت</th><th>ساعت</th></tr></thead><tbody>';
      const sorted = (stats.staffStats || []).sort((a,b) => b.hours - a.hours);
      for (const s of sorted) {
        h += '<tr><td>' + this._esc(s.name) + '</td><td style="font-size:10px;color:var(--fg-2)">' + (CAT_FA[s.category] || '—') + '</td>';
        h += '<td style="color:var(--violet)">' + s.nights + '</td><td>' + s.shifts + '</td><td>' + Math.round(s.hours) + 'h</td></tr>';
      }
      h += '</tbody></table></div>';
      return h;
    },

    async _saFairnessList() {
      const wards = ((this._cache.wards || {}).items || []).filter(w => !w.isManagement);
      let h = '<div class="sec-hd"><span>📊 عدالت — همه بخش‌ها</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      for (const w of wards.sort((a,b) => b.fairness - a.fairness)) {
        const cls = w.fairness >= 0.8 ? 'ok' : w.fairness >= 0.6 ? 'warn' : 'dng';
        h += '<div class="row ' + (cls === 'dng' ? 'hi' : cls === 'warn' ? 'md' : 'lo') + '" onclick="NABZ.sa.openWard(' + w.id + ')">';
        h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div><span class="pill ' + cls + '">' + w.fairness + '</span></div>';
        h += '<div class="row-meta">پوشش: ' + w.coverage + '% · ' + w.staffCount + ' پرسنل</div>';
        h += '<div class="progress" style="margin-top:6px"><div class="progress-fill ' + cls + '" style="width:' + Math.round(w.fairness*100) + '%"></div></div>';
        h += '</div>';
      }
      return h;
    },

    async _saRequests() {
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const prefs = await this._api('/api/sa/preferences?periodId=' + period.id + '&status=submitted').catch(() => ({ items: [] }));
      let h = '<div class="sec-hd"><span>📥 درخواست‌های در انتظار</span><span style="font-size:11px;color:var(--fg-2)">' + (prefs.items || []).length + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      if (!(prefs.items || []).length) { h += '<div class="empty">درخواستی نیست</div>'; return h; }
      
      const grouped = {};
      for (const p of prefs.items) {
        if (!grouped[p.staffId]) grouped[p.staffId] = [];
        grouped[p.staffId].push(p);
      }
      for (const [staffId, list] of Object.entries(grouped)) {
        const staffData = (this._cache.staffCache || {})[staffId] || null;
        h += '<div class="card" style="margin-bottom:8px">';
        h += '<div class="card-title">👤 پرسنل #' + staffId + ' — ' + list.length + ' مورد</div>';
        for (const p of list.slice(0, 8)) {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12px;border-top:1px solid var(--border)">';
          h += '<span>' + p.date + ' — ' + REQ_FA[p.requestType] + '</span>';
          h += '<span><button class="btn btn-ok btn-xs" style="padding:3px 8px;font-size:10px" onclick="NABZ.sa.approvePref(' + p.id + ',true)">✓</button> <button class="btn btn-dng btn-xs" style="padding:3px 8px;font-size:10px" onclick="NABZ.sa.approvePref(' + p.id + ',false)">✗</button></span>';
          h += '</div>';
        }
        h += '</div>';
      }
      return h;
    },

    async approvePref(id, ok) {
      try {
        await this._api('/api/sa/preferences/' + id + '/approve', { method: 'POST', body: JSON.stringify({ approve: ok }) });
        NABZ._toast(ok ? '✅ تأیید' : '❌ رد');
        this._renderSaManager();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _saTodayAttendance() {
      const today = await this._api('/api/sa/attendance/today').catch(() => ({ byWard: {}, totalAssignments: 0 }));
      let h = '<div class="sec-hd"><span>📍 حضور امروز</span><span style="font-size:11px;color:var(--fg-2)">' + (today.date || '') + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      const wards = (this._cache.wards || {}).items || [];
      const byWard = today.byWard || {};
      
      let totalAll = 0, presentAll = 0, lateAll = 0, absentAll = 0;
      for (const w of wards) {
        const d = byWard[w.id] || { total:0, checked_in:0, checked_out:0, late:0, absent:0 };
        totalAll += d.total; presentAll += d.checked_in + d.checked_out; lateAll += d.late; absentAll += d.absent;
      }
      h += '<div class="grid-4" style="margin-bottom:16px">';
      h += '<div class="stat"><div class="v">' + totalAll + '</div><div class="l">کل</div></div>';
      h += '<div class="stat ok"><div class="v">' + presentAll + '</div><div class="l">حاضر</div></div>';
      h += '<div class="stat warn"><div class="v">' + lateAll + '</div><div class="l">تأخیر</div></div>';
      h += '<div class="stat dng"><div class="v">' + absentAll + '</div><div class="l">غیبت</div></div>';
      h += '</div>';
      
      h += '<div class="sec-hd"><span>🏥 جزئیات بخش‌ها</span></div>';
      for (const w of wards) {
        if (!byWard[w.id] || !byWard[w.id].total) continue;
        const d = byWard[w.id];
        const cls = d.absent > 0 ? 'dng' : d.late > 0 ? 'warn' : 'ok';
        h += '<div class="row ' + (cls === 'dng' ? 'hi' : cls === 'warn' ? 'md' : '') + '">';
        h += '<div class="row-hd"><div class="row-title">' + this._esc(w.label) + '</div>';
        h += '<span class="pill ' + cls + '">' + (d.checked_in+d.checked_out) + '/' + d.total + '</span></div>';
        h += '<div class="row-meta">';
        if (d.late > 0) h += '⚠️ ' + d.late + ' تأخیر · ';
        if (d.absent > 0) h += '❌ ' + d.absent + ' غیبت · ';
        h += '⏳ ' + d.scheduled + ' در انتظار';
        h += '</div></div>';
      }
      return h;
    },

    async _saPayroll() {
      const period = await this._getPeriod();
      if (!period) return '<div class="empty">دوره یافت نشد</div>';
      const d = await this._api('/api/sa/payroll?periodId=' + period.id).catch(() => ({ items: [] }));
      let h = '<div class="sec-hd"><span>💰 کارانه — ' + MONTHS[period.jm-1] + ' ' + period.jy + '</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      if (!(d.items||[]).length) { h += '<div class="empty">داده‌ای نیست</div>'; return h; }
      h += '<div class="scroll-x"><table><thead><tr><th>نام</th><th>بخش</th><th>ساعت</th><th>اضافه</th><th>خالص</th></tr></thead><tbody>';
      for (const p of (d.items||[]).sort((a,b)=>b.net-a.net).slice(0, 100)) {
        h += '<tr><td>' + this._esc(p.staffName) + '</td><td style="font-size:10px">' + this._esc(p.wardLabel) + '</td>';
        h += '<td>' + Math.round(p.totalMin/60) + 'h</td><td>' + Math.round(p.overtimeMin/60) + 'h</td>';
        h += '<td style="color:var(--ok);font-weight:800">' + this._fmtNum(p.net) + '</td></tr>';
      }
      h += '</tbody></table></div>';
      return h;
    },

    async _saConfig() {
      const cfg = await this._api('/api/sa/config').catch(() => null);
      if (!cfg) return '<div class="empty">تنظیمات یافت نشد</div>';
      let h = '<div class="sec-hd"><span>⚙️ تنظیمات الگوریتم</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      h += '<div class="card"><div class="card-title">⚖️ وزن‌ها</div>';
      for (const [k, lbl] of [['coverage','پوشش'],['pref','ترجیحات'],['fair','عدالت'],['rest','استراحت']]) {
        h += '<div style="display:flex;justify-content:space-between;font-size:12px;padding:4px 0"><span>' + lbl + '</span><b>' + (cfg.weights[k]||0) + '</b></div>';
      }
      h += '</div>';
      h += '<div class="card"><div class="card-title">⏱️ محدودیت‌ها</div>';
      h += '<div style="font-size:12px;line-height:1.8">';
      h += 'حداکثر شب متوالی: <b>' + (cfg.limits.maxConsecutiveNights||2) + '</b><br>';
      h += 'حداکثر روز متوالی: <b>' + (cfg.limits.maxConsecutiveWorkDays||6) + '</b><br>';
      h += 'حداقل استراحت: <b>' + (cfg.rest.minMinutes||720) + ' دقیقه</b>';
      h += '</div></div>';
      return h;
    },

    async _saAudit() {
      const chain = await this._api('/api/sa/audit?limit=50').catch(() => ({ items: [] }));
      const verify = await this._api('/api/sa/audit/verify').catch(() => ({ ok: true, count: 0 }));
      let h = '<div class="sec-hd"><span>🔐 Audit Trail</span></div>';
      h += '<button class="btn" style="width:100%;margin-bottom:12px;padding:10px;font-size:12px" onclick="NABZ.sa.go(\'home\')">← بازگشت</button>';
      h += '<div class="card" style="border-color:var(--' + (verify.ok?'ok':'dng') + ')">';
      h += '<div style="text-align:center;font-size:16px;font-weight:900;color:var(--' + (verify.ok?'ok':'dng') + ')">' + (verify.ok?'✅ زنجیره سالم':'❌ شکسته') + '</div>';
      h += '<div style="text-align:center;font-size:11px;color:var(--fg-2);margin-top:4px">' + verify.count + ' رکورد</div>';
      h += '</div>';
      for (const a of (chain.items||[])) {
        h += '<div class="card" style="padding:10px;margin-bottom:4px">';
        h += '<div style="font-size:11px;font-weight:800">' + this._esc(a.action) + '</div>';
        h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + (a.actor?.name || '?') + ' · ' + new Date(a.at).toLocaleString('fa-IR') + '</div>';
        h += '<div style="font-family:monospace;font-size:9px;color:var(--primary);margin-top:3px">' + (a.hash||'').slice(0,12) + '</div>';
        h += '</div>';
      }
      return h;
    },

    async solveAll() {
      if (!confirm('برنامه همه بخش‌ها با تنظیمات فعلی بازتولید شود؟')) return;
      NABZ._toast('در حال حل همه بخش‌ها...');
      try {
        const r = await this._api('/api/sa/solve-all', { method: 'POST', body: JSON.stringify({}) });
        const ok = (r.results||[]).filter(x => !x.error).length;
        const err = (r.results||[]).filter(x => x.error).length;
        NABZ._toast('✅ ' + ok + ' بخش حل شد' + (err ? ' (' + err + ' خطا)' : ''));
        this._invalidate();
        this._renderSaManager();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ─── Helpers ───
    _monthDays(jy, jm) {
      const ml = jm <= 6 ? 31 : jm <= 11 ? 30 : 29;
      const days = [];
      const gy = new Date().getFullYear();
      for (let d = 1; d <= ml; d++) {
        // Weekday: approximate using G2J conversion
        const dow = this._jalaliWeekday(jy, jm, d);
        days.push({ jd: d, date: jy + '/' + this._pad(jm) + '/' + this._pad(d), wd: dow, isFri: dow === 6 });
      }
      return days;
    },
    _jalaliWeekday(jy, jm, jd) {
      try {
        const t = new Date();
        const g = new Date(jy + 621, jm <= 10 ? jm + 2 : jm - 10, jd);
        // Rough: subtract 1 day offset typical in Jalaali conversion
        return (g.getDay() + 1) % 7;
      } catch (e) { return 0; }
    },

    // ═══════════════════════════════════════════════════════════
    //  STAFF VIEW (kind: sa_staff, role: shift_staff)
    // ═══════════════════════════════════════════════════════════
    async staffHome() {
      const user = NABZ.state.user;
      if (!user || user.role !== 'shift_staff') return this.showDashboard(null, null);
      const m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        const period = await this._getPeriod();
        const assigns = await this._api('/api/sa/assignments?staffId=' + user.staffId + (period ? '&periodId=' + period.id : '')).catch(() => ({ items: [] }));
        const today = this._todayJalali();
        const todayA = (assigns.items||[]).find(a => a.date === today);
        
        let h = '<div class="sec-hd"><span>👋 سلام ' + this._esc(user.fullName || user.username) + '</span></div>';
        if (period) h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        
        if (todayA) {
          const state = todayA.state || 'scheduled';
          h += '<div class="card" style="border-color:var(--primary);background:linear-gradient(135deg,rgba(6,182,212,0.1),rgba(139,92,246,0.05));margin-bottom:12px">';
          h += '<div class="card-title">📍 شیفت امروز</div>';
          h += '<div style="font-size:18px;font-weight:900;margin:6px 0">' + SHIFT_ICON[todayA.shift] + ' ' + SHIFT_FA[todayA.shift] + '</div>';
          h += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:10px">وضعیت: <span class="pill ' + (ATT_CLS[state]||'info') + '">' + (ATT_FA[state]||'—') + '</span></div>';
          if (state === 'scheduled') {
            h += '<div style="display:flex;gap:6px">';
            h += '<button class="btn btn-ok" style="flex:1;padding:10px;font-size:12px" onclick="NABZ.sa.staffCheckIn(' + todayA.id + ')">✅ ورود</button>';
            h += '<button class="btn btn-warn" style="flex:1;padding:10px;font-size:12px" onclick="NABZ.sa.staffLate(' + todayA.id + ')">⏰ تأخیر</button>';
            h += '</div>';
          } else if (state === 'checked_in') {
            h += '<button class="btn btn-primary" style="width:100%;padding:10px;font-size:12px" onclick="NABZ.sa.staffCheckOut(' + todayA.id + ')">🚪 پایان شیفت</button>';
          }
          h += '</div>';
        } else {
          h += '<div class="hint info" style="margin-bottom:12px">امروز شیفتی ندارید</div>';
        }
        
        const totalMin = (assigns.items||[]).reduce((s,a) => s + (a.actualMinutes||0), 0);
        const nights = (assigns.items||[]).filter(a => ['N','EN'].includes(a.shift)).length;
        const shifts = (assigns.items||[]).length;
        h += '<div class="grid-4" style="margin-bottom:16px">';
        h += '<div class="stat"><div class="v">' + shifts + '</div><div class="l">شیفت</div></div>';
        h += '<div class="stat"><div class="v">' + Math.round(totalMin/60) + 'h</div><div class="l">کارکرد</div></div>';
        h += '<div class="stat"><div class="v">' + nights + '</div><div class="l">شب</div></div>';
        h += '<div class="stat ok"><div class="v">' + ((assigns.items||[]).filter(a => a.state === 'checked_in').length) + '</div><div class="l">حاضر</div></div>';
        h += '</div>';
        
        h += '<div class="sec-hd"><span>📅 شیفت‌های این ماه</span></div>';
        const sorted = (assigns.items||[]).sort((a,b) => a.date < b.date ? -1 : 1);
        for (const a of sorted.slice(0, 20)) {
          const c = SHIFT_COLORS[a.shift] || { bg:'var(--bg-3)', fg:'var(--fg-2)' };
          h += '<div class="row lo" style="padding:10px">';
          h += '<div class="row-hd"><div class="row-title" style="font-size:13px">' + a.date + '</div>';
          h += '<span class="pill" style="background:' + c.bg + ';color:' + c.fg + '">' + SHIFT_ICON[a.shift] + ' ' + SHIFT_FA[a.shift] + '</span></div>';
          if (a.state && a.state !== 'scheduled') h += '<div class="row-meta">' + (ATT_FA[a.state]||'') + '</div>';
          h += '</div>';
        }
        
        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    async staffCheckIn(assignId) {
      try {
        await this._api('/api/sa/attendance/' + assignId + '/checkin', { method: 'POST', body: '{}' });
        NABZ._toast('✅ ثبت ورود');
        this.staffHome();
      } catch (e) { alert('خطا: ' + e.message); }
    },
    async staffCheckOut(assignId) {
      try {
        await this._api('/api/sa/attendance/' + assignId + '/checkout', { method: 'POST', body: '{}' });
        NABZ._toast('🚪 پایان شیفت');
        this.staffHome();
      } catch (e) { alert('خطا: ' + e.message); }
    },
    async staffLate(assignId) {
      const reason = prompt('دلیل تأخیر:') || '';
      try {
        await this._api('/api/sa/attendance/' + assignId + '/late', { method: 'POST', body: JSON.stringify({ reason }) });
        NABZ._toast('⚠️ اعلام شد');
        this.staffHome();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async staffRequest() {
      const user = NABZ.state.user;
      const m = document.getElementById('content');
      try {
        const period = await this._getPeriod();
        if (!period) return;
        const days = this._monthDays(period.jy, period.jm);
        const prefs = await this._api('/api/sa/preferences?staffId=' + user.staffId + '&periodId=' + period.id).catch(() => ({ items: [] }));
        const prefMap = new Map();
        for (const p of prefs.items || []) prefMap.set(p.date, p);
        
        this.ui.reqBuffer = (prefs.items || []).filter(p => p.status === 'draft').map(p => ({ date: p.date, requestType: p.requestType }));
        const bufferMap = new Map();
        for (const b of this.ui.reqBuffer) bufferMap.set(b.date, b);
        
        let h = '<div class="sec-hd"><span>📝 درخواست شیفت</span></div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        
        // Calendar
        h += '<div class="card" style="padding:8px">';
        h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:6px">';
        for (const w of ['ش','ی','د','س','چ','پ','ج']) h += '<div style="text-align:center;font-size:9px;font-weight:900;color:var(--fg-2);padding:4px 0">' + w + '</div>';
        h += '</div>';
        h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">';
        // Pad start
        const firstWd = days[0].wd;
        for (let i = 0; i < firstWd; i++) h += '<div></div>';
        for (const d of days) {
          const buf = bufferMap.get(d.date);
          const existing = prefMap.get(d.date);
          let bg = 'var(--bg-2)';
          let fg = 'var(--fg)';
          if (existing) {
            const c = SHIFT_COLORS[SHIFT_ICON.rev?.[existing.requestType]] || { bg:'rgba(139,92,246,0.15)', fg:'var(--violet)' };
            bg = 'rgba(139,92,246,0.15)';
            fg = 'var(--violet)';
          }
          if (buf) { bg = 'rgba(6,182,212,0.2)'; fg = 'var(--primary)'; }
          if (d.isFri) bg = 'rgba(239,68,68,0.08)';
          h += '<div onclick="NABZ.sa.staffPickDate(\'' + d.date + '\')" style="background:' + bg + ';color:' + fg + ';border:1px solid var(--border);border-radius:4px;padding:4px;min-height:40px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center">';
          h += '<div style="font-size:11px;font-weight:800">' + d.jd + '</div>';
          if (buf) h += '<div style="font-size:8px;font-weight:700">' + REQ_ICON[buf.requestType] + '</div>';
          else if (existing) h += '<div style="font-size:8px">' + REQ_ICON[existing.requestType] + '</div>';
          h += '</div>';
        }
        h += '</div></div>';
        
        h += '<div style="display:flex;gap:6px;margin-top:12px">';
        h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.sa.staffSaveReq(\'draft\')">💾 پیش‌نویس</button>';
        h += '<button class="btn btn-primary" style="flex:2;padding:12px" onclick="NABZ.sa.staffSaveReq(\'submitted\')">📤 ارسال</button>';
        h += '</div>';
        
        m.innerHTML = h;
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>';
      }
    },

    staffPickDate(date) {
      const existing = this.ui.reqBuffer.find(b => b.date === date);
      const sheet = document.createElement('div');
      sheet.className = 'bs-backdrop';
      sheet.onclick = e => { if (e.target === sheet) sheet.remove(); };
      let h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">' + date + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="bs-body">';
      const shifts = [['MORNING','صبح','🌅'],['EVENING','عصر','🌆'],['NIGHT','شب','🌙'],['LONG','لانگ','📏'],['EVENING_NIGHT','عصر+شب','🌗'],['H24','۲۴ساعته','⏰']];
      h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin-bottom:8px">شیفت</div>';
      for (const [code, label, ico] of shifts) {
        h += '<button class="btn" style="width:100%;margin-bottom:4px;padding:12px;justify-content:flex-start;text-align:right" onclick="NABZ.sa.staffPickReq(\'' + date + '\',\'' + code + '\')">' + ico + ' ' + label + '</button>';
      }
      h += '<div style="font-size:11px;font-weight:900;color:var(--fg-2);margin:12px 0 8px">مرخصی</div>';
      const leaves = [['LEAVE','مرخصی','🏖️'],['SICK','استعلاجی','🤒'],['REST','استراحت','💤']];
      for (const [code, label, ico] of leaves) {
        h += '<button class="btn" style="width:100%;margin-bottom:4px;padding:12px;justify-content:flex-start;text-align:right" onclick="NABZ.sa.staffPickReq(\'' + date + '\',\'' + code + '\')">' + ico + ' ' + label + '</button>';
      }
      if (existing) {
        h += '<button class="btn btn-dng" style="width:100%;margin-top:12px;padding:10px" onclick="NABZ.sa.staffClearReq(\'' + date + '\')">🗑 حذف</button>';
      }
      h += '</div>';
      const c = document.createElement('div');
      c.className = 'bs-sheet';
      c.innerHTML = h;
      sheet.appendChild(c);
      document.body.appendChild(sheet);
      requestAnimationFrame(() => sheet.classList.add('show'));
    },

    staffPickReq(date, type) {
      this.ui.reqBuffer = this.ui.reqBuffer.filter(b => b.date !== date);
      this.ui.reqBuffer.push({ date, requestType: type });
      document.querySelector('.bs-backdrop')?.remove();
      this.staffRequest();
    },

    staffClearReq(date) {
      this.ui.reqBuffer = this.ui.reqBuffer.filter(b => b.date !== date);
      document.querySelector('.bs-backdrop')?.remove();
      this.staffRequest();
    },

    async staffSaveReq(status) {
      const user = NABZ.state.user;
      const period = await this._getPeriod();
      if (!period) return;
      try {
        await this._api('/api/sa/preferences', {
          method: 'POST',
          body: JSON.stringify({
            periodId: period.id,
            staffId: user.staffId,
            items: this.ui.reqBuffer,
            status
          })
        });
        NABZ._toast(status === 'submitted' ? '✅ ارسال شد' : '💾 ذخیره شد');
        this.staffHome();
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async staffSchedule() {
      const user = NABZ.state.user;
      const m = document.getElementById('content');
      try {
        const period = await this._getPeriod();
        if (!period) return;
        const assigns = await this._api('/api/sa/assignments?staffId=' + user.staffId + '&periodId=' + period.id).catch(() => ({ items: [] }));
        const sorted = (assigns.items||[]).sort((a,b) => a.date < b.date ? -1 : 1);
        
        let h = '<div class="sec-hd"><span>📅 برنامه من</span></div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-bottom:12px">' + MONTHS[period.jm-1] + ' ' + period.jy + '</div>';
        if (!sorted.length) { h += '<div class="empty">برنامه‌ای نیست</div>'; }
        else {
          for (const a of sorted) {
            const c = SHIFT_COLORS[a.shift] || { bg:'var(--bg-3)', fg:'var(--fg-2)' };
            h += '<div class="row lo" style="padding:10px">';
            h += '<div class="row-hd"><div class="row-title" style="font-size:13px">' + a.date + '</div>';
            h += '<span class="pill" style="background:' + c.bg + ';color:' + c.fg + '">' + SHIFT_ICON[a.shift] + ' ' + SHIFT_FA[a.shift] + '</span></div>';
            h += '<div class="row-meta">' + (ATT_FA[a.state]||'—') + '</div>';
            h += '</div>';
          }
        }
        m.innerHTML = h;
      } catch (e) { m.innerHTML = '<div class="empty">خطا: ' + this._esc(e.message) + '</div>'; }
    },

    staffView(view) {
      if (view === 'home') this.staffHome();
      else if (view === 'checkin') this.staffHome(); // checkin is on home
      else if (view === 'request') this.staffRequest();
      else if (view === 'schedule') this.staffSchedule();
      else this.staffHome();
    },

    _todayJalali() {
      // Best-effort — server provides authoritative values
      const now = new Date();
      const y = now.getFullYear(), m = now.getMonth() + 1, d = now.getDate();
      // Simple approximation
      const jy = y - 621, jm = m <= 3 ? m + 9 : m - 3, jd = d;
      return jy + '/' + this._pad(jm) + '/' + this._pad(jd);
    }
  };

  // Attach to NABZ
  window.NABZ = window.NABZ || {};
  NABZ.sa = Sa;
  console.log('[sa] shift assistant loaded ✓');
})();
EOF_SA
echo "✅ public/sa.js ($(wc -l < public/sa.js) lines)"

# ═══════════════════════════════════════════════════════════
#  public/sa-init.js
# ═══════════════════════════════════════════════════════════
cat > public/sa-init.js << 'EOF_INIT'
// ═══════════════════════════════════════════════════════════
//  NABZ Shift Assistant — Bootstrap + PIN login + staff nav
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  // ─── 1) Wrap NABZ.show for sa kinds ───
  function patchShow() {
    if (!window.NABZ || typeof NABZ.show !== 'function') return setTimeout(patchShow, 200);
    if (NABZ.show._saWrapped) return;
    const orig = NABZ.show;
    NABZ.show = async function(id) {
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
      if (p && p.kind === 'sa_staff' && NABZ.sa) {
        NABZ.state.current = id;
        document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
        await NABZ.sa.staffSchedule();
        return;
      }
      return orig.call(NABZ, id);
    };
    NABZ.show._saWrapped = true;
    console.log('[sa-init] show() wrapped ✓');
  }
  patchShow();

  // ─── 2) Wrap NABZ.showHome for shift_staff role ───
  function patchShowHome() {
    if (!window.NABZ || typeof NABZ.showHome !== 'function') return setTimeout(patchShowHome, 200);
    if (NABZ.showHome._saWrapped) return;
    const orig = NABZ.showHome;
    NABZ.showHome = async function() {
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff' && NABZ.sa) {
        return NABZ.sa.staffHome();
      }
      return orig.call(this);
    };
    NABZ.showHome._saWrapped = true;
    console.log('[sa-init] showHome() wrapped ✓');
  }
  patchShowHome();

  // ─── 3) Wrap NABZ.boot to patch shift_staff nav ───
  function patchBoot() {
    if (!window.NABZ || typeof NABZ.boot !== 'function') return setTimeout(patchBoot, 200);
    if (NABZ.boot._saWrapped) return;
    const orig = NABZ.boot;
    NABZ.boot = async function() {
      const result = await orig.call(this);
      if (NABZ.state.user && NABZ.state.user.role === 'shift_staff') {
        setTimeout(patchShiftStaffNav, 50);
      }
      return result;
    };
    NABZ.boot._saWrapped = true;
    console.log('[sa-init] boot() wrapped ✓');
  }
  patchBoot();

  function patchShiftStaffNav() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    if (sidebar.dataset.saPatched) return;
    sidebar.dataset.saPatched = '1';
    sidebar.innerHTML = [
      '<button class="bn-tab on" data-nav="home" onclick="NABZ.sa.staffView(\'home\');NABZ._markTab(this)">',
      '  <span class="bn-icon">🏠</span><span class="bn-label">خانه</span></button>',
      '<button class="bn-tab" data-nav="checkin" onclick="NABZ.sa.staffView(\'checkin\');NABZ._markTab(this)">',
      '  <span class="bn-icon">📍</span><span class="bn-label">حضور</span></button>',
      '<button class="bn-tab" data-nav="request" onclick="NABZ.sa.staffView(\'request\');NABZ._markTab(this)">',
      '  <span class="bn-icon">📝</span><span class="bn-label">درخواست</span></button>',
      '<button class="bn-tab" data-nav="schedule" onclick="NABZ.sa.staffView(\'schedule\');NABZ._markTab(this)">',
      '  <span class="bn-icon">📅</span><span class="bn-label">برنامه</span></button>',
      '<button class="bn-tab" onclick="NABZ.logout()">',
      '  <span class="bn-icon">⏻</span><span class="bn-label">خروج</span></button>'
    ].join('');
    console.log('[sa-init] shift_staff nav patched ✓');
  }

  NABZ._markTab = function(btn) {
    document.querySelectorAll('.bn-tab').forEach(b => b.classList.remove('on'));
    btn.classList.add('on');
  };

  // ─── 4) Inject PIN login tab on login screen ───
  function injectPinTab() {
    const tabs = document.querySelector('.lg-tabs');
    if (!tabs || tabs.querySelector('[data-pin]')) return true;
    const btn = document.createElement('button');
    btn.dataset.pin = '1';
    btn.type = 'button';
    btn.textContent = '🏥 دستیار شیفت';
    btn.onclick = () => switchToPinMode(btn);
    tabs.appendChild(btn);
    return true;
  }
  function tryInjectPin() {
    if (!injectPinTab()) setTimeout(tryInjectPin, 300);
  }

  function switchToPinMode(btn) {
    document.querySelectorAll('.lg-tabs button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const form = document.getElementById('lgf');
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(form);
      const code = String(fd.get('u') || '').trim();
      const pin = String(fd.get('p') || '').trim();
      if (!code || !pin) return;
      const submitBtn = form.querySelector('button');
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = '...'; }
      try {
        const r = await fetch('/api/sa/auth/pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, pin })
        }).then(x => x.json());
        if (!r.ok) throw new Error(r.error || 'login_failed');
        localStorage.setItem('nabz_tk', r.data.token);
        localStorage.setItem('nabz_u', JSON.stringify({
          id: 'sa_' + r.data.staff.id,
          username: r.data.staff.code,
          role: 'shift_staff',
          fullName: r.data.staff.name,
          ward: null,
          staffId: r.data.staff.id,
          wardId: r.data.staff.wardId
        }));
        location.reload();
      } catch (err) {
        document.getElementById('le').textContent = 'کد یا PIN نادرست است';
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🔐 ورود'; }
      }
    };
    const inputs = form.querySelectorAll('input');
    if (inputs[0]) { inputs[0].placeholder = 'کد پرسنلی (مثلاً 5059258191)'; inputs[0].value = ''; inputs[0].type = 'text'; }
    if (inputs[1]) { inputs[1].placeholder = 'PIN (۴ رقم آخر کد)'; inputs[1].value = ''; inputs[1].type = 'password'; }
  }

  // ─── 5) Boot ───
  function boot() {
    const token = localStorage.getItem('nabz_tk');
    if (!token) {
      tryInjectPin();
    } else {
      // May be shift_staff — check and patch nav
      setTimeout(() => {
        if (NABZ.state.user && NABZ.state.user.role === 'shift_staff') {
          patchShiftStaffNav();
        }
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
EOF_INIT
echo "✅ public/sa-init.js ($(wc -l < public/sa-init.js) lines)"

# ═══════════════════════════════════════════════════════════
#  public/style.css — append
# ═══════════════════════════════════════════════════════════
if ! grep -q "sa-shift-tag" public/style.css 2>/dev/null; then
cat >> public/style.css << 'EOF_CSS'

/* ═══════════════════════════════════════════════════════════
   Shift Assistant (dastyar) — Part 17+
   ═══════════════════════════════════════════════════════════ */
.sa-cal { display:grid; grid-template-columns:repeat(7,1fr); gap:2px; }
.sa-cal-cell {
  background:var(--bg-2);
  border:1px solid var(--border);
  border-radius:5px;
  padding:4px;
  min-height:46px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  cursor:pointer;
  transition:all var(--dur-fast);
  font-size:11px;
}
.sa-cal-cell:hover { background:var(--bg-3); border-color:var(--border-3); }
.sa-cal-cell.empty { background:transparent; border:none; cursor:default; }
.sa-cal-cell.fri { background:rgba(239,68,68,0.06); }
.sa-cal-cell.today { border-color:var(--primary); box-shadow:0 0 0 2px var(--primary-soft); }
.sa-cal-cell .sa-day { font-size:11px; font-weight:900; }
.sa-cal-cell .sa-tag { font-size:8px; margin-top:2px; }

.sa-shift-tag {
  display:inline-flex;
  align-items:center;
  gap:3px;
  padding:2px 6px;
  border-radius:6px;
  font-size:10px;
  font-weight:900;
}
.sa-shift-tag.M { background:rgba(59,130,246,0.15); color:#3b82f6; }
.sa-shift-tag.E { background:rgba(245,158,11,0.15); color:#f59e0b; }
.sa-shift-tag.N { background:rgba(139,92,246,0.15); color:#8b5cf6; }
.sa-shift-tag.L { background:rgba(16,185,129,0.15); color:#10b981; }
.sa-shift-tag.EN { background:rgba(168,85,247,0.15); color:#a855f7; }
.sa-shift-tag.H24 { background:rgba(239,68,68,0.15); color:#ef4444; }

.sa-pin-hint {
  font-size:11px;
  color:var(--fg-2);
  margin-top:8px;
  padding:8px;
  background:var(--bg-3);
  border-radius:6px;
  text-align:center;
  font-family:var(--mono);
}
EOF_CSS
echo "✅ public/style.css (+sa styles)"
else
echo "ℹ️  style.css already has sa styles"
fi

# ═══════════════════════════════════════════════════════════
#  Patch index.html
# ═══════════════════════════════════════════════════════════
node << 'EOF_HTML'
const fs = require('fs');
const F = 'public/index.html';
let src = fs.readFileSync(F, 'utf8');
if (src.includes('/sa.js')) { console.log('ℹ️  index.html already has sa'); process.exit(0); }
const from = '<script src="/cdss.js"></script>';
const to = '<script src="/cdss.js"></script>\n<script src="/sa.js"></script>\n<script src="/sa-init.js"></script>';
if (!src.includes(from)) { console.error('❌ anchor not found'); process.exit(1); }
src = src.replace(from, to);
fs.writeFileSync(F, src);
console.log('✅ public/index.html (+2 script tags)');
EOF_HTML

# ═══════════════════════════════════════════════════════════
#  Patch sw.js
# ═══════════════════════════════════════════════════════════
node << 'EOF_SW'
const fs = require('fs');
const F = 'public/sw.js';
if (!fs.existsSync(F)) process.exit(0);
let src = fs.readFileSync(F, 'utf8');
const vMatch = src.match(/const VERSION = (\d+);/);
if (vMatch) {
  const newV = parseInt(vMatch[1]) + 1;
  src = src.replace('const VERSION = ' + vMatch[1] + ';', 'const VERSION = ' + newV + ';');
  if (!src.includes('/sa.js')) {
    src = src.replace("'/cdss.js'", "'/cdss.js',\n  '/sa.js',\n  '/sa-init.js'");
  }
  fs.writeFileSync(F, src);
  console.log('✅ sw.js → v' + newV);
}
EOF_SW

# ═══════════════════════════════════════════════════════════
#  Patch app.js
# ═══════════════════════════════════════════════════════════
node << 'EOF_APP'
const fs = require('fs');
const F = 'public/app.js';
let src = fs.readFileSync(F, 'utf8');
let changed = 0;

// (a) MOD_META
if (!src.includes("shift_assistant:{l:'دستیار شیفت'")) {
  const from = "cdss:{l:'موتور بالینی',i:'🧠'}";
  const to = "cdss:{l:'موتور بالینی',i:'🧠'},\n    shift_assistant:{l:'دستیار شیفت',i:'🏥'}";
  if (src.includes(from)) { src = src.replace(from, to); changed++; }
  else console.warn('⚠️  MOD_META anchor not found');
}

// (b) modOrder
if (!src.includes("'shift_assistant'")) {
  const from = "'cdss','emergency'";
  const to = "'cdss','shift_assistant','emergency'";
  if (src.includes(from)) { src = src.replace(from, to); changed++; }
  else console.warn('⚠️  modOrder anchor not found');
}

// (c) getNav — add shift_staff case at top
if (!src.includes("shift_staff")) {
  const from = "function getNav(user){\n  if (user.role === 'staff')";
  const to = "function getNav(user){\n  if (user.role === 'shift_staff') return [{k:'home',i:'🏠',l:'خانه'},{k:'checkin',i:'📍',l:'حضور'},{k:'request',i:'📝',l:'درخواست'},{k:'schedule',i:'📅',l:'برنامه'}];\n  if (user.role === 'staff')";
  if (src.includes(from)) { src = src.replace(from, to); changed++; }
  else console.warn('⚠️  getNav anchor not found');
}

if (changed) {
  fs.writeFileSync(F, src);
  console.log('✅ public/app.js: patched ' + changed + ' spots');
} else {
  console.log('ℹ️  app.js already patched');
}
EOF_APP

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Phase 2 نصب شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 فایل‌های جدید:"
echo "   public/sa.js       ← UI کامل (مدیر + پرسنل)"
echo "   public/sa-init.js  ← PIN login + nav + wrap"
echo ""
echo "✏️  پچ‌شده:"
echo "   public/app.js      (MOD_META + modOrder + getNav)"
echo "   public/index.html  (+2 script tag)"
echo "   public/sw.js       (bump + STATIC)"
echo "   public/style.css   (+sa styles)"
echo ""
echo "🔄 اجرا:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null || true"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "⚠️  Hard Reload در مرورگر (Ctrl+Shift+R) — دو بار"
echo ""
