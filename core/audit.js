'use strict';
const store = require('./store'), crypto = require('crypto');
function write(module, action, entityId, actor, meta) {
  const prev = store.readAll('audit_chain').slice(-1)[0];
  const prevHash = prev ? prev.hash : 'genesis';
  const rec = {
    id: store.uid('aud'), module, action, entityId,
    actor: { id: actor.id, role: actor.role, name: actor.fullName || actor.username },
    meta: meta || {}, prevHash, at: new Date().toISOString()
  };
  rec.hash = crypto.createHash('sha256').update(JSON.stringify({ rec, prevHash })).digest('hex').slice(0, 16);
  store.put('audit_chain', rec);
  return rec;
}
function verify() {
  const chain = store.readAll('audit_chain');
  for (let i = 1; i < chain.length; i++) {
    if (chain[i].prevHash !== chain[i-1].hash) return { ok: false, brokenAt: i };
  }
  return { ok: true, count: chain.length };
}
function recent(limit) { return store.readAll('audit_chain').slice(-(limit || 100)).reverse(); }
module.exports = { write, verify, recent };
