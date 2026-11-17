#!/data/data/com.termux/files/usr/bin/bash
set -e
[ ! -f core/server.js ] && { echo "❌ از ریشهٔ پروژه"; exit 1; }

echo "🩺 NABZ Pre-Flight Check"
echo ""

# ═══════════════════════════════════════════════════════════
#  ۱) وضعیت فایل‌ها
# ═══════════════════════════════════════════════════════════
echo "═══ ۱) فایل‌ها ═══"
for f in core/server.js core/neural.js modules/shift_assistant.js public/sa.js public/sa-init.js public/app.js public/index.html public/sw.js; do
  if [ -f "$f" ]; then
    sz=$(wc -l < "$f")
    echo "✅ $f ($sz خط)"
  else
    echo "❌ $f گم‌شده"
  fi
done
echo ""

# ═══════════════════════════════════════════════════════════
#  ۲) ماژول shift_assistant
# ═══════════════════════════════════════════════════════════
echo "═══ ۲) ماژول shift_assistant ═══"
node -e "
  try {
    const m = require('./modules/shift_assistant.js');
    console.log('✅ بارگذاری موفق');
    console.log('   routes:', m.routes.length);
    console.log('   panels:', m.panels.length);
    console.log('   handlers:', Object.keys(m.handlers || {}).length);
    const p = m.panels[0];
    console.log('   panel.id:', p.id, '| kind:', p.kind);
  } catch (e) {
    console.error('❌', e.message);
    process.exit(1);
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  ۳) داده‌های seed
# ═══════════════════════════════════════════════════════════
echo "═══ ۳) داده ═══"
node -e "
  const store = require('./core/store');
  const wards = store.readAll('sa_wards');
  const staff = store.readAll('sa_staff');
  const periods = store.readAll('sa_periods');
  console.log('بخش‌ها:', wards.length);
  console.log('پرسنل:', staff.length);
  console.log('دوره‌ها:', periods.length);
  if (periods[0]) console.log('  دوره فعلی:', periods[0].id, '| status:', periods[0].status);
  if (wards.length === 0) { console.error('❌ seed نشده!'); process.exit(1); }
  const headNurses = staff.filter(s => s.category === 'head_nurse').length;
  console.log('سرپرستارها:', headNurses);
"
echo ""

# ═══════════════════════════════════════════════════════════
#  ۴) _modules شبیه‌سازی (بدون سرور)
# ═══════════════════════════════════════════════════════════
echo "═══ ۴) _modules (شبیه‌سازی) ═══"
node -e "
  const fs = require('fs');
  const path = require('path');
  const MODS = {};
  for (const f of fs.readdirSync('modules')) {
    if (!f.endsWith('.js')) continue;
    try { MODS[f.replace('.js','')] = require('./modules/' + f); }
    catch (e) { console.warn('  skip', f, ':', e.message); }
  }
  const panels = [];
  for (const [name, mod] of Object.entries(MODS)) {
    for (const p of (mod.panels || [])) {
      panels.push(Object.assign({}, p, { id: name + '.' + p.id, module: name }));
    }
  }
  const dups = {};
  const seen = {};
  for (const p of panels) {
    if (seen[p.id]) dups[p.id] = (dups[p.id]||1) + 1;
    seen[p.id] = true;
  }
  console.log('کل پنل‌ها:', panels.length);
  const sa = panels.filter(p => p.id.startsWith('shift_assistant.'));
  const cdss = panels.filter(p => p.id.startsWith('cdss.'));
  console.log('shift_assistant:', sa.length, '→', sa.map(p => p.id + ' [' + p.kind + ']').join(', '));
  console.log('cdss:', cdss.length, '→', cdss.map(p => p.id + ' [' + p.kind + ']').join(', '));
  if (Object.keys(dups).length > 0) {
    console.warn('⚠️  id تکراری:', Object.keys(dups).join(', '));
  } else {
    console.log('✅ هیچ id تکراری نیست');
  }
"
echo ""

# ═══════════════════════════════════════════════════════════
#  ۵) Syntax همه فایل‌های فرانت
# ═══════════════════════════════════════════════════════════
echo "═══ ۵) Syntax فرانت ═══"
node -e "
  const fs = require('fs');
  const files = ['app.js','extra.js','cdss.js','sa.js','sa-init.js','voice.js','voice-init.js','offline.js','offline-init.js','documents.js','scanner.js','ops2.js','live.js'];
  let ok = 0, fail = 0;
  for (const f of files) {
    const p = 'public/' + f;
    if (!fs.existsSync(p)) continue;
    try { new Function(fs.readFileSync(p, 'utf8')); ok++; }
    catch (e) { console.error('  ❌', f, ':', e.message); fail++; }
  }
  console.log('✅ ' + ok + ' فایل OK' + (fail ? ' — ' + fail + ' خطا' : ''));
  if (fail > 0) process.exit(1);
"
echo ""

# ═══════════════════════════════════════════════════════════
#  ۶) wrap شمارش روی NABZ.show
# ═══════════════════════════════════════════════════════════
echo "═══ ۶) wrap روی NABZ.show ═══"
node -e "
  const fs = require('fs');
  const files = ['app.js','extra.js','cdss.js','sa-init.js'];
  let count = 0;
  for (const f of files) {
    if (!fs.existsSync('public/' + f)) continue;
    const s = fs.readFileSync('public/' + f, 'utf8');
    const m = (s.match(/NABZ\.show\s*=\s*(async\s+)?function/g) || []).length;
    if (m) { console.log('  ' + f + ': ' + m); count += m; }
  }
  console.log(count === 1 ? '✅ فقط ۱ wrap (cdss.js)' : '⚠️  ' + count + ' wrap');
"
echo ""

# ═══════════════════════════════════════════════════════════
#  ۷) admin password
# ═══════════════════════════════════════════════════════════
echo "═══ ۷) admin ═══"
node -e "
  const bcrypt = require('bcryptjs');
  const store = require('./core/store');
  const a = store.readAll('users').find(u => u.username === 'admin');
  if (!a) { console.error('❌ admin نیست'); process.exit(1); }
  const ok = bcrypt.compareSync('nabz@2026', a.passwordHash || '');
  console.log(ok ? '✅ admin/nabz@2026 کار می‌کند' : '❌ پسورد اشتباه');
  if (!ok) process.exit(1);
"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✅ Pre-flight تمام"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "حالا سرور را استارت بزنید:"
echo "  pkill -9 -f 'core/server.js' 2>/dev/null; sleep 1"
echo "  export NODE_OPTIONS='--max-old-space-size=384'"
echo "  node core/server.js"
echo ""
echo "و در مرورگر تست‌های end-to-end بزنید (پایین راهنما)."
echo ""
