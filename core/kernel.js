'use strict';
const ESC = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function compile(pattern) {
  const keys = [];
  const src = pattern.split('/').map(seg => {
    if (seg.startsWith(':')) { keys.push(seg.slice(1)); return '([^/]+)'; }
    return ESC(seg);
  }).join('/');
  return { re: new RegExp('^' + src + '$'), keys };
}
const PERM_OVERRIDES = {
  'GET /api/analytics/patient/:patientId': 'patients.view',
  'GET /api/hops/acuity/:patientId': 'patients.view',
  'GET /api/docs/:type/:patientId': 'patients.view',
  'POST /api/hops/acuity': 'patients.view'
};
const RD_MAP = {
  nurse: 'nurse', nurse_aide: 'nurse', assistant_nurse: 'nurse', head_nurse: 'head_nurse',
  resident: 'resident', intern: 'resident',
  attending: 'attending', specialist: 'attending', surgeon: 'attending', anesthesiologist: 'attending', physician: 'attending',
  matron: 'matron', nursing_director: 'matron', medical_director: 'matron', hospital_director: 'matron',
  supervisor: 'supervisor', clinical_supervisor: 'supervisor', supervisor_senior: 'supervisor', supervisor_er: 'supervisor',
  supervisor_infection: 'supervisor', supervisor_accreditation: 'supervisor', supervisor_education: 'supervisor', supervisor_clinical: 'supervisor',
  pharmacist: 'pharmacist', lab_tech: 'lab_tech', radiology_tech: 'radiology_tech', receptionist: 'receptionist', admin: 'admin', it_staff: 'admin'
};
function roleDashboardAllowed(role, pathname) {
  const m = /^\/api\/rde?\/([^/]+)$/.exec(pathname);
  if (!m) return true;
  const x = m[1];
  if (x === 'router') return true;
  if (role === 'admin') return true;
  return x === role || x === RD_MAP[role] || (x === 'director' && /director$/.test(role));
}
function build(raw, perms, MODS) {
  const warnings = [], seen = new Set(), routes = [];
  for (const r of raw) {
    const fn = typeof r.handler === 'function' ? r.handler : (r.handler && typeof r.handler.handler === 'function' ? r.handler.handler : null);
    const key = r.method + ' ' + r.path;
    if (!fn) { warnings.push({ level: 'error', type: 'missing_handler', route: key, module: r.modName }); continue; }
    if (seen.has(key)) { warnings.push({ level: 'warn', type: 'duplicate_route', route: key, module: r.modName }); continue; }
    seen.add(key);
    const c = compile(r.path);
    const perm = r.perm || PERM_OVERRIDES[key] || null;
    if (perm && !(perm in perms.P)) warnings.push({ level: 'warn', type: 'undefined_permission', route: key, perm, module: r.modName });
    routes.push({ method: r.method, path: r.path, key, perm, declaredPerm: r.perm || null, fn, modName: r.modName,
      re: c.re, keys: c.keys, nParams: c.keys.length, public: !!r.public, noGuard: !!r.noGuard });
  }
  routes.sort((a, b) => a.nParams - b.nParams);
  const byMethod = new Map();
  for (const r of routes) { if (!byMethod.has(r.method)) byMethod.set(r.method, []); byMethod.get(r.method).push(r); }
  for (const list of byMethod.values()) {
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      if (a.nParams === 0 || a.path === b.path) continue;
      const rep = b.path.replace(/:\w+/g, 'x');
      if (a.re.test(rep) && !b.re.test(a.path.replace(/:\w+/g, 'x'))) warnings.push({ level: 'warn', type: 'route_shadowed', route: b.key, by: a.key });
    }
  }
  const noPerm = routes.filter(r => !r.perm && !r.public).map(r => r.key);
  const ids = {};
  for (const [name, mod] of Object.entries(MODS)) for (const p of (mod.panels || [])) {
    const id = name + '.' + p.id; ids[id] = (ids[id] || 0) + 1;
    if (p.perm && !(p.perm in perms.P)) warnings.push({ level: 'warn', type: 'panel_undefined_permission', panel: id, perm: p.perm });
  }
  for (const id in ids) if (ids[id] > 1) warnings.push({ level: 'error', type: 'duplicate_panel_id', panel: id });
  return {
    routes, byMethod, warnings, noPerm,
    match(method, pn) {
      const list = byMethod.get(method); if (!list) return null;
      for (const r of list) { const m = r.re.exec(pn); if (m) { const params = {}; r.keys.forEach((k, i) => params[k] = m[i + 1]); return { route: r, params }; } }
      return null;
    }
  };
}
module.exports = { build, compile, PERM_OVERRIDES, roleDashboardAllowed };
