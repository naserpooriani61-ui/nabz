
echo "═══════════ Diagnostic ═══════════"
echo "1. تعداد ارجاع به _docButtonsFor:"
grep -c "_docButtonsFor" public/app.js

echo ""
echo "2. محل‌های ارجاع:"
grep -n "_docButtonsFor" public/app.js

echo ""
echo "3. تعریف function _docButtonsFor:"
grep -c "^function _docButtonsFor\|^const _docButtonsFor\|  function _docButtonsFor" public/app.js

echo ""
echo "4. Return statement:"
grep "return {" public/app.js | head -1

echo ""
echo "═══════════ Fix ═══════════"

node << 'NODE'
const fs = require('fs');
let s = fs.readFileSync('public/app.js', 'utf8');
let fixes = 0;

// ─── Fix 1: NABZ._docButtonsFor( → _docButtonsFor( ───
const before1 = s;
s = s.replace(/NABZ\._docButtonsFor\s*\(/g, '_docButtonsFor(');
if (s !== before1) {
  fixes++;
  console.log('✅ Fix 1: NABZ._docButtonsFor → _docButtonsFor (local call)');
}

// ─── Fix 2: Ensure _docButtonsFor function exists ───
const hasFn = /function\s+_docButtonsFor\s*\(/.test(s) || /const\s+_docButtonsFor\s*=/.test(s);
if (!hasFn && s.includes('_docButtonsFor(')) {
  const fnDef = `

function _docButtonsFor(panelId, item) {
  if (!item) return '';
  const btn = function(label, type, val) {
    return '<button class="btn btn-block" style="margin-top:6px;background:var(--bg-3);padding:10px;font-size:12px" onclick="NABZ.openDoc(\\'' + type + '\\',\\'' + val + '\\')">' + label + '</button>';
  };
  let html = '';
  if (panelId === 'clinical.patients' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)"><div style="font-size:12px;font-weight:900;margin-bottom:8px">📄 اسناد</div>' +
      btn('📋 کاردکس', 'kardex', item.id) +
      btn('💊 MAR', 'mar', item.id) +
      btn('📈 نمودار ویتال', 'vitalsChart', item.id) +
      '</div>';
  } else if (panelId === 'workflow.discharge' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('🚪 خلاصه ترخیص', 'discharge', item.id) + '</div>';
  } else if (panelId === 'workflow.handover' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('📄 چاپ تحویل', 'handover', item.id) + '</div>';
  } else if (panelId === 'nursing_report.nursing' && item.id) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('📄 چاپ گزارش', 'nursingReport', item.id) + '</div>';
  } else if (panelId === 'bedboard.wards' && item.code) {
    html = '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border)">' +
      btn('👥 لیست بخش', 'wardCensus', item.code) + '</div>';
  }
  return html;
}
`;
  // Insert right before showNeural
  if (s.includes('async function showNeural()')) {
    s = s.replace('async function showNeural()', fnDef + '\nasync function showNeural()');
  } else {
    // Fallback: insert before return
    s = s.replace(/return \{/, fnDef + '\nreturn {');
  }
  fixes++;
  console.log('✅ Fix 2: _docButtonsFor function added');
} else if (hasFn) {
  console.log('ℹ️ _docButtonsFor already defined');
}

// ─── Fix 3: Export (for console access, optional) ───
if (!/return \{[^}]*_docButtonsFor/.test(s)) {
  s = s.replace(/return \{([^}]*)\};/, function(m, inner) {
    if (inner.indexOf('_docButtonsFor') !== -1) return m;
    return 'return {' + inner + ', _docButtonsFor };';
  });
  if (s.indexOf(', _docButtonsFor };') !== -1) {
    fixes++;
    console.log('✅ Fix 3: _docButtonsFor exported');
  }
}

if (fixes > 0) {
  fs.writeFileSync('public/app.js', s);
  console.log('');
  console.log('💾 app.js saved — ' + fixes + ' fixes applied');
} else {
  console.log('');
  console.log('ℹ️ No fixes applied — check manually');
}
NODE

echo ""
echo "═══════════ Verify syntax ═══════════"
node -e "new Function(require('fs').readFileSync('public/app.js','utf8'))" && echo "✅ app.js syntax OK" || echo "❌ Syntax error"

echo ""
echo "═══════════ Restart ═══════════"
for pid in $(pgrep -f "core/server.js" 2>/dev/null); do kill -9 "$pid" 2>/dev/null; done
sleep 1

echo ""
echo "✅ Done"
