'use strict';
const crypto = require('crypto'), store = require('./store');
let KEYS = null;
function getKeys() {
  if (KEYS) return KEYS;
  const stored = store.readAll('_keys')[0];
  if (stored && stored.publicKey) { KEYS = stored; return KEYS; }
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  KEYS = {
    id: 'key_' + Date.now(),
    publicKey: publicKey.export({ type: 'spki', format: 'pem' }),
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };
  store.put('_keys', KEYS);
  return KEYS;
}
function signAction(payload) {
  const k = getKeys();
  const data = JSON.stringify(payload);
  const sig = crypto.sign(null, Buffer.from(data), k.privateKey).toString('base64');
  return {
    id: store.uid('sig'), ...payload, signature: sig,
    publicKeyId: k.id, algorithm: 'Ed25519',
    timestamp: new Date().toISOString(),
    fingerprint: crypto.createHash('sha256').update(data + sig).digest('hex').slice(0, 16)
  };
}
function verifySignature(record) {
  try {
    const k = getKeys();
    const { signature, publicKeyId, algorithm, timestamp, fingerprint, ...payload } = record;
    return crypto.verify(null, Buffer.from(JSON.stringify(payload)), k.publicKey, Buffer.from(signature, 'base64'));
  } catch (_) { return false; }
}
module.exports = { signAction, verifySignature, getKeys };
