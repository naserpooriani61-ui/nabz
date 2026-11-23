'use strict';
// core/config/form-schemas.js — UDES form definitions (data-only)
// Add new schema → form appears automatically. Zero code changes.

const SCHEMAS = {

  vitals: {
    title: 'ثبت علائم حیاتی', icon: '💉',
    endpoint: '/api/clinical/vitals', method: 'POST',
    helpText: 'NEWS2 به‌طور خودکار محاسبه می‌شود',
    groups: [
      { id: 'main', label: 'اصلی', icon: '📊' },
      { id: 'neuro', label: 'اعصاب', icon: '🧠' }
    ],
    fields: [
      { key: 'hr', label: 'ضربان قلب', type: 'number', min: 0, max: 300, unit: 'bpm', group: 'main', required: true },
      { key: 'rr', label: 'تعداد تنفس', type: 'number', min: 0, max: 80, unit: '/min', group: 'main' },
      { key: 'spo2', label: 'اشباع اکسیژن', type: 'number', min: 0, max: 100, unit: '%', group: 'main' },
      { key: 'temp', label: 'دمای بدن', type: 'number', min: 30, max: 45, step: 0.1, unit: '°C', group: 'main' },
      { key: 'bp_sys', label: 'فشار سیستولیک', type: 'number', min: 0, max: 300, unit: 'mmHg', group: 'main' },
      { key: 'bp_dia', label: 'فشار دیاستولیک', type: 'number', min: 0, max: 200, unit: 'mmHg', group: 'main' },
      { key: 'onOxygen', label: 'اکسیژن مکمل', type: 'checkbox', group: 'main' },
      { key: 'gcs', label: 'سطح هوشیاری', type: 'select', options: ['15','14','13','12','11','10','9','8','7','6','5','4','3'], group: 'neuro' },
      { key: 'consciousness', label: 'وضعیت', type: 'select', options: ['alert','voice','pain','unresponsive'], group: 'neuro' },
      { key: 'pain', label: 'شدت درد', type: 'range', min: 0, max: 10, unit: '/10', group: 'neuro' },
      { key: 'notes', label: 'یادداشت', type: 'textarea', rows: 2, group: 'neuro' }
    ]
  },

  order: {
    title: 'ثبت سفارش', icon: '📋',
    endpoint: '/api/clinical/orders', method: 'POST',
    helpText: 'فیلدهای جزئیات بر اساس نوع سفارش تغییر می‌کنند',
    groups: [
      { id: 'main', label: 'نوع', icon: '📋' },
      { id: 'details', label: 'جزئیات', icon: '🔍' }
    ],
    fields: [
      { key: 'type', label: 'نوع سفارش', type: 'select', options: ['medication','lab','paraclinical','imaging','nursing','consult','diet','activity'], group: 'main', required: true },
      { key: 'priority', label: 'اولویت', type: 'select', options: ['routine','urgent','stat'], group: 'main' },
      { key: 'details.drug', label: 'نام دارو', type: 'text', group: 'details', visibleIf: { field: 'type', equals: 'medication' } },
      { key: 'details.dose', label: 'دوز', type: 'text', group: 'details', visibleIf: { field: 'type', equals: 'medication' } },
      { key: 'details.route', label: 'راه مصرف', type: 'select', options: ['PO','IV','IM','SC','SL','PR','INH','TOP'], group: 'details', visibleIf: { field: 'type', equals: 'medication' } },
      { key: 'details.frequency', label: 'تکرار', type: 'select', options: ['OD','BID','TDS','QID','Q4H','Q6H','Q8H','Q12H','Q24H','PRN','CONT'], group: 'details', visibleIf: { field: 'type', equals: 'medication' } },
      { key: 'details.duration', label: 'مدت (روز)', type: 'number', min: 0, max: 365, group: 'details', visibleIf: { field: 'type', equals: 'medication' } },
      { key: 'details.panel', label: 'نام آزمایش', type: 'text', group: 'details', visibleIf: { field: 'type', equals: 'lab' } },
      { key: 'details.modality', label: 'تصویربرداری', type: 'text', group: 'details', visibleIf: { field: 'type', equals: 'imaging' } },
      { key: 'details.note', label: 'یادداشت', type: 'textarea', rows: 2, group: 'details' }
    ]
  },

  io: {
    title: 'ثبت I&O', icon: '💧',
    endpoint: '/api/clinical/io', method: 'POST',
    groups: [{ id: 'main', label: 'ورودی/خروجی', icon: '💧' }],
    fields: [
      { key: 'type', label: 'نوع', type: 'select', options: ['intake','output'], group: 'main', required: true },
      { key: 'kind', label: 'منبع', type: 'select', options: ['oral','iv','urine','vomit','stool','drain','blood','other'], group: 'main' },
      { key: 'amount', label: 'مقدار', type: 'number', min: 0, max: 10000, unit: 'cc', group: 'main', required: true },
      { key: 'notes', label: 'یادداشت', type: 'text', group: 'main' }
    ]
  },

  'nursing-note': {
    title: 'یادداشت پرستاری', icon: '📝',
    endpoint: '/api/nurse/quick/note', method: 'POST',
    groups: [{ id: 'main', label: 'یادداشت', icon: '📝' }],
    fields: [
      { key: 'category', label: 'دسته', type: 'select', options: ['observation','intervention','assessment','communication','other'], group: 'main' },
      { key: 'text', label: 'متن یادداشت', type: 'textarea', rows: 6, group: 'main', required: true }
    ]
  },

  consult: {
    title: 'درخواست مشاوره', icon: '🩺',
    endpoint: '/api/wf/consults', method: 'POST',
    helpText: 'فرمت SBAR استاندارد',
    groups: [
      { id: 'main', label: 'درخواست', icon: '🩺' },
      { id: 'isbar', label: 'SBAR', icon: '📋' }
    ],
    fields: [
      { key: 'targetService', label: 'سرویس هدف', type: 'select', options: ['cardio','neuro','surgery','internal','ortho','urology','obgyn','psych','icu','er','oncology','nephro'], group: 'main', required: true },
      { key: 'consultType', label: 'نوع', type: 'select', options: ['routine','urgent','emergency'], group: 'main' },
      { key: 'question', label: 'سوال بالینی', type: 'textarea', rows: 4, group: 'main', required: true },
      { key: 'isbar.situation', label: 'S — وضعیت', type: 'text', group: 'isbar' },
      { key: 'isbar.background', label: 'B — سابقه', type: 'textarea', rows: 2, group: 'isbar' },
      { key: 'isbar.assessment', label: 'A — ارزیابی', type: 'textarea', rows: 2, group: 'isbar' },
      { key: 'isbar.recommendation', label: 'R — توصیه', type: 'text', group: 'isbar' }
    ]
  },

  transfer: {
    title: 'درخواست انتقال', icon: '🔄',
    endpoint: '/api/wf/transfers', method: 'POST',
    groups: [{ id: 'main', label: 'اطلاعات', icon: '🔄' }],
    fields: [
      { key: 'toWard', label: 'بخش مقصد', type: 'text', group: 'main', required: true },
      { key: 'urgency', label: 'فوریت', type: 'select', options: ['routine','urgent','emergent'], group: 'main' },
      { key: 'reason', label: 'علت انتقال', type: 'textarea', rows: 3, group: 'main', required: true }
    ]
  },

  discharge: {
    title: 'برنامه ترخیص', icon: '🚪',
    endpoint: '/api/wf/discharges', method: 'POST',
    groups: [
      { id: 'main', label: 'اطلاعات', icon: '🚪' },
      { id: 'summary', label: 'خلاصه', icon: '📄' }
    ],
    fields: [
      { key: 'dischargeType', label: 'نوع ترخیص', type: 'select', options: ['home','home_with_services','transfer','ama','expired'], group: 'main', required: true },
      { key: 'summary.finalDiagnosis', label: 'تشخیص نهایی', type: 'textarea', rows: 2, group: 'summary' },
      { key: 'summary.followupInstructions', label: 'دستورات پیگیری', type: 'textarea', rows: 3, group: 'summary' }
    ]
  },

  handover: {
    title: 'تحویل شیفت', icon: '📝',
    endpoint: '/api/wf/handovers', method: 'POST',
    groups: [{ id: 'main', label: 'اطلاعات', icon: '📝' }],
    fields: [
      { key: 'wardCode', label: 'کد بخش', type: 'text', group: 'main', required: true },
      { key: 'shiftType', label: 'شیفت', type: 'select', options: ['morning','evening','night'], group: 'main', required: true },
      { key: 'summary', label: 'خلاصه تحویل', type: 'textarea', rows: 5, group: 'main' }
    ]
  },

  'ed-visit': {
    title: 'ویزیت اورژانس', icon: '🚨',
    endpoint: '/api/emergency/visits', method: 'POST',
    helpText: 'ثبت بیمار جدید در اورژانس',
    groups: [
      { id: 'main', label: 'اطلاعات بیمار', icon: '🚨' },
      { id: 'vitals', label: 'علائم اولیه', icon: '📊' }
    ],
    fields: [
      { key: 'patientName', label: 'نام بیمار', type: 'text', group: 'main', required: true },
      { key: 'age', label: 'سن', type: 'number', min: 0, max: 130, group: 'main' },
      { key: 'sex', label: 'جنسیت', type: 'select', options: ['male','female'], group: 'main' },
      { key: 'chiefComplaint', label: 'شکایت اصلی', type: 'textarea', rows: 2, group: 'main', required: true },
      { key: 'arrivalMode', label: 'نحوه ورود', type: 'select', options: ['walk_in','ambulance','transfer','police','other'], group: 'main' },
      { key: 'vitals.hr', label: 'HR', type: 'number', min: 0, max: 300, group: 'vitals' },
      { key: 'vitals.rr', label: 'RR', type: 'number', min: 0, max: 80, group: 'vitals' },
      { key: 'vitals.spo2', label: 'SpO₂', type: 'number', min: 0, max: 100, group: 'vitals' },
      { key: 'vitals.bp_sys', label: 'SBP', type: 'number', min: 0, max: 300, group: 'vitals' },
      { key: 'vitals.bp_dia', label: 'DBP', type: 'number', min: 0, max: 200, group: 'vitals' },
      { key: 'vitals.temp', label: 'T°', type: 'number', min: 30, max: 45, step: 0.1, group: 'vitals' },
      { key: 'vitals.onOxygen', label: 'اکسیژن', type: 'checkbox', group: 'vitals' }
    ]
  },

  incident: {
    title: 'ثبت حادثه', icon: '⚠️',
    endpoint: '/api/safety/incidents', method: 'POST',
    groups: [{ id: 'main', label: 'حادثه', icon: '⚠️' }],
    fields: [
      { key: 'category', label: 'دسته', type: 'select', options: ['fall','medication_error','procedure','equipment','infection','transfusion','behavior','other'], group: 'main', required: true },
      { key: 'severity', label: 'شدت', type: 'select', options: ['minor','moderate','major','critical','sentinel'], group: 'main', required: true },
      { key: 'description', label: 'شرح حادثه', type: 'textarea', rows: 5, group: 'main', required: true },
      { key: 'patientName', label: 'بیمار (اگر مرتبط)', type: 'text', group: 'main' },
      { key: 'wardCode', label: 'بخش', type: 'text', group: 'main' }
    ]
  },

  code: {
    title: 'فعال‌سازی کد', icon: '🚨',
    endpoint: '/api/emergency/codes', method: 'POST',
    helpText: 'کد را انتخاب کنید و نام بیمار را وارد کنید',
    groups: [{ id: 'main', label: 'اطلاعات', icon: '🚨' }],
    fields: [
      { key: 'code', label: 'نوع کد', type: 'select', options: [
        { value: '247', label: '۲۴۷ — STEMI (سکته قلبی)' },
        { value: '724', label: '۷۲۴ — Stroke (سکته مغزی)' },
        { value: '99', label: '۹۹ — CPR (ایست قلبی)' }
      ], group: 'main', required: true },
      { key: 'patientName', label: 'نام بیمار / شماره تخت', type: 'text', group: 'main', required: true },
      { key: 'note', label: 'یادداشت', type: 'text', group: 'main' }
    ]
  },

  'blood-request': {
    title: 'درخواست خون', icon: '🩸',
    endpoint: '/api/para/blood', method: 'POST',
    groups: [{ id: 'main', label: 'درخواست', icon: '🩸' }],
    fields: [
      { key: 'productType', label: 'فرآورده', type: 'select', options: ['PRBC','FFP','Platelet','Cryo','Whole Blood'], group: 'main', required: true },
      { key: 'units', label: 'تعداد واحد', type: 'number', min: 1, max: 20, group: 'main', required: true },
      { key: 'urgency', label: 'فوریت', type: 'select', options: ['routine','urgent','emergency'], group: 'main' },
      { key: 'reason', label: 'اندیکاسیون', type: 'textarea', rows: 3, group: 'main' },
      { key: 'hgb', label: 'Hb (g/dL)', type: 'number', min: 0, max: 25, step: 0.1, group: 'main' }
    ]
  }
};

function getSchema(id) {
  const s = SCHEMAS[id];
  return s ? Object.assign({ id: id }, s) : null;
}

function listSchemas() {
  return Object.keys(SCHEMAS).map(function(id) {
    return { id: id, title: SCHEMAS[id].title, icon: SCHEMAS[id].icon };
  });
}

module.exports = { SCHEMAS: SCHEMAS, getSchema: getSchema, listSchemas: listSchemas };
