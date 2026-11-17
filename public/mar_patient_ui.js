(function() {
  if (!window.NABZ) return;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function fmtTime(iso) { try { return new Date(iso).toLocaleTimeString('fa-IR', {hour:'2-digit', minute:'2-digit'}); } catch(_) { return '—'; } }

  const FREQ_MAP = { 'OD': 'روزانه', 'Q24H': 'روزانه', 'BID': 'دوبار در روز', 'Q12H': 'هر ۱۲ ساعت', 'TDS': 'سه‌بار در روز', 'Q8H': 'هر ۸ ساعت', 'QID': 'چهاربار در روز', 'Q6H': 'هر ۶ ساعت', 'HS': 'شب‌هنگام', 'Q4H': 'هر ۴ ساعت', 'CONT': 'مداوم', 'Q8H PRN': 'هر ۸ ساعت (PRN)' };
  const ROUTE_MAP = { 'PO': 'خوراکی', 'IV': 'وریدی', 'IV INFUSION': 'سرم وریدی', 'SC': 'زیرجلدی', 'IM': 'عضلانی', 'SL': 'زیرزبانی', 'PR': 'مقعدی', 'INH': 'استنشاقی' };

  async function show(p, data) {
    const pid = (data && data.patientId) || new URLSearchParams(location.search).get('patientId');
    const content = document.getElementById('content');
    if (!content) return;
    content.innerHTML = '<div style="padding:40px;text-align:center;font-weight:900;">⏳ در حال دریافت MAR...</div>';

    try {
      const kardex = await NABZ._api('/api/kardex/' + encodeURIComponent(pid));
      const pat = kardex.patient || {};
      const meds = kardex.meds || [];

      let h = '';
      // هدر بیمار با بج V30
      h += '<div style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe);padding:16px;border-radius:16px;margin:12px;border:1px solid #bae6fd;display:flex;align-items:center;gap:12px;direction:rtl;">';
      h += '<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:900;">' + esc((pat.firstName||'?').charAt(0)) + '</div>';
      h += '<div style="flex:1;"><div style="font-size:16px;font-weight:900;color:#0c4a6e;">MAR - ' + esc((pat.firstName||'')+' '+(pat.lastName||'')) + ' <span style="background:#ef4444;color:#fff;font-size:10px;padding:2px 6px;border-radius:4px;">V30</span></div>';
      h += '<div style="font-size:12px;color:#0369a1;">MRN: ' + esc(pat.mrn||'—') + ' · ' + esc(pat.wardCode||'—') + ' · تخت ' + esc(pat.bedNumber||'—') + '</div></div></div>';

      // لیست داروها
      if (!meds.length) {
        h += '<div style="text-align:center;padding:40px;color:#64748b;">دارویی برای این بیمار ثبت نشده است.</div>';
      } else {
        h += '<div style="padding:0 12px 80px 12px;">';
        meds.forEach(m => {
          const d = m.order || m.details || m;
          const freqFa = FREQ_MAP[(d.frequency||'').toUpperCase()] || d.frequency || '';
          const routeFa = ROUTE_MAP[(d.route||'').toUpperCase()] || d.route || '';
          const isHighAlert = m.classification && m.classification.isHighAlert;

          h += '<div style="margin-bottom:12px;padding:14px;border-radius:12px;border:1px solid #e2e8f0;background:#fff;box-shadow:0 2px 4px rgba(0,0,0,0.02);">';
          
          // نام دارو
          h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">';
          h += '<div><div style="font-weight:900;font-size:15px;color:#1e293b;">' + esc(d.drug) + '</div>';
          h += '<div style="font-size:12px;color:#475569;margin-top:4px;">' + esc(d.dose) + ' · ' + esc(routeFa) + ' · <span style="color:#1e40af;font-weight:700;">' + esc(freqFa) + '</span></div></div>';
          if (isHighAlert) h += '<span style="background:#dc2626;color:#fff;font-size:10px;font-weight:900;padding:2px 6px;border-radius:4px;">HIGH ALERT</span>';
          h += '</div>';
          
          // تایم‌لاین دوزها
          const mar = m.mar || [];
          if (mar.length) {
            h += '<div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px;margin-top:10px;border-top:1px solid #f1f5f9;padding-top:10px;">';
            mar.slice(-6).forEach(ev => {
              const isGiven = ev.status === 'given';
              const color = isGiven ? '#d1fae5' : '#fef3c7';
              const textColor = isGiven ? '#065f46' : '#92400e';
              h += '<div style="flex:1;min-width:60px;text-align:center;padding:6px;border-radius:8px;background:' + color + ';color:' + textColor + ';">';
              h += '<div style="font-size:10px;font-weight:700;">' + fmtTime(ev.scheduledAt) + '</div>';
              h += '<div style="font-size:14px;">' + (isGiven ? '✅' : '⏰') + '</div>';
              if (isGiven && ev.administeredBy) h += '<div style="font-size:9px;opacity:0.7;">' + esc(ev.administeredBy.split(' ')[0]) + '</div>';
              h += '</div>';
            });
            h += '</div>';
          }

          // دکمه‌های عملیاتی (ثبت دوز، رد)
          h += '<div style="display:flex;gap:8px;margin-top:12px;">';
          const nextDose = mar.find(x => x.status === 'scheduled' || x.status === 'due');
          if (nextDose) {
             h += '<button class="btn" style="flex:1;background:#0ea5e9;color:#fff;font-weight:900;padding:10px;" onclick="NABZ.marAdminister(\'' + nextDose.id + '\', \'' + pid + '\')">💉 ثبت دوز</button>';
             h += '<button class="btn" style="flex:1;background:#f1f5f9;color:#475569;padding:10px;" onclick="NABZ.marRefuse(\'' + nextDose.id + '\', \'' + pid + '\')">❌ رد دوز</button>';
          } else {
             h += '<div style="flex:1;text-align:center;font-size:11px;color:#94a3b8;padding:8px;background:#f8fafc;border-radius:8px;">دوز فعالی برای ثبت وجود ندارد</div>';
          }
          h += '</div>';
          h += '</div>';
        });
        h += '</div>';
      }

      content.innerHTML = h;
    } catch(e) {
      content.innerHTML = '<div style="color:red;padding:20px;text-align:center;">خطا در دریافت اطلاعات: ' + esc(e.message) + '</div>';
    }
  }

  // توابع تعاملی سراسری
  NABZ.marAdminister = async function(marId, pid) {
    if (!confirm('آیا از ثبت این دوز اطمینان دارید؟')) return;
    try {
      await NABZ._api('/api/kardex/mar/' + marId + '/given', { method: 'POST', body: JSON.stringify({ note: 'Administered via MAR UI' }) });
      NABZ._toast('✅ دوز با موفقیت ثبت شد');
      show(null, { patientId: pid });
    } catch(e) { alert('خطا: ' + e.message); }
  };

  NABZ.marRefuse = async function(marId, pid) {
    const reason = prompt('دلیل رد دوز را وارد کنید:');
    if (!reason) return;
    try {
      await NABZ._api('/api/kardex/mar/' + marId + '/refuse', { method: 'POST', body: JSON.stringify({ reason }) });
      NABZ._toast('✅ دوز رد شد');
      show(null, { patientId: pid });
    } catch(e) { alert('خطا: ' + e.message); }
  };

  NABZ.registerKind('mar_patient', show);
})();
