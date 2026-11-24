// public/shift_roster_ui.js — NABZ Intelligent Shift Roster (Minimal & Clean)
(function() {
  'use strict';
  const fa = (n) => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  async function api(url, opts = {}) {
    if (typeof NABZ !== 'undefined' && typeof NABZ._api === 'function') return NABZ._api(url, opts);
    const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
    return res.json();
  }

  if (!document.getElementById('roster-style')) {
    const st = document.createElement('style'); st.id = 'roster-style';
    st.textContent = `
      .rost-wrap { direction: rtl; font-family: 'Vazirmatn', Tahoma, sans-serif; background: #f8fafc; min-height: 100vh; padding: 16px; }
      .rost-card { background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
      .rost-header { font-size: 16px; font-weight: 800; color: #0f172a; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center; }
      .rost-btn { padding: 10px 16px; border-radius: 8px; border: none; font-weight: 700; font-size: 13px; cursor: pointer; width: 100%; transition: opacity 0.2s; }
      .rost-btn-primary { background: #1e40af; color: #fff; }
      .rost-btn:active { opacity: 0.8; }
      .rost-loading { padding: 40px; text-align: center; color: #64748b; }
      .rost-grid { overflow-x: auto; }
      .rost-table { width: 100%; border-collapse: collapse; font-size: 12px; min-width: 600px; }
      .rost-table th, .rost-table td { border: 1px solid #e2e8f0; padding: 6px; text-align: center; }
      .rost-table th { background: #f8fafc; font-weight: 700; color: #475569; position: sticky; left: 0; }
      .rost-table td:first-child { text-align: right; font-weight: 700; background: #fff; position: sticky; left: 0; z-index: 1; }
      .shift-m { background: #fef3c7; color: #92400e; font-weight: 700; border-radius: 4px; padding: 2px 4px; }
      .shift-e { background: #ffedd5; color: #9a3412; font-weight: 700; border-radius: 4px; padding: 2px 4px; }
      .shift-n { background: #e0e7ff; color: #3730a3; font-weight: 700; border-radius: 4px; padding: 2px 4px; }
      .shift-off { color: #94a3b8; }
    `;
    document.head.appendChild(st);
  }

  async function show() {
    const host = document.getElementById('content'); if (!host) return;
    host.innerHTML = `
      <div class="rost-wrap">
        <div class="rost-card">
          <div class="rost-header">
            <span>🧠 تولید رستر هوشمند شیفت</span>
          </div>
          <p style="font-size:13px;color:#475569;margin-bottom:16px">الگوریتم Simulated Annealing با رعایت قوانین استراحت، سقف شب، و درخواست‌ها، بهترین چیدمان را تولید می‌کند.</p>
          <button class="rost-btn rost-btn-primary" onclick="NABZ._rostGenerate()">🚀 اجرای چیدمان هوشمند (تست)</button>
        </div>
        <div id="rost-result"></div>
      </div>`;
  }

  window.NABZ = window.NABZ || {};
  
  window.NABZ._rostGenerate = async function() {
    const resultDiv = document.getElementById('rost-result');
    resultDiv.innerHTML = '<div class="rost-loading">⏳ در حال محاسبه هزاران ترکیب ممکن...</div>';
    
    // Dummy data for testing the engine
    const dummyStaff = [
      { id: 's1', name: 'پرستار ۱', locked: Array(7).fill(false) },
      { id: 's2', name: 'پرستار ۲', locked: Array(7).fill(false) },
      { id: 's3', name: 'پرستار ۳', locked: Array(7).fill(false) },
      { id: 's4', name: 'پرستار ۴', locked: Array(7).fill(false) }
    ];
    const dummyRequests = [
      [1, 1, 0, 0, 0, 0, 0], // 1 = morning
      [0, 0, 2, 2, 0, 0, 0], // 2 = evening
      [0, 0, 0, 0, 3, 3, 0], // 3 = night
      [0, 0, 0, 0, 0, 0, 0]
    ];
    const rules = { minM: 1, minE: 1, minN: 1, maxConsec: 5, maxConsecNights: 2 };

    try {
      const res = await api('/api/shift-roster/generate', { 
        method: 'POST', 
        body: JSON.stringify({ staff: dummyStaff, days: 7, rules, requests: dummyRequests }) 
      });
      
      if (res.ok) {
        const grid = res.roster.grid;
        let html = `<div class="rost-card"><div class="rost-header">✅ چیدمان با موفقیت انجام شد (امتیاز خطا: ${fa(res.roster.cost)})</div>`;
        html += '<div class="rost-grid"><table class="rost-table"><thead><tr><th>پرسنل</th>';
        for (let d = 1; d <= 7; d++) html += `<th>روز ${fa(d)}</th>`;
        html += '</tr></thead><tbody>';
        
        grid.forEach((row, i) => {
          html += `<tr><td>${esc(dummyStaff[i].name)}</td>`;
          row.forEach(shift => {
            let cls = 'shift-off', txt = '—';
            if (shift === 'morning') { cls = 'shift-m'; txt = 'ص'; }
            else if (shift === 'evening') { cls = 'shift-e'; txt = 'ع'; }
            else if (shift === 'night') { cls = 'shift-n'; txt = 'ش'; }
            html += `<td><span class="${cls}">${txt}</span></td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table></div></div>';
        resultDiv.innerHTML = html;
      }
    } catch (e) {
      resultDiv.innerHTML = `<div class="rost-loading" style="color:#dc2626">خطا در چیدمان: ${esc(e.message)}</div>`;
    }
  };

  if (typeof NABZ !== 'undefined' && typeof NABZ.registerKind === 'function') {
    NABZ.registerKind('shift_roster', show);
  }
})();
