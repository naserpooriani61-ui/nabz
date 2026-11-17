'use strict';
// NABZ Tehran time helpers. Timestamps stay UTC; day buckets use Tehran (UTC+3:30).
const TEHRAN_OFFSET_MS = 3.5 * 3600 * 1000;
let _fmt = null, _fmtParts = null;
try {
  const t1 = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
  if (/^\d{4}-\d{2}-\d{2}$/.test(t1.format(new Date()))) { _fmt = t1; _fmtParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false }); }
} catch (_) {}

function todayTehran(date) {
  const d = date || new Date();
  if (_fmt) return _fmt.format(d);
  return new Date(d.getTime() + TEHRAN_OFFSET_MS).toISOString().slice(0, 10);
}
function todayTehranComponents(date) {
  const d = date || new Date();
  if (_fmtParts) {
    const parts = _fmtParts.formatToParts(d);
    let y, m, dd;
    for (const p of parts) {
      if (p.type === 'year') y = parseInt(p.value, 10);
      if (p.type === 'month') m = parseInt(p.value, 10);
      if (p.type === 'day') dd = parseInt(p.value, 10);
    }
    return { y, m, d: dd };
  }
  const s = new Date(d.getTime() + TEHRAN_OFFSET_MS);
  return { y: s.getUTCFullYear(), m: s.getUTCMonth() + 1, d: s.getUTCDate() };
}
function dateKeyTehran(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return todayTehran(d);
}
function hourTehran(date) {
  const d = date || new Date();
  if (_fmtParts) {
    const parts = _fmtParts.formatToParts(d);
    for (const p of parts) if (p.type === 'hour') return parseInt(p.value, 10) % 24;
  }
  return new Date(d.getTime() + TEHRAN_OFFSET_MS).getUTCHours();
}
function startOfDayTehran(date) {
  const c = todayTehranComponents(date);
  return new Date(Date.UTC(c.y, c.m - 1, c.d, 0, 0, 0) - TEHRAN_OFFSET_MS).toISOString();
}
function endOfDayTehran(date) {
  return new Date(new Date(startOfDayTehran(date)).getTime() + 86400000).toISOString();
}
function shiftOfDayTehran(date) {
  const h = hourTehran(date);
  if (h >= 7 && h < 14) return 'morning';
  if (h >= 14 && h < 19) return 'evening';
  return 'night';
}
module.exports = { TEHRAN_OFFSET_MS, todayTehran, todayTehranComponents, dateKeyTehran, hourTehran, startOfDayTehran, endOfDayTehran, shiftOfDayTehran, hasIntl: !!_fmt };
