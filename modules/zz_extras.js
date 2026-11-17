
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Extras (lab test catalog + auto-attach)
// ═══════════════════════════════════════════════════════════
const store = require('../core/store');
const bus = require('../core/events');

// ═══ Lab Test Panels (with critical values for auto-detection) ═══
const LAB_TESTS = {
  'CBC': [
    { code: 'WBC', name: 'White Blood Cells', unit: '×10³/µL', normalLow: 4.0, normalHigh: 11.0, critLow: 2.0, critHigh: 30.0 },
    { code: 'Hgb', name: 'Hemoglobin', unit: 'g/dL', normalLow: 12.0, normalHigh: 17.0, critLow: 7.0, critHigh: 20.0 },
    { code: 'Hct', name: 'Hematocrit', unit: '%', normalLow: 36, normalHigh: 50, critLow: 21, critHigh: 60 },
    { code: 'Plt', name: 'Platelets', unit: '×10³/µL', normalLow: 150, normalHigh: 400, critLow: 50, critHigh: 1000 },
    { code: 'MCV', name: 'MCV', unit: 'fL', normalLow: 80, normalHigh: 100 },
    { code: 'MCH', name: 'MCH', unit: 'pg', normalLow: 27, normalHigh: 33 },
    { code: 'RDW', name: 'RDW', unit: '%', normalLow: 11.5, normalHigh: 14.5 }
  ],
  'BMP': [
    { code: 'Na', name: 'Sodium', unit: 'mEq/L', normalLow: 135, normalHigh: 145, critLow: 120, critHigh: 160 },
    { code: 'K', name: 'Potassium', unit: 'mEq/L', normalLow: 3.5, normalHigh: 5.0, critLow: 2.5, critHigh: 6.5 },
    { code: 'Cl', name: 'Chloride', unit: 'mEq/L', normalLow: 96, normalHigh: 106 },
    { code: 'CO2', name: 'Bicarbonate', unit: 'mEq/L', normalLow: 22, normalHigh: 29, critLow: 10, critHigh: 40 },
    { code: 'BUN', name: 'BUN', unit: 'mg/dL', normalLow: 7, normalHigh: 20, critHigh: 100 },
    { code: 'Cr', name: 'Creatinine', unit: 'mg/dL', normalLow: 0.6, normalHigh: 1.2, critLow: 0.3, critHigh: 4.0 },
    { code: 'Glu', name: 'Glucose', unit: 'mg/dL', normalLow: 70, normalHigh: 100, critLow: 40, critHigh: 500 },
    { code: 'Ca', name: 'Calcium', unit: 'mg/dL', normalLow: 8.5, normalHigh: 10.5, critLow: 6.0, critHigh: 13.0 }
  ],
  'CMP': [
    { code: 'ALT', name: 'ALT', unit: 'U/L', normalLow: 7, normalHigh: 56, critHigh: 1000 },
    { code: 'AST', name: 'AST', unit: 'U/L', normalLow: 10, normalHigh: 40, critHigh: 1000 },
    { code: 'ALP', name: 'ALP', unit: 'U/L', normalLow: 44, normalHigh: 147 },
    { code: 'T.Bili', name: 'Total Bilirubin', unit: 'mg/dL', normalLow: 0.3, normalHigh: 1.2, critHigh: 20 },
    { code: 'Alb', name: 'Albumin', unit: 'g/dL', normalLow: 3.5, normalHigh: 5.0, critLow: 2.0 },
    { code: 'TP', name: 'Total Protein', unit: 'g/dL', normalLow: 6.0, normalHigh: 8.3 }
  ],
  'Coagulation': [
    { code: 'PT', name: 'PT', unit: 'sec', normalLow: 11, normalHigh: 13.5, critHigh: 30 },
    { code: 'INR', name: 'INR', unit: '', normalLow: 0.8, normalHigh: 1.2, critHigh: 5.0 },
    { code: 'aPTT', name: 'aPTT', unit: 'sec', normalLow: 25, normalHigh: 35, critHigh: 100 },
    { code: 'Fibrinogen', name: 'Fibrinogen', unit: 'mg/dL', normalLow: 200, normalHigh: 400, critLow: 100 }
  ],
  'Cardiac': [
    { code: 'Trop-I', name: 'Troponin I', unit: 'ng/mL', normalLow: 0, normalHigh: 0.04, critHigh: 0.5 },
    { code: 'CK-MB', name: 'CK-MB', unit: 'ng/mL', normalLow: 0, normalHigh: 5, critHigh: 25 },
    { code: 'BNP', name: 'BNP', unit: 'pg/mL', normalLow: 0, normalHigh: 100, critHigh: 900 },
    { code: 'CK', name: 'Creatine Kinase', unit: 'U/L', normalLow: 30, normalHigh: 200, critHigh: 5000 }
  ],
  'ABG': [
    { code: 'pH', name: 'pH', unit: '', normalLow: 7.35, normalHigh: 7.45, critLow: 7.20, critHigh: 7.60 },
    { code: 'pCO2', name: 'pCO2', unit: 'mmHg', normalLow: 35, normalHigh: 45, critLow: 20, critHigh: 70 },
    { code: 'pO2', name: 'pO2', unit: 'mmHg', normalLow: 80, normalHigh: 100, critLow: 50 },
    { code: 'HCO3', name: 'HCO3', unit: 'mEq/L', normalLow: 22, normalHigh: 26, critLow: 10, critHigh: 40 },
    { code: 'Lactate', name: 'Lactate', unit: 'mmol/L', normalLow: 0.5, normalHigh: 2.0, critHigh: 4.0 }
  ],
  'Lipid': [
    { code: 'TC', name: 'Total Cholesterol', unit: 'mg/dL', normalLow: 0, normalHigh: 200 },
    { code: 'LDL', name: 'LDL', unit: 'mg/dL', normalLow: 0, normalHigh: 100 },
    { code: 'HDL', name: 'HDL', unit: 'mg/dL', normalLow: 40, normalHigh: 60 },
    { code: 'TG', name: 'Triglycerides', unit: 'mg/dL', normalLow: 0, normalHigh: 150, critHigh: 1000 }
  ],
  'Thyroid': [
    { code: 'TSH', name: 'TSH', unit: 'mIU/L', normalLow: 0.4, normalHigh: 4.0, critLow: 0.01, critHigh: 50 },
    { code: 'FT4', name: 'Free T4', unit: 'ng/dL', normalLow: 0.8, normalHigh: 1.8 },
    { code: 'FT3', name: 'Free T3', unit: 'pg/mL', normalLow: 2.3, normalHigh: 4.2 }
  ],
  'Urinalysis': [
    { code: 'UA-pH', name: 'Urine pH', unit: '', normalLow: 4.5, normalHigh: 8.0 },
    { code: 'UA-SG', name: 'Specific Gravity', unit: '', normalLow: 1.005, normalHigh: 1.030 },
    { code: 'UA-Protein', name: 'Protein', unit: '', normalLow: 0, normalHigh: 0 },
    { code: 'UA-Glucose', name: 'Glucose', unit: '', normalLow: 0, normalHigh: 0 },
    { code: 'UA-Ketones', name: 'Ketones', unit: '', normalLow: 0, normalHigh: 0 },
    { code: 'UA-WBC', name: 'WBC', unit: '/hpf', normalLow: 0, normalHigh: 5 },
    { code: 'UA-RBC', name: 'RBC', unit: '/hpf', normalLow: 0, normalHigh: 2 }
  ],
  'HbA1c': [
    { code: 'HbA1c', name: 'HbA1c', unit: '%', normalLow: 4.0, normalHigh: 5.7, critHigh: 10 }
  ],
  'Electrolytes': [
    { code: 'Mg', name: 'Magnesium', unit: 'mg/dL', normalLow: 1.7, normalHigh: 2.2, critLow: 1.0, critHigh: 4.0 },
    { code: 'Phos', name: 'Phosphate', unit: 'mg/dL', normalLow: 2.5, normalHigh: 4.5, critLow: 1.0, critHigh: 8.0 }
  ]
};

// ═══ Auto-attach tests to labs on order ═══
bus.on('lab.ordered', function(payload) {
  try {
    const lab = payload.record;
    if (!lab) return;
    if (lab.tests && lab.tests.length) return; // already has tests
    const panel = LAB_TESTS[lab.panelCode];
    if (!panel) return;
    lab.tests = panel.map(t => Object.assign({}, t));
    store.put('labs', lab);
    console.log('[extras] auto-attached ' + panel.length + ' tests to lab ' + lab.id + ' (' + lab.panelCode + ')');
  } catch (e) {
    console.warn('[extras] auto-attach failed:', e.message);
  }
});

// ═══ Handlers ═══
function listLabTests(ctx) {
  const panels = Object.keys(LAB_TESTS).map(code => ({
    code,
    testCount: LAB_TESTS[code].length,
    tests: LAB_TESTS[code]
  }));
  return { panels, total: panels.length, totalTests: panels.reduce((s, p) => s + p.testCount, 0) };
}

function getLabPanel(ctx) {
  const code = ctx.params.code;
  const panel = LAB_TESTS[code];
  if (!panel) throw ctx.E.notFound('panel_not_found');
  return { code, tests: panel };
}

// ═══ Route to trigger auto-attach on existing labs ═══
function backfillLabs(ctx) {
  let count = 0;
  const labs = store.readAll('labs');
  for (const lab of labs) {
    if (lab.tests && lab.tests.length) continue;
    const panel = LAB_TESTS[lab.panelCode];
    if (!panel) continue;
    lab.tests = panel.map(t => Object.assign({}, t));
    store.put('labs', lab);
    count++;
  }
  return { backfilled: count };
}

module.exports = {
  handlers: { listLabTests, getLabPanel, backfillLabs },
  routes: [

    { method:'GET', path:'/api/extras/lab-tests', handler:'listLabTests', perm:'lab.view' },
    { method:'POST', path:'/api/extras/lab-tests/backfill', handler:'backfillLabs', perm:'admin.users.manage' },
    { method:'GET', path:'/api/extras/lab-tests/:code', handler:'getLabPanel', perm:'lab.view' },
  
  ],
  panels: []
};
