// patch-erf.js — اصلاح ایدمپوتنت باگ‌های emergency_full_v2.js
// استفاده: node patch-erf.js [مسیر اختیاری فایل]
const fs = require('fs');
const path = require('path');

// اگر مسیر از argv داده شده، همان را استفاده کن
const argPath = process.argv[2];
if (argPath) {
  const abs = path.resolve(process.cwd(), argPath);
  if (!fs.existsSync(abs)) {
    console.error('❌ مسیر داده‌شده وجود ندارد:', abs);
    process.exit(1);
  }
  run(abs);
} else {
  // در غیر این صورت خودکار جستجو کن
  const CANDIDATES = [
    'emergency_full_v2.js',
    'modules/emergency_full_v2.js',
    'server/modules/emergency_full_v2.js',
    'src/emergency_full_v2.js',
    'src/modules/emergency_full_v2.js',
    'server/emergency_full_v2.js',
    'lib/emergency_full_v2.js',
    'src/lib/emergency_full_v2.js',
  ];
  const found = CANDIDATES
    .map(p => path.resolve(process.cwd(), p))
    .find(p => fs.existsSync(p));

  if (!found) {
    console.error('❌ emergency_full_v2.js پیدا نشد در مسیرهای رایج.');
    console.error('');
    console.error('این را بزن تا مسیرش را ببینی:');
    console.error('  find . -name "emergency_full_v2.js" -not -path "*/node_modules/*"');
    console.error('');
    console.error('بعد با مسیر اجرا کن:');
    console.error('  node patch-erf.js "مسیر/واقعی/emergency_full_v2.js"');
    process.exit(1);
  }
  run(found);
}

function run(file) {
  console.log('📄 فایل:', file);
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;
  const warnings = [];

  function patch(label, find, replace) {
    if (src.includes(replace) && !src.includes(find)) {
      console.log('  ⏭️  ' + label + ' (از قبل اعمال شده)');
      return;
    }
    if (src.includes(find)) {
      src = src.split(find).join(replace);
      console.log('  ✅ ' + label);
      changed++;
    } else {
      console.log('  ⚠️  ' + label + ' (pattern پیدا نشد)');
      warnings.push(label);
    }
  }

  // ۱. NEWS2 fix
  patch(
    'NEWS2: onOxygen شمارش',
    'if (v.onOxygen) s += 2;',
    'if (v.onOxygen) { n++; s += 2; }'
  );

  // ۲. initZoneBeds
  patch(
    'initZoneBeds: تشخیص دقیق',
    "const existing = h(ctx, 'beds').filter(b => b.area === 'ed' || b.zone);\n  if (existing.length > 0) return { initialized: false, count: existing.length };",
    "const existing = h(ctx, 'beds').filter(b => b.zone);\n  const expected = ZONES.reduce((s, z) => s + z.beds, 0);\n  if (existing.length >= expected) return { initialized: false, count: existing.length };"
  );

  // ۳. Route conflict
  patch(
    'Route: تعارض disposition',
    "{ method: 'POST', path: '/api/erf/visit/:id/:action',  handler: 'disposition',    perm: 'ed.triage' }",
    "{ method: 'POST', path: '/api/erf/visit/:id/disposition/:action', handler: 'disposition', perm: 'ed.triage' }"
  );

  // ۴. listBeds side-effect
  patch(
    'listBeds: حذف auto-init',
    "  let beds = h(ctx, 'beds').filter(b => b.area === 'ed' || b.zone);\n  if (!beds.length) {\n    // auto-init if empty\n    initZoneBeds(ctx);\n    beds = h(ctx, 'beds').filter(b => b.area === 'ed' || b.zone);\n  }",
    "  let beds = h(ctx, 'beds').filter(b => b.zone);"
  );

  if (changed > 0) {
    fs.writeFileSync(file, src);
    console.log('\n✅ ' + changed + ' از ۴ patch اعمال شد.');
  } else {
    console.log('\nℹ️  تغییری اعمال نشد.');
  }

  if (warnings.length > 0) {
    console.log('\n⚠️  این patchها اعمال نشدن چون pattern دقیق پیدا نشد:');
    warnings.forEach(w => console.log('   - ' + w));
    console.log('\nاین طبیعی است اگر فایل شما کمی متفاوت نوشته شده. مهم نیست — patchها فقط بهبود هستند، نه واجب.');
    console.log('اگر شک داری، بگو تا pattern را دقیق‌تر کنیم.');
  }
}
