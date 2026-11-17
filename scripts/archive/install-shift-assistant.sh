#!/data/data/com.termux/files/usr/bin/bash
set -e

echo "🏥 NABZ Shift Assistant — Backend Installer"
echo ""

if [ ! -f "core/server.js" ] || [ ! -d "modules" ] || [ ! -d "public" ]; then
  echo "❌ از ریشهٔ پروژه اجرا کنید"
  exit 1
fi

STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/sa-$STAMP"
mkdir -p "$BACKUP_DIR"
for f in core/permissions-extra.js public/sw.js; do
  [ -f "$f" ] && cp "$f" "$BACKUP_DIR/" 2>/dev/null || true
done
echo "📦 Backup → $BACKUP_DIR"
echo ""

# ─── 1) Extract REAL_DATA from dastyar ───
DASTYAR_FILE=""
for loc in "dastyar_v19_fixed.html" "./public/dastyar_v19_fixed.html" "$HOME/dastyar_v19_fixed.html" "/sdcard/Download/dastyar_v19_fixed.html"; do
  if [ -f "$loc" ]; then DASTYAR_FILE="$loc"; break; fi
done

mkdir -p data

if [ -n "$DASTYAR_FILE" ]; then
  echo "✅ یافت شد: $DASTYAR_FILE"
  node << 'EOF_EXTRACT'
const fs = require('fs');
const candidates = ['dastyar_v19_fixed.html', './public/dastyar_v19_fixed.html',
  process.env.HOME + '/dastyar_v19_fixed.html', '/sdcard/Download/dastyar_v19_fixed.html'];
const path = candidates.find(p => fs.existsSync(p));
if (!path) { console.error('not found'); process.exit(1); }
const src = fs.readFileSync(path, 'utf8');
const startMarker = 'const REAL_DATA = [';
const startIdx = src.indexOf(startMarker);
if (startIdx === -1) { console.error('REAL_DATA start not found'); process.exit(1); }
const arrayStart = startIdx + 'const REAL_DATA = '.length;
const endIdx = src.indexOf('\n];', arrayStart);
if (endIdx === -1) { console.error('REAL_DATA end not found'); process.exit(1); }
const arrText = src.slice(arrayStart, endIdx + 3);
let REAL_DATA;
try { REAL_DATA = new Function('return ' + arrText)(); }
catch (e) { console.error('parse failed:', e.message); process.exit(1); }

const out = { wards: [], staff: [], extractedAt: new Date().toISOString() };
let staffId = 1;
for (const [code, label, diff, wk, staffList] of REAL_DATA) {
  const wardId = out.wards.length + 1;
  out.wards.push({ id: wardId, code, label, diff: +diff, wk: +wk });
  for (const [pCode, pName, posCode, empCode] of staffList) {
    if (!pName) continue;
    out.staff.push({
      id: staffId++,
      code: pCode || (code + '-' + String(staffId).padStart(2, '0')),
      name: pName, posCode, empCode, wardId
    });
  }
}
fs.writeFileSync('data/sa_seed.json', JSON.stringify(out, null, 2));
console.log('✅ ' + out.wards.length + ' wards, ' + out.staff.length + ' staff → data/sa_seed.json');
EOF_EXTRACT
else
  echo "⚠️  dastyar_v19_fixed.html یافت نشد — ماژول با داده خالی کار می‌کند"
  echo '{"wards":[],"staff":[]}' > data/sa_seed.json
fi
echo ""

# ─── 2) Write module ───
cat > modules/shift_assistant.js << 'EOF_MODULE'
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Shift Assistant (dastyar) Backend Integration
//  37 wards, ~550 real Sina staff, advancedSolve, PIN auth
// ═══════════════════════════════════════════════════════════
const { h, sd } = require('../core/mod-helpers');
const bus = require('../core/events');
const store = require('../core/store');
const auth = require('../core/auth');
const perms = require('../core/permissions');

// ═══ JALALI UTILS ═══
const _div = (a,b) => Math.trunc(a/b);
const _mod = (a,b) => a - _div(a,b)*b;
function _jalCal(jy) {
  const b = [-61,9,38,199,426,686,756,818,1111,1181,1210,1635,2060,2097,2192,2262,2324,2394,2456,3178];
  const gy = jy+621; let lJ=-14, jp=b[0], jm, jump=0, n, i;
  for (i=1; i<b.length; i++) { jm=b[i]; jump=jm-jp; if (jy<jm) break; lJ+=_div(jump,33)*8+_div(_mod(jump,33),4); jp=jm; }
  n=jy-jp; lJ+=_div(n,33)*8+_div(_mod(n,33)+3,4);
  if (_mod(jump,33)===4 && jump-n===4) lJ+=1;
  const lG=_div(gy,4)-_div((_div(gy,100)+1)*3,4)-150;
  const march=20+lJ-lG; if (jump-n<6) n=n-jump+_div(jump+4,33)*33;
  let leap=_mod(_mod(n+1,33)-1,4); if (leap===-1) leap=4;
  return { leap, gy, march };
}
const _g2d = (gy,gm,gd) => { let d=_div((gy+_div(gm-8,6)+100100)*1461,4)+_div(153*_mod(gm+9,12)+2,5)+gd-34840408; return d-_div(_div(gy+100100+_div(gm-8,6),100)*3,4)+752; };
const _d2g = (jdn) => { let j=4*jdn+139361631; j=j+_div(_div(4*jdn+183187720,146097)*3,4)*4-3908; const i=_div(_mod(j,1461),4)*5+308; return { gy:_div(j,1461)-100100+_div(8-_div(_mod(i,153),12),6), gm:_mod(_div(i,153),12)+1, gd:_div(_mod(i,153),5)+1 }; };
const _j2d = (jy,jm,jd) => { const r=_jalCal(jy); return _g2d(r.gy,3,r.march)+(jm-1)*31-_div(jm,7)*(jm-7)+jd-1; };
const _d2j = (jdn) => { const gy=_d2g(jdn).gy; let jy=gy-621; const r=_jalCal(jy); const jdn1f=_g2d(gy,3,r.march); let k=jdn-jdn1f; if (k>=0) { if (k<=185) return { jy, jm:1+_div(k,31), jd:_mod(k,31)+1 }; k-=186; } else { jy-=1; k+=179; if (r.leap===1) k+=1; } return { jy, jm:7+_div(k,30), jd:_mod(k,30)+1 }; };
const monthLength = (jy,jm) => jm<=6?31:jm<=11?30:(_jalCal(jy).leap===0?30:29);
const fmtJ = (jy,jm,jd) => jy+'/'+String(jm).padStart(2,'0')+'/'+String(jd).padStart(2,'0');
const parseJ = s => { const p=String(s).split(/[\/\-]/); return { jy:+p[0], jm:+p[1], jd:+p[2] }; };
const weekdayIdx = (jy,jm,jd) => _mod(_j2d(jy,jm,jd)+2,7);
function monthDays(jy,jm) { const out=[]; for (let d=1; d<=monthLength(jy,jm); d++) { out.push({ date:fmtJ(jy,jm,d), jy, jm, jd:d, wd:weekdayIdx(jy,jm,d), isFri:weekdayIdx(jy,jm,d)===6 }); } return out; }
function addDaysJ(jy,jm,jd,n) { let y=jy,m=jm,d=jd+n; while (d<1) { m--; if (m<1){m=12;y--;} d+=monthLength(y,m); } while (d>monthLength(y,m)) { d-=monthLength(y,m); m++; if (m>12){m=1;y++;} } return { jy:y, jm:m, jd:d }; }
function todayJ() { const now=new Date(); return _d2j(_g2d(now.getFullYear(),now.getMonth()+1,now.getDate())); }

// ═══ CONSTANTS ═══
const SHIFTS = {
  M:   { code:'M',   fa:'صبح',        minutes:420,  startHour:7,  endHour:14 },
  E:   { code:'E',   fa:'عصر',        minutes:420,  startHour:13, endHour:20 },
  N:   { code:'N',   fa:'شب',         minutes:780,  startHour:19, endHour:8  },
  L:   { code:'L',   fa:'لانگ',       minutes:780,  startHour:7,  endHour:20 },
  EN:  { code:'EN',  fa:'عصر+شب',    minutes:1140, startHour:13, endHour:8  },
  H24: { code:'H24', fa:'۲۴ساعته',   minutes:1440, startHour:7,  endHour:7  }
};
const SHIFT_ORDER = ['M','E','N','L','EN','H24'];

const POS_MAP = { M:'matron', S:'supervisor', H:'head_nurse', R:'rn', U:'support', B:'beh_yar', A:'assistant', N:'anesthesia', O:'or_tech', X:'or_specialist', W:'midwife', E:'ecg', C:'secretary', P:'patient_care', Z:'wound_specialist' };
const EMP_MAP = { '1':'رسمی', '2':'رسمی آزمایشی', '3':'قراردادی', '4':'شرکتی', '5':'پیمانی', '6':'طرحی', '7':'تمدید طرح' };

// Map dastyar ward codes → NABZ sina.js ward codes (for cross-module integration)
const WARD_MAP = {
  'NO':'NURSING_OFFICE', 'SUR1':'GEN_SURG14', 'SUR2':'GEN_SURG2',
  'VAS1':'VASC1', 'VAS2':'VASC2', 'ICUP':'ICU_RESP', 'MAXF':'MAXFAX',
  'INTM':'INT_M', 'INTF':'INT_F', 'NEUM':'NEURO_M', 'NEUF':'NEURO_F',
  'MS1':'MS1', 'MS2':'MS2', 'MS3':'MS3', 'CCU':'CCU',
  'KID1':'URO1', 'KID2':'URO2', 'TRANS':'KIDNEY_TX',
  'ICUG1':'ICU_GEN1', 'ICUG2':'ICU_GEN2', 'CLINIC':'CLINIC',
  'ENDO':'ENDOSCOPY', 'CSR':'CSR', 'ORTF':'ORTHO_F', 'ORTM':'ORTHO_M',
  'NSGF':'NSURG_F', 'NSGM':'NSURG_M', 'ICUN':'ICU_NEURO', 'ICUER':'ICU_ER',
  'DIAL':'DIALYSIS', 'ONCO':'ONCO', 'CATH':'CATHLAB', 'VIP':'VIP',
  'ORG':'OR_GEN', 'ORE':'OR_ER', 'ER':'ER', 'EXTRA':null
};

const REQ_FA = { MORNING:'صبح', EVENING:'عصر', NIGHT:'شب', LONG:'لانگ', EVENING_NIGHT:'عصر+شب', H24:'۲۴ساعته', LEAVE:'مرخصی', SICK:'استعلاجی', HALF_M:'مرخصی نیم‌روز صبح', HALF_E:'مرخصی نیم‌روز عصر', REST:'استراحت' };
const SHIFT_TO_REQ = { M:'MORNING', E:'EVENING', N:'NIGHT', L:'LONG', EN:'EVENING_NIGHT', H24:'H24' };

const ROUTINES = [
  { code:'M_SAT_THU', label:'صبح — شنبه تا پنجشنبه', run: days => days.filter(d=>d.wd!==6).map(d=>({date:d.date, req:'MORNING'})) },
  { code:'E_SAT_THU', label:'عصر — شنبه تا پنجشنبه', run: days => days.filter(d=>d.wd!==6).map(d=>({date:d.date, req:'EVENING'})) },
  { code:'N_SAT_THU', label:'شب — شنبه تا پنجشنبه', run: days => days.filter(d=>d.wd!==6).map(d=>({date:d.date, req:'NIGHT'})) },
  { code:'L_SAT_THU', label:'لانگ — شنبه تا پنجشنبه', run: days => days.filter(d=>d.wd!==6).map(d=>({date:d.date, req:'LONG'})) },
  { code:'N_ODD', label:'شب — تاریخ فرد', run: days => days.filter(d=>d.jd%2===1).map(d=>({date:d.date, req:'NIGHT'})) },
  { code:'N_EVEN', label:'شب — تاریخ زوج', run: days => days.filter(d=>d.jd%2===0).map(d=>({date:d.date, req:'NIGHT'})) },
  { code:'L_ODD', label:'لانگ — تاریخ فرد', run: days => days.filter(d=>d.jd%2===1).map(d=>({date:d.date, req:'LONG'})) },
  { code:'L_EVEN', label:'لانگ — تاریخ زوج', run: days => days.filter(d=>d.jd%2===0).map(d=>({date:d.date, req:'LONG'})) },
  { code:'EN_C1', label:'عصر+شب نوبت ۱', run: days => days.filter(d=>d.jd%3===1).map(d=>({date:d.date, req:'EVENING_NIGHT'})) },
  { code:'EN_C2', label:'عصر+شب نوبت ۲', run: days => days.filter(d=>d.jd%3===2).map(d=>({date:d.date, req:'EVENING_NIGHT'})) },
  { code:'EN_C3', label:'عصر+شب نوبت ۳', run: days => days.filter(d=>d.jd%3===0).map(d=>({date:d.date, req:'EVENING_NIGHT'})) }
];

const DEFAULT_CONFIG = {
  id: 'global',
  weights: { coverage:100, pref:50, fair:30, rest:15, random:2 },
  rest: { minMinutes:720, sameShiftMinutes:360, nightToMorningForbidden:true },
  limits: { maxConsecutiveNights:2, maxConsecutiveWorkDays:6, maxOvertimePerMonth:40, targetHoursPerMonth:168 },
  payroll: {
    hourlyBaseRate:300000, nightMultiplier:1.5, holidayMultiplier:1.5, overtimeMultiplier:1.5,
    karanehPerHour:120000, seniorityBonusPerYear:0.02, seniorityCap:0.20,
    insurance:0.07, tax:0.05,
    positionMult: { matron:1.35, supervisor:1.25, clinical_supervisor:1.25, head_nurse:1.15, rn:1.00, support:0.85, beh_yar:0.90, assistant:0.80, anesthesia:1.10, or_tech:1.05, or_specialist:1.10, midwife:1.05, secretary:0.75, patient_care:0.70, ecg:0.85, wound_specialist:1.10 }
  }
};

// ═══ SEED (idempotent) ═══
(function seedIfNeeded() {
  try {
    if (h({ store }, 'sa_wards').length > 0) return;
    const fs = require('fs'), path = require('path');
    const seedFile = path.join(store.DATA, 'sa_seed.json');
    if (!fs.existsSync(seedFile)) { console.log('[sa] no seed file, empty mode'); return; }
    const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
    let sc = 0, wc = 0;
    for (const w of seed.wards) {
      const ward = {
        id: w.id, code: w.code, label: w.label, diff: w.diff, wk: w.wk,
        nabzCode: WARD_MAP[w.code] || null,
        isManagement: w.code === 'NO' || w.code === 'EXTRA',
        headStaffId: null,
        createdAt: new Date().toISOString()
      };
      store.put('sa_wards', ward); wc++;
    }
    for (const s of seed.staff) {
      const category = POS_MAP[s.posCode] || 'rn';
      const employment = EMP_MAP[s.empCode] || 'قراردادی';
      const staff = {
        id: s.id, code: s.code, name: s.name, wardId: s.wardId,
        category, employment,
        seniorityYears: 3 + (s.id * 7 % 15),
        targetHours: 168, maxOvertime: 40,
        nightEligible: true, active: true,
        phone: '', nationalId: '', headOfWard: null,
        nabzUserId: null,
        createdAt: new Date().toISOString()
      };
      if (category === 'head_nurse') {
        staff.headOfWard = s.wardId;
        const w = store.get('sa_wards', s.wardId);
        if (w) { w.headStaffId = s.id; store.put('sa_wards', w); }
      }
      store.put('sa_staff', staff); sc++;
    }
    // Default config
    if (!store.get('sa_config', 'global')) store.put('sa_config', DEFAULT_CONFIG);
    // Current period
    const t = todayJ();
    const pid = t.jy + '-' + String(t.jm).padStart(2,'0');
    if (!store.get('sa_periods', pid)) {
      store.put('sa_periods', { id:pid, jy:t.jy, jm:t.jm, status:'collecting', createdAt: new Date().toISOString() });
    }
    console.log('[sa] seeded: ' + wc + ' wards, ' + sc + ' staff, period ' + pid);
  } catch (e) { console.error('[sa] seed failed:', e.message); }
})();

// ═══ FAIRNESS MATH ═══
function gini(v) { const n=v.length; if (!n) return 0; const s=v.reduce((a,b)=>a+b,0); if (!s) return 0; const so=[...v].sort((a,b)=>a-b); let c=0; for (let i=0; i<n; i++) c+=(i+1)*so[i]; return Math.max(0,(2*c)/(n*s)-(n+1)/n); }
function cv(v) { const n=v.length; if (!n) return 0; const m=v.reduce((a,b)=>a+b,0)/n; if (!m) return 0; const va=v.reduce((s,x)=>s+(x-m)**2,0)/n; return Math.sqrt(va)/m; }
function maxMinGap(v) { if (!v.length) return 0; return Math.max(...v) - Math.min(...v); }

// ═══ SOLVER (ported with fixes) ═══
function mulberry32(seed) { let a=seed>>>0; return function() { a=(a+0x6D2B79F5)>>>0; let t=a; t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296; }; }

function advancedSolve(ctx, wardId, periodId, weights, seed) {
  const period = ctx.store.get('sa_periods', periodId);
  if (!period) throw ctx.E.notFound('period_not_found');
  const cfg = ctx.store.get('sa_config', 'global') || DEFAULT_CONFIG;
  const days = monthDays(period.jy, period.jm);
  const dayMap = new Map(days.map(d => [d.date, d]));

  const wardStaff = h(ctx, 'sa_staff').filter(s => s.active && s.wardId === wardId && !['secretary','head_nurse','matron'].includes(s.category));
  const isSupWard = wardStaff.length > 0 && wardStaff.every(s => s.category === 'supervisor');

  const slots = [];
  const demands = h(ctx, 'sa_demands').filter(d => d.periodId === periodId && d.wardId === wardId);
  for (const dm of demands) {
    for (let i = 0; i < (dm.minRn || 0); i++) slots.push({ wardId, date: dm.date, shift: dm.shift, cat: 'rn', min: true });
    for (let i = 0; i < (dm.minSup || 0); i++) slots.push({ wardId, date: dm.date, shift: dm.shift, cat: 'support', min: true });
    for (let i = (dm.minRn||0); i < (dm.targetRn||0); i++) slots.push({ wardId, date: dm.date, shift: dm.shift, cat: 'rn', min: false });
    for (let i = (dm.minSup||0); i < (dm.targetSup||0); i++) slots.push({ wardId, date: dm.date, shift: dm.shift, cat: 'support', min: false });
  }
  if (!slots.length) return { assignments: [], shortages: [], metrics: { coverage: 100, totalSlots: 0, totalMin: 0, totalFilled: 0 } };

  // Derive leaves from approved preferences (fix bug #2)
  const leaves = new Map();
  for (const p of h(ctx, 'sa_preferences').filter(p => p.periodId === periodId && p.wardId === wardId && p.status === 'approved')) {
    if (['LEAVE','SICK','REST','HALF_M','HALF_E'].includes(p.requestType)) {
      if (!leaves.has(p.staffId)) leaves.set(p.staffId, new Set());
      leaves.get(p.staffId).add(p.date);
    }
  }
  const prefMap = new Map();
  for (const p of h(ctx, 'sa_preferences').filter(p => p.periodId === periodId && p.wardId === wardId && ['submitted','approved'].includes(p.status))) {
    const k = p.staffId + '|' + p.date;
    if (!prefMap.has(k)) prefMap.set(k, []);
    prefMap.get(k).push(p);
  }

  const busy = new Map();
  const counts = new Map();
  for (const st of wardStaff) {
    busy.set(st.id, new Map());
    counts.set(st.id, { nights: 0, holidays: 0, weekends: 0, minutes: 0, consecutiveNights: 0, consecutiveWork: 0, lastWorkedDate: null });
  }

  // Locked assignments — SORT BY DATE (fix bug #1)
  const locked = h(ctx, 'sa_assignments')
    .filter(a => a.periodId === periodId && a.wardId === wardId && a.locked)
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);

  const assignments = [];
  for (const a of locked) {
    if (!wardStaff.find(s => s.id === a.staffId) || busy.get(a.staffId).has(a.date)) continue;
    busy.get(a.staffId).set(a.date, a.shift);
    const c = counts.get(a.staffId);
    const day = dayMap.get(a.date);
    c.minutes += a.actualMinutes || SHIFTS[a.shift]?.minutes || 0;
    const isNight = a.shift === 'N' || a.shift === 'EN' || a.shift === 'H24';
    if (isNight) {
      const p = parseJ(a.date); const prev = addDaysJ(p.jy, p.jm, p.jd, -1);
      const prevSh = busy.get(a.staffId).get(fmtJ(prev.jy, prev.jm, prev.jd));
      if (prevSh === 'N' || prevSh === 'EN' || prevSh === 'H24') c.consecutiveNights++;
      else c.consecutiveNights = 1;
      c.nights++;
    } else { c.consecutiveNights = 0; }
    if (day?.isFri) c.weekends++;
    const p = parseJ(a.date); const prev = addDaysJ(p.jy, p.jm, p.jd, -1);
    if (c.lastWorkedDate === fmtJ(prev.jy, prev.jm, prev.jd)) c.consecutiveWork++;
    else c.consecutiveWork = 1;
    c.lastWorkedDate = a.date;
    assignments.push({ ...a, source: 'locked' });
  }

  function canAssign(st, slot) {
    if (slot.cat === 'rn') {
      if (isSupWard) { if (st.category !== 'supervisor') return false; }
      else { if (!['rn','anesthesia','midwife','or_tech','or_specialist','wound_specialist','ecg'].includes(st.category)) return false; }
    }
    if (slot.cat === 'support' && !['support','beh_yar','assistant','patient_care'].includes(st.category)) return false;
    if ((slot.shift === 'N' || slot.shift === 'EN' || slot.shift === 'H24') && !st.nightEligible) return false;
    const b = busy.get(st.id);
    if (b.has(slot.date)) return false;
    if (leaves.get(st.id)?.has(slot.date)) return false;
    const c = counts.get(st.id);
    const targetMin = (st.targetHours || 168) * 60;
    const allowanceMin = targetMin + (cfg.limits.maxOvertimePerMonth || 40) * 60;
    if (c.minutes + SHIFTS[slot.shift].minutes > allowanceMin) return false;

    // Rest check
    const p = parseJ(slot.date);
    const prev = addDaysJ(p.jy, p.jm, p.jd, -1);
    const pvk = fmtJ(prev.jy, prev.jm, prev.jd);
    if (b.has(pvk)) {
      const ps = b.get(pvk);
      if (cfg.rest.nightToMorningForbidden && (ps === 'N' || ps === 'EN' || ps === 'H24') && slot.shift === 'M') return false;
      const psDef = SHIFTS[ps], csDef = SHIFTS[slot.shift];
      let prevEndMin = psDef.endHour * 60;
      if (psDef.endHour <= psDef.startHour) prevEndMin += 24 * 60;
      let currStartMin = csDef.startHour * 60;
      let restMinutes = (currStartMin + 24 * 60) - prevEndMin;
      if (restMinutes < 0) restMinutes += 24 * 60;
      const minRestNeeded = (ps === slot.shift) ? (cfg.rest.sameShiftMinutes || 360) : (cfg.rest.minMinutes || 720);
      if (restMinutes < minRestNeeded) return false;
    }

    if (cfg.limits.maxConsecutiveNights && c.consecutiveNights >= cfg.limits.maxConsecutiveNights && ['N','EN','H24'].includes(slot.shift)) return false;

    if (cfg.limits.maxConsecutiveWorkDays && c.lastWorkedDate) {
      const prevStr = fmtJ(prev.jy, prev.jm, prev.jd);
      if (c.lastWorkedDate === prevStr && c.consecutiveWork >= cfg.limits.maxConsecutiveWorkDays) return false;
    }
    return true;
  }

  const order = slots.map(slot => {
    let cnt = 0;
    for (const st of wardStaff) if (canAssign(st, slot)) cnt++;
    return { slot, cnt };
  }).sort((a, b) => {
    if (a.slot.date !== b.slot.date) return a.slot.date < b.slot.date ? -1 : 1;
    if (a.cnt !== b.cnt) return a.cnt - b.cnt;
    return SHIFT_ORDER.indexOf(a.slot.shift) - SHIFT_ORDER.indexOf(b.slot.shift);
  });

  const rng = mulberry32(seed || 42);
  const shortages = [];
  const baseCap = weights.coverage + weights.pref + weights.fair + weights.rest + weights.random || 1;

  for (const { slot } of order) {
    const cands = [];
    for (const st of wardStaff) {
      if (!canAssign(st, slot)) continue;
      const c = counts.get(st.id);
      const day = dayMap.get(slot.date);
      let prefScore = 0;
      for (const p of (prefMap.get(st.id + '|' + slot.date) || [])) {
        if (SHIFT_TO_REQ[slot.shift] === p.requestType) prefScore += 1;
        if (p.requestType === 'LEAVE' || p.requestType === 'REST') prefScore -= 2;
      }
      const nightPenalty = ['N','EN'].includes(slot.shift) ? c.nights * 1.5 : 0;
      const holidayPenalty = day?.isFri ? c.weekends * 1.0 : 0;
      const hourPenalty = c.minutes / 1200;
      const fairnessScore = -(nightPenalty + holidayPenalty + hourPenalty);
      const coverageScore = slot.min ? 2 : 1;
      const rnd = rng() * (weights.random / 100);
      const total = (weights.coverage * coverageScore + weights.pref * prefScore + weights.fair * fairnessScore + weights.rest * 1 + rnd) / baseCap;
      cands.push({ st, score: total });
    }
    if (!cands.length) { if (slot.min) shortages.push({ ...slot }); continue; }
    cands.sort((a, b) => b.score - a.score);
    const chosen = cands[0].st;
    const day = dayMap.get(slot.date);
    busy.get(chosen.id).set(slot.date, slot.shift);
    const c = counts.get(chosen.id);
    c.minutes += SHIFTS[slot.shift].minutes;
    if (['N','EN','H24'].includes(slot.shift)) {
      const p = parseJ(slot.date); const prev = addDaysJ(p.jy, p.jm, p.jd, -1);
      const prevSh = busy.get(chosen.id).get(fmtJ(prev.jy, prev.jm, prev.jd));
      c.consecutiveNights = ['N','EN','H24'].includes(prevSh) ? c.consecutiveNights + 1 : 1;
      c.nights++;
    } else c.consecutiveNights = 0;
    if (day?.isFri) c.weekends++;
    const p = parseJ(slot.date); const prev = addDaysJ(p.jy, p.jm, p.jd, -1);
    c.consecutiveWork = c.lastWorkedDate === fmtJ(prev.jy, prev.jm, prev.jd) ? c.consecutiveWork + 1 : 1;
    c.lastWorkedDate = slot.date;
    assignments.push({
      staffId: chosen.id, wardId, date: slot.date, shift: slot.shift,
      category: slot.cat, actualMinutes: SHIFTS[slot.shift].minutes,
      state: 'scheduled', locked: false, source: 'auto'
    });
  }

  const minSlots = slots.filter(s => s.min).length;
  const missingMin = shortages.length;
  return {
    assignments, shortages,
    metrics: {
      coverage: minSlots > 0 ? Math.round((minSlots - missingMin) / minSlots * 10000) / 100 : 100,
      totalSlots: slots.length, totalMin: minSlots, totalFilled: assignments.length
    }
  };
}

// ═══ AUDIT HELPER ═══
function audit(ctx, action, entityId, meta) {
  try {
    const prev = h(ctx, 'sa_audit').slice(-1)[0];
    const rec = {
      id: ctx.uid('saa'),
      module: 'shift_assistant', action, entityId: String(entityId || ''),
      actor: { id: ctx.actor.id, name: ctx.actor.username, role: ctx.actor.role },
      meta: meta || {}, prevHash: prev ? prev.hash : 'genesis',
      at: ctx.now()
    };
    const crypto = require('crypto');
    rec.hash = crypto.createHash('sha256').update(JSON.stringify({ rec, prevHash: rec.prevHash })).digest('hex').slice(0, 16);
    ctx.store.put('sa_audit', rec);
    return rec;
  } catch (e) { console.warn('[sa] audit failed:', e.message); }
}

function notif(ctx, userId, title, body, type) {
  try {
    const all = h(ctx, 'sa_notifications');
    ctx.store.put('sa_notifications', {
      id: ctx.uid('san'), userId, title, body: body || '', type: type || 'info',
      read: false, createdAt: ctx.now()
    });
    if (all.length > 1000) {
      const toDelete = all.slice(0, all.length - 1000);
      for (const n of toDelete) ctx.store.remove('sa_notifications', n.id);
    }
  } catch (_) {}
}

// ═══ FAIRNESS / STATS ═══
function computeWardStats(ctx, wardId, periodId) {
  const period = ctx.store.get('sa_periods', periodId);
  if (!period) return null;
  const days = monthDays(period.jy, period.jm);
  const dayMap = new Map(days.map(d => [d.date, d]));
  const wardStaff = h(ctx, 'sa_staff').filter(s => s.wardId === wardId && s.active);
  const assigns = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.wardId === wardId);
  const demands = h(ctx, 'sa_demands').filter(d => d.periodId === periodId && d.wardId === wardId);

  const staffStats = {};
  for (const st of wardStaff) {
    staffStats[st.id] = {
      id: st.id, name: st.name, code: st.code, category: st.category,
      employment: st.employment, seniority: st.seniorityYears,
      targetHours: st.targetHours || 168,
      hours: 0, nights: 0, holidays: 0, weekends: 0, shifts: 0,
      overtime: 0, late: 0, absent: 0, checkedIn: 0,
      _days: new Set()
    };
  }
  for (const a of assigns) {
    const s = staffStats[a.staffId]; if (!s) continue;
    const day = dayMap.get(a.date); if (!day) continue;
    s.hours += (a.actualMinutes || 0) / 60;
    if (['N','EN'].includes(a.shift)) s.nights++;
    if (day.isFri) s.weekends++;
    s.shifts++;
    if (a.state === 'late') s.late++;
    if (a.state === 'absent') s.absent++;
    if (['checked_in','checked_out'].includes(a.state)) s.checkedIn++;
    s._days.add(a.date);
  }
  for (const st of wardStaff) {
    const s = staffStats[st.id];
    s.overtime = Math.max(0, s.hours - (st.targetHours || 168));
    s.workingDays = s._days.size;
    delete s._days;
  }
  const arr = Object.values(staffStats);
  const nightGini = gini(arr.map(s => s.nights));
  const weekendCV = cv(arr.map(s => s.weekends));
  const hourCV = cv(arr.map(s => s.hours));
  const nightGap = maxMinGap(arr.map(s => s.nights));

  let totalNeed = 0, totalFilled = 0;
  const shortages = [];
  for (const d of demands) {
    const need = (d.minRn || 0) + (d.minSup || 0);
    const filled = assigns.filter(a => a.date === d.date && a.shift === d.shift).length;
    totalNeed += need;
    totalFilled += Math.min(filled, need);
    if (filled < need) shortages.push({ date: d.date, shift: d.shift, need, filled, missing: need - filled });
  }
  const coverage = totalNeed > 0 ? (totalFilled / totalNeed) * 100 : 100;

  const prefs = h(ctx, 'sa_preferences').filter(p => p.periodId === periodId && p.wardId === wardId && ['submitted','approved'].includes(p.status));
  let prefTotal = 0, prefHonored = 0;
  for (const p of prefs) {
    prefTotal++;
    const match = assigns.find(a => a.staffId === p.staffId && a.date === p.date);
    if (match && SHIFT_TO_REQ[match.shift] === p.requestType) prefHonored++;
  }
  const prefSat = prefTotal > 0 ? (prefHonored / prefTotal) * 100 : 100;

  const fairnessTotal = Math.max(0, 1 - nightGini / 0.3) * 0.4 + Math.max(0, 1 - weekendCV / 0.4) * 0.3 + Math.max(0, 1 - hourCV / 0.25) * 0.3;
  return {
    staffStats: arr,
    fairness: {
      nightGini: Math.round(nightGini * 1000) / 1000,
      weekendCV: Math.round(weekendCV * 1000) / 1000,
      hourCV: Math.round(hourCV * 1000) / 1000,
      nightGap, total: Math.round(fairnessTotal * 100) / 100
    },
    coverage: Math.round(coverage * 100) / 100,
    totalNeed, totalFilled, shortages,
    prefSat: Math.round(prefSat * 100) / 100, prefTotal, prefHonored
  };
}

// ═══ PAYROLL ═══
function calcPayroll(ctx, staffId, periodId) {
  const st = ctx.store.get('sa_staff', staffId);
  const period = ctx.store.get('sa_periods', periodId);
  if (!st || !period) return null;
  const cfg = ctx.store.get('sa_config', 'global') || DEFAULT_CONFIG;
  const pc = cfg.payroll;
  const days = monthDays(period.jy, period.jm);
  const dayMap = new Map(days.map(d => [d.date, d]));
  const assigns = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.staffId === staffId);
  let totalMin = 0, nightMin = 0, holidayMin = 0;
  for (const a of assigns) {
    const day = dayMap.get(a.date); if (!day) continue;
    totalMin += a.actualMinutes || SHIFTS[a.shift]?.minutes || 0;
    if (['N','EN'].includes(a.shift)) nightMin += a.actualMinutes || 0;
    if (day.isFri) holidayMin += a.actualMinutes || 0;
  }
  const ward = ctx.store.get('sa_wards', st.wardId);
  const wardDiff = ward?.diff || 1.0;
  const baseRate = pc.hourlyBaseRate * wardDiff;
  const posMult = pc.positionMult[st.category] || 1.0;
  const normalPay = (totalMin / 60) * baseRate * posMult;
  const nightBonus = (nightMin / 60) * baseRate * (pc.nightMultiplier - 1) * posMult;
  const holidayBonus = (holidayMin / 60) * baseRate * (pc.holidayMultiplier - 1) * posMult;
  const targetMin = (st.targetHours || 168) * 60;
  const overtimeMin = Math.max(0, totalMin - targetMin);
  const overtimePay = (overtimeMin / 60) * baseRate * pc.overtimeMultiplier * posMult;
  const karanehBase = (totalMin / 60) * pc.karanehPerHour;
  const senBonus = Math.min(pc.seniorityCap, (st.seniorityYears || 0) * pc.seniorityBonusPerYear);
  const karaneh = karanehBase * (1 + senBonus) * wardDiff * posMult;
  const gross = normalPay + nightBonus + holidayPay(overtimePay);
  const ins = gross * pc.insurance;
  const tax = gross * pc.tax;
  return {
    staffId, staffName: st.name, wardLabel: ward?.label || '',
    totalMin, nightMin, holidayMin, overtimeMin,
    gross: Math.round(gross), net: Math.round(gross - ins - tax),
    breakdown: { normal: Math.round(normalPay), night: Math.round(nightBonus), holiday: Math.round(holidayBonus), overtime: Math.round(overtimePay), karaneh: Math.round(karaneh), insurance: Math.round(ins), tax: Math.round(tax) }
  };
  function holidayPay(ot) { return holidayBonus + overtimePay(ot); }
  function overtimePay(ot) { return (ot / 60) * baseRate * pc.overtimeMultiplier * posMult; }
}

// ═══ HANDLERS ═══
const H = {
  // ─── Auth ───
  pinLogin(ctx) {
    const code = String(ctx.body.code || '').trim();
    const pin = String(ctx.body.pin || '').trim();
    if (!code || !pin) throw ctx.E.badRequest('code_and_pin_required');
    const staff = h(ctx, 'sa_staff').find(s => s.code === code && s.active);
    if (!staff) throw ctx.E.notFound('staff_not_found');
    const expected = staff.code.length >= 4 ? staff.code.slice(-4) : '0000';
    if (pin !== expected) throw ctx.E.forbidden('invalid_pin');
    const token = auth.sign({ id: 'sa_' + staff.id, username: staff.code, role: 'shift_staff', fullName: staff.name, staffId: staff.id, wardId: staff.wardId });
    return { token, staff: { id: staff.id, code: staff.code, name: staff.name, wardId: staff.wardId, category: staff.category } };
  },

  // ─── Wards ───
  listWards(ctx) {
    const wards = h(ctx, 'sa_wards');
    const period = this._currentPeriod(ctx);
    const items = wards.map(w => {
      const staff = h(ctx, 'sa_staff').filter(s => s.wardId === w.id && s.active);
      const stats = period ? computeWardStats(ctx, w.id, period.id) : null;
      return {
        id: w.id, code: w.code, label: w.label, diff: w.diff, wk: w.wk,
        nabzCode: w.nabzCode, isManagement: w.isManagement,
        headNurse: w.headStaffId ? ctx.store.get('sa_staff', w.headStaffId)?.name : null,
        staffCount: staff.length,
        coverage: stats?.coverage || 0,
        fairness: stats?.fairness.total || 0,
        shortages: stats?.shortages.length || 0
      };
    });
    return { items, total: items.length };
  },

  // ─── Staff ───
  listStaff(ctx) {
    let items = h(ctx, 'sa_staff');
    if (ctx.query.wardId) items = items.filter(s => s.wardId === +ctx.query.wardId);
    if (ctx.query.category) items = items.filter(s => s.category === ctx.query.category);
    if (ctx.query.active !== 'false') items = items.filter(s => s.active);
    if (ctx.query.q) {
      const q = String(ctx.query.q).toLowerCase();
      items = items.filter(s => s.name.toLowerCase().includes(q) || s.code.includes(q));
    }
    const limit = Math.min(+ctx.query.limit || 100, 500);
    const offset = +ctx.query.offset || 0;
    return { items: items.slice(offset, offset + limit), total: items.length, offset, limit };
  },

  getStaff(ctx) {
    const s = ctx.store.get('sa_staff', +ctx.params.id);
    if (!s) throw ctx.E.notFound('staff_not_found');
    return s;
  },

  // ─── Periods ───
  _currentPeriod(ctx) {
    const t = todayJ();
    const pid = t.jy + '-' + String(t.jm).padStart(2, '0');
    let p = ctx.store.get('sa_periods', pid);
    if (!p) {
      p = { id: pid, jy: t.jy, jm: t.jm, status: 'collecting', createdAt: ctx.now() };
      ctx.store.put('sa_periods', p);
    }
    return p;
  },
  getPeriod(ctx) {
    return this._currentPeriod(ctx);
  },
  listPeriods(ctx) {
    const items = h(ctx, 'sa_periods').sort((a, b) => b.id.localeCompare(a.id));
    return { items, total: items.length };
  },
  createPeriod(ctx) {
    const b = ctx.body;
    if (!b.jy || !b.jm) throw ctx.E.badRequest('jy_and_jm_required');
    const pid = b.jy + '-' + String(b.jm).padStart(2, '0');
    if (ctx.store.get('sa_periods', pid)) throw ctx.E.conflict('period_exists');
    const p = { id: pid, jy: b.jy, jm: b.jm, status: 'collecting', createdAt: ctx.now() };
    ctx.store.put('sa_periods', p);
    audit(ctx, 'period.create', pid, { jy: b.jy, jm: b.jm });
    return p;
  },

  // ─── Demands ───
  getDemands(ctx) {
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    const wardId = +ctx.query.wardId;
    if (!wardId) throw ctx.E.badRequest('wardId_required');
    const items = h(ctx, 'sa_demands').filter(d => d.periodId === periodId && d.wardId === wardId);
    return { items, total: items.length, periodId, wardId };
  },
  saveDemands(ctx) {
    const b = ctx.body;
    if (!b.periodId || !b.wardId || !Array.isArray(b.items)) throw ctx.E.badRequest('missing');
    const period = ctx.store.get('sa_periods', b.periodId);
    if (!period) throw ctx.E.notFound('period_not_found');
    if (period.status === 'locked') throw ctx.E.conflict('period_locked');
    let saved = 0;
    ctx.store.remove('sa_demands', '');
    // Full replace for this ward+period
    const existing = h(ctx, 'sa_demands').filter(d => !(d.periodId === b.periodId && d.wardId === b.wardId));
    // Rebuild
    for (const old of h(ctx, 'sa_demands').filter(d => d.periodId === b.periodId && d.wardId === b.wardId)) {
      ctx.store.remove('sa_demands', old.id);
    }
    for (const it of b.items) {
      if (!it.date || !it.shift) continue;
      if (!(it.minRn || it.minSup || it.targetRn || it.targetSup)) continue;
      const rec = {
        id: ctx.uid('sadm'),
        periodId: b.periodId, wardId: b.wardId,
        date: it.date, shift: it.shift,
        minRn: Math.max(0, +it.minRn || 0),
        minSup: Math.max(0, +it.minSup || 0),
        targetRn: Math.max(0, +it.targetRn || 0),
        targetSup: Math.max(0, +it.targetSup || 0),
        updatedAt: ctx.now()
      };
      ctx.store.put('sa_demands', rec);
      saved++;
    }
    audit(ctx, 'demands.save', b.periodId + ':' + b.wardId, { saved });
    return { saved, periodId: b.periodId, wardId: b.wardId };
  },

  // ─── Solver ───
  solve(ctx) {
    const b = ctx.body;
    const periodId = b.periodId || this._currentPeriod(ctx).id;
    const wardId = +b.wardId;
    if (!wardId) throw ctx.E.badRequest('wardId_required');
    const period = ctx.store.get('sa_periods', periodId);
    if (!period) throw ctx.E.notFound('period_not_found');
    if (period.status === 'locked') throw ctx.E.conflict('period_locked');
    const cfg = ctx.store.get('sa_config', 'global') || DEFAULT_CONFIG;
    const weights = b.weights || cfg.weights;
    const seed = b.seed || (Date.now() % 100000);
    const result = advancedSolve(ctx, wardId, periodId, weights, seed);

    // Snapshot existing unlocked assignments (version history)
    const versionNum = h(ctx, 'sa_versions').filter(v => v.periodId === periodId && v.wardId === wardId).length + 1;
    const snapshot = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.wardId === wardId && !a.locked);
    ctx.store.put('sa_versions', {
      id: ctx.uid('sav'),
      periodId, wardId, versionNumber: versionNum,
      assignments: snapshot, metrics: result.metrics,
      weights, seed, createdBy: ctx.actor.id, createdAt: ctx.now()
    });

    // Delete unlocked, insert new
    for (const a of h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.wardId === wardId && !a.locked)) {
      ctx.store.remove('sa_assignments', a.id);
    }
    let saved = 0;
    for (const a of result.assignments) {
      if (a.source === 'locked') continue;
      ctx.store.put('sa_assignments', {
        id: ctx.uid('sas'),
        periodId, staffId: a.staffId, wardId, date: a.date, shift: a.shift,
        category: a.category, actualMinutes: a.actualMinutes,
        state: 'scheduled', locked: false, source: 'auto',
        version: versionNum, createdAt: ctx.now()
      });
      saved++;
    }
    audit(ctx, 'solve', wardId, { periodId, saved, coverage: result.metrics.coverage, version: versionNum });
    bus.emit('sa.solve.complete', { wardId, periodId, saved, coverage: result.metrics.coverage, actor: ctx.actor });
    return {
      saved, version: versionNum,
      coverage: result.metrics.coverage,
      shortages: result.shortages.length,
      metrics: result.metrics
    };
  },

  solveAll(ctx) {
    const b = ctx.body || {};
    const periodId = b.periodId || this._currentPeriod(ctx).id;
    const wards = h(ctx, 'sa_wards').filter(w => !w.isManagement);
    const results = [];
    for (const w of wards) {
      try {
        const r = this.solve({ ...ctx, body: { periodId, wardId: w.id } });
        results.push({ wardId: w.id, wardLabel: w.label, ...r });
      } catch (e) { results.push({ wardId: w.id, wardLabel: w.label, error: e.message }); }
    }
    return { periods: periodId, wards: results.length, results };
  },

  // ─── Assignments ───
  getAssignments(ctx) {
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    let items = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId);
    if (ctx.query.wardId) items = items.filter(a => a.wardId === +ctx.query.wardId);
    if (ctx.query.staffId) items = items.filter(a => a.staffId === +ctx.query.staffId);
    if (ctx.query.date) items = items.filter(a => a.date === ctx.query.date);
    return { items, total: items.length };
  },
  addAssignment(ctx) {
    const b = ctx.body;
    if (!b.periodId || !b.staffId || !b.wardId || !b.date || !b.shift) throw ctx.E.badRequest('missing');
    if (!SHIFTS[b.shift]) throw ctx.E.badRequest('invalid_shift');
    const existing = h(ctx, 'sa_assignments').filter(a =>
      a.periodId === b.periodId && a.staffId === b.staffId && a.date === b.date);
    if (existing.length) throw ctx.E.conflict('staff_already_assigned');
    const rec = {
      id: ctx.uid('sas'),
      periodId: b.periodId, staffId: b.staffId, wardId: b.wardId,
      date: b.date, shift: b.shift, category: b.category || 'rn',
      actualMinutes: SHIFTS[b.shift].minutes,
      state: 'scheduled', locked: true, source: 'manual',
      createdBy: ctx.actor.id, createdAt: ctx.now()
    };
    ctx.store.put('sa_assignments', rec);
    audit(ctx, 'assignment.add', rec.id, { staffId: b.staffId, date: b.date, shift: b.shift });
    bus.emit('sa.assignment.added', { record: rec, actor: ctx.actor });
    return rec;
  },
  deleteAssignment(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    const period = ctx.store.get('sa_periods', a.periodId);
    if (period && period.status === 'locked') throw ctx.E.conflict('period_locked');
    ctx.store.remove('sa_assignments', a.id);
    audit(ctx, 'assignment.delete', a.id, { staffId: a.staffId, date: a.date });
    bus.emit('sa.assignment.deleted', { record: a, actor: ctx.actor });
    return { deleted: true, id: a.id };
  },
  toggleLock(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.locked = !a.locked;
    a.updatedAt = ctx.now();
    ctx.store.put('sa_assignments', a);
    return a;
  },

  // ─── Preferences ───
  getPreferences(ctx) {
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    let items = h(ctx, 'sa_preferences').filter(p => p.periodId === periodId);
    if (ctx.query.staffId) items = items.filter(p => p.staffId === +ctx.query.staffId);
    if (ctx.query.wardId) items = items.filter(p => p.wardId === +ctx.query.wardId);
    if (ctx.query.status) items = items.filter(p => p.status === ctx.query.status);
    items.sort((a, b) => (a.date < b.date ? -1 : 1));
    return { items, total: items.length };
  },
  submitPreferences(ctx) {
    const b = ctx.body;
    const periodId = b.periodId || this._currentPeriod(ctx).id;
    const staffId = b.staffId || ctx.actor.staffId;
    if (!staffId || !Array.isArray(b.items)) throw ctx.E.badRequest('missing');
    const staff = ctx.store.get('sa_staff', staffId);
    if (!staff) throw ctx.E.notFound('staff_not_found');
    let saved = 0;
    for (const it of b.items) {
      if (!it.date || !it.requestType) continue;
      if (!REQ_FA[it.requestType]) continue;
      // Remove existing draft for same date+staff
      for (const old of h(ctx, 'sa_preferences').filter(p => p.periodId === periodId && p.staffId === staffId && p.date === it.date && p.status === 'draft')) {
        ctx.store.remove('sa_preferences', old.id);
      }
      const rec = {
        id: ctx.uid('sap'),
        periodId, staffId, wardId: staff.wardId,
        date: it.date, requestType: it.requestType, priority: it.priority || 'P4',
        status: b.status || 'submitted', submittedAt: ctx.now()
      };
      ctx.store.put('sa_preferences', rec);
      saved++;
    }
    if (saved > 0) {
      const recipient = staff.category === 'supervisor'
        ? h(ctx, 'sa_staff').find(s => s.category === 'matron')
        : (staff.wardId ? ctx.store.get('sa_wards', staff.wardId)?.headStaffId : null);
      if (recipient) {
        const recipientUser = h(ctx, 'sa_staff').find(s => s.id === recipient);
        if (recipientUser) notif(ctx, 'sa_' + recipientUser.id, '📥 درخواست جدید', staff.name + ' — ' + saved + ' مورد', 'info');
      }
    }
    audit(ctx, 'preferences.submit', staffId, { saved, periodId });
    return { saved, periodId, staffId };
  },
  approvePreference(ctx) {
    const p = ctx.store.get('sa_preferences', ctx.params.id);
    if (!p) throw ctx.E.notFound('preference_not_found');
    const ok = ctx.body.approve === true;
    p.status = ok ? 'approved' : 'rejected';
    p.approvedAt = ctx.now();
    p.approvedBy = ctx.actor.id;
    ctx.store.put('sa_preferences', p);
    notif(ctx, 'sa_' + p.staffId, ok ? '✅ تأیید درخواست' : '❌ رد درخواست', p.date + ' — ' + REQ_FA[p.requestType], ok ? 'success' : 'warning');
    audit(ctx, 'preference.' + (ok ? 'approve' : 'reject'), p.id, { date: p.date });
    return p;
  },
  applyRoutine(ctx) {
    const b = ctx.body;
    const routine = ROUTINES.find(r => r.code === b.routineCode);
    if (!routine) throw ctx.E.badRequest('invalid_routine');
    const periodId = b.periodId || this._currentPeriod(ctx).id;
    const period = ctx.store.get('sa_periods', periodId);
    if (!period) throw ctx.E.notFound('period_not_found');
    const days = monthDays(period.jy, period.jm);
    const items = routine.run(days);
    return { routineCode: routine.code, routineLabel: routine.label, items, count: items.length };
  },
  listRoutines(ctx) {
    return { items: ROUTINES.map(r => ({ code: r.code, label: r.label })), total: ROUTINES.length };
  },

  // ─── Attendance ───
  checkIn(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    const staff = ctx.store.get('sa_staff', a.staffId);
    a.state = 'checked_in';
    a.checkInAt = ctx.now();
    ctx.store.put('sa_assignments', a);
    ctx.store.put('sa_attendance', {
      id: ctx.uid('saa'), assignmentId: a.id, staffId: a.staffId,
      action: 'check_in', at: ctx.now(), byUserId: ctx.actor.id
    });
    bus.emit('sa.checkin', { record: a, staff: staff?.name, actor: ctx.actor });
    return a;
  },
  checkOut(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state = 'checked_out';
    a.checkOutAt = ctx.now();
    ctx.store.put('sa_assignments', a);
    ctx.store.put('sa_attendance', {
      id: ctx.uid('saa'), assignmentId: a.id, staffId: a.staffId,
      action: 'check_out', at: ctx.now(), byUserId: ctx.actor.id
    });
    return a;
  },
  reportLate(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state = 'late';
    a.lateReportedAt = ctx.now();
    a.lateReason = ctx.body.reason || '';
    ctx.store.put('sa_assignments', a);
    const staff = ctx.store.get('sa_staff', a.staffId);
    ctx.store.put('sa_attendance', {
      id: ctx.uid('saa'), assignmentId: a.id, staffId: a.staffId,
      action: 'report_late', at: ctx.now(), byUserId: ctx.actor.id,
      reason: a.lateReason
    });
    bus.emit('sa.attendance.late', { record: a, staff: staff?.name, reason: a.lateReason, actor: ctx.actor });
    return a;
  },
  reportAbsent(ctx) {
    const a = ctx.store.get('sa_assignments', ctx.params.id);
    if (!a) throw ctx.E.notFound('assignment_not_found');
    a.state = 'absent';
    a.absentReportedAt = ctx.now();
    a.absentReason = ctx.body.reason || '';
    ctx.store.put('sa_assignments', a);
    const staff = ctx.store.get('sa_staff', a.staffId);
    ctx.store.put('sa_attendance', {
      id: ctx.uid('saa'), assignmentId: a.id, staffId: a.staffId,
      action: 'report_absent', at: ctx.now(), byUserId: ctx.actor.id,
      reason: a.absentReason
    });
    bus.emit('sa.attendance.absent', { record: a, staff: staff?.name, reason: a.absentReason, actor: ctx.actor });
    return a;
  },
  todayAttendance(ctx) {
    const t = todayJ();
    const date = fmtJ(t.jy, t.jm, t.jd);
    const assigns = h(ctx, 'sa_assignments').filter(a => a.date === date);
    const byWard = {};
    for (const a of assigns) {
      if (!byWard[a.wardId]) byWard[a.wardId] = { total: 0, checked_in: 0, checked_out: 0, late: 0, absent: 0, scheduled: 0, list: [] };
      const w = byWard[a.wardId];
      w.total++;
      w[a.state || 'scheduled']++;
      w.list.push(a);
    }
    return { date, byWard, totalAssignments: assigns.length };
  },

  // ─── Fairness / Stats ───
  getFairness(ctx) {
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    const wardId = +ctx.query.wardId;
    if (!wardId) throw ctx.E.badRequest('wardId_required');
    const stats = computeWardStats(ctx, wardId, periodId);
    return stats;
  },

  // ─── Payroll ───
  getPayroll(ctx) {
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    const staffId = +ctx.query.staffId;
    if (staffId) return calcPayroll(ctx, staffId, periodId);
    const items = h(ctx, 'sa_staff').filter(s => s.active).map(s => calcPayroll(ctx, s.id, periodId)).filter(Boolean);
    return { items, total: items.length };
  },

  // ─── Config ───
  getConfig(ctx) {
    let cfg = ctx.store.get('sa_config', 'global');
    if (!cfg) { ctx.store.put('sa_config', DEFAULT_CONFIG); cfg = DEFAULT_CONFIG; }
    return cfg;
  },
  updateConfig(ctx) {
    const cfg = ctx.store.get('sa_config', 'global') || { ...DEFAULT_CONFIG };
    const b = ctx.body;
    if (b.weights) cfg.weights = { ...cfg.weights, ...b.weights };
    if (b.limits) cfg.limits = { ...cfg.limits, ...b.limits };
    if (b.rest) cfg.rest = { ...cfg.rest, ...b.rest };
    if (b.payroll) cfg.payroll = { ...cfg.payroll, ...b.payroll };
    ctx.store.put('sa_config', cfg);
    audit(ctx, 'config.update', 'global', { weights: cfg.weights });
    return cfg;
  },

  // ─── Period approve/lock ───
  approvePeriod(ctx) {
    const periodId = ctx.params.id;
    const p = ctx.store.get('sa_periods', periodId);
    if (!p) throw ctx.E.notFound('period_not_found');
    if (p.status === 'locked') throw ctx.E.conflict('already_locked');
    p.status = 'approved';
    p.approvedBy = ctx.actor.id;
    p.approvedAt = ctx.now();
    ctx.store.put('sa_periods', p);
    audit(ctx, 'period.approve', periodId, {});
    bus.emit('sa.period.approved', { period: p, actor: ctx.actor });
    return p;
  },
  lockPeriod(ctx) {
    const periodId = ctx.params.id;
    const p = ctx.store.get('sa_periods', periodId);
    if (!p) throw ctx.E.notFound('period_not_found');
    p.status = 'locked';
    p.lockedBy = ctx.actor.id;
    p.lockedAt = ctx.now();
    ctx.store.put('sa_periods', p);
    audit(ctx, 'period.lock', periodId, {});
    bus.emit('sa.period.locked', { period: p, actor: ctx.actor });
    return p;
  },

  // ─── Notifications ───
  listNotifications(ctx) {
    const userId = ctx.actor.id.startsWith('sa_') ? ctx.actor.id : null;
    if (!userId) return { items: [], total: 0 };
    const items = h(ctx, 'sa_notifications').filter(n => n.userId === userId).sort((a, b) => b.id > a.id ? -1 : 1);
    return { items: items.slice(0, 50), total: items.length };
  },
  markNotificationRead(ctx) {
    const n = ctx.store.get('sa_notifications', ctx.params.id);
    if (!n) throw ctx.E.notFound('notification_not_found');
    n.read = true;
    ctx.store.put('sa_notifications', n);
    return n;
  },

  // ─── Audit ───
  getAudit(ctx) {
    const items = h(ctx, 'sa_audit').slice(-100).reverse();
    const limit = Math.min(+ctx.query.limit || 50, 200);
    return { items: items.slice(0, limit), total: items.length };
  },
  verifyAudit(ctx) {
    const chain = h(ctx, 'sa_audit');
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].prevHash !== chain[i-1].hash) return { ok: false, brokenAt: i, count: chain.length };
    }
    return { ok: true, count: chain.length };
  },

  // ─── Reports ───
  wardReport(ctx) {
    const wardId = +ctx.params.wardId;
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    const stats = computeWardStats(ctx, wardId, periodId);
    const ward = ctx.store.get('sa_wards', wardId);
    return { ward, stats, periodId };
  },
  staffReport(ctx) {
    const staffId = +ctx.params.staffId;
    const periodId = ctx.query.periodId || this._currentPeriod(ctx).id;
    const staff = ctx.store.get('sa_staff', staffId);
    if (!staff) throw ctx.E.notFound('staff_not_found');
    const assigns = h(ctx, 'sa_assignments').filter(a => a.periodId === periodId && a.staffId === staffId);
    const payroll = calcPayroll(ctx, staffId, periodId);
    return { staff, assignments: assigns, payroll, periodId };
  }
};

// ═══ ROUTES ═══
module.exports = {
  handlers: H,
  routes: [
    { method:'POST', path:'/api/sa/auth/pin', handler:'pinLogin', perm:null },
    { method:'GET',  path:'/api/sa/wards', handler:'listWards', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/staff', handler:'listStaff', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/staff/:id', handler:'getStaff', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/period', handler:'getPeriod', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/periods', handler:'listPeriods', perm:'sa.view' },
    { method:'POST', path:'/api/sa/periods', handler:'createPeriod', perm:'sa.manage' },
    { method:'GET',  path:'/api/sa/demands', handler:'getDemands', perm:'sa.view' },
    { method:'POST', path:'/api/sa/demands', handler:'saveDemands', perm:'sa.manage' },
    { method:'POST', path:'/api/sa/solve', handler:'solve', perm:'sa.solve' },
    { method:'POST', path:'/api/sa/solve-all', handler:'solveAll', perm:'sa.solve' },
    { method:'GET',  path:'/api/sa/assignments', handler:'getAssignments', perm:'sa.view' },
    { method:'POST', path:'/api/sa/assignments', handler:'addAssignment', perm:'sa.manage' },
    { method:'DELETE', path:'/api/sa/assignments/:id', handler:'deleteAssignment', perm:'sa.manage' },
    { method:'POST', path:'/api/sa/assignments/:id/lock', handler:'toggleLock', perm:'sa.manage' },
    { method:'GET',  path:'/api/sa/preferences', handler:'getPreferences', perm:'sa.view' },
    { method:'POST', path:'/api/sa/preferences', handler:'submitPreferences', perm:'sa.request' },
    { method:'POST', path:'/api/sa/preferences/:id/approve', handler:'approvePreference', perm:'sa.approve' },
    { method:'POST', path:'/api/sa/routines/apply', handler:'applyRoutine', perm:'sa.request' },
    { method:'GET',  path:'/api/sa/routines', handler:'listRoutines', perm:'sa.view' },
    { method:'POST', path:'/api/sa/attendance/:id/checkin', handler:'checkIn', perm:'sa.checkin' },
    { method:'POST', path:'/api/sa/attendance/:id/checkout', handler:'checkOut', perm:'sa.checkin' },
    { method:'POST', path:'/api/sa/attendance/:id/late', handler:'reportLate', perm:'sa.checkin' },
    { method:'POST', path:'/api/sa/attendance/:id/absent', handler:'reportAbsent', perm:'sa.checkin' },
    { method:'GET',  path:'/api/sa/attendance/today', handler:'todayAttendance', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/fairness', handler:'getFairness', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/payroll', handler:'getPayroll', perm:'sa.payroll' },
    { method:'GET',  path:'/api/sa/config', handler:'getConfig', perm:'sa.view' },
    { method:'POST', path:'/api/sa/config', handler:'updateConfig', perm:'sa.admin' },
    { method:'POST', path:'/api/sa/periods/:id/approve', handler:'approvePeriod', perm:'sa.approve' },
    { method:'POST', path:'/api/sa/periods/:id/lock', handler:'lockPeriod', perm:'sa.lock' },
    { method:'GET',  path:'/api/sa/notifications', handler:'listNotifications', perm:'sa.view' },
    { method:'POST', path:'/api/sa/notifications/:id/read', handler:'markNotificationRead', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/audit', handler:'getAudit', perm:'sa.admin' },
    { method:'GET',  path:'/api/sa/audit/verify', handler:'verifyAudit', perm:'sa.admin' },
    { method:'GET',  path:'/api/sa/reports/ward/:wardId', handler:'wardReport', perm:'sa.view' },
    { method:'GET',  path:'/api/sa/reports/staff/:staffId', handler:'staffReport', perm:'sa.view' }
  ],
  panels: [
    { id:'dashboard', title:'دستیار شیفت', icon:'🏥', perm:'sa.view', kind:'sa_dashboard', api:'/api/sa/wards' },
    { id:'staff_schedule', title:'برنامه من', icon:'📅', perm:'sa.view', kind:'sa_staff', api:'/api/sa/assignments' }
  ]
};
EOF_MODULE
echo "✅ modules/shift_assistant.js ($(wc -l < modules/shift_assistant.js) lines)"

# ─── 3) Permissions ───
if ! grep -q "sa.view" core/permissions-extra.js 2>/dev/null; then
cat >> core/permissions-extra.js << 'EOF_PERMS'

Object.assign(perms.P, {
  'sa.view':     'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.request':  'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.checkin':  'admin,matron,supervisor,clinical_supervisor,head_nurse,nurse,shift_staff',
  'sa.manage':   'admin,matron,head_nurse',
  'sa.solve':    'admin,matron,head_nurse',
  'sa.approve':  'admin,matron',
  'sa.lock':     'admin,matron',
  'sa.payroll':  'admin,matron',
  'sa.admin':    'admin'
});
EOF_PERMS
echo "✅ permissions-extra.js (+9 perms)"
fi

# ─── 4) Bump SW ───
node << 'EOF_SW'
const fs = require('fs');
const F = 'public/sw.js';
if (!fs.existsSync(F)) process.exit(0);
let src = fs.readFileSync(F, 'utf8');
const vMatch = src.match(/const VERSION = (\d+);/);
if (vMatch) {
  const newV = parseInt(vMatch[1]) + 1;
  src = src.replace('const VERSION = ' + vMatch[1] + ';', 'const VERSION = ' + newV + ';');
  fs.writeFileSync(F, src);
  console.log('✅ sw.js → v' + newV);
}
EOF_SW

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Backend نصب شد"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "📁 فایل‌های جدید:"
echo "   modules/shift_assistant.js"
echo "   data/sa_seed.json"
echo ""
echo "✏️  فایل‌های پچ‌شده:"
echo "   core/permissions-extra.js (+9 مجوز)"
echo "   public/sw.js (bump version)"
echo ""
echo "🔄 اجرا:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null || true"
echo "  sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "  انتظار در خروجی:"
echo "    [sa] seeded: 37 wards, ~550 staff, period 1403-09"
echo "    📦 shift_assistant (37)"
echo "    📡 284 routes · 25 modules"
echo ""
