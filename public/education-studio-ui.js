(function() {
  'use strict';

  var Q_TYPES = {
    mcq_single: { label: 'چندگزینه‌ای تک‌پاسخ', icon: '◉', options: true, single: true },
    mcq_multiple: { label: 'چندگزینه‌ای چندپاسخ', icon: '☑', options: true, multiple: true },
    true_false: { label: 'صحیح/غلط', icon: '✓', options: true, single: true, fixed: ['صحیح','غلط'] },
    short_answer: { label: 'پاسخ کوتاه', icon: '✎', text: true },
    essay: { label: 'تشریحی', icon: '📝', manual: true },
    fill_blank: { label: 'جای خالی', icon: '_', manual: true },
    numeric: { label: 'عددی', icon: '#', numeric: true },
    matching: { label: 'تطبیق', icon: '⇄', manual: true },
    ordering: { label: 'ترتیب', icon: '↕', ordering: true }
  };
  var DIFF_FA = { easy: 'آسان', medium: 'متوسط', hard: 'سخت' };
  var BLOOM_FA = { remember:'یادآوری', understand:'فهمیدن', apply:'کاربرد', analyze:'تحلیل', evaluate:'ارزیابی', create:'خلق' };
  var CAT_FA = { general:'عمومی', clinical:'بالینی', infection_control:'کنترل عفونت', safety:'ایمنی', emergency:'اورژانس', communication:'ارتباط' };

  var ST = {
    _api: function(p, o) { return NABZ._api(p, o); },
    _esc: function(s) { return NABZ._esc(s); },
    _time: function(iso) { try { return new Date(iso).toLocaleString('fa-IR',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}); } catch(_){ return '—'; } },
    _open: function(html, opts) {
      opts = opts || {};
      var s = document.createElement('div'); s.className = 'bs-backdrop';
      s.onclick = function(e) { if (e.target === s && !opts.noClose) s.remove(); };
      var c = document.createElement('div'); c.className = 'bs-sheet';
      c.style.maxHeight = '96vh'; c.innerHTML = html;
      s.appendChild(c); document.body.appendChild(s);
      requestAnimationFrame(function() { s.classList.add('show'); });
      return s;
    },
    _closeAll: function() { document.querySelectorAll('.bs-backdrop').forEach(function(e) { e.remove(); }); },
    _tab: 'exams',
    _cache: {},
    _attemptTimer: null,
    _currentAttempt: null,
    _tabLabels: {
      exams: '📝 آزمون‌ها',
      questions: '❓ بانک سوال',
      cohorts: '👥 کلاس‌ها',
      assignments: '📤 تخصیص‌ها',
      attempts: '📊 تلاش‌ها',
      analytics: '📈 تحلیل'
    },

    showStudio: async function(p, d) {
      var m = document.getElementById('content');
      m.innerHTML = '<div style="text-align:center;padding:40px"><span class="spinner"></span></div>';
      try {
        if (!d) d = await ST._api('/api/edu-studio/analytics');
        ST._cache.analytics = d;
        ST._render(p);
      } catch (e) {
        m.innerHTML = '<div class="empty">خطا: ' + ST._esc(e.message) + '</div>';
      }
    },

    _render: function(p) {
      var d = ST._cache.analytics || {};
      var s = d.stats || {};
      var tab = ST._tab;
      var m = document.getElementById('content');
      var h = '<div class="sec-hd"><span>🎓 استودیوی آموزشی</span></div>';
      h += '<div class="rd-stats" style="grid-template-columns:repeat(4,1fr);margin-bottom:14px">';
      h += '<div class="rd-stat info"><div class="v">' + (s.published || 0) + '</div><div class="l">منتشرشده</div></div>';
      h += '<div class="rd-stat"><div class="v">' + (s.questions || 0) + '</div><div class="l">سوال</div></div>';
      h += '<div class="rd-stat ok"><div class="v">' + (s.cohorts || 0) + '</div><div class="l">کلاس</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + (s.attempts || 0) + '</div><div class="l">تلاش</div></div>';
      h += '</div>';
      h += '<div class="crisis-tabs" style="margin-bottom:12px">';
      Object.keys(ST._tabLabels).forEach(function(t) {
        h += '<button class="crisis-tab' + (tab === t ? ' on' : '') + '" onclick="NABZ.eduStudio._setTab(\'' + t + '\')">' + ST._tabLabels[t] + '</button>';
      });
      h += '</div>';
      h += '<div id="eduTabContent"><div style="text-align:center;padding:20px"><span class="spinner"></span></div></div>';
      m.innerHTML = h;
      ST._loadTab(tab);
      NABZ.state.current = p ? p.id : 'education_studio.studio';
    },

    _setTab: function(tab) { ST._tab = tab; ST._render(); },

    _loadTab: async function(tab) {
      var el = document.getElementById('eduTabContent');
      if (!el) return;
      try {
        if (tab === 'exams') await ST._loadExams(el);
        else if (tab === 'questions') await ST._loadQuestions(el);
        else if (tab === 'cohorts') await ST._loadCohorts(el);
        else if (tab === 'assignments') await ST._loadAssignments(el);
        else if (tab === 'attempts') await ST._loadAttempts(el);
        else if (tab === 'analytics') await ST._loadAnalytics(el);
      } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + ST._esc(e.message) + '</div>'; }
    },

    // ═════════ EXAMS ═════════
    _loadExams: async function(el) {
      var r = await ST._api('/api/edu-studio/exams');
      ST._cache.exams = r.items || [];
      var h = '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.eduStudio._newExam()">➕ آزمون جدید</button>';
      if (!r.items.length) h += '<div class="empty">هنوز آزمونی نساخته‌اید</div>';
      else r.items.forEach(function(e) {
        var cls = e.status === 'published' ? 'ok' : 'warn';
        var st = e.status === 'published' ? 'منتشر' : 'پیش‌نویس';
        h += '<div class="row lo" style="margin-bottom:6px;cursor:pointer" onclick="NABZ.eduStudio._openExam(\'' + e.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + ST._esc(e.title) + '</div><span class="pill ' + cls + '">' + st + '</span></div>';
        h += '<div class="row-meta">' + e.questionCount + ' سوال · ' + e.totalPoints + ' امتیاز · ' + e.timeLimitMinutes + ' دقیقه · قبولی ' + e.passingScore + '%</div>';
        if (e.description) h += '<div class="row-meta" style="font-size:10.5px;color:var(--fg-3)">' + ST._esc(e.description.slice(0, 80)) + '</div>';
        h += '</div>';
      });
      el.innerHTML = h;
    },

    _newExam: function() {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 آزمون جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>عنوان *</label><input type="text" id="exTitle" placeholder="مثلاً: آزمون ایمنی بیمار — پاییز ۱۴۰۴"></div>';
      h += '<div class="wf-field"><label>توضیح</label><textarea id="exDesc" rows="2"></textarea></div>';
      h += '<div class="wf-field"><label>دسته</label><select id="exCat">';
      Object.keys(CAT_FA).forEach(function(k) { h += '<option value="' + k + '">' + CAT_FA[k] + '</option>'; });
      h += '</select></div>';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>مدت (دقیقه)</label><input type="number" id="exDur" value="15" min="1" max="600"></div>';
      h += '<div class="wf-field"><label>قبولی٪</label><input type="number" id="exPass" value="60" min="0" max="100"></div>';
      h += '<div class="wf-field"><label>تلاش</label><input type="number" id="exAtt" value="2" min="1" max="20"></div>';
      h += '</div>';
      h += '<div style="display:flex;gap:8px;margin:8px 0">';
      h += '<label style="flex:1;display:flex;gap:6px;align-items:center;padding:8px;background:var(--bg-2);border-radius:6px;font-size:11px;cursor:pointer"><input type="checkbox" id="exShuf" style="width:16px;height:16px">هم‌زدن سوالات</label>';
      h += '<label style="flex:1;display:flex;gap:6px;align-items:center;padding:8px;background:var(--bg-2);border-radius:6px;font-size:11px;cursor:pointer"><input type="checkbox" id="exCert" style="width:16px;height:16px">گواهی برای قبولی</label>';
      h += '</div>';
      h += '<div class="wf-field"><label>نمایش نتیجه</label><select id="exShow"><option value="immediate">فوری</option><option value="after_due">بعد از مهلت</option><option value="never">هرگز</option></select></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.eduStudio._saveExam(null)">✅ ساخت</button>';
      ST._open(h);
    },

    _saveExam: async function(id) {
      var t = document.getElementById('exTitle').value.trim();
      if (!t) return alert('عنوان الزامی');
      var body = {
        title: t,
        description: document.getElementById('exDesc').value,
        category: document.getElementById('exCat').value,
        timeLimitMinutes: parseInt(document.getElementById('exDur').value) || 15,
        passingScore: parseInt(document.getElementById('exPass').value) || 60,
        attemptsAllowed: parseInt(document.getElementById('exAtt').value) || 2,
        shuffleQuestions: document.getElementById('exShuf').checked,
        certificate: { enabled: document.getElementById('exCert').checked, minScore: 80 },
        showResultsMode: document.getElementById('exShow').value
      };
      try {
        var r = id ? await ST._api('/api/edu-studio/exams/' + id, { method:'PUT', body: JSON.stringify(body) })
                    : await ST._api('/api/edu-studio/exams', { method:'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ ذخیره شد');
        ST._closeAll();
        if (!id) ST._openExam(r.id);
        else ST._loadTab('exams');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _openExam: async function(id) {
      try {
        var e = await ST._api('/api/edu-studio/exams/' + id);
        var qs = e.questions || [];
        var isDraft = e.status === 'draft';
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📝 ' + ST._esc(e.title) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:10px;padding:10px">';
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11.5px;color:var(--fg-2)">';
        h += '<div>مدت: <b>' + e.timeLimitMinutes + ' دقیقه</b></div>';
        h += '<div>قبولی: <b>' + e.passingScore + '%</b></div>';
        h += '<div>تلاش: <b>' + e.attemptsAllowed + '</b></div>';
        h += '<div>نمره کل: <b>' + e.totalPoints + '</b></div>';
        h += '</div></div>';
        h += '<div class="sec-hd" style="margin:12px 0 6px"><span>سوالات (' + qs.length + ')</span></div>';
        if (!qs.length) h += '<div class="empty" style="padding:16px">هنوز سوالی اضافه نشده</div>';
        else qs.forEach(function(q, i) {
          var t = Q_TYPES[q.type] || { icon: '?', label: q.type };
          h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;font-size:11.5px">';
          h += '<div style="flex:1"><span class="pill">' + (i+1) + '</span> ' + t.icon + ' ' + ST._esc((q.stem || '').slice(0, 60)) + '</div>';
          h += '<span class="pill info">' + (q.points || 1) + '</span>';
          if (isDraft) h += '<button class="btn btn-sm" style="padding:2px 6px;font-size:10px;color:var(--dng);margin-right:4px" onclick="event.stopPropagation();NABZ.eduStudio._removeQFromExam(\'' + e.id + '\',\'' + q.id + '\')">✗</button>';
          h += '</div>';
        });
        h += '<div style="display:flex;gap:6px;margin-top:12px">';
        if (isDraft) {
          h += '<button class="btn" style="flex:1;padding:10px;font-size:11.5px" onclick="NABZ.eduStudio._selectQuestionsForExam(\'' + e.id + '\')">✎ انتخاب سوالات</button>';
          if (qs.length) h += '<button class="btn btn-primary" style="flex:1;padding:10px;font-size:11.5px;font-weight:900" onclick="NABZ.eduStudio._publishExam(\'' + e.id + '\')">📢 انتشار</button>';
        } else {
          h += '<button class="btn" style="flex:1;padding:10px;font-size:11.5px" onclick="NABZ.eduStudio._newAssignment(\'' + e.id + '\')">📤 تخصیص</button>';
          h += '<button class="btn" style="flex:1;padding:10px;font-size:11.5px" onclick="NABZ.eduStudio._examAnalytics(\'' + e.id + '\')">📈 تحلیل</button>';
        }
        h += '</div>';
        h += '<div style="display:flex;gap:6px;margin-top:6px;margin-bottom:20px">';
        h += '<button class="btn" style="flex:1;padding:8px;font-size:11px" onclick="NABZ.eduStudio._duplicateExam(\'' + e.id + '\')">کپی</button>';
        if (isDraft) h += '<button class="btn" style="flex:1;padding:8px;font-size:11px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.eduStudio._deleteExam(\'' + e.id + '\')">حذف</button>';
        else h += '<button class="btn" style="flex:1;padding:8px;font-size:11px" onclick="NABZ.eduStudio._unpublishExam(\'' + e.id + '\')">لغو انتشار</button>';
        h += '</div>';
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _removeQFromExam: async function(examId, qid) {
      try {
        var e = await ST._api('/api/edu-studio/exams/' + examId);
        var ids = (e.questionIds || []).filter(function(x) { return x !== qid; });
        await ST._api('/api/edu-studio/exams/' + examId + '/questions', { method:'POST', body: JSON.stringify({ questionIds: ids }) });
        NABZ._toast('حذف شد');
        ST._closeAll();
        ST._openExam(examId);
      } catch (err) { alert('خطا: ' + err.message); }
    },

    _selectQuestionsForExam: async function(examId) {
      try {
        var [exam, qs] = await Promise.all([
          ST._api('/api/edu-studio/exams/' + examId),
          ST._api('/api/edu-studio/questions')
        ]);
        var selected = new Set(exam.questionIds || []);
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">❓ انتخاب سوالات</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<input type="search" id="qpSearch" placeholder="🔍 جستجو..." style="width:100%;padding:8px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:6px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:12px" oninput="NABZ.eduStudio._filterQP(this.value)">';
        h += '<div id="qpList" style="max-height:55vh;overflow-y:auto">';
        if (!qs.items.length) h += '<div class="empty">بانک سوال خالی است</div>';
        else qs.items.forEach(function(q) {
          var t = Q_TYPES[q.type] || { icon:'?' };
          h += '<label class="qp-item" data-text="' + ST._esc((q.stem + ' ' + (q.category || '')).toLowerCase()) + '" style="display:flex;gap:8px;align-items:flex-start;padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:3px;cursor:pointer">';
          h += '<input type="checkbox" ' + (selected.has(q.id) ? 'checked' : '') + ' onchange="NABZ.eduStudio._toggleQP(\'' + q.id + '\',this.checked)" style="width:18px;height:18px;margin-top:2px">';
          h += '<div style="flex:1"><div style="font-size:11.5px;font-weight:700">' + t.icon + ' ' + ST._esc((q.stem || '').slice(0, 90)) + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + ST._esc(t.label) + ' · ' + q.points + ' امتیاز · ' + ST._esc(DIFF_FA[q.difficulty] || q.difficulty) + '</div></div></label>';
        });
        h += '</div>';
        h += '<div style="display:flex;gap:6px;margin-top:10px;margin-bottom:20px">';
        h += '<button class="btn btn-primary" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.eduStudio._saveQP(\'' + examId + '\')">✅ ذخیره</button>';
        h += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        ST._qpSelected = selected;
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _toggleQP: function(qid, checked) {
      if (checked) ST._qpSelected.add(qid);
      else ST._qpSelected.delete(qid);
    },

    _filterQP: function(q) {
      q = String(q || '').toLowerCase();
      document.querySelectorAll('.qp-item').forEach(function(x) {
        x.style.display = x.dataset.text.indexOf(q) >= 0 ? '' : 'none';
      });
    },

    _saveQP: async function(examId) {
      try {
        await ST._api('/api/edu-studio/exams/' + examId + '/questions', {
          method:'POST', body: JSON.stringify({ questionIds: Array.from(ST._qpSelected) })
        });
        NABZ._toast('✅ ذخیره شد');
        ST._closeAll();
        ST._openExam(examId);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _publishExam: async function(id) {
      if (!confirm('انتشار آزمون؟ پس از انتشار قابل ویرایش نیست')) return;
      try {
        await ST._api('/api/edu-studio/exams/' + id + '/publish', { method:'POST', body:'{}' });
        NABZ._toast('📢 منتشر شد');
        ST._closeAll();
        ST._loadTab('exams');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _unpublishExam: async function(id) {
      if (!confirm('لغو انتشار؟')) return;
      try {
        await ST._api('/api/edu-studio/exams/' + id + '/unpublish', { method:'POST', body:'{}' });
        NABZ._toast('لغو شد');
        ST._closeAll();
        ST._openExam(id);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _duplicateExam: async function(id) {
      try {
        await ST._api('/api/edu-studio/exams/' + id + '/duplicate', { method:'POST', body:'{}' });
        NABZ._toast('✅ کپی شد');
        ST._closeAll();
        ST._loadTab('exams');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _deleteExam: async function(id) {
      if (!confirm('حذف آزمون؟')) return;
      try {
        await ST._api('/api/edu-studio/exams/' + id, { method:'DELETE' });
        NABZ._toast('حذف شد');
        ST._closeAll();
        ST._loadTab('exams');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═════════ QUESTIONS ═════════
    _loadQuestions: async function(el) {
      var r = await ST._api('/api/edu-studio/questions');
      ST._cache.questions = r.items || [];
      var h = '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.eduStudio._newQuestion()">➕ سوال جدید</button>';
      h += '<input type="search" placeholder="🔍 جستجو..." oninput="NABZ.eduStudio._filterQuestions(this.value)" style="width:100%;padding:8px;margin-bottom:8px;border:1.5px solid var(--border-2);border-radius:6px;background:var(--bg-2);color:var(--fg);font-family:inherit;font-size:12px">';
      h += '<div id="qList">';
      if (!r.items.length) h += '<div class="empty">بانک سوال خالی است</div>';
      else r.items.forEach(function(q) { h += ST._qRow(q); });
      h += '</div>';
      el.innerHTML = h;
    },

    _qRow: function(q) {
      var t = Q_TYPES[q.type] || { icon:'?', label: q.type };
      return '<div class="row lo q-item" data-text="' + ST._esc((q.stem + ' ' + (q.category || '') + ' ' + (q.tags||[]).join(' ')).toLowerCase()) + '" style="margin-bottom:4px;cursor:pointer" onclick="NABZ.eduStudio._editQuestion(\'' + q.id + '\')">' +
        '<div class="row-hd"><div class="row-title" style="font-size:11.5px">' + t.icon + ' ' + ST._esc((q.stem || '').slice(0, 80)) + '</div>' +
        '<span class="pill">' + q.points + '</span></div>' +
        '<div class="row-meta" style="font-size:10.5px">' + ST._esc(t.label) + ' · ' + ST._esc(DIFF_FA[q.difficulty] || q.difficulty) + ' · ' + ST._esc(BLOOM_FA[q.bloomsLevel] || '') + ' · ' + ST._esc(CAT_FA[q.category] || q.category) + '</div></div>';
    },

    _filterQuestions: function(q) {
      q = String(q || '').toLowerCase();
      document.querySelectorAll('.q-item').forEach(function(x) {
        x.style.display = x.dataset.text.indexOf(q) >= 0 ? '' : 'none';
      });
    },

    _newQuestion: function() {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">❓ سوال جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نوع سوال *</label><select id="qType" onchange="NABZ.eduStudio._renderQFields(this.value)">';
      Object.keys(Q_TYPES).forEach(function(k) { h += '<option value="' + k + '">' + Q_TYPES[k].icon + ' ' + Q_TYPES[k].label + '</option>'; });
      h += '</select></div>';
      h += '<div id="qFields"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.eduStudio._saveQuestion(null)">✅ ساخت</button>';
      ST._open(h);
      setTimeout(function() { ST._renderQFields('mcq_single'); }, 100);
    },

    _renderQFields: function(type) {
      var el = document.getElementById('qFields');
      if (!el) return;
      var def = Q_TYPES[type] || {};
      var h = '<div class="wf-field"><label>متن سوال *</label><textarea id="qStem" rows="3"></textarea></div>';
      if (def.options) {
        h += '<div class="wf-field"><label>گزینه‌ها</label>';
        var opts = def.fixed || ['', '', '', ''];
        for (var i = 0; i < opts.length; i++) {
          h += '<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">';
          if (def.single) h += '<input type="radio" name="qCorrect" value="' + i + '" style="width:18px;height:18px">';
          if (def.multiple) h += '<input type="checkbox" class="q-correct-multi" data-idx="' + i + '" style="width:18px;height:18px">';
          h += '<input type="text" class="q-opt-input" data-idx="' + i + '" value="' + ST._esc(opts[i]) + '" placeholder="گزینه ' + (i+1) + '" ' + (def.fixed ? 'readonly' : '') + ' style="flex:1;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-family:inherit;font-size:12px">';
          h += '</div>';
        }
        if (!def.fixed) h += '<button class="btn btn-sm" style="padding:6px;font-size:11px;margin-top:4px" onclick="NABZ.eduStudio._addQOption()">➕ گزینه</button>';
        h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:4px">✓ = پاسخ صحیح</div></div>';
      }
      if (def.numeric) {
        h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
        h += '<div class="wf-field"><label>پاسخ عددی *</label><input type="number" id="qNum" step="any"></div>';
        h += '<div class="wf-field"><label>تلورانس</label><input type="number" id="qNumTol" value="0.01" step="any"></div>';
        h += '</div>';
      }
      if (def.text) {
        h += '<div class="wf-field"><label>پاسخ صحیح *</label><input type="text" id="qTextAnswer"></div>';
        h += '<div class="wf-field"><label>پاسخ‌های جایگزین (با کاما)</label><input type="text" id="qAccepted"></div>';
      }
      h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">';
      h += '<div class="wf-field"><label>سطح</label><select id="qDiff"><option value="easy">آسان</option><option value="medium" selected>متوسط</option><option value="hard">سخت</option></select></div>';
      h += '<div class="wf-field"><label>حوزه</label><select id="qBloom">';
      Object.keys(BLOOM_FA).forEach(function(k) { h += '<option value="' + k + '">' + BLOOM_FA[k] + '</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>امتیاز</label><input type="number" id="qPts" value="1" min="1"></div>';
      h += '</div>';
      h += '<div class="wf-field"><label>دسته</label><select id="qCat">';
      Object.keys(CAT_FA).forEach(function(k) { h += '<option value="' + k + '">' + CAT_FA[k] + '</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>توضیح پاسخ</label><textarea id="qExpl" rows="2"></textarea></div>';
      el.innerHTML = h;
    },

    _addQOption: function() {
      var wrap = document.querySelector('.q-opt-input');
      if (!wrap) return;
      var container = wrap.parentElement.parentElement;
      var newIdx = container.querySelectorAll('.q-opt-input').length;
      var row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:4px';
      row.innerHTML = '<input type="radio" name="qCorrect" value="' + newIdx + '" style="width:18px;height:18px"><input type="text" class="q-opt-input" data-idx="' + newIdx + '" placeholder="گزینه ' + (newIdx+1) + '" style="flex:1;padding:8px;background:var(--bg-2);border:1.5px solid var(--border-2);border-radius:6px;color:var(--fg);font-family:inherit;font-size:12px">';
      wrap.parentElement.parentElement.insertBefore(row, wrap.parentElement.parentElement.querySelector('button'));
    },

    _saveQuestion: async function(id) {
      var type = document.getElementById('qType') ? document.getElementById('qType').value : 'mcq_single';
      var def = Q_TYPES[type] || {};
      var body = {
        type: type,
        stem: document.getElementById('qStem').value.trim(),
        difficulty: document.getElementById('qDiff').value,
        bloomsLevel: document.getElementById('qBloom').value,
        points: parseInt(document.getElementById('qPts').value) || 1,
        category: document.getElementById('qCat').value,
        explanation: document.getElementById('qExpl').value
      };
      if (!body.stem || body.stem.length < 5) return alert('متن سوال ≥۵ کاراکتر');
      if (def.options) {
        var inputs = document.querySelectorAll('.q-opt-input');
        body.options = Array.from(inputs).map(function(x) { return x.value.trim(); }).filter(Boolean);
        if (body.options.length < 2) return alert('حداقل ۲ گزینه');
        if (def.single) {
          var corr = document.querySelector('input[name="qCorrect"]:checked');
          if (!corr) return alert('پاسخ صحیح را انتخاب کن');
          body.correctAnswer = inputs[parseInt(corr.value)].value.trim();
        }
        if (def.multiple) {
          var corrects = [];
          document.querySelectorAll('.q-correct-multi:checked').forEach(function(cb) {
            corrects.push(inputs[parseInt(cb.dataset.idx)].value.trim());
          });
          if (!corrects.length) return alert('حداقل ۱ پاسخ صحیح');
          body.correctAnswers = corrects;
        }
      }
      if (def.numeric) {
        var n = parseFloat(document.getElementById('qNum').value);
        if (isNaN(n)) return alert('پاسخ عددی الزامی');
        body.correctNumber = n;
        body.numericTolerance = parseFloat(document.getElementById('qNumTol').value) || 0.01;
      }
      if (def.text) {
        var a = document.getElementById('qTextAnswer').value.trim();
        if (!a) return alert('پاسخ الزامی');
        body.correctAnswer = a;
        var accepted = document.getElementById('qAccepted').value;
        if (accepted) body.acceptedAnswers = accepted.split(',').map(function(x) { return x.trim(); }).filter(Boolean);
      }
      try {
        if (id) await ST._api('/api/edu-studio/questions/' + id, { method:'PUT', body: JSON.stringify(body) });
        else await ST._api('/api/edu-studio/questions', { method:'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ ذخیره شد');
        ST._closeAll();
        ST._loadTab('questions');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _editQuestion: async function(id) {
      try {
        var q = await ST._api('/api/edu-studio/questions/' + id);
        var t = Q_TYPES[q.type] || { icon:'?' };
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">' + t.icon + ' ' + ST._esc(t.label) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div style="padding:10px;background:var(--bg-2);border-radius:6px;margin-bottom:10px;font-size:12px">' + ST._esc(q.stem) + '</div>';
        if (q.options && q.options.length) {
          h += '<div style="margin-bottom:10px"><div style="font-size:10.5px;color:var(--fg-2);margin-bottom:4px">گزینه‌ها:</div>';
          q.options.forEach(function(o, i) {
            var isCorrect = q.correctAnswer === o || (q.correctAnswers || []).indexOf(o) >= 0;
            h += '<div style="padding:6px 10px;background:' + (isCorrect ? 'var(--ok-soft)' : 'var(--bg)') + ';border-radius:4px;margin-bottom:2px;font-size:11.5px;' + (isCorrect ? 'font-weight:800;color:var(--ok)' : '') + '">' + (isCorrect ? '✓ ' : '· ') + ST._esc(o) + '</div>';
          });
          h += '</div>';
        }
        if (q.explanation) h += '<div class="hint info" style="font-size:11px">' + ST._esc(q.explanation) + '</div>';
        h += '<div style="display:flex;gap:6px;margin-top:12px">';
        h += '<button class="btn btn-primary" style="flex:1;padding:10px;font-size:11.5px" onclick="NABZ.eduStudio._editQuestionForm(\'' + q.id + '\')">✎ ویرایش</button>';
        h += '<button class="btn" style="padding:10px;font-size:11.5px" onclick="NABZ.eduStudio._duplicateQuestion(\'' + q.id + '\')">کپی</button>';
        h += '<button class="btn" style="padding:10px;font-size:11.5px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.eduStudio._deleteQuestion(\'' + q.id + '\')">حذف</button>';
        h += '</div>';
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _editQuestionForm: async function(id) {
      try {
        var q = await ST._api('/api/edu-studio/questions/' + id);
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✎ ویرایش سوال</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="wf-field"><label>متن سوال *</label><textarea id="qStem" rows="3">' + ST._esc(q.stem) + '</textarea></div>';
        h += '<div class="wf-field"><label>توضیح پاسخ</label><textarea id="qExpl" rows="2">' + ST._esc(q.explanation || '') + '</textarea></div>';
        h += '<input type="hidden" id="qType" value="' + q.type + '">';
        h += '<input type="hidden" id="qDiff" value="' + q.difficulty + '">';
        h += '<input type="hidden" id="qBloom" value="' + q.bloomsLevel + '">';
        h += '<input type="hidden" id="qCat" value="' + q.category + '">';
        h += '<input type="hidden" id="qPts" value="' + q.points + '">';
        h += '<div style="display:flex;gap:6px;margin-top:10px">';
        h += '<button class="btn btn-primary" style="flex:1;padding:12px;font-weight:900" onclick="NABZ.eduStudio._updateQuestionText(\'' + id + '\')">✅ ذخیره</button>';
        h += '<button class="btn" style="flex:1;padding:12px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _updateQuestionText: async function(id) {
      try {
        await ST._api('/api/edu-studio/questions/' + id, {
          method:'PUT', body: JSON.stringify({
            stem: document.getElementById('qStem').value.trim(),
            explanation: document.getElementById('qExpl').value
          })
        });
        NABZ._toast('✅ ذخیره شد');
        ST._closeAll();
        ST._loadTab('questions');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _duplicateQuestion: async function(id) {
      try {
        await ST._api('/api/edu-studio/questions/' + id + '/duplicate', { method:'POST', body:'{}' });
        NABZ._toast('✅ کپی شد');
        ST._closeAll();
        ST._loadTab('questions');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _deleteQuestion: async function(id) {
      if (!confirm('حذف سوال؟')) return;
      try {
        await ST._api('/api/edu-studio/questions/' + id + '?force=1', { method:'DELETE' });
        NABZ._toast('حذف شد');
        ST._closeAll();
        ST._loadTab('questions');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═════════ COHORTS ═════════
    _loadCohorts: async function(el) {
      var r = await ST._api('/api/edu-studio/cohorts');
      ST._cache.cohorts = r.items || [];
      var h = '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.eduStudio._newCohort()">➕ کلاس جدید</button>';
      if (!r.items.length) h += '<div class="empty">هنوز کلاسی نساخته‌اید</div>';
      else r.items.forEach(function(c) {
        h += '<div class="row lo" style="margin-bottom:4px;cursor:pointer" onclick="NABZ.eduStudio._openCohort(\'' + c.id + '\')">';
        h += '<div class="row-hd"><div class="row-title">' + ST._esc(c.name) + '</div><span class="pill info">' + c.memberCount + ' نفر</span></div>';
        h += '<div class="row-meta" style="font-size:10.5px">' + (c.selectionMode === 'manual' ? 'دستی' : c.selectionMode === 'filter' ? 'فیلتری' : 'ترکیبی') + '</div></div>';
      });
      el.innerHTML = h;
    },

    _newCohort: function() {
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">👥 کلاس جدید</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>نام *</label><input type="text" id="coName"></div>';
      h += '<div class="wf-field"><label>توضیح</label><textarea id="coDesc" rows="2"></textarea></div>';
      h += '<div class="wf-field"><label>روش انتخاب</label><select id="coMode" onchange="NABZ.eduStudio._renderCohortMode(this.value)">';
      h += '<option value="manual">دستی</option><option value="filter">فیلتری</option><option value="mixed">ترکیبی</option>';
      h += '</select></div>';
      h += '<div id="coModeFields"></div>';
      h += '<div id="coPreview" style="margin-top:10px"></div>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.eduStudio._saveCohort(null)">✅ ساخت</button>';
      ST._open(h);
      setTimeout(function() { ST._renderCohortMode('manual'); }, 100);
    },

    _renderCohortMode: function(mode) {
      var el = document.getElementById('coModeFields');
      if (!el) return;
      var h = '';
      if (mode === 'manual' || mode === 'mixed') {
        h += '<div class="wf-field"><label>جستجوی پرسنل</label><input type="search" id="coStaffSearch" placeholder="🔍 نام یا کد..." oninput="NABZ.eduStudio._filterStaff(this.value)"></div>';
        h += '<div id="coStaffList" style="max-height:35vh;overflow-y:auto;background:var(--bg-2);border-radius:6px;padding:6px"><div style="text-align:center;padding:10px"><span class="spinner"></span></div></div>';
        ST._coSelected = new Set();
        ST._loadStaffPicker();
      }
      if (mode === 'filter' || mode === 'mixed') {
        h += '<div class="wf-field" style="margin-top:10px"><label>قواعد فیلتر</label>';
        h += '<div id="coRules">';
        h += '<div style="display:flex;gap:4px;margin-bottom:4px" class="co-rule">';
        h += '<select class="crField" style="flex:1;padding:6px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:4px;color:var(--fg);font-size:11px"><option value="category">نقش</option><option value="wardId">بخش ID</option><option value="employment">نوع استخدام</option></select>';
        h += '<input class="crValues" placeholder="مقادیر با کاما" style="flex:2;padding:6px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:4px;color:var(--fg);font-size:11px">';
        h += '</div></div>';
        h += '<button class="btn btn-sm" style="padding:6px;font-size:11px;margin-top:4px" onclick="NABZ.eduStudio._addRule()">➕ قاعده</button>';
        h += '</div>';
      }
      el.innerHTML = h;
      if (mode === 'mixed') h += '';
    },

    _addRule: function() {
      var rules = document.getElementById('coRules');
      if (!rules) return;
      var r = document.createElement('div');
      r.style.cssText = 'display:flex;gap:4px;margin-bottom:4px';
      r.className = 'co-rule';
      r.innerHTML = '<select class="crField" style="flex:1;padding:6px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:4px;color:var(--fg);font-size:11px"><option value="category">نقش</option><option value="wardId">بخش</option><option value="employment">استخدام</option></select><input class="crValues" placeholder="مقادیر" style="flex:2;padding:6px;background:var(--bg-2);border:1px solid var(--border-2);border-radius:4px;color:var(--fg);font-size:11px">';
      rules.appendChild(r);
    },

    _loadStaffPicker: async function() {
      var el = document.getElementById('coStaffList');
      if (!el) return;
      try {
        var r = await ST._api('/api/edu-studio/staff');
        ST._allStaff = r.items || [];
        el.innerHTML = '';
        if (!ST._allStaff.length) { el.innerHTML = '<div class="empty">پرسنلی نیست</div>'; return; }
        ST._allStaff.slice(0, 300).forEach(function(s) {
          var sid = String(s.id);
          var checked = ST._coSelected.has(sid) ? 'checked' : '';
          el.innerHTML += '<label class="co-staff-item" data-text="' + ST._esc((s.name + ' ' + s.code).toLowerCase()) + '" style="display:flex;gap:6px;padding:6px;border-radius:4px;margin-bottom:2px;cursor:pointer">' +
            '<input type="checkbox" ' + checked + ' onchange="NABZ.eduStudio._toggleCohortStaff(\'' + s.id + '\',this.checked)" style="width:18px;height:18px">' +
            '<div style="flex:1"><div style="font-size:11.5px;font-weight:700">' + ST._esc(s.name) + '</div>' +
            '<div style="font-size:10px;color:var(--fg-2)">' + ST._esc(s.code) + ' · ' + ST._esc(s.category) + '</div></div></label>';
        });
      } catch (e) { el.innerHTML = '<div class="empty">خطا: ' + ST._esc(e.message) + '</div>'; }
    },

    _toggleCohortStaff: function(id, checked) {
      var sid = String(id);
      if (checked) ST._coSelected.add(sid);
      else ST._coSelected.delete(sid);
    },

    _filterStaff: function(q) {
      q = String(q || '').toLowerCase();
      document.querySelectorAll('.co-staff-item').forEach(function(x) {
        x.style.display = x.dataset.text.indexOf(q) >= 0 ? '' : 'none';
      });
    },

    _saveCohort: async function(id) {
      var n = document.getElementById('coName').value.trim();
      if (!n) return alert('نام الزامی');
      var mode = document.getElementById('coMode').value;
      var body = {
        name: n,
        description: document.getElementById('coDesc').value,
        selectionMode: mode,
        staffIds: mode === 'manual' || mode === 'mixed' ? Array.from(ST._coSelected || []) : [],
        filterRules: []
      };
      if (mode === 'filter' || mode === 'mixed') {
        var rules = document.querySelectorAll('.co-rule');
        rules.forEach(function(r) {
          var f = r.querySelector('.crField').value;
          var vs = r.querySelector('.crValues').value.split(',').map(function(x) { return x.trim(); }).filter(Boolean);
          if (vs.length) body.filterRules.push({ field: f, op: 'in', values: vs });
        });
      }
      try {
        if (id) await ST._api('/api/edu-studio/cohorts/' + id, { method:'PUT', body: JSON.stringify(body) });
        else await ST._api('/api/edu-studio/cohorts', { method:'POST', body: JSON.stringify(body) });
        NABZ._toast('✅ ذخیره شد');
        ST._closeAll();
        ST._loadTab('cohorts');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _openCohort: async function(id) {
      try {
        var c = await ST._api('/api/edu-studio/cohorts/' + id);
        var progress = await ST._api('/api/edu-studio/cohorts/' + id + '/progress');
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">👥 ' + ST._esc(c.name) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:8px;padding:10px">';
        h += '<div style="font-size:11.5px">اعضا: <b>' + (progress.cohort.memberCount || 0) + '</b></div>';
        h += '<div style="font-size:11.5px">تخصیص: <b>' + progress.assignments + '</b></div>';
        h += '<div style="font-size:11.5px">تکمیل: <b>' + progress.completedTotal + '</b></div>';
        h += '</div>';
        if (progress.staffProgress && progress.staffProgress.length) {
          h += '<div class="sec-hd" style="margin:10px 0 6px"><span>پیشرفت اعضا</span></div>';
          h += '<div style="max-height:40vh;overflow-y:auto">';
          progress.staffProgress.slice(0, 50).forEach(function(s) {
            h += '<div style="padding:6px;background:var(--bg-2);border-radius:4px;margin-bottom:2px;font-size:11px">';
            h += '<b>' + ST._esc(s.name) + '</b> — ' + s.completed + '/' + s.assignments;
            h += '</div>';
          });
          h += '</div>';
        }
        h += '<div style="display:flex;gap:6px;margin-top:10px;margin-bottom:20px">';
        h += '<button class="btn" style="flex:1;padding:10px;color:var(--dng);border-color:var(--dng)" onclick="NABZ.eduStudio._deleteCohort(\'' + c.id + '\')">حذف</button>';
        h += '<button class="btn" style="flex:1;padding:10px" onclick="this.closest(\'.bs-backdrop\').remove()">بستن</button>';
        h += '</div>';
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _deleteCohort: async function(id) {
      if (!confirm('حذف کلاس؟')) return;
      try {
        await ST._api('/api/edu-studio/cohorts/' + id, { method:'DELETE' });
        NABZ._toast('حذف شد');
        ST._closeAll();
        ST._loadTab('cohorts');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═════════ ASSIGNMENTS ═════════
    _loadAssignments: async function(el) {
      var r = await ST._api('/api/edu-studio/assignments');
      var h = '<button class="btn btn-primary btn-block" style="padding:12px;margin-bottom:12px;font-weight:900" onclick="NABZ.eduStudio._newAssignment()">➕ تخصیص جدید</button>';
      if (!r.items.length) h += '<div class="empty">هنوز تخصیصی نیست</div>';
      else r.items.forEach(function(a) {
        h += '<div class="row lo" style="margin-bottom:4px">';
        h += '<div class="row-hd"><div class="row-title">' + ST._esc(a.examTitle) + '</div><span class="pill info">' + a.totalStaff + '</span></div>';
        h += '<div class="row-meta" style="font-size:10.5px">کلاس: ' + ST._esc(a.cohortName) + ' · مهلت: ' + ST._time(a.dueAt) + '</div>';
        h += '<div style="margin-top:4px"><button class="btn btn-sm" style="padding:4px 8px;font-size:10px;color:var(--dng)" onclick="NABZ.eduStudio._deleteAssignment(\'' + a.id + '\')">حذف</button></div>';
        h += '</div>';
      });
      el.innerHTML = h;
    },

    _newAssignment: async function(examId) {
      var [exams, cohorts] = await Promise.all([
        examId ? Promise.resolve({ items: [{ id: examId }] }) : ST._api('/api/edu-studio/exams?status=published'),
        ST._api('/api/edu-studio/cohorts')
      ]);
      var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📤 تخصیص آزمون</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
      h += '<div class="wf-field"><label>آزمون *</label><select id="asgExam">';
      if (examId) {
        var e = await ST._api('/api/edu-studio/exams/' + examId);
        h += '<option value="' + e.id + '">' + ST._esc(e.title) + '</option>';
      } else {
        (exams.items || []).forEach(function(e) { h += '<option value="' + e.id + '">' + ST._esc(e.title) + '</option>'; });
      }
      h += '</select></div>';
      h += '<div class="wf-field"><label>کلاس *</label><select id="asgCohort">';
      (cohorts.items || []).forEach(function(c) { h += '<option value="' + c.id + '">' + ST._esc(c.name) + ' (' + c.memberCount + ')</option>'; });
      h += '</select></div>';
      h += '<div class="wf-field"><label>مهلت</label><input type="date" id="asgDue" value="' + new Date(Date.now() + 7*86400000).toISOString().slice(0,10) + '"></div>';
      h += '<label style="display:flex;gap:6px;padding:8px;font-size:11.5px"><input type="checkbox" id="asgMand" checked style="width:16px;height:16px">اجباری</label>';
      h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.eduStudio._doCreateAssignment()">✅ تخصیص</button>';
      ST._closeAll();
      ST._open(h);
    },

    _doCreateAssignment: async function() {
      var eid = document.getElementById('asgExam').value;
      var cid = document.getElementById('asgCohort').value;
      if (!eid || !cid) return alert('آزمون و کلاس الزامی');
      try {
        var r = await ST._api('/api/edu-studio/assignments', {
          method:'POST', body: JSON.stringify({
            examId: eid, cohortId: cid,
            dueAt: new Date(document.getElementById('asgDue').value).toISOString(),
            isMandatory: document.getElementById('asgMand').checked
          })
        });
        NABZ._toast('✅ ' + r.totalStaff + ' نفر تخصیص');
        ST._closeAll();
        ST._loadTab('assignments');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _deleteAssignment: async function(id) {
      if (!confirm('حذف تخصیص؟')) return;
      try {
        await ST._api('/api/edu-studio/assignments/' + id, { method:'DELETE' });
        NABZ._toast('حذف شد');
        ST._loadTab('assignments');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═════════ ATTEMPTS ═════════
    _loadAttempts: async function(el) {
      var r = await ST._api('/api/edu-studio/attempts');
      var h = '';
      if (!r.items.length) h += '<div class="empty">هنوز تلاشی نیست</div>';
      else r.items.forEach(function(a) {
        var cls = a.status === 'graded' ? (a.passed ? 'ok' : 'dng') : a.status === 'pending_manual' ? 'warn' : 'info';
        var st = a.status === 'graded' ? (a.passed ? 'قبول' : 'رد') : a.status === 'pending_manual' ? 'در انتظار تصحیح' : 'در حال اجرا';
        h += '<div class="row lo" style="margin-bottom:3px">';
        h += '<div class="row-hd"><div class="row-title">' + ST._esc(a.userName) + '</div><span class="pill ' + cls + '">' + st + '</span></div>';
        h += '<div class="row-meta" style="font-size:10.5px">' + ST._esc(a.examTitle) + ' · ' + (a.score !== undefined ? a.score + '%' : '—') + ' · تلاش ' + a.attemptNumber + '</div>';
        if (a.status === 'pending_manual') h += '<button class="btn btn-sm" style="padding:4px 8px;font-size:10px;margin-top:4px" onclick="NABZ.eduStudio._gradeAttempt(\'' + a.id + '\')">✎ تصحیح</button>';
        h += '</div>';
      });
      el.innerHTML = h;
    },

    _gradeAttempt: async function(id) {
      try {
        var a = await ST._api('/api/edu-studio/attempts?status=pending_manual');
        var attempt = (a.items || []).find(function(x) { return x.id === id; });
        if (!attempt) attempt = (await ST._api('/api/edu-studio/attempts')).items.find(function(x) { return x.id === id; });
        var manualQs = (attempt.graded || []).filter(function(g) { return g.manual && !g.gradedBy; });
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">✎ تصحیح دستی</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="card" style="margin-bottom:10px;padding:8px;font-size:11.5px"><b>' + ST._esc(attempt.userName) + '</b> — ' + ST._esc(attempt.examTitle) + '</div>';
        manualQs.forEach(function(g) {
          var q = attempt.questions.find(function(x) { return x.id === g.id; });
          h += '<div style="padding:10px;background:var(--bg-2);border-radius:6px;margin-bottom:8px">';
          h += '<div style="font-size:11.5px;font-weight:800;margin-bottom:4px">' + ST._esc(q ? q.stem : '') + '</div>';
          h += '<div style="font-size:11px;color:var(--fg-2);margin-bottom:4px">پاسخ: ' + ST._esc(JSON.stringify(g.given)) + '</div>';
          h += '<div class="wf-field" style="margin:0"><label>امتیاز (۰-' + (q ? q.points : 1) + ')</label><input type="number" class="grade-input" data-qid="' + g.id + '" min="0" max="' + (q ? q.points : 1) + '" value="0"></div>';
          h += '</div>';
        });
        h += '<button class="btn btn-primary btn-block" style="padding:14px;margin-top:12px;font-weight:900" onclick="NABZ.eduStudio._submitGrades(\'' + id + '\')">✅ ثبت نمرات</button>';
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    },

    _submitGrades: async function(id) {
      var scores = {};
      document.querySelectorAll('.grade-input').forEach(function(inp) { scores[inp.dataset.qid] = parseFloat(inp.value) || 0; });
      try {
        await ST._api('/api/edu-studio/attempts/' + id + '/grade', { method:'POST', body: JSON.stringify({ scores: scores }) });
        NABZ._toast('✅ تصحیح شد');
        ST._closeAll();
        ST._loadTab('attempts');
      } catch (e) { alert('خطا: ' + e.message); }
    },

    // ═════════ ANALYTICS ═════════
    _loadAnalytics: async function(el) {
      var d = await ST._api('/api/edu-studio/analytics');
      var h = '<div class="sec-hd"><span>📈 تحلیل کلی</span></div>';
      var s = d.stats || {};
      h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
      h += '<div class="rd-stat info"><div class="v">' + (s.exams || 0) + '</div><div class="l">آزمون</div></div>';
      h += '<div class="rd-stat ok"><div class="v">' + (s.certificates || 0) + '</div><div class="l">گواهی</div></div>';
      h += '<div class="rd-stat warn"><div class="v">' + (s.attempts || 0) + '</div><div class="l">تلاش</div></div>';
      h += '</div>';
      h += '<div class="sec-hd" style="margin:12px 0 6px"><span>📊 عملکرد آزمون‌ها</span></div>';
      (d.exams || []).forEach(function(e) {
        h += '<div style="padding:8px;background:var(--bg-2);border-radius:6px;margin-bottom:4px;font-size:11.5px">';
        h += '<div style="display:flex;justify-content:space-between"><b>' + ST._esc(e.title) + '</b><span class="pill ' + (e.attempts ? 'info' : '') + '">' + e.attempts + ' تلاش</span></div>';
        if (e.attempts) {
          h += '<div style="font-size:10.5px;color:var(--fg-2);margin-top:2px">میانگین: ' + e.avgScore + '% · قبولی: ' + e.passRate + '%</div>';
          h += '<button class="btn btn-sm" style="padding:4px 8px;font-size:10px;margin-top:4px" onclick="NABZ.eduStudio._examAnalytics(\'' + e.id + '\')">📈 جزئیات</button>';
        }
        h += '</div>';
      });
      el.innerHTML = h;
    },

    _examAnalytics: async function(id) {
      try {
        var d = await ST._api('/api/edu-studio/exams/' + id + '/analytics');
        var h = '<div class="bs-handle"></div><div class="bs-hd"><div class="bs-title">📈 ' + ST._esc(d.exam.title) + '</div><button class="bs-close" onclick="this.closest(\'.bs-backdrop\').remove()">✕</button></div>';
        h += '<div class="rd-stats" style="grid-template-columns:repeat(3,1fr);margin-bottom:12px">';
        h += '<div class="rd-stat"><div class="v">' + d.attempts + '</div><div class="l">تلاش</div></div>';
        h += '<div class="rd-stat info"><div class="v">' + d.avgScore + '%</div><div class="l">میانگین</div></div>';
        h += '<div class="rd-stat ok"><div class="v">' + d.passRate + '%</div><div class="l">قبولی</div></div>';
        h += '</div>';
        h += '<div class="sec-hd"><span>تحلیل سوالات</span></div>';
        (d.questionStats || []).forEach(function(q) {
          var pv = q.pValue;
          var cls = pv === null ? '' : pv >= 80 ? 'ok' : pv >= 40 ? 'warn' : 'dng';
          h += '<div style="padding:8px;background:var(--bg-2);border-radius:4px;margin-bottom:3px;font-size:11px">';
          h += '<div style="font-weight:700">' + ST._esc((q.stem || '').slice(0, 70)) + '</div>';
          h += '<div style="font-size:10px;color:var(--fg-2);margin-top:2px">' + q.timesCorrect + '/' + q.timesAnswered + (pv !== null ? ' · p=' + pv + '%' : '') + '</div>';
          h += '</div>';
        });
        ST._closeAll();
        ST._open(h);
      } catch (e) { alert('خطا: ' + e.message); }
    }
  };

  window.NABZ = window.NABZ || {};
  NABZ.eduStudio = ST;

  var tries = 0;
  (function tryReg() {
    if (NABZ._dispatchRegistry && typeof NABZ.registerKind === 'function') {
      NABZ.registerKind('edu_studio', function(p, d) { return ST.showStudio(p, d); });
      console.log('[edu-studio-ui] registered');
      return;
    }
    if (++tries > 60) return console.warn('[edu-studio-ui] timeout');
    setTimeout(tryReg, 100);
  })();
})();
