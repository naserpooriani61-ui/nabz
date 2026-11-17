import re

with open('public/zz_dispatch.js', 'r', encoding='utf-8') as f:
    src = f.read()

# آیا قبلاً پچ شده؟
if "'erf_beds':'erfPanels.beds'" in src:
    print('ℹ️  قبلاً پچ شده — کاری لازم نیست')
    exit(0)

# پیدا کردن EXTERNAL و اضافه کردن ۴ خط قبل از آکولاد بسته
# دنبال ': 'erf_referrals':'erfUI.showReferrals',' می‌گردیم
pattern = r"('erf_referrals':'erfUI\.showReferrals',?\s*)"
match = re.search(pattern, src)

if not match:
    # تلاش دوم: دنبال هر 'erf_' در EXTERNAL بگرد
    pattern2 = r"('erf_[a-z]+':'erfUI\.[a-zA-Z]+',?\s*)"
    matches = list(re.finditer(pattern2, src))
    if not matches:
        print('❌ نتوانستم EXTERNAL را پیدا کنم — دستی چک کن')
        exit(1)
    match = matches[-1]

insert_pos = match.end()
addition = """
    'erf_beds':'erfPanels.beds',
    'erf_codes':'erfPanels.codes',
    'erf_orders':'erfPanels.orders',
    'erf_stats':'erfPanels.stats',
    """

src = src[:insert_pos] + addition + src[insert_pos:]

with open('public/zz_dispatch.js', 'w', encoding='utf-8') as f:
    f.write(src)

print('✅ ۴ kind به EXTERNAL اضافه شد:')
print('   - erf_beds → erfPanels.beds')
print('   - erf_codes → erfPanels.codes')
print('   - erf_orders → erfPanels.orders')
print('   - erf_stats → erfPanels.stats')
