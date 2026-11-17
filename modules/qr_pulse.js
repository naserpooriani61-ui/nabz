const { h, sd } = require('../core/mod-helpers');
const crypto = require('crypto');
const fs = require('fs'), path = require('path');
const DATA = process.env.DATA_DIR || path.join(__dirname, '..', 'data');

function getSecret() {
  const f = path.join(DATA, '_qr_secret');
  try { if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8'); } catch (_) {}
  const s = crypto.randomBytes(32).toString('hex');
  try { if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true }); fs.writeFileSync(f, s); } catch (_) {}
  return s;
}
const SECRET = getSecret();
const BUCKET_SEC = 30;
const VALID_BUCKETS = 3;

function bucket() { return Math.floor(Date.now() / 1000 / BUCKET_SEC); }
function sign(ward, b) { return crypto.createHmac('sha256', SECRET).update(ward + '|' + b).digest('hex').slice(0, 12); }
function generateQR(ward) {
  const b = bucket();
  return 'QR1|' + ward + '|' + b + '|' + sign(ward, b);
}
function verifyQR(code) {
  const parts = (code || '').trim().split('|');
  if (parts.length !== 4 || parts[0] !== 'QR1') return { ok: false, reason: 'format' };
  const [_, ward, bStr, sig] = parts;
  const b = Number(bStr);
  if (isNaN(b)) return { ok: false, reason: 'bad_bucket' };
  if (sig !== sign(ward, b)) return { ok: false, reason: 'invalid_signature' };
  const now = bucket();
  if (now - b > VALID_BUCKETS) return { ok: false, reason: 'expired' };
  if (now - b < -1) return { ok: false, reason: 'future' };
  return { ok: true, ward, bucket: b };
}

const current = (ctx) => {
  const ward = ctx.actor.ward || ctx.query.ward || (ctx.actor.role === 'admin' ? 'ICU' : null);
  if (!ward) throw ctx.E.badRequest('ward_required');
  const b = bucket();
  return {
    ward, code: generateQR(ward),
    bucket: b, expiresAt: new Date((b + VALID_BUCKETS) * BUCKET_SEC * 1000).toISOString(),
    rotateEverySec: BUCKET_SEC, validForSec: BUCKET_SEC * VALID_BUCKETS
  };
};

const scan = (ctx) => {
  const b = ctx.body;
  if (!b.code) throw ctx.E.badRequest('code_required');
  const v = verifyQR(b.code);
  if (!v.ok) throw ctx.E.badRequest('invalid_qr: ' + v.reason);
  const today = new Date().toISOString().slice(0, 10);
  const existing = h(ctx, 'attendance').find(a => a.userId === ctx.actor.id && a.date === today);
  if (existing && existing.checkIn && !existing.checkOut) {
    existing.checkOut = ctx.now();
    existing.workedHours = Math.round((sd(existing.checkOut) - sd(existing.checkIn)) / 360000) / 10;
    existing.checkOutMethod = 'qr_pulse';
    ctx.store.put('attendance', existing);
    return { action: 'checkout', attendance: existing, ward: v.ward };
  }
  if (existing && existing.checkIn && existing.checkOut)
    throw ctx.E.conflict('already_checked_in_and_out');
  const rec = { id: ctx.uid('att'), userId: ctx.actor.id,
    userName: ctx.actor.username, wardCode: v.ward, date: today,
    checkIn: ctx.now(), checkOut: null, method: 'qr_pulse' };
  ctx.store.put('attendance', rec);
  ctx.bus.emit('qr.checkin', { record: rec, actor: ctx.actor });
  return { action: 'checkin', attendance: rec, ward: v.ward };
};

const history = (ctx) => {
  const today = new Date().toISOString().slice(0, 10);
  let items = h(ctx, 'attendance').filter(a => a.date === today);
  if (ctx.actor.role !== 'admin') {
    items = items.filter(a => a.wardCode === ctx.actor.ward || a.userId === ctx.actor.id);
  }
  items.sort((a, b) => sd(b.checkIn) - sd(a.checkIn));
  return { items, total: items.length };
};

const verify = (ctx) => {
  const code = ctx.query.code;
  if (!code) throw ctx.E.badRequest('code_required');
  return verifyQR(code);
};

module.exports = {
  handlers: { current, scan, history, verify },
  routes: [
    {method:'GET', path:'/api/qr/current', handler:'current', perm:'qr.view'},
    {method:'POST', path:'/api/qr/scan', handler:'scan', perm:'qr.scan'},
    {method:'GET', path:'/api/qr/today', handler:'history', perm:'qr.view'},
    {method:'GET', path:'/api/qr/verify', handler:'verify', perm:'qr.view'}
  ],
  panels: [
    {id:'qr_show', title:'QR بخش من', icon:'📱', perm:'qr.view', kind:'action', api:'/api/qr/current'},
    {id:'qr_scan', title:'ثبت با QR', icon:'📷', perm:'qr.scan', kind:'list',
      api:'/api/qr/today', fields:['userName','wardCode','checkIn','checkOut','method'],
      form:{api:'/api/qr/scan', method:'POST', fields:[
        {name:'code', label:'کد QR را وارد کنید', required:true}
      ]}}
  ]
};
