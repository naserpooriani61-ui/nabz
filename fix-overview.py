import re

with open('modules/emergency_full.js', 'r', encoding='utf-8') as f:
    src = f.read()

if 'ERF-OVERVIEW-FIX-V2' in src:
    print('ℹ️  قبلاً پچ شده')
    exit(0)

# ─── پیدا کردن تابع overview ───
m = re.search(r'function overview\s*\(ctx\)\s*\{', src)
if not m:
    print('❌ تابع overview پیدا نشد')
    exit(1)

# پیدا کردن بلوک return { ... } داخل overview
start = m.end()
depth = 1
i = start
while i < len(src) and depth > 0:
    if src[i] == '{': depth += 1
    elif src[i] == '}': depth -= 1
    i += 1
body_end = i

body = src[start:body_end]

# پیدا کردن return داخل body
rm = re.search(r'return\s*\{', body)
if not rm:
    print('❌ return پیدا نشد در overview')
    exit(1)

ret_start = start + rm.start()
ret_end = start + rm.end()

# ساخت return جدید — هم آرایه هم آبجکت
new_return = '''/* ERF-OVERVIEW-FIX-V2: both array & object shapes for client compat */
  const zonesArr = ZONES.map(z => byZone[z.code]);
  const byEsiArr = [1,2,3,4,5].map(l => ({ level: l, count: byEsi[l] || 0 }));

  return {'''

src = src[:ret_start] + new_return + src[ret_end:]

# داخل بلوک return، خطوط zones و byEsi را اضافه کنیم (قبل از zoneList)
anchor = 'zoneList: ZONES,'
if anchor in src:
    src = src.replace(
        anchor,
        'zones: zonesArr,           // ← آرایه برای forEach\n    zonesByCode: byZone,       // ← آبجکت برای [code]\n    byEsi: byEsiArr,           // ← آرایه برای forEach\n    byEsiMap: byEsi,           // ← آبجکت برای [level]\n    ' + anchor,
        1
    )
    # حذف zones قدیمی (object) اگر هست
    src = re.sub(r'\bzones:\s*byZone\s*,\s*\n?\s*', '', src)
    # حذف byEsi قدیمی (object) اگر هست
    src = re.sub(r'\bbyEsi\s*,\s*\n?\s*', '', src)
    print('✅ overview اصلاح شد:')
    print('   - zones: آرایه (forEach کار می‌کند)')
    print('   - zonesByCode: آبجکت (برای [code])')
    print('   - byEsi: آرایه (forEach کار می‌کند)')
    print('   - byEsiMap: آبجکت (برای [level])')
else:
    print('❌ anchor "zoneList: ZONES," پیدا نشد')
    exit(1)

with open('modules/emergency_full.js', 'w', encoding='utf-8') as f:
    f.write(src)

print('\n✅ ذخیره شد')
