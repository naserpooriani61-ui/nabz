'use strict';
const bus = require('./events');

const clients = new Set();
let nextId = 1;
const MAX_CLIENTS = 200;
const HEARTBEAT_MS = 25000;

function addClient(res, meta) {
  // Cap to avoid memory blowup on Termux
  if (clients.size >= MAX_CLIENTS) {
    const oldest = clients.values().next().value;
    if (oldest) removeClient(oldest);
  }

  const client = {
    id: 'sse_' + (nextId++),
    res,
    meta: meta || {},
    connectedAt: Date.now(),
    pingInterval: null,
    closed: false
  };

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Authorization'
    });

    // Retry interval hint
    res.write('retry: 3000\n\n');

    // Welcome
    res.write('event: evt\ndata: ' + JSON.stringify({
      event: 'stream.connected',
      data: { clientId: client.id, serverTime: new Date().toISOString() },
      at: new Date().toISOString()
    }) + '\n\n');

    // Heartbeat to keep proxy from closing
    client.pingInterval = setInterval(() => {
      if (client.closed) return;
      try {
        res.write(': ping ' + Date.now() + '\n\n');
      } catch (_) {
        removeClient(client);
      }
    }, HEARTBEAT_MS);

    res.on('close', () => removeClient(client));
    res.on('error', () => removeClient(client));
    res.on('finish', () => removeClient(client));

    clients.add(client);
    console.log('[sse] +client ' + client.id + ' (total=' + clients.size + ')');

    return client;
  } catch (e) {
    console.error('[sse] failed to init client:', e.message);
    return null;
  }
}

function removeClient(client) {
  if (!client || client.closed) return;
  client.closed = true;
  if (client.pingInterval) clearInterval(client.pingInterval);
  clients.delete(client);
  try { client.res.end(); } catch (_) {}
  console.log('[sse] -client ' + client.id + ' (total=' + clients.size + ')');
}

function filterForClient(client, eventName, payload) {
  // Global events: send to everyone
  const globalEvents = ['stream.connected', 'crisis.activated', 'crisis.deactivated',
    'ed.code.activated', 'ed.code.closed', 'ed.mci.activated',
    'system.announcement'];
  if (globalEvents.includes(eventName)) return true;

  // For patient-related events, filter by ward or service
  const record = payload && (payload.record || payload);
  if (!record) return true;

  const resolver = require('./ward-resolver');
  const scope = resolver.resolveUserScope(client.meta, false);

  // Cross-ward user sees everything
  if (scope.kind === 'all') return true;

  // If event has patientId/wardCode, check
  const ward = record.wardCode || (record.patient && record.patient.wardCode);
  const svc = record.serviceCode || (ward ? resolver.serviceForWard(ward) : null);

  if (scope.kind === 'wards') {
    if (!ward) return true;
    return scope.codes.includes(ward);
  }
  if (scope.kind === 'services') {
    if (!svc) return true;
    return scope.codes.includes(svc);
  }
  // Cannot resolve → block patient-specific, allow global
  if (record.patientId || ward) return false;
  return true;
}

function broadcast(eventName, payload) {
  if (clients.size === 0) return;
  let frame;
  try {
    frame = 'event: evt\ndata: ' + JSON.stringify({
      event: eventName,
      data: payload,
      at: new Date().toISOString()
    }) + '\n\n';
  } catch (e) {
    return;
  }
  let sent = 0, filtered = 0;
  for (const c of clients) {
    if (c.closed) continue;
    if (!filterForClient(c, eventName, payload)) { filtered++; continue; }
    try { c.res.write(frame); sent++; } catch (_) { removeClient(c); }
  }
  if (filtered > 0) {
    console.log('[sse] ' + eventName + ' → ' + sent + ' sent, ' + filtered + ' filtered');
  }
}

// Subscribe to all events from Event Bus
bus.on('*', (payload) => {
  const evt = payload._event;
  if (!evt || evt === 'stream.connected') return;
  broadcast(evt, payload);
});

function stats() {
  return {
    clients: clients.size,
    connections: Array.from(clients).map(c => ({
      id: c.id,
      userId: c.meta.userId,
      role: c.meta.role,
      ward: c.meta.ward,
      connectedForSec: Math.floor((Date.now() - c.connectedAt) / 1000)
    }))
  };
}

module.exports = { addClient, removeClient, broadcast, stats };
