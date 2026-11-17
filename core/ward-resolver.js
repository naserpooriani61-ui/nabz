
'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Ward & Service Resolver
//  حل مشکل ۳ سیستم ward مختلف:
//    sa_staff.wardId (numeric) ↔ sa_wards.code (string) ↔ patient.wardCode (string)
//    wf_staff.ward (string, ممکن است legacy 'ICU' باشد)
//    users.ward (اغلب null)
// ═══════════════════════════════════════════════════════════
const store = require('./store');

// ═══ Ward → Service mapping (Persian hospital reality) ═══
const WARD_TO_SERVICE = {
  'ICU_RESP': 'pulmo',
  'ICU_NEURO': 'neuro',
  'ICU_ER': 'emergency',
  'ICU_GEN1': 'internal',
  'ICU_GEN2': 'internal',
  'CCU': 'cardio',
  'ER': 'emergency',
  'GEN_SURG14': 'surgery',
  'GEN_SURG2': 'surgery',
  'VASC1': 'vascular',
  'VASC2': 'vascular',
  'MAXFAX': 'maxillofacial',
  'NSURG_M': 'neurosurgery',
  'NSURG_F': 'neurosurgery',
  'ORTHO_M': 'ortho',
  'ORTHO_F': 'ortho',
  'URO1': 'urology',
  'URO2': 'urology',
  'KIDNEY_TX': 'transplant',
  'INT_M': 'internal',
  'INT_F': 'internal',
  'NEURO_M': 'neuro',
  'NEURO_F': 'neuro',
  'MS1': 'neuro',
  'MS2': 'neuro',
  'MS3': 'neuro',
  'ONCO': 'oncology',
  'DIALYSIS': 'nephrology',
  'CATHLAB': 'cardio',
  'VIP': 'vip',
  'OR_GEN': 'surgery',
  'OR_ER': 'surgery',
  'CSR': 'recovery',
  'CLINIC': 'outpatient',
  'ENDOSCOPY': 'gastro',
  'NURSING_OFFICE': 'admin'
};

// ═══ Legacy ward names (از seed.js قدیمی) ═══
const LEGACY_MAP = {
  'ICU': 'ICU_GEN1',
  'ER': 'ER',
  'GEN': 'INT_M'
};

// ═══ Caches (Invalidate on demand) ═══
let _cache = { wards: null, ts: 0 };
const CACHE_TTL = 60000; // 60s

function loadWards() {
  const now = Date.now();
  if (_cache.wards && (now - _cache.ts) < CACHE_TTL) return _cache.wards;
  const saWards = store.readAll('sa_wards');
  const byId = {};
  const byCode = {};
  for (const w of saWards) {
    if (w.id != null) byId[String(w.id)] = w;
    if (w.code) byCode[w.code] = w;
  }
  _cache.wards = { byId, byCode, list: saWards };
  _cache.ts = now;
  return _cache.wards;
}

function invalidateCache() { _cache.ts = 0; }

// ═══ Core resolution functions ═══

// Is this a real ward code (exists in sa_wards or legacy map)?
function isRealWardCode(code) {
  if (!code) return false;
  if (LEGACY_MAP[code]) return true;
  const { byCode } = loadWards();
  return !!byCode[code];
}

// Map legacy 'ICU' → 'ICU_GEN1'
function normalizeWardCode(code) {
  if (!code) return null;
  if (LEGACY_MAP[code]) return LEGACY_MAP[code];
  return code;
}

// Resolve a user to their ward code
// Priority: user.ward → staffId in sa_staff → staffId in wf_staff
function resolveUserWard(user) {
  if (!user) return null;

  // 1) Direct ward on user
  if (user.ward && isRealWardCode(user.ward)) {
    return normalizeWardCode(user.ward);
  }

  // 2) Via sa_staff (wardId numeric → sa_wards.code)
  if (user.staffId) {
    const saStaff = store.readAll('sa_staff');
    const wfStaff = store.readAll('wf_staff');
    const { byId } = loadWards();

    // 2a) sa_staff lookup
    const sa = saStaff.find(s =>
      String(s.id) === String(user.staffId) ||
      s.code === user.username
    );
    if (sa && sa.wardId != null) {
      const ward = byId[String(sa.wardId)];
      if (ward && ward.code) return ward.code;
    }

    // 2b) wf_staff lookup
    const wf = wfStaff.find(s =>
      String(s.id) === String(user.staffId) ||
      s.personnelCode === user.username ||
      (s.fullName && user.fullName && s.fullName === user.fullName)
    );
    if (wf && wf.ward) return normalizeWardCode(wf.ward);
  }

  // 3) Via username match on personnelCode
  if (user.username) {
    const wfByCode = store.readAll('wf_staff').find(s => s.personnelCode === user.username);
    if (wfByCode && wfByCode.ward) return normalizeWardCode(wfByCode.ward);
    const saByCode = store.readAll('sa_staff').find(s => s.code === user.username);
    if (saByCode && saByCode.wardId != null) {
      const { byId } = loadWards();
      const ward = byId[String(saByCode.wardId)];
      if (ward && ward.code) return ward.code;
    }
  }

  return null;
}

// Resolve a user to their services (array)
// Priority: user.services[] → infer from ward → null
function resolveUserServices(user, resolvedWard) {
  if (!user) return [];
  if (Array.isArray(user.services) && user.services.length > 0) return user.services;
  const ward = resolvedWard || resolveUserWard(user);
  if (ward && WARD_TO_SERVICE[ward]) return [WARD_TO_SERVICE[ward]];
  return [];
}

// Ward → Service
function serviceForWard(wardCode) {
  if (!wardCode) return null;
  return WARD_TO_SERVICE[wardCode] || null;
}

// Patient → Service (from wardCode if patient has no explicit serviceCode)
function serviceForPatient(patient) {
  if (!patient) return null;
  if (patient.serviceCode) return patient.serviceCode;
  return WARD_TO_SERVICE[patient.wardCode] || null;
}

// ═══ Scope verification ═══
// Returns:
//   { kind: 'all' }         — cross-ward user, sees all
//   { kind: 'wards', codes } — sees specific wards
//   { kind: 'services', codes } — sees specific services
//   { kind: 'none', reason } — cannot resolve, should ERROR
function resolveUserScope(user, isCrossWard) {
  if (!user) return { kind: 'none', reason: 'no_user' };
  if (isCrossWard) return { kind: 'all' };

  // Services take priority for multi-ward specialties
  const services = resolveUserServices(user);
  if (services.length > 0 && ['attending', 'specialist', 'surgeon', 'physician'].includes(user.role)) {
    return { kind: 'services', codes: services };
  }

  // Ward-based
  const ward = resolveUserWard(user);
  if (ward) return { kind: 'wards', codes: [ward] };

  // Cannot resolve — this is the CRITICAL bug we're fixing
  return { kind: 'none', reason: 'ward_not_configured', userId: user.id, username: user.username };
}

// ═══ Filter items by scope ═══
function filterByScope(scope, items, wardField, serviceField) {
  if (!Array.isArray(items)) return [];
  wardField = wardField || 'wardCode';
  serviceField = serviceField || 'serviceCode';

  if (scope.kind === 'all') return items;

  if (scope.kind === 'wards') {
    const set = new Set(scope.codes);
    return items.filter(x => set.has(normalizeWardCode(x[wardField] || x.ward)));
  }

  if (scope.kind === 'services') {
    const set = new Set(scope.codes);
    return items.filter(x => {
      const svc = x[serviceField] || serviceForWard(normalizeWardCode(x[wardField] || x.ward));
      return svc && set.has(svc);
    });
  }

  // scope.kind === 'none' → return empty BUT caller should have thrown
  return [];
}

module.exports = {
  // Constants
  WARD_TO_SERVICE, LEGACY_MAP,
  // Ward resolution
  isRealWardCode, normalizeWardCode,
  resolveUserWard, resolveUserServices, resolveUserScope,
  // Service helpers
  serviceForWard, serviceForPatient,
  // Filtering
  filterByScope,
  // Cache
  invalidateCache,
  // List
  listAllWards() { return loadWards().list; }
};

console.log('[ward-resolver] loaded — mapping ' + Object.keys(WARD_TO_SERVICE).length + ' wards');
