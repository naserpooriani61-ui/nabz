/* public/kardex_ui.js — Clinical Cockpit v2 */
(function () {
  'use strict';
  function boot() {
    if (!window.NABZ || typeof NABZ.registerKind !== 'function') { setTimeout(boot, 100); return; }
    register();
  }

  function register() {
    if (!document.getElementById('kx-style-v2')) {
      const st = document.createElement('style');
      st.id = 'kx-style-v2';
      st.textContent = `
/* kx2-theme-v5-marker */
:root{--kx-bg:#eef2f8;--kx-surface:#fff;--kx-surface-2:#f8fafc;--kx-surface-3:#eef2f7;--kx-text:#0f172a;--kx-text-2:#475569;--kx-text-3:#94a3b8;--kx-border:#e2e8f0;--kx-primary:#1e4d8c;--kx-primary-h:#163a6b;--kx-primary-soft:#dbeafe;--kx-success:#059669;--kx-success-soft:#d1fae5;--kx-warning:#d97706;--kx-warning-soft:#fef3c7;--kx-danger:#dc2626;--kx-danger-soft:#fee2e2;--kx-shadow-sm:0 1px 2px rgba(15,23,42,.04),0 1px 3px rgba(15,23,42,.05);--kx-shadow-md:0 4px 12px rgba(15,23,42,.07);--kx-shadow-lg:0 12px 32px rgba(15,23,42,.12);--kx-r:14px;--kx-r-sm:10px;--kx-pill:999px;--kx-t:.22s cubic-bezier(.4,0,.2,1)}
@media(prefers-color-scheme:dark){:root{--kx-bg:#0b1220;--kx-surface:#131c2e;--kx-surface-2:#1a2540;--kx-surface-3:#1f2d45;--kx-text:#e2e8f0;--kx-text-2:#94a3b8;--kx-text-3:#64748b;--kx-border:#1f2d45;--kx-primary:#3b82f6;--kx-primary-h:#60a5fa;--kx-primary-soft:#1e3a8a;--kx-success:#10b981;--kx-success-soft:#064e3b;--kx-warning:#f59e0b;--kx-warning-soft:#78350f;--kx-danger:#ef4444;--kx-danger-soft:#7f1d1d;--kx-shadow-sm:0 1px 2px rgba(0,0,0,.3);--kx-shadow-md:0 4px 12px rgba(0,0,0,.4);--kx-shadow-lg:0 12px 32px rgba(0,0,0,.5)}}
.kx2{direction:rtl;font-family:'Vazirmatn',Tahoma,sans-serif;background:var(--kx-bg);min-height:100vh;color:var(--kx-text);padding-bottom:88px;font-size:14px;line-height:1.65}
.kx2 *{box-sizing:border-box}
.kx2-rb{position:sticky;top:0;z-index:10;padding:14px 16px;background:linear-gradient(135deg,rgba(30,77,140,.97),rgba(15,23,42,.95));backdrop-filter:blur(12px) saturate(1.2);-webkit-backdrop-filter:blur(12px) saturate(1.2);color:#fff;box-shadow:0 4px 20px rgba(15,23,42,.18);border-bottom:1px solid rgba(255,255,255,.08)}
.kx2-rb-top{display:flex;align-items:center;gap:12px}
.kx2-avatar{width:46px;height:46px;border-radius:50%;background:linear-gradient(135deg,#60a5fa,#3b82f6);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:17px;flex-shrink:0;box-shadow:0 4px 12px rgba(59,130,246,.35);border:2px solid rgba(255,255,255,.2)}
.kx2-name{font-size:17px;font-weight:800;line-height:1.25;letter-spacing:-.01em}
.kx2-sub{font-size:12px;opacity:.85;margin-top:3px;font-variant-numeric:tabular-nums}
.kx2-allergy{background:linear-gradient(135deg,#dc2626,#b91c1c);display:inline-block;padding:4px 12px;border-radius:var(--kx-pill);font-size:11px;font-weight:700;margin-top:8px;margin-left:6px;box-shadow:0 2px 8px rgba(220,38,38,.4);border:1px solid rgba(255,255,255,.15);animation:kx2pulse 2s ease-in-out infinite}
.kx2-iso{background:linear-gradient(135deg,#f59e0b,#d97706);display:inline-block;padding:4px 12px;border-radius:var(--kx-pill);font-size:11px;font-weight:700;margin-top:8px;box-shadow:0 2px 8px rgba(245,158,11,.35);border:1px solid rgba(255,255,255,.15)}
@keyframes kx2pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
@keyframes kx2fade{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
@keyframes kx2spin{to{transform:rotate(360deg)}}
.kx2-vitals{display:flex;gap:8px;padding:12px;background:var(--kx-bg);overflow-x:auto;scrollbar-width:none}
.kx2-vitals::-webkit-scrollbar{display:none}
.kx2-v{flex:1 0 auto;min-width:88px;padding:12px 8px 10px;text-align:center;background:var(--kx-surface);border-radius:var(--kx-r-sm);border:1px solid var(--kx-border);box-shadow:var(--kx-shadow-sm);position:relative;transition:transform var(--kx-t),box-shadow var(--kx-t)}
.kx2-v:hover{transform:translateY(-1px);box-shadow:var(--kx-shadow-md)}
.kx2-v.crit{border-color:var(--kx-danger);background:var(--kx-danger-soft)}
.kx2-v.crit .kx2-v-v{color:var(--kx-danger)}
.kx2-v-l{font-size:10px;color:var(--kx-text-3);font-weight:700;letter-spacing:.03em;text-transform:uppercase}
.kx2-v-v{font-size:22px;font-weight:800;line-height:1.1;margin-top:2px;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.kx2-v-t{font-size:11px;font-weight:700;position:absolute;top:6px;left:8px}
.kx2-v-t.up{color:var(--kx-danger)}.kx2-v-t.down{color:var(--kx-success)}.kx2-v-t.flat{color:var(--kx-text-3)}
.kx2-spark{display:block;margin:6px auto 0;width:72px;height:22px;overflow:visible}
.kx2-spark polyline{fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round;stroke-linecap:round;opacity:.8}
.kx2-spark.s-up{color:var(--kx-danger)}.kx2-spark.s-down{color:var(--kx-success)}.kx2-spark.s-flat{color:var(--kx-text-3)}.kx2-spark.s-warn{color:var(--kx-warning)}
.kx2-v.news{background:linear-gradient(135deg,var(--kx-primary),var(--kx-primary-h));color:#fff;border-color:transparent;box-shadow:0 4px 14px rgba(30,77,140,.3)}
.kx2-v.news .kx2-v-l,.kx2-v.news .kx2-v-v{color:#fff}
.kx2-v.news.high{background:linear-gradient(135deg,#f59e0b,#d97706);box-shadow:0 4px 14px rgba(245,158,11,.35)}
.kx2-v.news.critical{background:linear-gradient(135deg,#dc2626,#991b1b);box-shadow:0 4px 14px rgba(220,38,38,.4);animation:kx2pulse 2s ease-in-out infinite}
.kx2-v.news.medium{background:linear-gradient(135deg,#eab308,#ca8a04);box-shadow:0 4px 14px rgba(234,179,8,.3)}
.kx2-v.news.low{background:linear-gradient(135deg,#10b981,#059669);box-shadow:0 4px 14px rgba(16,185,129,.3)}
.kx2-v.news .kx2-v-t{color:rgba(255,255,255,.9)}
.kx2-sec{background:var(--kx-surface);margin:12px;border-radius:var(--kx-r);overflow:hidden;box-shadow:var(--kx-shadow-sm);border:1px solid var(--kx-border);transition:box-shadow var(--kx-t)}
.kx2-sec:hover{box-shadow:var(--kx-shadow-md)}
.kx2-sec-h{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;cursor:pointer;user-select:none;transition:background var(--kx-t)}
.kx2-sec-h:hover{background:var(--kx-surface-2)}
.kx2-sec-t{display:flex;align-items:center;gap:10px;font-size:15px;font-weight:800;color:var(--kx-text);letter-spacing:-.01em}
.kx2-sec-t .count{background:var(--kx-surface-3);color:var(--kx-text-2);border-radius:var(--kx-pill);padding:2px 10px;font-size:11px;font-weight:700;font-variant-numeric:tabular-nums}
.kx2-sec-t .count.danger{background:var(--kx-danger);color:#fff}
.kx2-sec-t .count.warn{background:var(--kx-warning);color:#fff}
.kx2-chev{color:var(--kx-text-3);font-size:16px;transition:transform var(--kx-t)}
.kx2-sec.open .kx2-chev{transform:rotate(90deg)}
.kx2-sec-b{display:none;padding:0 16px 14px;border-top:1px solid var(--kx-border)}
.kx2-sec.open .kx2-sec-b{display:block;animation:kx2fade .3s ease}
.kx2-urgent{background:var(--kx-surface);margin:12px;border-radius:var(--kx-r);overflow:hidden;box-shadow:0 4px 20px rgba(220,38,38,.18);border:2px solid var(--kx-danger)}
.kx2-urgent.all-clear{border-color:var(--kx-success);box-shadow:0 4px 20px rgba(16,185,129,.18)}
.kx2-urgent-h{padding:14px 16px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;font-size:15px;font-weight:800;display:flex;align-items:center;gap:10px}
.kx2-urgent.all-clear .kx2-urgent-h{background:linear-gradient(135deg,#10b981,#059669)}
.kx2-urgent-b{padding:12px;display:flex;flex-direction:column;gap:10px}
.kx2-u-card{padding:12px 14px;border-radius:var(--kx-r-sm);background:var(--kx-danger-soft);border-right:4px solid var(--kx-danger);display:flex;gap:12px;align-items:flex-start;transition:transform var(--kx-t)}
.kx2-u-card:hover{transform:translateX(-2px)}
.kx2-u-card.high{background:var(--kx-warning-soft);border-right-color:var(--kx-warning)}
.kx2-u-card.warning{background:var(--kx-surface-2);border-right-color:var(--kx-text-3)}
.kx2-u-icon{font-size:22px;flex-shrink:0;line-height:1}
.kx2-u-body{flex:1;min-width:0}
.kx2-u-title{font-weight:800;font-size:14px;margin-bottom:3px;color:var(--kx-text)}
.kx2-u-sub{font-size:12px;color:var(--kx-text-2);line-height:1.55}
.kx2-u-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.kx2-u-actions button{border:none;border-radius:8px;padding:6px 14px;font-family:inherit;font-size:12px;font-weight:700;cursor:pointer;transition:all var(--kx-t)}
.kx2-u-actions button:active{transform:scale(.97)}
.kx2-u-actions .primary{background:var(--kx-primary);color:#fff;box-shadow:0 2px 6px rgba(30,77,140,.3)}
.kx2-u-actions .primary:hover{background:var(--kx-primary-h)}
.kx2-u-actions .danger{background:var(--kx-surface);color:var(--kx-danger);border:1px solid var(--kx-danger)}
.kx2-u-actions .danger:hover{background:var(--kx-danger-soft)}
.kx2-u-actions .secondary{background:var(--kx-surface-3);color:var(--kx-text-2)}
.kx2-all-clear{text-align:center;padding:28px;color:var(--kx-success);font-weight:700;font-size:15px}
.kx2-tl{padding:8px 0}
.kx2-tl-item{display:flex;gap:12px;padding:10px 14px;border-bottom:1px solid var(--kx-border);align-items:center;transition:background var(--kx-t)}
.kx2-tl-item:hover{background:var(--kx-surface-2)}
.kx2-tl-item:last-child{border-bottom:none}
.kx2-tl-time{font-size:13px;font-weight:700;color:var(--kx-primary);min-width:50px;font-variant-numeric:tabular-nums}
.kx2-tl-icon{font-size:18px}
.kx2-tl-title{flex:1;font-size:13px;font-weight:600;color:var(--kx-text)}
.kx2-tl-title small{display:block;font-size:11px;color:var(--kx-text-2);font-weight:400;margin-top:2px}
.kx2-tl-badge{font-size:10px;padding:2px 10px;border-radius:var(--kx-pill);background:var(--kx-warning-soft);color:#92400e;font-weight:700}
.kx2-tl-badge.high{background:var(--kx-danger-soft);color:#991b1b}
.kx2-meds{padding:4px 0}
.kx2-class{padding:12px 0;border-bottom:1px solid var(--kx-border)}
.kx2-class:last-child{border-bottom:none}
.kx2-class-h{font-size:13px;font-weight:800;color:var(--kx-primary);margin-bottom:8px;display:flex;align-items:center;gap:8px}
.kx2-med{padding:10px 12px;border-radius:var(--kx-r-sm);margin-bottom:6px;background:var(--kx-surface-2);display:flex;align-items:center;gap:10px;font-size:13px;border:1px solid transparent;transition:all var(--kx-t)}
.kx2-med:hover{background:var(--kx-surface-3);border-color:var(--kx-border)}
.kx2-med-icon{font-size:16px}
.kx2-med-name{flex:1;font-weight:700;color:var(--kx-text)}
.kx2-med-dose{font-size:11px;color:var(--kx-text-2);font-weight:500}
.kx2-med-doses{font-size:12px;color:var(--kx-success);font-weight:700;font-variant-numeric:tabular-nums}
.kx2-med-alert{background:var(--kx-danger-soft);color:var(--kx-danger);font-size:10px;padding:2px 8px;border-radius:var(--kx-pill);font-weight:700}
.kx2-med-progress{display:inline-block;width:56px;height:6px;background:var(--kx-surface-3);border-radius:3px;overflow:hidden;vertical-align:middle;margin-left:6px}
.kx2-med-progress-in{display:block;height:100%;background:var(--kx-success);transition:width .4s ease;border-radius:3px}
.kx2-med-progress-in.partial{background:var(--kx-warning)}
.kx2-med-progress-in.empty{background:var(--kx-danger)}
.kx2-list{padding:4px 0}
.kx2-row{display:flex;align-items:center;gap:10px;padding:10px 4px;border-bottom:1px solid var(--kx-border);font-size:13px;transition:background var(--kx-t)}
.kx2-row:hover{background:var(--kx-surface-2)}
.kx2-row:last-child{border-bottom:none}
.kx2-row-icon{font-size:16px}
.kx2-row-title{flex:1;font-weight:600;color:var(--kx-text)}
.kx2-row-sub{font-size:11px;color:var(--kx-text-2);margin-top:2px}
.kx2-row-status{font-size:10px;padding:3px 10px;border-radius:var(--kx-pill);font-weight:700;background:var(--kx-surface-3);color:var(--kx-text-2)}
.kx2-row-status.pending{background:var(--kx-warning-soft);color:#92400e}
.kx2-row-status.verified{background:var(--kx-success-soft);color:#065f46}
.kx2-row-status.active{background:var(--kx-primary-soft);color:var(--kx-primary)}
.kx2-row-status.cancelled{background:var(--kx-danger-soft);color:#991b1b}
.kx2-row-actions button{background:var(--kx-primary-soft);border:none;color:var(--kx-primary);border-radius:8px;padding:4px 10px;font-size:11px;font-family:inherit;cursor:pointer;font-weight:700;margin-right:3px;transition:all var(--kx-t)}
.kx2-row-actions button:hover{background:var(--kx-primary);color:#fff}
.kx2-row-actions button:active{transform:scale(.96)}
.kx2-alert{padding:12px 14px;border-radius:var(--kx-r-sm);margin-bottom:8px;background:var(--kx-surface-2);border-right:4px solid var(--kx-text-3);transition:transform var(--kx-t)}
.kx2-alert:hover{transform:translateX(-2px)}
.kx2-alert.critical{background:var(--kx-danger-soft);border-right-color:var(--kx-danger)}
.kx2-alert.high{background:var(--kx-warning-soft);border-right-color:var(--kx-warning)}
.kx2-alert-t{font-weight:800;font-size:13px;display:flex;gap:8px;align-items:center;color:var(--kx-text)}
.kx2-alert-m{font-size:12px;color:var(--kx-text-2);margin-top:4px;line-height:1.6}
.kx2-alert-r{font-size:12px;color:var(--kx-primary);margin-top:6px;font-weight:600;padding:6px 10px;background:var(--kx-primary-soft);border-radius:6px;display:inline-block}
.kx2-io{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;padding:8px 0}
.kx2-io-c{text-align:center;padding:12px 8px;border-radius:var(--kx-r-sm);background:var(--kx-surface-2);border:1px solid var(--kx-border);transition:transform var(--kx-t)}
.kx2-io-c:hover{transform:translateY(-1px)}
.kx2-io-c.l{font-size:11px;color:var(--kx-text-2);margin-bottom:6px;font-weight:600}
.kx2-io-c.v{font-size:20px;font-weight:800;font-variant-numeric:tabular-nums}
.kx2-io-c.in .v{color:var(--kx-success)}.kx2-io-c.out .v{color:var(--kx-warning)}.kx2-io-c.bal .v{color:var(--kx-primary)}.kx2-io-c.bal.neg .v{color:var(--kx-danger)}
.kx2-empty{text-align:center;color:var(--kx-text-3);font-style:italic;padding:20px 8px;font-size:13px}
.kx2-bottom{position:fixed;bottom:12px;left:12px;right:12px;background:var(--kx-surface);border:1px solid var(--kx-border);border-radius:var(--kx-r);display:flex;box-shadow:var(--kx-shadow-lg);z-index:9;overflow:hidden}
.kx2-bottom button{flex:1;background:none;border:none;padding:14px 6px;font-family:inherit;font-size:11px;color:var(--kx-text-2);cursor:pointer;font-weight:700;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all var(--kx-t)}
.kx2-bottom button:active{background:var(--kx-surface-3);transform:scale(.96)}
.kx2-bottom button .ico{font-size:20px}
.kx2-bottom button.primary{color:var(--kx-primary)}
.kx2-loading{padding:60px 20px;text-align:center;color:var(--kx-text-3);font-size:14px}
.kx2-loading::after{content:'';display:block;width:32px;height:32px;margin:16px auto 0;border:3px solid var(--kx-surface-3);border-top-color:var(--kx-primary);border-radius:50%;animation:kx2spin 1s linear infinite}
.kx2-error{padding:20px;color:var(--kx-danger);background:var(--kx-danger-soft);text-align:center;border-radius:var(--kx-r);margin:20px;border:1px solid var(--kx-danger)}
@media print{.kx2-bottom{display:none}.kx2{border:none;box-shadow:none;padding-bottom:0}.kx2-sec{page-break-inside:avoid;box-shadow:none;border:1px solid #ccc}}
`;
      document.head.appendChild(st);
    }

    const LABELS = {
      cardiovascular: { icon: '🫀', label: 'قلبی-عروقی' },
      anti_infective: { icon: '🦠', label: 'ضدعفونی / آنتی‌بیوتیک' },
      fluid:          { icon: '💧', label: 'سرم و مایعات وریدی' },
      endocrine:      { icon: '🧬', label: 'غدد / هورمون' },
      analgesia:      { icon: '💊', label: 'ضددرد' },
      analgesia_prn:  { icon: '📋', label: 'PRN (در صورت نیاز)' },
      respiratory:    { icon: '🌬️', label: 'تنفسی' },
      gi:             { icon: '🩹', label: 'گوارش' },
      cns:            { icon: '🧠', label: 'اعصاب / آرام‌بخش' },
      electrolytes:   { icon: '⚡', label: 'الکترولیت' },
      topical:        { icon: '🩹', label: 'موضعی' },
      inhaled:        { icon: '🌬️', label: 'استنشاقی' },
      other:          { icon: '💊', label: 'سایر' }
    };
    const ACTIONS = {
      administer: 'اجرا', refuse: 'رد', miss: 'missed',
      verify: 'تأیید', cancel: 'لغو', discontinue: 'DC',
      respond: 'پاسخ', approve: 'تصویب', hold: 'توقف'
    };
    const STATUS_FA = {
      pending: 'در انتظار', verified: 'تأییدشده', active: 'فعال', held: 'متوقف',
      given: 'اجرا شد', given_partial: 'جزئی', missed: 'missed', refused: 'رد',
      cancelled: 'لغو', discontinued: 'قطع', requested: 'درخواست', responded: 'پاسخ'
    };

    function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]); }
    function fmtT(iso) { try { return new Date(iso).toLocaleTimeString('fa-IR',{hour:'2-digit',minute:'2-digit'}); } catch(_) { return ''; } }
    function fmtD(iso) { try { return new Date(iso).toLocaleDateString('fa-IR'); } catch(_) { return ''; } }
    function ago(iso) {
      if (!iso) return '';
      const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
      if (s < 60) return 'الان';
      if (s < 3600) return Math.floor(s/60) + 'm';
      if (s < 86400) return Math.floor(s/3600) + 'h';
      return Math.floor(s/86400) + 'd';
    }

    async function fetchKardex(pid) {
      const url = '/api/kardex/' + encodeURIComponent(pid);
      if (window.NABZ && typeof NABZ._api === 'function') return await NABZ._api(url);
      const r = await fetch(url, { credentials: 'include' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }
    async function doAction(entity, id, action, body) {
      const url = `/api/kardex/${entity}/${encodeURIComponent(id)}/${encodeURIComponent(action)}`;
      if (window.NABZ && typeof NABZ._api === 'function') {
        return await NABZ._api(url, { method: 'POST', body: JSON.stringify(body || {}) });
      }
      const r = await fetch(url, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {})
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.message || data.code || 'HTTP ' + r.status);
      return data;
    }

    // ─── Header ribbon ───
    function renderRibbon(p) {
      const initials = (p.name || '?').split(' ').map(s => s[0]).slice(0, 2).join('');
      let h = '<div class="kx2-rb">';
      h += '<div class="kx2-rb-top">';
      h += '<div class="kx2-avatar">' + esc(initials) + '</div>';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div class="kx2-name">' + esc(p.name) + '</div>';
      h += '<div class="kx2-sub">';
      const parts = [];
      if (p.age) parts.push(p.age + ' سال');
      if (p.sex) parts.push(p.sex === 'male' ? 'مرد' : 'زن');
      if (p.wardCode) parts.push(p.wardCode);
      if (p.bedNumber) parts.push('تخت ' + p.bedNumber);
      h += parts.map(esc).join(' · ');
      h += '</div>';
      h += '</div></div>';
      const badges = [];
      if (p.admissionReason) badges.push('<div style="font-size:11px;opacity:.9;margin-top:6px;">📋 ' + esc(p.admissionReason) + '</div>');
      if (p.allergies && p.allergies.length) badges.push('<span class="kx2-allergy">⚠️ ' + esc(p.allergies.join('، ')) + '</span>');
      if (p.isolation) badges.push('<span class="kx2-iso">🔒 ' + esc(p.isolation) + '</span>');
      h += badges.join('');
      h += '</div>';
      return h;
    }

    function kx2Spark(vitals, field, opts) {
      if (!Array.isArray(vitals) || vitals.length < 2) return '';
      opts = opts || {};
      const sorted = vitals.slice().sort((a, b) => {
        const ta = new Date(a.recordedAt || a.createdAt || 0).getTime() || 0;
        const tb = new Date(b.recordedAt || b.createdAt || 0).getTime() || 0;
        return ta - tb;
      });
      const vals = sorted.slice(-8).map(v => Number(v[field])).filter(n => isFinite(n) && n > 0);
      if (vals.length < 2) return '';
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const range = (max - min) || 1;
      const W = 72, H = 22, PAD = 2;
      const step = (W - 2 * PAD) / (vals.length - 1);
      const pts = vals.map((v, i) => {
        const x = PAD + i * step;
        const y = PAD + (H - 2 * PAD) * (1 - (v - min) / range);
        return x.toFixed(1) + ',' + y.toFixed(1);
      }).join(' ');
      const last = vals[vals.length - 1], first = vals[0];
      let cls = 's-flat';
      if (last > first) cls = 's-up';
      else if (last < first) cls = 's-down';
      if (opts.low != null && last < opts.low) cls = 's-warn';
      else if (opts.high != null && last > opts.high) cls = 's-warn';
      return '<svg class="kx2-spark ' + cls + '" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none"><polyline points="' + pts + '"/></svg>';
    }

    // ─── Vitals strip ───
    function renderVitalsStrip(cv, trends, vitals) {
      if (!cv) return '<div class="kx2-vitals"><div class="kx2-v" style="flex:1;"><div class="kx2-v-l">—</div><div class="kx2-v-v">—</div></div></div>';
      const numCls = (val, min, max) => {
        const n = Number(val) || 0;
        if (!n) return '';
        if (n < min || n > max) return 'crit';
        return '';
      };
      const tIcon = (t) => t === 'up' ? '↑' : t === 'down' ? '↓' : t === 'flat' ? '·' : '';
      const tCls = (t) => t || 'flat';
      const newsCls = cv.newsLevel || 'low';
  const v = vitals || [];

      let h = '<div class="kx2-vitals">';
      h += '<div class="kx2-v ' + numCls(cv.hr, 60, 100) + '"><div class="kx2-v-l">HR</div><div class="kx2-v-v">' + (cv.hr || '—') + '</div>' + kx2Spark(v, 'hr', {low: 60, high: 100}) + '<div class="kx2-v-t ' + tCls(trends.hr) + '">' + tIcon(trends.hr) + '</div></div>';
      h += '<div class="kx2-v ' + numCls(cv.spo2, 95, 100) + '"><div class="kx2-v-l">SpO₂</div><div class="kx2-v-v">' + (cv.spo2 || '—') + '</div>' + kx2Spark(v, 'spo2', {low: 95, high: 100}) + '<div class="kx2-v-t ' + tCls(trends.spo2) + '">' + tIcon(trends.spo2) + '</div></div>';
      h += '<div class="kx2-v ' + numCls(cv.sbp, 100, 160) + '"><div class="kx2-v-l">BP</div><div class="kx2-v-v">' + (cv.sbp || '—') + '/' + (cv.dbp || '—') + '</div>' + kx2Spark(v, 'bp_sys', {low: 100, high: 160}) + '<div class="kx2-v-t ' + tCls(trends.sbp) + '">' + tIcon(trends.sbp) + '</div></div>';
      h += '<div class="kx2-v ' + numCls(cv.temp, 36, 38) + '"><div class="kx2-v-l">T°</div><div class="kx2-v-v">' + (cv.temp || '—') + '</div>' + kx2Spark(v, 'temp', {low: 36, high: 38}) + '<div class="kx2-v-t ' + tCls(trends.temp) + '">' + tIcon(trends.temp) + '</div></div>';
      h += '<div class="kx2-v news ' + newsCls + '"><div class="kx2-v-l">NEWS2</div><div class="kx2-v-v">' + (cv.news2 != null ? cv.news2 : '—') + '</div><div class="kx2-v-t ' + tCls(trends.news) + '">' + tIcon(trends.news) + '</div></div>';
      h += '</div>';
      return h;
    }

    // ─── NEWS2 Trend Chart ───
    function news2Calc(v) {
      if (!v || typeof v !== 'object') v = {};
      let t = 0;
      const num = (x) => { const n = Number(x); return isFinite(n) ? n : null; };
      const rr = num(v.rr);
      if (rr != null) t += rr <= 8 ? 3 : rr <= 11 ? 1 : rr <= 20 ? 0 : rr <= 24 ? 2 : 3;
      const spo2 = num(v.spo2);
      if (spo2 != null) t += spo2 <= 91 ? 3 : spo2 <= 93 ? 2 : spo2 <= 95 ? 1 : 0;
      if (v.onOxygen) t += 2;
      const sbp = num(v.bp_sys);
      if (sbp != null) t += sbp <= 90 ? 3 : sbp <= 100 ? 2 : sbp <= 110 ? 1 : sbp <= 219 ? 0 : 3;
      const hr = num(v.hr);
      if (hr != null) t += hr <= 40 ? 3 : hr <= 50 ? 1 : hr <= 90 ? 0 : hr <= 110 ? 1 : hr <= 130 ? 2 : 3;
      if (v.consciousness && v.consciousness !== 'alert') t += 3;
      const temp = num(v.temp);
      if (temp != null) t += temp <= 35 ? 3 : temp <= 36 ? 1 : temp <= 38 ? 0 : temp <= 39 ? 1 : 2;
      const risk = t >= 7 ? 'critical' : t >= 5 ? 'high' : t >= 1 ? 'medium' : 'low';
      return { total: t, risk };
    }

    function renderNews2Trend(vitals) {
      if (!Array.isArray(vitals) || vitals.length < 2) return '';
      const now = Date.now();
      const cutoff = now - 24 * 3600 * 1000;
      const toPoint = (v) => {
        if (!v || !v.recordedAt) return null;
        const ts = new Date(v.recordedAt).getTime();
        if (!isFinite(ts)) return null;
        const c = (v.news2 != null && v.newsLevel) ? { total: Number(v.news2), risk: v.newsLevel } : news2Calc(v);
        return { ts, at: v.recordedAt, total: c.total, risk: c.risk };
      };
      let pts = vitals.map(toPoint).filter(Boolean).filter(p => p.ts >= cutoff).sort((a,b) => a.ts - b.ts);
      if (pts.length < 2) pts = vitals.map(toPoint).filter(Boolean).sort((a,b) => a.ts - b.ts).slice(-12);
      if (pts.length < 2) return '';

      const W = 600, H = 150, PADL = 30, PADR = 10, PADT = 12, PADB = 25;
      const maxY = Math.max(7, ...pts.map(p => p.total)) + 1;
      const xStep = (W - PADL - PADR) / (pts.length - 1);
      const xOf = (i) => PADL + i * xStep;
      const yOf = (t) => PADT + (H - PADT - PADB) * (1 - t / maxY);
      const col = (r) => r === 'critical' ? '#dc2626' : r === 'high' ? '#ea580c' : r === 'medium' ? '#ca8a04' : '#16a34a';
      const linePts = pts.map((p, i) => xOf(i).toFixed(1) + ',' + yOf(p.total).toFixed(1)).join(' ');
      const y5 = yOf(5), y7 = yOf(7);

      let circles = '';
      pts.forEach((p, i) => {
        const tip = new Date(p.at).toLocaleString('fa-IR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' — NEWS2: ' + p.total + ' (' + p.risk + ')';
        circles += '<circle cx="' + xOf(i).toFixed(1) + '" cy="' + yOf(p.total).toFixed(1) + '" r="4" fill="' + col(p.risk) + '" stroke="#fff" stroke-width="1.5"><title>' + tip + '</title></circle>';
      });

      const fmt = (iso) => { try { return new Date(iso).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }); } catch (_) { return ''; } };
      const latest = pts[pts.length - 1];
      const first = pts[0];
      const trend = latest.total > first.total ? '↑' : latest.total < first.total ? '↓' : '·';

      const svg =
        '<svg viewBox="0 0 ' + W + ' ' + H + '" class="kx2-news2-svg" preserveAspectRatio="none">' +
          '<line x1="' + PADL + '" x2="' + (W - PADR) + '" y1="' + y5.toFixed(1) + '" y2="' + y5.toFixed(1) + '" stroke="#f59e0b" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>' +
          '<line x1="' + PADL + '" x2="' + (W - PADR) + '" y1="' + y7.toFixed(1) + '" y2="' + y7.toFixed(1) + '" stroke="#dc2626" stroke-width="1" stroke-dasharray="4 3" opacity="0.55"/>' +
          '<text x="' + (W - PADR - 2) + '" y="' + (y5 - 2).toFixed(1) + '" font-size="9" fill="#f59e0b" text-anchor="end">5</text>' +
          '<text x="' + (W - PADR - 2) + '" y="' + (y7 - 2).toFixed(1) + '" font-size="9" fill="#dc2626" text-anchor="end">7</text>' +
          '<polyline points="' + linePts + '" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linejoin="round"/>' +
          circles +
          '<text x="' + (PADL - 5) + '" y="' + (PADT + 5) + '" font-size="9" fill="#94a3b8" text-anchor="end">' + maxY + '</text>' +
          '<text x="' + (PADL - 5) + '" y="' + (H - PADB + 3) + '" font-size="9" fill="#94a3b8" text-anchor="end">0</text>' +
          '<text x="' + (PADL - 2) + '" y="' + (H - 6) + '" font-size="10" fill="#94a3b8" text-anchor="start">' + fmt(first.at) + '</text>' +
          '<text x="' + (W - PADR) + '" y="' + (H - 6) + '" font-size="10" fill="#94a3b8" text-anchor="end">' + fmt(latest.at) + '</text>' +
        '</svg>';

      if (!document.getElementById('kx2-news2-style')) {
        const st = document.createElement('style');
        st.id = 'kx2-news2-style';
        st.textContent =
          '.kx2-news2-wrap{background:#fff;border-bottom:1px solid #e2e8f0;padding:4px 12px 8px;}' +
          '.kx2-news2-toggle{cursor:pointer;font-weight:600;color:#475569;font-size:12px;list-style:none;padding:6px 0;user-select:none;}' +
          '.kx2-news2-toggle::-webkit-details-marker{display:none;}' +
          '.kx2-news2-toggle::after{content:"▾";margin-right:6px;color:#94a3b8;}' +
          'details.kx2-news2-wrap[open] .kx2-news2-toggle::after{content:"▴";}' +
          '.kx2-news2-svg{width:100%;height:auto;display:block;margin-top:4px;}';
        document.head.appendChild(st);
      }

      return '<details class="kx2-news2-wrap">' +
        '<summary class="kx2-news2-toggle">📈 NEWS2 trend · ' + pts.length + ' نقطه · ' + trend + ' (آخرین: ' + latest.total + ' ' + latest.risk + ')</summary>' +
        svg +
      '</details>';
    }

    // ─── Urgent hero ───
    function renderUrgent(urgent) {
      if (!urgent || !urgent.length) {
        return '<div class="kx2-urgent all-clear"><div class="kx2-urgent-h">✅ همه‌چیز مرتب است</div><div class="kx2-all-clear">هیچ اقدام فوری در این لحظه لازم نیست</div></div>';
      }
      let h = '<div class="kx2-urgent"><div class="kx2-urgent-h">⚡ ' + urgent.length + ' کار فوری</div><div class="kx2-urgent-b">';
      urgent.forEach(u => {
        h += '<div class="kx2-u-card ' + u.severity + '">';
        h += '<div class="kx2-u-icon">' + u.icon + '</div>';
        h += '<div class="kx2-u-body">';
        h += '<div class="kx2-u-title">' + esc(u.title) + '</div>';
        h += '<div class="kx2-u-sub">' + esc(u.subtitle) + '</div>';
        if (u.actions && u.actions.length) {
          h += '<div class="kx2-u-actions">';
          u.actions.forEach(a => {
            const cls = a === 'verify' || a === 'administer' || a === 'respond' ? 'primary' : (a === 'cancel' || a === 'refuse' || a === 'discontinue') ? 'danger' : 'secondary';
            h += '<button class="' + cls + '" data-k="' + esc(u.entity) + '" data-i="' + esc(u.id) + '" data-a="' + esc(a) + '">' + esc(ACTIONS[a] || a) + '</button>';
          });
          h += '</div>';
        }
        h += '</div></div>';
      });
      h += '</div></div>';
      return h;
    }

    // ─── Timeline ───
    function renderTimeline(items) {
      if (!items || !items.length) return '<div class="kx2-empty">هیچ رویدادی در ۸ ساعت آینده نیست</div>';
      let h = '<div class="kx2-tl">';
      items.forEach(it => {
        const badge = it.isHighAlert ? '<span class="kx2-tl-badge high">HIGH</span>' : '';
        h += '<div class="kx2-tl-item">';
        h += '<div class="kx2-tl-time">' + fmtT(it.at) + '</div>';
        h += '<div class="kx2-tl-icon">' + it.icon + '</div>';
        h += '<div class="kx2-tl-title">' + esc(it.title) + (it.subtitle ? '<small>' + esc(it.subtitle) + '</small>' : '') + '</div>';
        h += badge;
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    // ─── MAR Translators ───
    const FREQ_MAP = {
      'OD': 'روزانه', 'Q24H': 'روزانه', 'BID': 'دوبار در روز', 'Q12H': 'هر ۱۲ ساعت',
      'TDS': 'سه‌بار در روز', 'Q8H': 'هر ۸ ساعت', 'QID': 'چهاربار در روز', 'Q6H': 'هر ۶ ساعت',
      'HS': 'شب‌هنگام', 'Q4H': 'هر ۴ ساعت', 'Q1H': 'هر ۱ ساعت', 'CONT': 'مداوم',
      'Q8H PRN': 'هر ۸ ساعت (PRN)', 'Q4H PRN': 'هر ۴ ساعت (PRN)',
      'Q6H PRN': 'هر ۶ ساعت (PRN)', 'Q1H X2': 'هر ۱ ساعت (۲ دوز)'
    };
    const ROUTE_MAP = {
      'PO': 'خوراکی', 'IV': 'وریدی', 'IV INFUSION': 'سرم وریدی', 'SC': 'زیرجلدی',
      'IM': 'عضلانی', 'SL': 'زیرزبانی', 'PR': 'مقعدی', 'INH': 'استنشاقی'
    };

    // ─── Meds by class ───
    function renderMedGroups(groups) {
      if (!groups || !groups.length) return '<div class="kx2-empty">هیچ داروی فعالی نیست</div>';
      let h = '<div class="kx2-meds">';
      groups.forEach(g => {
        const meta = LABELS[g.class] || { icon: '💊', label: g.class };
        h += '<div class="kx2-class">';
        h += '<div class="kx2-class-h">' + meta.icon + ' ' + esc(meta.label) + ' <span style="color:#94a3b8;font-weight:400;">(' + g.entries.length + ')</span></div>';
        g.entries.forEach(e => {
          const o = e.order, d = o.details || {}, tl = e.timeline || {};
          const givenPct = tl.total > 0 ? Math.round((tl.givenToday / tl.total) * 100) : 0;
          const progressCls = givenPct >= 100 ? '' : givenPct >= 50 ? 'partial' : 'empty';
          const freq = (d.frequency || '').toUpperCase();
          const route = (d.route || '').toUpperCase();
          const freqFa = FREQ_MAP[freq] || freq || '';
          const routeFa = ROUTE_MAP[route] || route || '';
          const isPRN = freq.includes('PRN');
          const isHighAlert = e.classification && e.classification.isHighAlert;
          
          h += '<div class="kx2-med" style="flex-direction:column;align-items:stretch;gap:6px;">';
          h += '  <div style="display:flex;align-items:center;gap:8px;">';
          h += '    <span class="kx2-med-icon">' + (isHighAlert ? '⚠️' : '💊') + '</span>';
          h += '    <div style="flex:1;min-width:0;">';
          h += '      <div class="kx2-med-name">' + esc(d.drug || '?') + '</div>';
          h += '      <div class="kx2-med-dose" style="margin-top:2px;">' + esc(d.dose || '') + ' · ' + esc(routeFa) + ' · <span style="color:#1e40af;font-weight:700;">' + esc(freqFa) + '</span></div>';
          h += '    </div>';
          if (isHighAlert) h += '<span class="kx2-med-alert" style="background:#dc2626;color:#fff;padding:2px 6px;">HIGH ALERT</span>';
          h += '  </div>';
          
          h += '  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:2px;">';
          if (isPRN) {
              const todayPrn = (e.mar || []).filter(m => m.status === 'given').length;
              h += '<span style="font-size:11px;background:#e0e7ff;color:#3730a3;padding:2px 8px;border-radius:10px;font-weight:700;">' + todayPrn + ' دوز در ۲۴ ساعت اخیر</span>';
          } else {
              const recent = (e.mar || []).filter(m => m.status === 'given').slice(-3);
              const upcoming = (e.mar || []).filter(m => ['scheduled','due'].includes(m.status)).slice(0, 2);
              recent.forEach(m => { h += '<span style="font-size:11px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:10px;font-weight:700;" title="داده شده توسط ' + esc(m.administeredBy) + '">✅ ' + fmtT(m.administeredAt) + '</span>'; });
              upcoming.forEach(m => { h += '<span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:10px;font-weight:700;" title="دوز بعدی">⏰ ' + fmtT(m.scheduledAt) + '</span>'; });
              if (tl.overdueCount > 0) h += '<span style="font-size:11px;background:#fee2e2;color:#991b1b;padding:2px 8px;border-radius:10px;font-weight:700;">🔴 ' + tl.overdueCount + ' عقب‌افتاده</span>';
              if (tl.total > 0) h += '<span style="font-size:11px;color:#64748b;">(' + tl.givenToday + '/' + tl.total + ')</span>';
          }
          h += '  </div>';
          h += '</div>';
        });
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    // ─── Simple list ───
    function renderSimpleList(entries, type) {
      if (!entries || !entries.length) return '<div class="kx2-empty">موردی ثبت نشده</div>';
      const icons = { lab: '🧪', paraclinical: '📷', imaging: '📷', nursing: '🩹', consult: '🩺' };
      let h = '<div class="kx2-list">';
      entries.forEach(e => {
        const o = e.order || {}, d = o.details || {};
        const title = d.panel || d.modality || d.note || o.type;
        h += '<div class="kx2-row">';
        h += '<span class="kx2-row-icon">' + (icons[o.type] || '📋') + '</span>';
        h += '<div class="kx2-row-title">' + esc(title) + (d.bodyPart ? '<div class="kx2-row-sub">' + esc(d.bodyPart) + '</div>' : '') + '</div>';
        h += '<span class="kx2-row-status ' + esc(o.status) + '">' + esc(STATUS_FA[o.status] || o.status) + '</span>';
        if (e.actions && e.actions.length) {
          h += '<div class="kx2-row-actions">';
          e.actions.filter(a => a.allowed).forEach(a => {
            h += '<button data-k="order" data-i="' + esc(o.id) + '" data-a="' + esc(a.action) + '">' + esc(ACTIONS[a.action] || a.action) + '</button>';
          });
          h += '</div>';
        }
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    // ─── Consults ───
    function renderConsults(consults) {
      if (!consults || !consults.length) return '<div class="kx2-empty">مشاوره‌ای ثبت نشده</div>';
      let h = '<div class="kx2-list">';
      consults.forEach(c => {
        const co = c.consult;
        h += '<div class="kx2-row">';
        h += '<span class="kx2-row-icon">🩺</span>';
        h += '<div class="kx2-row-title">' + esc(co.targetService) + '<div class="kx2-row-sub">' + esc(co.question || '') + '</div></div>';
        h += '<span class="kx2-row-status ' + esc(co.status) + '">' + esc(STATUS_FA[co.status] || co.status) + '</span>';
        if (c.actions && c.actions.length) {
          h += '<div class="kx2-row-actions">';
          c.actions.filter(a => a.allowed).forEach(a => {
            h += '<button data-k="consult" data-i="' + esc(co.id) + '" data-a="' + esc(a.action) + '">' + esc(ACTIONS[a.action] || a.action) + '</button>';
          });
          h += '</div>';
        }
        h += '</div>';
      });
      h += '</div>';
      return h;
    }

    // ─── Alerts ───
    function renderAlerts(alerts) {
      if (!alerts || !alerts.length) return '<div class="kx2-empty">هیچ هشداری نیست</div>';
      let h = '';
      alerts.forEach(a => {
        const cls = a.severity === 'critical' ? 'critical' : a.severity === 'high' ? 'high' : '';
        const icon = a.severity === 'critical' ? '🚨' : a.severity === 'high' ? '⚠️' : 'ℹ️';
        h += '<div class="kx2-alert ' + cls + '">';
        h += '<div class="kx2-alert-t">' + icon + ' ' + esc(a.title || a.type) + '</div>';
        h += '<div class="kx2-alert-m">' + esc(a.message || '') + '</div>';
        if (a.recommendation) h += '<div class="kx2-alert-r">💡 ' + esc(a.recommendation) + '</div>';
        h += '</div>';
      });
      return h;
    }

    // ─── I&O ───
    function renderIo(io) {
      return '<div class="kx2-io">' +
        '<div class="kx2-io-c in"><div class="l">ورودی</div><div class="v">' + (io.intake || 0) + ' cc</div></div>' +
        '<div class="kx2-io-c out"><div class="l">خروجی</div><div class="v">' + (io.output || 0) + ' cc</div></div>' +
        '<div class="kx2-io-c bal ' + (io.balance < 0 ? 'neg' : '') + '"><div class="l">بالانس</div><div class="v">' + (io.balance >= 0 ? '+' : '') + (io.balance || 0) + ' cc</div></div>' +
        '</div>';
    }

    // ─── Collapsible section ───
    let _uid = 0;
    function section(id, icon, title, count, bodyHtml, opts) {
      opts = opts || {};
      const uid = 'sec_' + (++_uid);
      const countCls = opts.countCls || '';
      const open = opts.open ? 'open' : '';
      let h = '<section class="kx2-sec ' + open + '" id="' + uid + '">';
      h += '<header class="kx2-sec-h" data-sec="' + uid + '">';
      h += '<div class="kx2-sec-t">' + icon + ' ' + esc(title) + (count != null ? ' <span class="count ' + countCls + '">' + count + '</span>' : '') + '</div>';
      h += '<span class="kx2-chev">▶</span>';
      h += '</header>';
      h += '<div class="kx2-sec-b">' + bodyHtml + '</div>';
      h += '</section>';
      return h;
    }

    // ─── Main render ───
    function render(d) {
      let h = '';
      h += renderRibbon(d.patient);
      h += renderVitalsStrip(d.currentVitals, d.trends || {}, d.vitals || d._rawVitals || []);
      // UDES quick bar
      if (window.NABZ && typeof NABZ.udesQuickBar === 'function' && d && d.patient && d.patient.id) h += NABZ.udesQuickBar(d.patient.id);
      h += renderNews2Trend(d.vitals || d._rawVitals || []);
      h += renderUrgent(d.urgent);

      // Timeline (open)
      if (d.timeline && d.timeline.length) {
        h += section('timeline', '📅', 'برنامهٔ ۸ ساعت آینده', d.timeline.length, renderTimeline(d.timeline), { open: true });
      }

      // Meds by class (open)
      h += section('meds', '💊', 'داروهای فعال', (d.medGroups || []).reduce((s, g) => s + g.entries.length, 0), renderMedGroups(d.medGroups), { open: true });

      // Labs (collapsed)
      if (d.labs && d.labs.length) h += section('labs', '🧪', 'آزمایشات', d.labs.length, renderSimpleList(d.labs, 'lab'), {});
      // Imaging (collapsed)
      if (d.imaging && d.imaging.length) h += section('imaging', '📷', 'تصویربرداری', d.imaging.length, renderSimpleList(d.imaging, 'imaging'), {});
      // Nursing (collapsed)
      if (d.nursing && d.nursing.length) h += section('nursing', '🩹', 'اقدامات پرستاری', d.nursing.length, renderSimpleList(d.nursing, 'nursing'), {});
      // Consults (collapsed)
      if (d.consults && d.consults.length) h += section('consults', '🩺', 'مشاوره‌ها', d.consults.length, renderConsults(d.consults), {});
      // Alerts (open if critical)
      const critAlerts = (d.alerts || []).filter(a => a.severity === 'critical').length;
      if (d.alerts && d.alerts.length) h += section('alerts', '🚨', 'هشدارها', d.alerts.length, renderAlerts(d.alerts), { countCls: critAlerts ? 'danger' : '', open: critAlerts > 0 });
      // I&O (collapsed)
      if (d.ioSummary) h += section('io', '💧', 'I&O ۲۴h', null, renderIo(d.ioSummary), {});

      // Bottom bar
      h += '<div class="kx2-bottom">';
      h += '<button data-bottom="sbar"><span class="ico">📝</span>SBAR</button>';
      h += '<button data-bottom="refresh" class="primary"><span class="ico">🔄</span>به‌روزرسانی</button>';
      h += '<button data-bottom="print"><span class="ico">🖨️</span>چاپ</button>';
      h += '</div>';

      return h;
    }

    async function promptAction(action) {
      if (action === 'administer') {
        const w = await NABZ.dialog.form({ icon: '✍️', title: 'شاهد', fields: [{ key: 'v', label: 'شاهد (برای High-Alert اجباری)', required: true, type: 'text' }], submitLabel: 'تأیید' }).then(function(d) { return d && d.v; });
        const body = { fiveRights: { attested: true, at: new Date().toISOString() } };
        if (w) body.witnessId = w;
        const notes = await NABZ.dialog.form({ icon: '📝', title: 'توضیحات', fields: [{ key: 'v', label: 'توضیحات (اختیاری)', type: 'textarea' }], submitLabel: 'تأیید' }).then(function(d) { return d && d.v; });
        if (notes) body.notes = notes;
        return body;
      }
      if (action === 'respond') {
        const a = await NABZ.dialog.form({ icon: '💬', title: 'پاسخ مشاوره', fields: [{ key: 'v', label: 'پاسخ مشاوره', required: true, type: 'textarea' }], submitLabel: 'ارسال' }).then(function(d) { return d && d.v; }); if (!a) return null;
        return { answer: a };
      }
      if (['cancel','discontinue','refuse','miss','hold'].includes(action)) {
        const r = await NABZ.dialog.form({ icon: '📝', title: 'دلیل', fields: [{ key: 'v', label: 'دلیل', required: true, type: 'textarea' }], submitLabel: 'تأیید' }).then(function(d) { return d && d.v; }); if (!r) return null;
        return { reason: r };
      }
      return {};
    }

    function bind(el, d, pid) {
      // Section toggles
      el.querySelectorAll('.kx2-sec-h').forEach(h => {
        h.onclick = () => {
          const sec = document.getElementById(h.dataset.sec);
          if (sec) sec.classList.toggle('open');
        };
      });
      // Action buttons
      el.querySelectorAll('[data-k][data-i][data-a]').forEach(btn => {
        btn.onclick = async (e) => {
          e.preventDefault(); e.stopPropagation();
          const kind = btn.dataset.k, id = btn.dataset.i, action = btn.dataset.a;
          const body = await promptAction(action);
          if (body === null) return;
          const orig = btn.textContent;
          btn.disabled = true; btn.textContent = '...';
          try { await doAction(kind, id, action, body); await load(pid, el); }
          catch (err) { alert('خطا: ' + err.message); btn.disabled = false; btn.textContent = orig; }
        };
      });
      // Bottom bar
      el.querySelectorAll('[data-bottom]').forEach(btn => {
        btn.onclick = () => {
          const t = btn.dataset.bottom;
          if (t === 'refresh') load(pid, el);
          else if (t === 'print') window.print();
          else if (t === 'sbar' && window.NABZ && NABZ.show) {
            try { NABZ.show('handover_print', { patientId: pid }); }
            catch (_) { window.open('/kind/handover_print?patientId=' + encodeURIComponent(pid), '_blank'); }
          }
        };
      });
    }

    async function load(pid, el) {
      el.innerHTML = '<div class="kx2-loading">در حال بارگذاری کاردکس...</div>';
      try {
        // Try V2 first, fallback to V1
        let d;
        try {
          d = await fetchKardex(pid);
        } catch (e) {
          el.innerHTML = '<div class="kx2-error">خطا: ' + esc(e.message) + '</div>';
          return;
        }
        // If server returned V1 (no medGroups), compute client-side won't work — just use what we have
        if (!d.medGroups) {
          // Simple fallback: build basic medGroups from buckets
          const groups = [];
          ['oral','injectable','fluids','prn','topical','inhaled'].forEach(bk => {
            if (d[bk] && d[bk].length) groups.push({ class: bk, entries: d[bk] });
          });
          d.medGroups = groups;
          d.trends = {};
          d.urgent = [];
          d.timeline = [];
        }
        el.innerHTML = render(d);
        bind(el, d, pid);
      } catch (e) {
        el.innerHTML = '<div class="kx2-error">خطا: ' + esc(e.message) + '</div>';
      }
    }

    function show(panel, data) {
      const pid = (data && data.patientId) || (panel && panel.patientId) || new URLSearchParams(location.search).get('patientId');
      const el = document.createElement('div');
      el.className = 'kx2';
      const mount = document.getElementById('content') || document.querySelector('main');
      if (mount) { mount.innerHTML = ''; mount.appendChild(el); }
      if (!pid) { el.innerHTML = '<div class="kx2-empty">بیمار انتخاب نشده</div>'; return el; }
      load(pid, el);
      return el;
    }

    NABZ.registerKind('kardex', show);

    // (autoRoute removed in v16 — URL handled by app.js boot)
    console.log('[kardex_ui] v2 cockpit registered');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // Bridge: kardex to nursing workspace
  window.NABZ = window.NABZ || {};
  window.NABZ._kxFindActiveVisit = async function(patientId, patientName) {
    var token = localStorage.getItem('nabz_tk') || '';
    var h = token ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token } : { 'Content-Type': 'application/json' };
    var r = await fetch('/api/emergency/visits', { headers: h }).then(function(x) { return x.json(); });
    var list = (r && r.data && r.data.visits) || (r && r.visits) || (Array.isArray(r) ? r : []);
    var TERM = ['closed','discharged','departed','transferred','lwbs','absconded'];
    var active = list.filter(function(v) { return TERM.indexOf(v.status) === -1; });
    var found = active.find(function(x) { return x.patientId === patientId || x.id === patientId; });
    if (!found && patientName) found = active.find(function(x) { return x.name && String(x.name).trim() === String(patientName).trim(); });
    return found || null;
  };
  window.NABZ._kxOpenNursingForPatient = async function(patientId, opts) {
    opts = opts || {};
    try {
      var v = await window.NABZ._kxFindActiveVisit(patientId, opts.patientName);
      if (!v) { if (confirm("ویزیت فعال اورژانس برای این بیمار نیست. ویزیت جدید بسازیم؟")) { window.NABZ._triRegisterNewPatient && window.NABZ._triRegisterNewPatient(); } return; }
      if (window.NABZ_NAV) window.NABZ_NAV.go('ed/nursing/v', { visitId: v.id });
      else if (window.NABZ && window.NABZ.show) window.NABZ.show('ed_nursing');
    } catch (e) { console.error("[kx]", e); alert("خطا: " + (e.message || e)); }
  };
  window.NABZ._kxOpenVitalsForPatient = async function(patientId, opts) {
    opts = opts || {};
    try {
      var v = await window.NABZ._kxFindActiveVisit(patientId, opts.patientName);
      if (!v) { alert('ویزیت فعال نیست'); return; }
      if (window.NABZ_NAV) window.NABZ_NAV.go('ed/physician/v', { visitId: v.id });
      setTimeout(function() { if (window.NABZ._phVitals) window.NABZ._phVitals(); }, 600);
    } catch (e) { alert("خطا: " + (e.message || e)); }
  };
  (function rebindKardexTabs() {
    function fix() {
      document.querySelectorAll('button').forEach(function(b) {
        if (b.getAttribute('data-kx-rebound')) return;
        var t = (b.textContent || '').trim();
        if (t.indexOf('MAR') >= 0 && t.indexOf('تعاملی') >= 0) {
          b.setAttribute('onclick', 'NABZ._kxOpenNursingForPatient(window.__kx_patientId, {patientName: window.__kx_patientName})');
          b.setAttribute('data-kx-rebound', '1');
        } else if ((t.indexOf('علائم حیاتی') >= 0 || t.indexOf('ویتال') >= 0) && t.indexOf('تعاملی') >= 0) {
          b.setAttribute('onclick', 'NABZ._kxOpenVitalsForPatient(window.__kx_patientId, {patientName: window.__kx_patientName})');
          b.setAttribute('data-kx-rebound', '1');
        } else if (t.indexOf('مراقبت پرستاری') >= 0 || t.indexOf('برنامه مراقبت') >= 0) {
          b.setAttribute('onclick', 'NABZ._kxOpenNursingForPatient(window.__kx_patientId, {patientName: window.__kx_patientName})');
          b.setAttribute('data-kx-rebound', '1');
        }
      });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fix);
    else setTimeout(fix, 500);
    setInterval(fix, 3000);
  })();

  // ═══════════════════════════════════════════════════════════════
  // _kx_bridge2_installed — Kardex bridge to workspaces
  // ═══════════════════════════════════════════════════════════════
  window.NABZ = window.NABZ || {};

  window.NABZ._kxGetCurrentPatient = function() {
    try {
      var u = new URL(window.location.href);
      var pid = u.searchParams.get('patientId') || u.searchParams.get('id');
      if (pid && pid !== 'undefined' && pid !== 'null') return pid;
    } catch (_) {}
    if (window.__kx_patientId) return window.__kx_patientId;
    if (window.KX && window.KX.patientId) return window.KX.patientId;
    if (window.KX_STATE && window.KX_STATE.patientId) return window.KX_STATE.patientId;
    return null;
  };

  window.NABZ._kxFindActiveVisit = async function(pid, patientName) {
    if (!pid && !patientName) return null;
    try {
      var tk = localStorage.getItem('nabz_tk') || '';
      var h = { 'Content-Type': 'application/json' };
      if (tk) h.Authorization = 'Bearer ' + tk;
      var r = await fetch('/api/emergency/visits', { headers: h }).then(function(x) { return x.json(); });
      var list = (r && r.data && r.data.visits) || (r && r.visits) || (Array.isArray(r) ? r : []);
      var TERM = ['closed','discharged','departed','transferred','lwbs','absconded','deceased'];
      var active = list.filter(function(v) { return v && TERM.indexOf(v.status) === -1; });
      var found = null;
      if (pid) found = active.find(function(v) { return v.patientId === pid || v.id === pid; });
      if (!found && patientName) found = active.find(function(v) { return v.name && String(v.name).trim() === String(patientName).trim(); });
      return found || null;
    } catch (e) {
      console.warn('[kx-bridge] findActiveVisit:', e && e.message);
      return null;
    }
  };

  window.NABZ._kxGoWorkspace = async function(kind) {
    var pid = window.NABZ._kxGetCurrentPatient();
    var name = window.__kx_patientName || (window.KX && window.KX.patientName) || '';
    if (!pid && !name) { alert('شناسه بیمار یافت نشد'); return; }
    var v = await window.NABZ._kxFindActiveVisit(pid, name);
    if (!v) {
      if (confirm('این بیمار ویزیت فعال اورژانس ندارد. ویزیت جدید ثبت کنیم؟')) {
        if (window.NABZ._triRegisterNewPatient) window.NABZ._triRegisterNewPatient();
      }
      return;
    }
    var routes = { sbar: 'ed/sbar/v', discharge: 'ed/discharge/v', careplan: 'ed/careplan/v', nursing: 'ed/nursing/v', physician: 'ed/physician/v' };
    var route = routes[kind];
    if (!route) { alert('نوع نامعتبر'); return; }
    try {
      if (window.NABZ_NAV) window.NABZ_NAV.go(route, { visitId: v.id });
      else window.location.hash = '#/' + route + '/' + encodeURIComponent(v.id);
    } catch (e) { alert('خطا: ' + (e.message || e)); }
  };

  window.NABZ._kxOpenSbar      = function() { return window.NABZ._kxGoWorkspace('sbar'); };
  window.NABZ._kxOpenDischarge = function() { return window.NABZ._kxGoWorkspace('discharge'); };
  window.NABZ._kxOpenCarePlan  = function() { return window.NABZ._kxGoWorkspace('careplan'); };
  window.NABZ._kxOpenNursing   = function() { return window.NABZ._kxGoWorkspace('nursing'); };
  window.NABZ._kxOpenPhysician = function() { return window.NABZ._kxGoWorkspace('physician'); };

  window.NABZ._kxSetPatient = function(pid, name) {
    window.__kx_patientId = pid;
    window.__kx_patientName = name || '';
  };

})();
