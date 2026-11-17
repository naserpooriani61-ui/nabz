'use strict';
// ═══════════════════════════════════════════════════════════
//  NABZ — Voice Notes (Part 15)
//  Audio attachments for ISBAR + other entities
//  Storage:  data/_voice/<id>.bin   (raw binary)
//            data/voice_notes.json  (metadata)
// ═══════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const store = require('../core/store');
const { h, sd } = require('../core/mod-helpers');

const VOICE_DIR = path.join(store.DATA, '_voice');
if (!fs.existsSync(VOICE_DIR)) fs.mkdirSync(VOICE_DIR, { recursive: true });

const MAX_DURATION_SEC = 60;
const MAX_SIZE_BYTES   = 2 * 1024 * 1024;
const MAX_NOTES_PER_FIELD = 10;
const ENTITY_TYPES = ['nursing_report','handover','kardex','vitals'];

function voiceFile(id) { return path.join(VOICE_DIR, id + '.bin'); }

function upload(ctx) {
  const b = ctx.body;
  if (!b.entityType || !ENTITY_TYPES.includes(b.entityType))
    throw ctx.E.badRequest('invalid_entity_type');
  if (!b.entityId) throw ctx.E.badRequest('entity_required');
  if (!b.audio)    throw ctx.E.badRequest('audio_required');

  let buffer;
  try {
    const b64 = String(b.audio).replace(/^data:audio\/[^;]+;base64,/, '');
    buffer = Buffer.from(b64, 'base64');
  } catch (_) { throw ctx.E.badRequest('invalid_audio'); }

  if (buffer.length > MAX_SIZE_BYTES)
    throw ctx.E.badRequest('audio_too_large:' + Math.round(buffer.length/1024) + 'KB');
  if (buffer.length < 100) throw ctx.E.badRequest('audio_too_small');

  const durationSec = Number(b.durationSec) || 0;
  if (durationSec > MAX_DURATION_SEC) throw ctx.E.badRequest('duration_too_long');

  const field = b.field || null;
  const existing = h(ctx, 'voice_notes').filter(n =>
    n.entityType === b.entityType && n.entityId === b.entityId && n.field === field);
  if (existing.length >= MAX_NOTES_PER_FIELD) throw ctx.E.conflict('too_many_notes');

  const id = ctx.uid('vn');
  fs.writeFileSync(voiceFile(id), buffer);

  const rec = {
    id, entityType: b.entityType, entityId: b.entityId, field,
    durationSec: Math.round(durationSec * 10) / 10,
    sizeBytes: buffer.length,
    mimeType: b.mimeType || 'audio/webm',
    uploadedBy: ctx.actor.id, uploadedByName: ctx.actor.username,
    createdAt: ctx.now()
  };
  ctx.store.put('voice_notes', rec);
  ctx.bus.emit('voice.note.created', { record: rec, actor: ctx.actor });
  return rec;
}

function listForEntity(ctx) {
  const items = h(ctx, 'voice_notes').filter(n =>
    n.entityType === ctx.params.entityType && n.entityId === ctx.params.entityId);
  items.sort((a, b) => sd(b.createdAt) - sd(a.createdAt));
  return { items, total: items.length };
}

function getMeta(ctx) {
  const n = ctx.store.get('voice_notes', ctx.params.id);
  if (!n) throw ctx.E.notFound('not_found');
  return n;
}

function streamAudio(ctx) {
  const n = ctx.store.get('voice_notes', ctx.params.id);
  if (!n) throw ctx.E.notFound('not_found');
  const f = voiceFile(n.id);
  if (!fs.existsSync(f)) throw ctx.E.notFound('audio_file_missing');
  const buf = fs.readFileSync(f);
  if (ctx.res) {
    ctx.res.writeHead(200, {
      'Content-Type': n.mimeType || 'audio/webm',
      'Content-Length': buf.length,
      'Cache-Control': 'private, max-age=3600',
      'Content-Disposition': 'inline'
    });
    ctx.res.end(buf);
  }
  return undefined;
}

function remove(ctx) {
  const n = ctx.store.get('voice_notes', ctx.params.id);
  if (!n) throw ctx.E.notFound('not_found');
  if (n.uploadedBy !== ctx.actor.id && ctx.actor.role !== 'admin')
    throw ctx.E.forbidden('not_owner');
  try { if (fs.existsSync(voiceFile(n.id))) fs.unlinkSync(voiceFile(n.id)); } catch (_) {}
  ctx.store.remove('voice_notes', n.id);
  ctx.bus.emit('voice.note.deleted', { record: n, actor: ctx.actor });
  return { deleted: true, id: n.id };
}

function cleanup(ctx) {
  const allNotes = h(ctx, 'voice_notes');
  const validIds = {
    nursing_report: new Set(h(ctx,'nursing_reports').map(x=>x.id)),
    handover:       new Set(h(ctx,'handovers').map(x=>x.id)),
    kardex:         new Set(h(ctx,'orders').map(x=>x.id)),
    vitals:         new Set(h(ctx,'vitals').map(x=>x.id))
  };
  let removed = 0;
  for (const n of allNotes) {
    const set = validIds[n.entityType];
    if (set && !set.has(n.entityId)) {
      try { if (fs.existsSync(voiceFile(n.id))) fs.unlinkSync(voiceFile(n.id)); } catch (_) {}
      ctx.store.remove('voice_notes', n.id);
      removed++;
    }
  }
  return { scanned: allNotes.length, removed };
}

function stats(ctx) {
  const all = h(ctx, 'voice_notes');
  const totalBytes = all.reduce((s, n) => s + (n.sizeBytes || 0), 0);
  return {
    total: all.length,
    totalMB: Math.round(totalBytes / 1024 / 1024 * 100) / 100,
    maxPerField: MAX_NOTES_PER_FIELD,
    maxSizeBytes: MAX_SIZE_BYTES,
    maxDurationSec: MAX_DURATION_SEC
  };
}

module.exports = {
  handlers: { upload, listForEntity, getMeta, streamAudio, remove, cleanup, stats },
  routes: [
    { method:'POST', path:'/api/voice/upload', handler:'upload', perm:'voice.create' },
    { method:'POST', path:'/api/voice/cleanup', handler:'cleanup', perm:'admin.users.manage' },
    { method:'GET',  path:'/api/voice/stats', handler:'stats', perm:'voice.view' },
    { method:'GET',  path:'/api/voice/:entityType/:entityId', handler:'listForEntity', perm:'voice.view' },
    { method:'GET',  path:'/api/voice/note/:id', handler:'getMeta', perm:'voice.view' },
    { method:'GET',  path:'/api/voice/note/:id/audio', handler:'streamAudio', perm:'voice.view' },
    { method:'DELETE', path:'/api/voice/note/:id', handler:'remove', perm:'voice.delete' }
  
  ],
  panels: []
};
