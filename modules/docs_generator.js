
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Documentation Engine
//  Auto-generates SYSTEM.md + USER-MANUAL.html from live code
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const perms = require('../core/permissions');

const ROOT = path.join(__dirname, '..');

function loadAllModules() {
  const mods = {};
  const dir = path.join(ROOT, 'modules');
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.js') || file.includes('.bak-')) continue;
    try {
      const m = require(path.join(dir, file));
      if (m && (m.routes || m.panels)) mods[file.replace('.js', '')] = m;
    } catch (_) {}
  }
  return mods;
}

function fmtCount(n) { return n.toLocaleString('en-US'); }

function buildSystemMarkdown() {
  const mods = loadAllModules();
  const ts = new Date().toISOString();

  let routesTotal = 0, panelsTotal = 0, permsUsed = new Set();
  const moduleStats = [];
  for (const [name, m] of Object.entries(mods)) {
    const r = (m.routes || []).length;
    const p = (m.panels || []).length;
    routesTotal += r;
    panelsTotal += p;
    for (const route of m.routes || []) if (route.perm) permsUsed.add(route.perm);
    moduleStats.push({ name, routes: r, panels: p });
  }
  moduleStats.sort((a, b) => b.routes - a.routes);

  let md = '';
  md += '# NABZ — System Documentation\n\n';
  md += '_Generated: ' + ts + '_\n\n';
  md += '## Overview\n\n';
  md += '**' + Object.keys(mods).length + ' modules · ' + routesTotal + ' routes · ' + panelsTotal + ' panels · ' + permsUsed.size + ' permissions**\n\n';

  md += '## Architecture\n\n';
  md += '- Server: Node.js commonjs, no build step\n';
  md += '- Data: JSON files in `data/` (atomic writes, no DB)\n';
  md += '- Auth: JWT (8h TTL) + bcrypt password hashing\n';
  md += '- Permissions: role-based (`core/permissions.js`)\n';
  md += '- Events: SSE broadcast with ward/service filtering\n';
  md += '- State: order/mar/consult/transfer state machines\n\n';

  md += '## Modules\n\n';
  md += '| Module | Routes | Panels |\n|---|---|---|\n';
  for (const s of moduleStats) md += '| ' + s.name + ' | ' + s.routes + ' | ' + s.panels + ' |\n';

  md += '\n## Roles\n\n';
  const roles = Object.keys(perms.ROLES).sort();
  md += '**' + roles.length + ' roles** — `' + roles.join('`, `') + '`\n\n';

  md += '### Role hierarchy\n\n';
  const byLevel = {};
  for (const [code, r] of Object.entries(perms.ROLES)) {
    const lvl = r.level || r.l || 9;
    if (!byLevel[lvl]) byLevel[lvl] = [];
    byLevel[lvl].push(code);
  }
  for (const lvl of Object.keys(byLevel).sort((a, b) => a - b)) {
    md += '- **Level ' + lvl + ':** ' + byLevel[lvl].join(', ') + '\n';
  }

  md += '\n## Permissions Matrix\n\n';
  md += '| Permission | Allowed Roles |\n|---|---|\n';
  const sortedPerms = Object.keys(perms.P).sort();
  for (const p of sortedPerms) {
    const roles = String(perms.P[p]).split(',').slice(0, 6);
    const more = String(perms.P[p]).split(',').length > 6 ? ' …' : '';
    md += '| `' + p + '` | ' + roles.join(', ') + more + ' |\n';
  }

  md += '\n## Endpoints by Module\n\n';
  for (const [name, m] of Object.entries(mods).sort()) {
    if (!m.routes || !m.routes.length) continue;
    md += '### ' + name + '\n\n';
    for (const r of m.routes) {
      const perm = r.perm ? '`' + r.perm + '`' : '_public_';
      md += '- `' + r.method + ' ' + r.path + '` → ' + perm + '\n';
    }
    md += '\n';
  }

  md += '## Quick Start\n\n';
  md += '```bash\n';
  md += 'cd ~/nabz\n';
  md += 'export NODE_OPTIONS="--max-old-space-size=384"\n';
  md += 'node core/server.js\n';
  md += '```\n\n';
  md += 'Open: http://localhost:4000\n\n';
  md += '**First login:** admin / nabz@2026 (must change password immediately)\n\n';

  return md;
}

function buildUserManualHtml() {
  const mods = loadAllModules();
  const ts = new Date().toISOString();

  let html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">';
  html += '<title>NABZ — راهنمای کاربری</title>';
  html += '<style>';
  html += '@page { size: A4; margin: 15mm; }';
  html += 'body { font-family: "Vazirmatn", Tahoma, sans-serif; line-height: 1.7; color: #0f172a; max-width: 800px; margin: 20px auto; padding: 20px; }';
  html += 'h1 { color: #0891b2; border-bottom: 3px solid #0891b2; padding-bottom: 8px; }';
  html += 'h2 { color: #0c4a6e; margin-top: 24px; border-right: 4px solid #06b6d4; padding-right: 10px; }';
  html += 'h3 { color: #1e40af; margin-top: 16px; }';
  html += 'code { background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 90%; }';
  html += 'pre { background: #f8fafc; padding: 12px; border-radius: 8px; overflow-x: auto; border-right: 3px solid #06b6d4; }';
  html += '.box { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 12px; margin: 10px 0; }';
  html += '.warn { background: #fef3c7; border-color: #f59e0b; }';
  html += 'table { width: 100%; border-collapse: collapse; margin: 10px 0; }';
  html += 'th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: right; }';
  html += 'th { background: #e0f2fe; font-weight: 800; }';
  html += '.footer { margin-top: 40px; padding-top: 10px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 10px; color: #94a3b8; }';
  html += '</style></head><body>';

  html += '<h1>🫀 راهنمای کاربری نبض</h1>';
  html += '<p><em>تولید: ' + new Date().toLocaleString('fa-IR') + '</em></p>';

  html += '<div class="box">';
  html += '<strong>ورود به سیستم:</strong> آدرس سرور محلی (مثلاً <code>http://localhost:4000</code>)<br>';
  html += '<strong>اولین ورود:</strong> admin / nabz@2026 — <em>بلافاصله رمز را تغییر دهید</em>';
  html += '</div>';

  html += '<h2>شروع کار</h2>';
  html += '<h3>۱. ورود</h3>';
  html += '<p>با نام کاربری و رمز وارد شوید. اگر اولین ورود است، سیستm باید رمز را تغییر دهد.</p>';

  html += '<h3>۲. خانه (Dashboard)</h3>';
  html += '<p>بعد از ورود، داشبورد مخصوص نقش شما نمایش داده می‌شود:</p>';
  html += '<ul>';
  html += '<li><strong>پرستار:</strong> بیماران بخش، MAR نزدیک، ویتال بحرانی</li>';
  html += '<li><strong>سرپرستار:</strong> آمار تیم، درخواست‌ها، compliance</li>';
  html += '<li><strong>پزشک:</strong> بیماران سرویس، راند، مشاوره</li>';
  html += '<li><strong>مترون:</strong> همه بخش‌ها، بحران‌ها، درخواست‌ها</li>';
  html += '<li><strong>مدیر:</strong> کاربران، دسترسی‌ها، سیستم</li>';
  html += '</ul>';

  html += '<h3>۳. دسترسی سریع</h3>';
  html += '<p>در پایین صفحه ۵ تب اصلی:</p>';
  html += '<table><tr><th>تب</th><th>کاربرد</th></tr>';
  html += '<tr><td>🏠 خانه</td><td>داشبورد نقش</td></tr>';
  html += '<tr><td>🚨 اورژانس</td><td>تریاژ، کد، MCI</td></tr>';
  html += '<tr><td>🩺 بالینی</td><td>بیماران، ویتال، کاردکس، MAR</td></tr>';
  html += '<tr><td>🧠 عصبی</td><td>موتور عصبی، cohort</td></tr>';
  html += '<tr><td>☰ منو</td><td>همه پنل‌ها</td></tr>';
  html += '</table>';

  html += '<h2>کارهای روزانه پرستار</h2>';
  html += '<h3>ثبت ویتال</h3>';
  html += '<ol><li>پنل «بیماران» → کلیک روی بیمار</li>';
  html += '<li>دکمه «ثبت ویتال» یا از منو</li>';
  html += '<li>مقادیر را وارد کنید — NEWS2 خودکار محاسبه می‌شود</li>';
  html += '<li>اگر NEWS2 ≥ ۷، هشدار فوری ارسال می‌شود</li></ol>';

  html += '<h3>توزیع دارو (MAR)</h3>';
  html += '<ol><li>پنل MAR — سه تب: در نوبت / دیرکرد / پرخطر</li>';
  html += '<li>روی دوز کلیک → ۵ Rights را تیک بزنید</li>';
  html += '<li>داروهای High-Alert نیاز به شاهد دارند</li>';
  html += '<li>PRN بعد از ۱ ساعت نیاز به ثبت اثربخشی دارد</li></ol>';

  html += '<h3>تحویل شیفت</h3>';
  html += '<p>پنل «تحویل شیفت — پرستاری» → بیمار → «📝 تولید ISBAR» → امضا → گیرنده تأیید می‌کند</p>';

  html += '<h2>کارهای روزانه پزشک</h2>';
  html += '<h3>ثبت دستور</h3>';
  html += '<ol><li>بیمار → «دستور جدید»</li>';
  html += '<li>یا از Order Set آماده استفاده کنید</li>';
  html += '<li>سیستم تداخل دارویی و آلرژی را چک می‌کند</li></ol>';

  html += '<h3>مشاوره</h3>';
  html += '<p>درخواست مشاوره → انتخاب سرویس + نوع (اورژانسی/فوری/روتین) → ارسال</p>';

  html += '<h3>ترخیص</h3>';
  html += '<ol><li>ترخیص → «ترخیص پیشرفته»</li>';
  html += '<li>Med Rec، Readmission Risk، Follow-up، Teach-back را انجام دهید</li>';
  html += '<li>Checklist JCI را کامل کنید</li>';
  html += '<li>سند انتقال PCP تولید کنید</li></ol>';

  html += '<h2>مدیریت</h2>';
  html += '<h3>افزودن کاربر</h3>';
  html += '<p>مدیریت → «کاربران» → ➕ جدید → نام کاربری، رمز، نقش، بخش</p>';

  html += '<h3>تخصیص بخش</h3>';
  html += '<p>مدیریت → «مدیریت بخش کاربران» → هر کاربر را یک بخش اختصاص دهید</p>';

  html += '<h3>On-Call</h3>';
  html += '<p>مدیریت → «On-Call Board» → دکمه «🚀 خودکار پر کن»</p>';

  html += '<h2>عیب‌یابی</h2>';
  html += '<div class="box warn">';
  html += '<strong>اگر صفحه خالی بود:</strong> بخش (ward) شما تعریف نشده — با مدیر تماس بگیرید<br>';
  html += '<strong>اگر login خطا داد:</strong> رمز اشتباه یا حساب غیرفعال است<br>';
  html += '<strong>اگر SSE قطع شد:</strong> صفحه را refresh کنید<br>';
  html += '<strong>اگر داده قدیمی:</strong> Ctrl+Shift+R برای hard refresh';
  html += '</div>';

  html += '<h2>راهنمای فنی (برای IT)</h2>';
  html += '<pre>cd ~/nabz\nexport NODE_OPTIONS="--max-old-space-size=384"\nnode core/server.js</pre>';
  html += '<p>Log در: <code>~/nabz-server.log</code><br>';
  html += 'Backups: <code>~/nabz-backups/</code><br>';
  html += 'Data: <code>~/nabz/data/</code></p>';

  html += '<div class="footer">';
  html += 'NABZ — Neural Hospital Operating System v1.0 · ' + ts;
  html += '</div>';
  html += '</body></html>';

  return html;
}

// ═══ Handlers ═══
function systemMd(ctx) {
  return { markdown: buildSystemMarkdown(), generatedAt: new Date().toISOString() };
}

function userManualHtml(ctx) {
  return { html: buildUserManualHtml(), generatedAt: new Date().toISOString() };
}

function saveToDisk(ctx) {
  const mdPath = path.join(process.env.HOME || '/tmp', 'nabz-SYSTEM.md');
  const htmlPath = path.join(ROOT, 'public', 'user-manual.html');
  fs.writeFileSync(mdPath, buildSystemMarkdown(), 'utf8');
  fs.writeFileSync(htmlPath, buildUserManualHtml(), 'utf8');
  return { markdownPath: mdPath, manualPath: '/user-manual.html' };
}

module.exports = {
  handlers: { systemMd, userManualHtml, saveToDisk },
  routes: [
    { method: 'GET',  path: '/api/docs/system', handler: 'systemMd',      perm: 'admin.users.manage' },
    { method: 'GET',  path: '/api/docs/manual', handler: 'userManualHtml', perm: null },
    { method: 'POST', path: '/api/docs/save',   handler: 'saveToDisk',    perm: 'admin.users.manage' }
  ],
  panels: []
};

console.log('[docs-generator] loaded — /api/docs/system + /api/docs/manual');
