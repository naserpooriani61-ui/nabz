// ═══════════════════════════════════════════════════════════
//  NABZ — Education UI (LMS, exams, certificates, cases)
// ═══════════════════════════════════════════════════════════
(function() {
  'use strict';

  const CAT_FA = {
    general:'عمومی', clinical:'بالینی', infection_control:'کنترل عفونت',
    safety:'ایمنی بیمار', communication:'ارتباط', emergency:'اورژانس'
  };
  const TYPE_FA = { article:'مقاله', video:'ویدیو', pdf:'PDF', interactive:'تعاملی' };
  const Q_TYPE_FA = { mcq_single:'چندگزینه‌ای', mcq_multiple:'چندپاسخی', true_false:'صحیح/غلط', short_answer:'پاسخ کوتاه' };

  const EDU = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR', {month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_) { return '—'; } },
    _date: function(iso) { try { return new Date(iso).toLocaleDateString('fa-IR'); } catch(_) { return '—'; } },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
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
      return { sheet:s, content:c };
    },
    _timer: null,
    _clearTimer: function() { if (EDU._timer) { clearInterval(EDU._timer); EDU._timer = null; } },

    // ═══════════════════════════════════════════════════
    //  ARTICLE — Read learning object
    // ═══════════════════════════════════════════════════
    viewObject: async function(id) {
      try {
        var d = await EDU._api('/api/edu/objects');
        var obj = (d.items || []).find(function(x) { return x.id === id; });
        if (!obj) return alert('مقاله یافت نشد');

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📖 ' + EDU._esc(obj.title) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">';
        h += '<span class="pill info">' + (CAT_FA[obj.category] || obj.category) + '</span>';
        h += '<span class="pill">' + (TYPE_FA[obj.type] || obj.type) + '</span>';
        if (obj.status === 'published') h += '<span class="pill ok">منتشرشده</span>';
        h += '</div>';
        h += '<div class="edu-article-body">';
        h += EDU._esc(obj.body || 'متن مقاله').replace(/\n/g, '<br>');
        h += '</div>';
        h += '<div style="font-size:11px;color:var(--fg-2);margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
        h += 'نویسنده: ' + EDU._esc(obj.createdByName || '—') + ' · ' + EDU._date(obj.createdAt);
        h += '</div>';
        h += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">✅ خواندم</button>';
        h += '</div>';
        EDU._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  EXAM — Start attempt
    // ═══════════════════════════════════════════════════
    startExam: async function(examId) {
      try {
        var r = await EDU._api('/api/edu/exams/' + examId + '/start', {
          method:'POST', body: '{}'
        });
        NABZ._toast('📝 آزمون شروع شد');
        EDU._attempt = r;
        EDU._answers = {};
        EDU._openExam(0);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    _openExam: function(idx) {
      var a = EDU._attempt;
      if (!a || !a.questions || !a.questions.length) return alert('سوالی وجود ندارد');
      if (idx < 0) idx = 0;
      if (idx >= a.questions.length) idx = a.questions.length - 1;
      EDU._examIdx = idx;

      var q = a.questions[idx];
      var total = a.questions.length;
      var answered = Object.keys(EDU._answers).length;

      // Header
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">📝 ' + EDU._esc(a.examTitle) + '</div>';
      h += '<button class="bs-close" onclick="if(confirm(\'خروج از آزمون؟ پاسخ‌های شما از دست می‌روند.\')){this.closest(\'.bs-backdrop\').remove();NABZ.edu._clearTimer()}">✕</button></div>';

      // Timer bar
      h += '<div class="edu-exam-bar">';
      h += '<div class="edu-exam-progress">';
      h += '<div class="edu-exam-progress-fill" style="width:' + Math.round(answered/total*100) + '%"></div>';
      h += '</div>';
      h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px;font-size:12px;font-weight:800">';
      h += '<span>' + (idx+1) + ' از ' + total + '</span>';
      h += '<span id="eduExamTimer" class="edu-timer">--:--</span>';
      h += '<span>' + answered + '/' + total + ' پاسخ</span>';
      h += '</div>';
      h += '</div>';

      // Question
      h += '<div class="edu-question-card">';
      h += '<div class="edu-q-head">';
      h += '<span class="pill info">سوال ' + (idx+1) + '</span>';
      h += '<span class="pill">' + (Q_TYPE_FA[q.type] || q.type) + '</span>';
      h += '<span class="pill">' + (q.points || 1) + ' امتیاز</span>';
      h += '</div>';
      h += '<div class="edu-q-stem">' + EDU._esc(q.stem) + '</div>';

      // Options
      var currentAns = EDU._answers[q.id];
      if (q.type === 'mcq_single' || q.type === 'true_false') {
        (q.options || []).forEach(function(opt, oi) {
          var checked = currentAns === opt;
          h += '<label class="edu-option ' + (checked ? 'selected' : '') + '">';
          h += '<input type="radio" name="q_' + q.id + '" value="' + EDU._esc(opt) + '" ' + (checked ? 'checked' : '') + ' onchange="NABZ.edu._saveAnswer(\'' + q.id + '\', this.value, this)">';
          h += '<span>' + EDU._esc(opt) + '</span>';
          h += '</label>';
        });
      } else if (q.type === 'mcq_multiple') {
        var arr = Array.isArray(currentAns) ? currentAns : [];
        (q.options || []).forEach(function(opt) {
          var checked = arr.indexOf(opt) >= 0;
          h += '<label class="edu-option ' + (checked ? 'selected' : '') + '">';
          h += '<input type="checkbox" value="' + EDU._esc(opt) + '" ' + (checked ? 'checked' : '') + ' onchange="NABZ.edu._toggleMulti(\'' + q.id + '\', this.value, this)">';
          h += '<span>' + EDU._esc(opt) + '</span>';
          h += '</label>';
        });
      } else if (q.type === 'short_answer') {
        h += '<textarea class="edu-short-input" rows="3" placeholder="پاسخ خود را بنویسید..." onchange="NABZ.edu._saveAnswer(\'' + q.id + '\', this.value, null)">' + EDU._esc(currentAns || '') + '</textarea>';
      }
      h += '</div>';

      // Nav
      h += '<div class="edu-exam-nav">';
      if (idx > 0) h += '<button class="btn" style="flex:1;padding:12px" onclick="NABZ.edu._closeAll();NABZ.edu._openExam(' + (idx-1) + ')">← قبلی</button>';
      else h += '<button class="btn" style="flex:1;padding:12px" disabled style="opacity:0.4">← قبلی</button>';
      if (idx < total - 1) h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.edu._closeAll();NABZ.edu._openExam(' + (idx+1) + ')">بعدی →</button>';
      else h += '<button class="btn btn-ok" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.edu._confirmSubmit()">✅ پایان و ثبت</button>';
      h += '</div>';

      // Question grid (bottom)
      h += '<div class="edu-q-grid">';
      for (var i = 0; i < total; i++) {
        var qq = a.questions[i];
        var isAnswered = EDU._answers[qq.id] !== undefined;
        var isCurrent = i === idx;
        var cls = isCurrent ? 'current' : isAnswered ? 'answered' : '';
        h += '<button class="edu-q-dot ' + cls + '" onclick="NABZ.edu._closeAll();NABZ.edu._openExam(' + i + ')">' + (i+1) + '</button>';
      }
      h += '</div>';

      h += '<button class="btn btn-dng btn-block" style="margin-top:12px;margin-bottom:20px;padding:10px;font-size:12px" onclick="NABZ.edu._confirmSubmit()">📤 ثبت نهایی</button>';

      EDU._clearTimer();
      EDU._openSheet(h, { noClose: true });

      // Start timer
      var endAt = new Date(a.endsAt).getTime();
      var tick = function() {
        var el = document.getElementById('eduExamTimer');
        if (!el) { EDU._clearTimer(); return; }
        var remain = Math.floor((endAt - Date.now()) / 1000);
        if (remain <= 0) {
          EDU._clearTimer();
          el.textContent = '⏰ پایان';
          el.style.color = 'var(--dng)';
          setTimeout(function() { EDU._submitAttempt(true); }, 500);
          return;
        }
        var mm = Math.floor(remain / 60);
        var ss = remain % 60;
        el.textContent = String(mm).padStart(2,'0') + ':' + String(ss).padStart(2,'0');
        el.style.color = remain < 60 ? 'var(--dng)' : remain < 300 ? 'var(--warn)' : 'var(--fg)';
      };
      tick();
      EDU._timer = setInterval(tick, 1000);
    },

    _saveAnswer: function(qid, value, el) {
      if (value === '' || value == null) delete EDU._answers[qid];
      else EDU._answers[qid] = value;
      // Refresh dots if present
      var dots = document.querySelectorAll('.edu-q-dot');
      if (dots.length && EDU._attempt) {
        EDU._attempt.questions.forEach(function(q, i) {
          var answered = EDU._answers[q.id] !== undefined;
          var dot = dots[i];
          if (dot) {
            dot.classList.toggle('answered', answered && !dot.classList.contains('current'));
          }
        });
        var bar = document.querySelector('.edu-exam-progress-fill');
        if (bar) bar.style.width = Math.round(Object.keys(EDU._answers).length / EDU._attempt.questions.length * 100) + '%';
      }
      // Visual feedback
      if (el && el.parentElement) {
        var siblings = el.parentElement.parentElement.querySelectorAll('.edu-option');
        siblings.forEach(function(s) { s.classList.remove('selected'); });
        el.parentElement.classList.add('selected');
      }
    },

    _toggleMulti: function(qid, value, el) {
      var arr = EDU._answers[qid] || [];
      if (!Array.isArray(arr)) arr = [];
      var idx = arr.indexOf(value);
      if (el.checked) { if (idx < 0) arr.push(value); }
      else { if (idx >= 0) arr.splice(idx, 1); }
      if (arr.length) EDU._answers[qid] = arr;
      else delete EDU._answers[qid];
      if (el && el.parentElement) el.parentElement.classList.toggle('selected', el.checked);
      var bar = document.querySelector('.edu-exam-progress-fill');
      if (bar && EDU._attempt) bar.style.width = Math.round(Object.keys(EDU._answers).length / EDU._attempt.questions.length * 100) + '%';
    },

    _confirmSubmit: function() {
      var a = EDU._attempt;
      if (!a) return;
      var unanswered = a.questions.length - Object.keys(EDU._answers).length;
      var msg = unanswered > 0 ? '⚠️ ' + unanswered + ' سوال بی‌پاسخ!\n\n' : '';
      msg += 'ثبت نهایی؟ پس از ثبت، قابل تغییر نیست.';
      if (!confirm(msg)) return;
      EDU._submitAttempt(false);
    },

    _submitAttempt: async function(auto) {
      EDU._clearTimer();
      var a = EDU._attempt;
      if (!a) return;
      if (auto) alert('⏰ زمان آزمون تمام شد — ثبت خودکار');
      try {
        var r = await EDU._api('/api/edu/attempts/' + a.id + '/submit', {
          method:'POST', body: JSON.stringify({ answers: EDU._answers })
        });
        EDU._closeAll();
        EDU._attempt = null;
        EDU._answers = {};
        EDU._showResult(r);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  RESULT — Score + review
    // ═══════════════════════════════════════════════════
    _showResult: async function(r) {
      var passed = r.passed;
      var color = passed ? 'ok' : 'dng';
      var icon = passed ? '🎉' : '😔';
      var msg = passed ? 'قبول شدید' : 'متأسفانه قبول نشدید';
      var h = '<div class="bs-handle"></div>';
      h += '<div class="bs-hd"><div class="bs-title">' + icon + ' نتیجه آزمون</div>';
      h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

      h += '<div class="edu-result-card ' + color + '">';
      h += '<div style="font-size:64px;line-height:1">' + icon + '</div>';
      h += '<div style="font-size:56px;font-weight:900;color:var(--' + color + ')">' + r.score + '</div>';
      h += '<div style="font-size:11px;color:var(--fg-2);margin-top:4px">درصد</div>';
      h += '<div style="font-size:16px;font-weight:900;margin-top:8px;color:var(--' + color + ')">' + msg + '</div>';
      h += '</div>';

      h += '<div class="card" style="margin-bottom:12px">';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>نمره قبولی:</span><b>' + (r.passingScore || 60) + '%</b></div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span>امتیاز:</span><b>' + (r.earned || 0) + ' / ' + (r.total || 0) + '</b></div>';
      h += '<div style="display:flex;justify-content:space-between;font-size:12px"><span>زمان:</span><b>' + EDU._time(r.submittedAt) + '</b></div>';
      h += '</div>';

      if (passed) {
        h += '<div class="hint success" style="margin-bottom:12px">🏅 گواهی شما صادر شد</div>';
        h += '<button class="btn btn-ok btn-block" style="padding:14px;margin-bottom:8px;font-weight:900" onclick="NABZ.edu.showCertificates()">🏅 مشاهده گواهی</button>';
      }

      // Review questions
      if (r.review && r.review.length) {
        h += '<div class="sec-hd" style="margin:14px 0 8px"><span>📋 بازبینی سوالات</span></div>';
        r.review.forEach(function(rev, i) {
          var q = rev.question || {};
          var ansOk = rev.correct;
          h += '<div class="edu-review-item ' + (ansOk ? 'ok' : 'dng') + '">';
          h += '<div class="edu-review-hd">';
          h += '<span class="pill">' + (i+1) + '</span>';
          h += '<span class="pill ' + (ansOk ? 'ok' : 'dng') + '">' + (ansOk ? '✓ درست' : '✗ غلط') + '</span>';
          h += '</div>';
          h += '<div class="edu-review-stem">' + EDU._esc(q.stem || '') + '</div>';
          if (!ansOk) {
            h += '<div style="font-size:11.5px;margin-top:6px"><b style="color:var(--dng)">پاسخ شما:</b> ' + EDU._esc(String(rev.given || '—')) + '</div>';
            h += '<div style="font-size:11.5px"><b style="color:var(--ok)">پاسخ درست:</b> ' + EDU._esc(String(rev.expected || '—')) + '</div>';
          } else {
            h += '<div style="font-size:11.5px;margin-top:6px;color:var(--ok)">✓ پاسخ صحیح</div>';
          }
          h += '</div>';
        });
      }

      h += '<div style="margin-top:14px;margin-bottom:20px"><button class="btn btn-block" style="padding:12px" onclick="this.closest(\'.bs-backdrop\').remove();if(NABZ.state.current)NABZ.show(NABZ.state.current)">بستن و بازخوانی</button></div>';
      EDU._openSheet(h);
    },

    // ═══════════════════════════════════════════════════
    //  CERTIFICATES
    // ═══════════════════════════════════════════════════
    showCertificates: async function() {
      try {
        var d = await EDU._api('/api/edu/certificates');
        var items = d.items || [];
        if (!items.length) return alert('گواهی‌ای ندارید — ابتدا در آزمون‌ها قبول شوید');
        // اگر یکی، مستقیم باز کن
        if (items.length === 1) return EDU.viewCertificate(items[0].id);
        // چند تا، picker
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🏅 گواهی‌های من</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        items.forEach(function(c) {
          h += '<button class="btn" style="width:100%;text-align:right;padding:14px;margin-bottom:6px;display:flex;flex-direction:column;gap:4px;align-items:stretch" onclick="NABZ.edu._closeAll();NABZ.edu.viewCertificate(\'' + c.id + '\')">';
          h += '<div style="font-weight:900">🏅 ' + EDU._esc(c.examTitle) + '</div>';
          h += '<div style="font-size:11px;color:var(--fg-2)">' + EDU._date(c.issuedAt) + ' · نمره ' + c.score + '%</div>';
          h += '</button>';
        });
        EDU._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    viewCertificate: async function(certId) {
      try {
        var d = await EDU._api('/api/edu/certificates');
        var c = (d.items || []).find(function(x) { return x.id === certId; });
        if (!c) return alert('گواهی یافت نشد');

        var user = NABZ.state.user;
        var serial = 'NABZ-CERT-' + c.id.slice(-8).toUpperCase();
        var dateFa = EDU._date(c.issuedAt);

        var certHtml = '<div class="edu-cert">';
        certHtml += '<div class="edu-cert-border"></div>';
        certHtml += '<div class="edu-cert-org">🫀 بیمارستان سینا</div>';
        certHtml += '<div class="edu-cert-org-sub">سیستم آموزشی نبض</div>';
        certHtml += '<div class="edu-cert-badge">🏅</div>';
        certHtml += '<div class="edu-cert-title">گواهی‌نامه</div>';
        certHtml += '<div class="edu-cert-subtitle">مبنی بر گذراندن موفقیت‌آمیز آزمون</div>';
        certHtml += '<div class="edu-cert-exam">«' + EDU._esc(c.examTitle) + '»</div>';
        certHtml += '<div class="edu-cert-recipient-label">اعطا می‌شود به</div>';
        certHtml += '<div class="edu-cert-recipient">' + EDU._esc(c.userName || (user && user.fullName) || '—') + '</div>';
        certHtml += '<div class="edu-cert-score">با نمره <b>' + c.score + '%</b></div>';
        certHtml += '<div class="edu-cert-date">' + dateFa + '</div>';
        certHtml += '<div class="edu-cert-serial">' + serial + '</div>';
        certHtml += '<div class="edu-cert-signature">';
        certHtml += '<div class="edu-cert-sig"><div class="edu-cert-sig-line"></div><div class="edu-cert-sig-lbl">مدیر آموزش</div></div>';
        certHtml += '<div class="edu-cert-sig"><div class="edu-cert-sig-line"></div><div class="edu-cert-sig-lbl">مدیر بیمارستان</div></div>';
        certHtml += '</div>';
        certHtml += '</div>';

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🏅 گواهی‌نامه</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += certHtml;
        h += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="NABZ.edu._printCertificate(\'' + c.id + '\')">🖨 چاپ / PDF</button>';
        h += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        EDU._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    _printCertificate: async function(certId) {
      try {
        var d = await EDU._api('/api/edu/certificates');
        var c = (d.items || []).find(function(x) { return x.id === certId; });
        if (!c) return alert('گواهی یافت نشد');
        var user = NABZ.state.user;
        var serial = 'NABZ-CERT-' + c.id.slice(-8).toUpperCase();
        var dateFa = EDU._date(c.issuedAt);
        var html = '<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><title>گواهی‌نامه</title>';
        html += '<style>';
        html += '@page{size:A4 landscape;margin:0}';
        html += '*{box-sizing:border-box;margin:0;padding:0}';
        html += 'body{font-family:"Vazirmatn",Tahoma,sans-serif;background:#f8fafc;padding:0}';
        html += '.cert{width:100%;height:100vh;padding:20mm;display:flex;align-items:center;justify-content:center;background:#f8fafc}';
        html += '.inner{width:100%;max-width:260mm;background:#fff;border-radius:12px;padding:20mm;position:relative;box-shadow:0 8px 32px rgba(0,0,0,0.1);border:4px solid #0891b2}';
        html += '.inner::before{content:"";position:absolute;inset:8mm;border:2px solid #cbd5e1;border-radius:8px;pointer-events:none}';
        html += '.org{text-align:center;font-size:20px;font-weight:900;color:#0891b2;margin-bottom:2px}';
        html += '.org-sub{text-align:center;font-size:12px;color:#64748b;margin-bottom:24px}';
        html += '.badge{text-align:center;font-size:64px;line-height:1;margin-bottom:8px}';
        html += '.title{text-align:center;font-size:42px;font-weight:900;color:#0c4a6e;letter-spacing:-1px;margin-bottom:8px}';
        html += '.subtitle{text-align:center;font-size:14px;color:#64748b;margin-bottom:32px}';
        html += '.exam{text-align:center;font-size:22px;font-weight:800;color:#1e40af;margin-bottom:32px;line-height:1.4}';
        html += '.recipient-label{text-align:center;font-size:12px;color:#94a3b8;margin-bottom:6px}';
        html += '.recipient{text-align:center;font-size:32px;font-weight:900;color:#0f172a;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #0891b2;display:inline-block;width:80%;margin-right:10%;margin-left:10%}';
        html += '.score{text-align:center;font-size:16px;color:#16a34a;font-weight:800;margin-bottom:24px}';
        html += '.score b{font-size:22px}';
        html += '.date{text-align:center;font-size:13px;color:#64748b;margin-bottom:40px}';
        html += '.serial{text-align:center;font-family:monospace;font-size:11px;color:#94a3b8;margin-bottom:32px}';
        html += '.sigs{display:flex;justify-content:space-around;margin-top:auto}';
        html += '.sig{flex:1;text-align:center;max-width:70mm}';
        html += '.sig-line{border-top:1.5px solid #64748b;margin-bottom:6px;height:40px}';
        html += '.sig-lbl{font-size:11px;color:#64748b;font-weight:700}';
        html += '</style></head><body><div class="cert"><div class="inner">';
        html += '<div class="org">🫀 بیمارستان سینا</div>';
        html += '<div class="org-sub">سیستم آموزشی نبض — Neural Hospital OS</div>';
        html += '<div class="badge">🏅</div>';
        html += '<div class="title">گواهی‌نامه</div>';
        html += '<div class="subtitle">مبنی بر گذراندن موفقیت‌آمیز آزمون</div>';
        html += '<div class="exam">«' + EDU._esc(c.examTitle) + '»</div>';
        html += '<div class="recipient-label">اعطا می‌شود به</div>';
        html += '<div class="recipient">' + EDU._esc(c.userName || (user && user.fullName) || '—') + '</div>';
        html += '<div class="score">با نمره <b>' + c.score + '%</b></div>';
        html += '<div class="date">' + dateFa + '</div>';
        html += '<div class="serial">' + serial + '</div>';
        html += '<div class="sigs">';
        html += '<div class="sig"><div class="sig-line"></div><div class="sig-lbl">مدیر آموزش</div></div>';
        html += '<div class="sig"><div class="sig-line"></div><div class="sig-lbl">مدیر بیمارستان</div></div>';
        html += '</div>';
        html += '</div></div></body></html>';
        var w = window.open('', '_blank');
        if (!w) return alert('پاپ‌آپ مسدود است');
        w.document.open(); w.document.write(html); w.document.close();
        setTimeout(function() { try { w.focus(); w.print(); } catch(_) { alert('Ctrl+P'); } }, 500);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  CASES — Clinical case studies
    // ═══════════════════════════════════════════════════
    viewCase: async function(caseId) {
      try {
        var d = await EDU._api('/api/edu/cases');
        var c = (d.items || []).find(function(x) { return x.id === caseId; });
        if (!c) return alert('کیس یافت نشد');

        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">🩺 ' + EDU._esc(c.title) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';

        h += '<div class="edu-case-section">';
        h += '<div class="edu-case-label">📋 شکایت اصلی</div>';
        h += '<div class="edu-case-text">' + EDU._esc(c.chiefComplaint || '—') + '</div>';
        h += '</div>';

        if (c.history) {
          h += '<div class="edu-case-section">';
          h += '<div class="edu-case-label">📚 سابقه</div>';
          h += '<div class="edu-case-text">' + EDU._esc(c.history) + '</div>';
          h += '</div>';
        }

        if (c.physicalExam) {
          h += '<div class="edu-case-section">';
          h += '<div class="edu-case-label">🩺 معاینه فیزیکی</div>';
          h += '<div class="edu-case-text">' + EDU._esc(c.physicalExam) + '</div>';
          h += '</div>';
        }

        if (c.differentials && c.differentials.length) {
          h += '<div class="edu-case-section">';
          h += '<div class="edu-case-label">🔍 تشخیص‌های افتراقی</div>';
          c.differentials.forEach(function(dx) {
            h += '<div class="edu-case-diff">• ' + EDU._esc(dx) + '</div>';
          });
          h += '</div>';
        }

        // Hidden reveal section
        h += '<div id="eduCaseReveal" style="display:none">';
        if (c.correctDiagnosis) {
          h += '<div class="edu-case-section" style="border-color:var(--ok);background:var(--ok-soft)">';
          h += '<div class="edu-case-label" style="color:var(--ok)">✅ تشخیص نهایی</div>';
          h += '<div class="edu-case-text" style="font-weight:900;font-size:14px">' + EDU._esc(c.correctDiagnosis) + '</div>';
          h += '</div>';
        }
        if (c.discussion) {
          h += '<div class="edu-case-section">';
          h += '<div class="edu-case-label">💡 بحث بالینی</div>';
          h += '<div class="edu-case-text">' + EDU._esc(c.discussion) + '</div>';
          h += '</div>';
        }
        h += '</div>';

        h += '<div style="display:flex;gap:6px;margin-top:14px;margin-bottom:20px">';
        h += '<button class="btn btn-primary" style="flex:1;padding:12px" onclick="document.getElementById(\'eduCaseReveal\').style.display=\'block\';this.style.display=\'none\'">💡 نمایش تشخیص و بحث</button>';
        h += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        EDU._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    },

    // ═══════════════════════════════════════════════════
    //  MY PROGRESS — Dashboard
    // ═══════════════════════════════════════════════════
    myProgress: async function() {
      try {
        var [stats, assignments, certificates, exams] = await Promise.all([
          EDU._api('/api/edu/stats').catch(function() { return {}; }),
          EDU._api('/api/edu/my').catch(function() { return { items: [] }; }),
          EDU._api('/api/edu/certificates').catch(function() { return { items: [] }; }),
          EDU._api('/api/edu/exams').catch(function() { return { items: [] }; })
        ]);

        var h = '<div class="sec-hd"><span>📊 پیشرفت من</span></div>';
        h += '<div class="rd-stats">';
        h += '<div class="rd-stat"><div class="v">' + (stats.exams || 0) + '</div><div class="l">آزمون‌ها</div></div>';
        h += '<div class="rd-stat ok"><div class="v">' + (certificates.items || []).length + '</div><div class="l">گواهی‌ها</div></div>';
        h += '<div class="rd-stat ' + ((assignments.items || []).length ? 'warn' : '') + '"><div class="v">' + (assignments.items || []).length + '</div><div class="l">تکالیف</div></div>';
        h += '<div class="rd-stat"><div class="v">' + (stats.objects || 0) + '</div><div class="l">مقاله</div></div>';
        h += '</div>';

        // Assignments due
        var pending = (assignments.items || []).filter(function(a) { return a.status === 'assigned'; });
        if (pending.length) {
          h += '<div class="sec-hd"><span>📥 تکالیف در انتظار</span><span class="rd-mini">' + pending.length + '</span></div>';
          pending.forEach(function(a) {
            var exam = (exams.items || []).find(function(x) { return x.id === a.refId; });
            var overdue = a.dueAt && new Date(a.dueAt).getTime() < Date.now();
            h += '<div class="row ' + (overdue ? 'hi' : 'md') + '">';
            h += '<div class="row-hd"><div class="row-title">' + EDU._esc(a.refTitle || 'آزمون') + '</div>';
            h += '<span class="pill ' + (overdue ? 'dng' : 'warn') + '">' + (overdue ? 'گذشته' : 'در انتظار') + '</span></div>';
            if (a.dueAt) h += '<div class="row-meta">مهلت: ' + EDU._date(a.dueAt) + '</div>';
            h += '</div>';
          });
        }

        // Certificates
        if ((certificates.items || []).length) {
          h += '<div class="sec-hd"><span>🏅 گواهی‌های من</span></div>';
          (certificates.items || []).forEach(function(c) {
            h += '<div class="row lo" onclick="NABZ.edu.viewCertificate(\'' + c.id + '\')">';
            h += '<div class="row-hd"><div class="row-title">' + EDU._esc(c.examTitle) + '</div>';
            h += '<span class="pill ok">' + c.score + '%</span></div>';
            h += '<div class="row-meta">' + EDU._date(c.issuedAt) + '</div>';
            h += '</div>';
          });
        }

        // Published exams
        var published = (exams.items || []).filter(function(e) { return e.status === 'published'; });
        if (published.length) {
          h += '<div class="sec-hd"><span>📝 آزمون‌های فعال</span></div>';
          published.forEach(function(e) {
            h += '<div class="row md" onclick="NABZ.edu.startExam(\'' + e.id + '\')">';
            h += '<div class="row-hd"><div class="row-title">' + EDU._esc(e.title) + '</div>';
            h += '<span class="pill info">' + e.questions.length + ' سوال</span></div>';
            h += '<div class="row-meta">قبولی: ' + e.passingScore + '% · ' + e.timeLimitMinutes + ' دقیقه · ' + e.attemptsAllowed + ' تلاش</div>';
            h += '</div>';
          });
        }

        var m = document.getElementById('content');
        m.innerHTML = h;
        // Set current to a virtual panel so FAB hides
        NABZ.state.current = null;
      } catch(e) { alert('خطا: ' + e.message); }
    }
  };

  // ═══ Bootstrap ═══
  var waitCount = 0;
  function ready(fn) {
    if (window.NABZ && typeof NABZ.show === 'function') return fn();
    if (++waitCount >= 50) return console.warn('[edu-ui] timeout');
    setTimeout(function() { ready(fn); }, 100);
  }

  ready(function() {
    NABZ.edu = EDU;

    // Wrap showItem
    var prevShowItem = NABZ.showItem;
    NABZ.showItem = function(pid, iid) {
      if (pid === 'education.objects') return EDU.viewObject(iid);
      if (pid === 'education.cases') return EDU.viewCase(iid);
      if (pid === 'education.certificates') return EDU.viewCertificate(iid);
      if (pid === 'education.exams') return EDU._examDetail(iid);
      return prevShowItem.apply(NABZ, arguments);
    };

    // Exam detail (pre-start)
    EDU._examDetail = async function(id) {
      try {
        var d = await EDU._api('/api/edu/exams');
        var e = (d.items || []).find(function(x) { return x.id === id; });
        if (!e) return alert('آزمون یافت نشد');
        if (e.status !== 'published') return alert('این آزمون منتشر نشده');
        var h = '<div class="bs-handle"></div>';
        h += '<div class="bs-hd"><div class="bs-title">📝 ' + EDU._esc(e.title) + '</div>';
        h += '<button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:12px">';
        if (e.description) h += '<div style="font-size:13px;margin-bottom:8px">' + EDU._esc(e.description) + '</div>';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        h += '<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:6px"><div style="font-size:22px;font-weight:900;color:var(--primary)">' + e.questions.length + '</div><div style="font-size:10px;color:var(--fg-2)">سوال</div></div>';
        h += '<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:6px"><div style="font-size:22px;font-weight:900;color:var(--warn)">' + e.timeLimitMinutes + '</div><div style="font-size:10px;color:var(--fg-2)">دقیقه</div></div>';
        h += '<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:6px"><div style="font-size:22px;font-weight:900;color:var(--ok)">' + e.passingScore + '%</div><div style="font-size:10px;color:var(--fg-2)">قبولی</div></div>';
        h += '<div style="text-align:center;padding:8px;background:var(--bg-3);border-radius:6px"><div style="font-size:22px;font-weight:900">' + e.attemptsAllowed + '</div><div style="font-size:10px;color:var(--fg-2)">تلاش</div></div>';
        h += '</div></div>';
        h += '<div class="hint warn">⚠️ با شروع آزمون، تایمر فعال می‌شود و قابل توقف نیست</div>';
        h += '<button class="btn btn-primary btn-block" style="padding:16px;font-size:15px;margin-top:12px;font-weight:900" onclick="NABZ.edu._closeAll();NABZ.edu.startExam(\'' + e.id + '\')">🚀 شروع آزمون</button>';
        EDU._openSheet(h);
      } catch(e) { alert('خطا: ' + e.message); }
    };

    // FAB for education panels
    var fab = document.createElement('button');
    fab.id = 'eduFab';
    fab.style.cssText = 'position:fixed;bottom:calc(var(--nav-h,72px) + 20px);left:20px;padding:14px 20px;background:linear-gradient(135deg,#8b5cf6,#7c3aed);color:#fff;border:none;border-radius:30px;font-family:inherit;font-size:13px;font-weight:900;box-shadow:0 4px 20px rgba(139,92,246,0.5);cursor:pointer;z-index:50;display:none;align-items:center;gap:6px';
    document.body.appendChild(fab);

    var FAB_MAP = {
      'education.certificates': { label:'🏅 پیشرفت من', fn:function() { EDU.myProgress(); } }
    };
    function update() {
      if (!NABZ.state) return;
      var cfg = FAB_MAP[NABZ.state.current];
      if (!cfg || document.querySelector('.bs-backdrop')) { fab.style.display = 'none'; return; }
      fab.style.display = 'flex';
      fab.textContent = cfg.label;
      fab.onclick = cfg.fn;
    }
    var content = document.getElementById('content');
    if (content) new MutationObserver(update).observe(content, { childList:true, subtree:false });
    setInterval(update, 500);

    console.log('[edu-ui] loaded ✓ — exams, certificates, cases');
  });
})();
