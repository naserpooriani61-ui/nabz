
// ═══════════════════════════════════════════════════════════
//  NABZ — Order Sets Intelligence UI
//  Wraps encounters-ui to inject:
//    1. Recommendations on top
//    2. Pre-apply safety modal
//    3. Time-critical badges
//    4. Post-apply pathway suggestion
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  var INT = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(el) { el.remove(); }); },
    _openSheet: function(html, opts) {
      opts = opts || {};
      var s = document.createElement('div');
      s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s && !opts.noClose) s.remove(); };
      var c = document.createElement('div');
      c.className = 'bs-sheet';
      c.style.maxHeight = '96vh';
      c.innerHTML = html;
      s.appendChild(c);
      document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return { sheet: s, content: c };
    },

    // ═══════════════════════════════════════════════════
    //  INTELLIGENT PICKER
    // ═══════════════════════════════════════════════════
    async showIntelligentPicker(patientId) {
      try {
        NABZ._toast('در حال تحلیل بیمار...');
        var intel = await this._api('/api/intel/order-sets/' + patientId);
        var catalog = await this._api('/api/enc/ordersets');
        this._renderPicker(patientId, intel, catalog);
      } catch (e) {
        alert('خطا: ' + e.message);
      }
    },

    _renderPicker: function(patientId, intel, catalog) {
      var p = intel.patient;
      var recs = intel.recommendations || [];
      var all = (catalog.items || []).sort(function(a, b) {
        return (a.category || '').localeCompare(b.category || '') || a.name.localeCompare(b.name);
      });

      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">💊 بسته‌های درمانی هوشمند</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Patient context
      h += '<div class="card" style="background:linear-gradient(135deg,rgba(6,182,212,.1),rgba(139,92,246,.05));margin-bottom:12px">';
      h += '<div style="font-weight:900;font-size:14px">' + this._esc(p.name) + '</div>';
      h += '<div style="font-size:11.5px;color:var(--fg-2);margin-top:2px">';
      h += (p.age || '—') + ' سال';
      if (p.diagnosis) h += ' · ' + this._esc(p.diagnosis);
      h += '</div>';
      if (p.allergies && p.allergies.length) {
        h += '<div style="font-size:11px;color:var(--dng);margin-top:4px;font-weight:800">⚠️ آلرژی: ' + this._esc(p.allergies.join('، ')) + '</div>';
      }
      if (intel.lastVital) {
        var v = intel.lastVital;
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:4px">';
        h += 'HR ' + (v.hr || '—') + ' · SBP ' + (v.bp_sys || '—') + ' · SpO₂ ' + (v.spo2 || '—') + '% · T ' + (v.temp || '—') + '° · NEWS2 ' + (v.news2 || '—');
        h += '</div>';
      }
      h += '</div>';

      // Recommendations section
      if (recs.length > 0) {
        h += '<div style="font-size:11.5px;font-weight:900;color:var(--primary);margin:12px 0 6px;padding:4px 8px;background:var(--primary-soft);border-radius:6px">🎯 پیشنهاد برای این بیمار (' + recs.length + ')</div>';
        recs.forEach(function(r) {
          h += INT._renderRecommendationCard(patientId, r);
        });
      } else {
        h += '<div class="hint info" style="margin:12px 0">هیچ پیشنهاد خاصی یافت نشد — کل کاتالوگ را ببینید</div>';
      }

      // Full catalog with search + filter
      h += '<div style="font-size:11.5px;font-weight:900;color:var(--fg-2);margin:16px 0 6px;padding:4px 8px;background:var(--bg-3);border-radius:6px">📚 کل کاتالوگ (' + all.length + ')</div>';

      // Search input
      h += '<input id="osSearch" type="search" placeholder="🔍 جستجو بسته..." oninput="NABZ.osIntel._filterCatalog(this.value)" style="width:100%;padding:8px 12px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:8px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:12px">';

      // Category chips
      var cats = {};
      all.forEach(function(s) { cats[s.category] = (cats[s.category] || 0) + 1; });
      var CAT_FA = {
        cardiac:'قلب', respiratory:'ریه', renal:'کلیه', infection:'عفونت',
        hematology:'خون', endocrine:'غدد', neuro:'اعصاب', critical:'بحرانی',
        emergency:'اورژانس', gastro:'گوارش', toxicology:'سم‌شناسی', psychiatric:'روان'
      };
      h += '<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px">';
      h += '<button class="os-cat-btn" data-cat="" style="padding:4px 10px;font-size:10.5px;border-radius:14px;border:1px solid var(--primary);background:var(--primary);color:#fff;cursor:pointer;font-family:inherit;font-weight:800" onclick="NABZ.osIntel._filterCat(\'\')">همه</button>';
      Object.keys(cats).sort().forEach(function(c) {
        h += '<button class="os-cat-btn" data-cat="' + c + '" style="padding:4px 10px;font-size:10.5px;border-radius:14px;border:1px solid var(--border-2);background:transparent;color:var(--fg-2);cursor:pointer;font-family:inherit;font-weight:700" onclick="NABZ.osIntel._filterCat(\'' + c + '\')">' + (CAT_FA[c] || c) + ' (' + cats[c] + ')</button>';
      });
      h += '</div>';

      // Catalog grid
      h += '<div id="osCatalogGrid" style="max-height:45vh;overflow-y:auto;padding-right:4px">';
      var byCat = {};
      all.forEach(function(s) {
        if (!byCat[s.category]) byCat[s.category] = [];
        byCat[s.category].push(s);
      });
      Object.keys(byCat).forEach(function(cat) {
        h += '<div class="os-cat-group" data-cat="' + cat + '" style="margin-bottom:8px">';
        h += '<div style="font-size:10px;color:var(--fg-3);font-weight:800;margin-bottom:4px">' + (CAT_FA[cat] || cat) + '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">';
        byCat[cat].forEach(function(s) {
          h += INT._renderCatalogItem(patientId, s);
        });
        h += '</div></div>';
      });
      h += '</div>';

      this._openSheet(h);
    },

    _renderRecommendationCard: function(patientId, r) {
      var timeBadge = r.timeCritical
        ? '<span style="background:var(--dng);color:#fff;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:900;margin-left:4px">⏱ ' + r.timeCriticalMinutes + 'د</span>'
        : '';
      var appliedBadge = r.alreadyApplied > 0
        ? '<span style="background:var(--warn-soft);color:var(--warn);padding:2px 8px;border-radius:10px;font-size:9px;font-weight:900;margin-left:4px">⚠️ ' + r.alreadyApplied + ' فعال</span>'
        : '';

      var reasonChips = '';
      if (r.reasons && r.reasons.length) {
        reasonChips = '<div style="font-size:10px;color:var(--ok);margin-top:4px">✓ ' + r.reasons.join(' · ') + '</div>';
      }
      var flagChips = '';
      if (r.flags && r.flags.length) {
        r.flags.forEach(function(f) {
          var cls = f.severity === 'critical' ? 'dng' : f.type === 'time_critical' ? 'info' : 'warn';
          flagChips += '<span class="pill ' + cls + '" style="font-size:9px;margin-left:2px">' + INT._esc(f.message) + '</span>';
        });
      }

      var h = '<div class="card" style="padding:10px;margin-bottom:6px;border-color:var(--primary);cursor:pointer" onclick="NABZ.osIntel.preApply(\'' + r.id + '\',\'' + patientId + '\')">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">';
      h += '<div style="flex:1;min-width:0">';
      h += '<div style="font-size:12.5px;font-weight:900">' + (r.icon || '💊') + ' ' + this._esc(r.name) + timeBadge + appliedBadge + '</div>';
      h += reasonChips;
      if (flagChips) h += '<div style="margin-top:4px">' + flagChips + '</div>';
      if (r.source) h += '<div style="font-size:9.5px;color:var(--fg-3);margin-top:2px;font-family:monospace">📖 ' + this._esc(r.source) + '</div>';
      h += '</div>';
      h += '<div style="text-align:left"><div style="font-size:16px;font-weight:900;color:var(--primary)">' + r.score + '</div>';
      h += '<div style="font-size:8.5px;color:var(--fg-3)">score</div></div>';
      h += '</div></div>';
      return h;
    },

    _renderCatalogItem: function(patientId, s) {
      var timeBadge = s.timeCritical
        ? '<span style="color:var(--dng);font-size:9px;font-weight:900">⏱ ' + s.timeCriticalMinutes + 'د</span>'
        : '';
      var h = '<button class="os-catalog-btn" data-search="' + (s.name + ' ' + (s.description || '') + ' ' + (s.category || '') + ' ' + s.id).toLowerCase() + '" style="padding:8px;background:var(--bg-2);border:1px solid var(--border);border-radius:8px;font-family:inherit;color:var(--fg);cursor:pointer;text-align:right;font-size:11px" onclick="NABZ.osIntel.preApply(\'' + s.id + '\',\'' + patientId + '\')">';
      h += '<div style="font-weight:800;line-height:1.3">' + (s.icon || '💊') + ' ' + this._esc(s.name) + '</div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px">';
      h += '<span style="font-size:9px;color:var(--fg-3)">' + (s.meds || []).length + ' دارو</span>';
      h += timeBadge;
      h += '</div></button>';
      return h;
    },

    _filterCatalog: function(q) {
      q = String(q || '').toLowerCase().trim();
      document.querySelectorAll('.os-catalog-btn').forEach(function(btn) {
        btn.style.display = !q || btn.dataset.search.includes(q) ? '' : 'none';
      });
      document.querySelectorAll('.os-cat-group').forEach(function(g) {
        var any = Array.from(g.querySelectorAll('.os-catalog-btn')).some(function(b) { return b.style.display !== 'none'; });
        g.style.display = any ? '' : 'none';
      });
    },

    _filterCat: function(cat) {
      document.querySelectorAll('.os-cat-btn').forEach(function(b) {
        var active = b.dataset.cat === cat;
        b.style.background = active ? 'var(--primary)' : 'transparent';
        b.style.color = active ? '#fff' : 'var(--fg-2)';
        b.style.borderColor = active ? 'var(--primary)' : 'var(--border-2)';
      });
      document.querySelectorAll('.os-cat-group').forEach(function(g) {
        g.style.display = !cat || g.dataset.cat === cat ? '' : 'none';
      });
    },

    // ═══════════════════════════════════════════════════
    //  PRE-APPLY SAFETY MODAL
    // ═══════════════════════════════════════════════════
    async preApply(setId, patientId) {
      this._closeAll();
      try {
        NABZ._toast('در حال بررسی ایمنی...');
        var check = await this._api('/api/intel/order-sets/' + setId + '/' + patientId);
        this._renderSafetyModal(check);
      } catch (e) {
        alert('خطا: ' + e.message);
      }
    },

    _renderSafetyModal: function(chk) {
      var s = chk.set;
      var p = chk.patient;

      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">' + (s.icon || '💊') + ' ' + this._esc(s.name) + '</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      // Patient header
      h += '<div class="card" style="background:var(--bg-2);margin-bottom:10px;padding:10px">';
      h += '<div style="font-weight:900;font-size:13px">' + this._esc(p.name) + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2)">' + (p.age || '—') + ' سال';
      if (p.diagnosis) h += ' · ' + this._esc(p.diagnosis);
      h += '</div>';
      if (p.allergies && p.allergies.length) {
        h += '<div style="font-size:11px;color:var(--dng);margin-top:4px;font-weight:800">⚠️ آلرژی: ' + this._esc(p.allergies.join('، ')) + '</div>';
      }
      h += '</div>';

      // Time-critical banner
      if (s.timeCritical) {
        h += '<div style="background:var(--dng);color:#fff;padding:12px;border-radius:8px;margin-bottom:10px;text-align:center">';
        h += '<div style="font-size:22px">⏱</div>';
        h += '<div style="font-weight:900;font-size:14px">بسته حیاتی</div>';
        h += '<div style="font-size:12px">باید ظرف ' + s.timeCriticalMinutes + ' دقیقه اعمال شود</div>';
        h += '</div>';
      }

      // Critical conflicts (blockers)
      if (chk.conflicts.length > 0) {
        h += '<div style="background:var(--dng-soft);border:2px solid var(--dng);border-radius:8px;padding:12px;margin-bottom:10px">';
        h += '<div style="font-weight:900;color:var(--dng);margin-bottom:6px">🚨 تداخل بحرانی (' + chk.conflicts.length + ')</div>';
        chk.conflicts.forEach(function(c) {
          h += '<div style="padding:6px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
          h += '<div style="font-weight:800">' + this._esc(c.message) + '</div>';
          h += '</div>';
        }, this);
        h += '</div>';
      }

      // Duplicates
      if (chk.duplicates.length > 0) {
        h += '<div style="background:var(--warn-soft);border:1px solid var(--warn);border-radius:8px;padding:10px;margin-bottom:10px">';
        h += '<div style="font-weight:900;color:var(--warn);font-size:12px;margin-bottom:4px">⚠️ دستورات تکراری (' + chk.duplicates.length + ')</div>';
        chk.duplicates.forEach(function(d) {
          h += '<div style="font-size:11px;padding:2px 0">• ' + this._esc(d.message) + '</div>';
        }, this);
        h += '</div>';
      }

      // Warnings
      if (chk.warnings.length > 0) {
        h += '<div style="background:var(--warn-soft);border:1px solid var(--warn);border-radius:8px;padding:10px;margin-bottom:10px">';
        h += '<div style="font-weight:900;color:var(--warn);font-size:12px;margin-bottom:4px">⚠️ هشدارها (' + chk.warnings.length + ')</div>';
        chk.warnings.forEach(function(w) {
          h += '<div style="font-size:11px;padding:2px 0">• ' + this._esc(w.message) + '</div>';
        }, this);
        h += '</div>';
      }

      // Summary of what will be created
      h += '<div class="card" style="background:var(--primary-soft);border-color:var(--primary);padding:10px;margin-bottom:10px">';
      h += '<div style="font-size:11px;font-weight:900;color:var(--primary);margin-bottom:6px">📦 این بسته ایجاد می‌کند:</div>';
      h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:11px">';
      if (s.totalMeds > 0) h += '<div>💊 ' + s.totalMeds + ' دارو</div>';
      if (s.totalLabs > 0) h += '<div>🧪 ' + s.totalLabs + ' آزمایش</div>';
      if (s.totalImaging > 0) h += '<div>🩻 ' + s.totalImaging + ' تصویر</div>';
      h += '</div>';
      if (s.source) h += '<div style="font-size:10px;color:var(--fg-3);margin-top:6px;font-family:monospace">📖 ' + this._esc(s.source) + '</div>';
      h += '</div>';

      // Action buttons
      h += '<div style="display:flex;gap:6px;margin-bottom:20px">';
      if (!chk.safeToApply) {
        h += '<button class="btn btn-block" style="padding:14px;background:var(--dng);color:#fff;border:none;font-weight:900;opacity:0.6;cursor:not-allowed" disabled>🚫 به دلیل تداخل، غیرفعال</button>';
        h += '<button class="btn btn-block" style="padding:14px;color:var(--dng);border:2px solid var(--dng);margin-top:6px" onclick="NABZ.osIntel._forceApply(\'' + s.id + '\',\'' + p.id + '\')">⚠️ اعمال اجباری (مسئولیت پزشک)</button>';
      } else {
        h += '<button class="btn btn-primary" style="flex:2;padding:14px;font-weight:900" onclick="NABZ.osIntel._apply(\'' + s.id + '\',\'' + p.id + '\')">✅ اعمال بسته</button>';
        h += '<button class="btn" style="flex:1;padding:14px" onclick="this.closest(\'.bs-backdrop\').remove()">انصراف</button>';
      }
      h += '</div>';

      this._openSheet(h);
    },

    async _apply(setId, patientId) {
      try {
        this._closeAll();
        NABZ._toast('در حال اعمال بسته...');
        var r = await this._api('/api/enc/ordersets/' + setId + '/apply', {
          method: 'POST',
          body: JSON.stringify({ patientId: patientId })
        });
        this._showSuccess(setId, patientId, r);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _forceApply(setId, patientId) {
      if (!confirm('⚠️ شما در حال اعمال بسته‌ای هستید که تداخل بحرانی دارد.\n\nآیا مطمئنید؟')) return;
      await this._apply(setId, patientId);
    },

    async _showSuccess(setId, patientId, result) {
      try {
        var chk = await this._api('/api/intel/order-sets/' + setId + '/' + patientId);
        var pathway = chk.pathwayLink;

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">✅ اعمال شد</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="card" style="text-align:center;padding:16px;background:var(--ok-soft);border-color:var(--ok)">';
        h += '<div style="font-size:48px">✅</div>';
        h += '<div style="font-weight:900;font-size:15px;color:var(--ok);margin-top:4px">' + this._esc(result.orderSet || 'بسته') + '</div>';
        h += '<div style="font-size:12px;color:var(--fg-2);margin-top:4px">' + (result.total || 0) + ' دستور ایجاد شد</div>';
        h += '</div>';

        // Details
        h += '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-bottom:12px;font-size:11.5px">';
        var labels = { orders:'دارو', labs:'آزمایش', imaging:'تصویر', consults:'مشاوره', nursing:'پرستاری' };
        for (var k in result.created || {}) {
          if (result.created[k] > 0) {
            h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;text-align:center"><div style="font-weight:900;color:var(--primary);font-size:18px">' + result.created[k] + '</div><div style="font-size:10px;color:var(--fg-2)">' + (labels[k] || k) + '</div></div>';
          }
        }
        h += '</div>';

        // Pathway suggestion
        if (pathway) {
          h += '<div class="card" style="background:var(--warn-soft);border-color:var(--warn);margin-bottom:12px">';
          h += '<div style="font-weight:900;font-size:12.5px;color:var(--warn);margin-bottom:4px">🛤️ مسیر بالینی مرتبط</div>';
          h += '<div style="font-size:11.5px;color:var(--fg-2);margin-bottom:8px">این بسته با یک Pathway استاندارد همراه است — می‌توانید مسیر را شروع کنید تا milestones پایش شوند</div>';
          h += '<button class="btn btn-block" style="padding:10px;font-weight:900;background:var(--warn);color:#fff;border:none" onclick="NABZ.osIntel._startPathway(\'' + pathway + '\',\'' + patientId + '\')">🛤️ شروع مسیر ' + this._esc(pathway) + '</button>';
          h += '</div>';
        }

        h += '<button class="btn btn-block" style="padding:10px" onclick="this.closest(\'.bs-backdrop\').remove();if(NABZ.state.current)NABZ.show(NABZ.state.current)">بستن و بازخوانی</button>';

        this._openSheet(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    async _startPathway(pathwayId, patientId) {
      try {
        await this._api('/api/enc/pathways/' + pathwayId + '/start', {
          method: 'POST',
          body: JSON.stringify({ patientId: patientId })
        });
        NABZ._toast('✅ مسیر شروع شد');
        this._closeAll();
        if (NABZ.state.current) NABZ.show(NABZ.state.current);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && NABZ.enc && typeof NABZ.enc.showOrderSets === 'function') return fn();
    if (++waitCount >= 60) return console.warn('[os-intel] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.osIntel = INT;

    // ─── Replace showOrderSets with intelligent version ───
    var origShow = NABZ.enc.showOrderSets;
    NABZ.enc.showOrderSets = async function(patientId) {
      if (!patientId) {
        // No patient → fall back to original (picker first)
        return origShow.call(NABZ.enc, patientId);
      }
      return INT.showIntelligentPicker(patientId);
    };

    // ─── Replace _applyOrderSet to route through safety modal ───
    var origApply = NABZ.enc._applyOrderSet;
    NABZ.enc._applyOrderSet = async function(setId, patientId) {
      return INT.preApply(setId, patientId);
    };

    console.log('[os-intel] loaded — intelligent picker + safety modal');
  });
})();
