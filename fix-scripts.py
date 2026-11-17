import re

with open('public/index.html', 'r', encoding='utf-8') as f:
    html = f.read()

changed = False

# ۱) zz_dispatch.js — باید قبل از همه UIها لود شود
if 'zz_dispatch.js' not in html:
    # بعد از </title> یا <body> یا اولین <script> — قبل از emergency-ui.js
    m = re.search(r'<script src="/emergency-ui\.js', html)
    if m:
        html = html[:m.start()] + '<script src="/zz_dispatch.js?v=1"></script>\n    ' + html[m.start():]
        changed = True
        print('✅ zz_dispatch.js اضافه شد (قبل از emergency-ui.js)')
    else:
        print('⚠️  emergency-ui.js پیدا نشد — دستی چک کن')

# ۲) zz_erf_panels.js — بعد از erf_ui.js
if 'zz_erf_panels.js' not in html:
    m = re.search(r'<script src="/erf_ui\.js[^"]*"></script>', html)
    if m:
        html = html[:m.end()] + '\n    <script src="/zz_erf_panels.js?v=1"></script>' + html[m.end():]
        changed = True
        print('✅ zz_erf_panels.js اضافه شد (بعد از erf_ui.js)')
    else:
        print('⚠️  erf_ui.js پیدا نشد — دستی چک کن')

if changed:
    with open('public/index.html', 'w', encoding='utf-8') as f:
        f.write(html)
    print('\n✅ index.html به‌روزرسانی شد')
else:
    print('\nℹ️  تغییری لازم نبود — هر دو فایل قبلاً بارگذاری می‌شوند')
