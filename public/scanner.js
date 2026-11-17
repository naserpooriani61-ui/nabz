// ═══════════════════════════════════════════════════════════
//  NABZ QR Scanner — Camera + BarcodeDetector
// ═══════════════════════════════════════════════════════════

NABZ.openQRScanner = async function() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    alert('دوربین در دسترس نیست. از ورود دستی استفاده کنید.');
    return NABZ._qrManualPrompt();
  }

  const modal = document.createElement('div');
  modal.className = 'qr-modal';
  modal.innerHTML =
    '<div class="qr-hdr"><button class="qr-close" onclick="NABZ._closeQR()">✕</button><span>📷 اسکن QR</span></div>' +
    '<div class="qr-video-wrap"><video id="qrVideo" autoplay playsinline muted></video>' +
    '<div class="qr-frame"></div>' +
    '<div class="qr-loading" id="qrLoading"><div class="spinner"></div></div>' +
    '</div>' +
    '<div class="qr-hint" id="qrHint">کد QR بخش را در کادر قرار دهید</div>' +
    '<div class="qr-manual">' +
    '<input id="qrManual" placeholder="یا کد را دستی وارد کنید">' +
    '<button onclick="NABZ._qrManualInput()">تأیید</button>' +
    '</div>';
  document.body.appendChild(modal);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    modal._stream = stream;
    const video = document.getElementById('qrVideo');
    video.srcObject = stream;

    // Wait for video metadata
    await new Promise(resolve => {
      if (video.readyState >= 2) resolve();
      else video.onloadedmetadata = resolve;
    });
    document.getElementById('qrLoading').style.display = 'none';

    // BarcodeDetector support?
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      let stopped = false;

      const scanLoop = async () => {
        if (stopped || !document.body.contains(modal)) return;
        try {
          if (video.readyState === video.HAVE_ENOUGH_DATA) {
            const codes = await detector.detect(video);
            if (codes.length > 0) {
              stopped = true;
              NABZ._qrProcess(codes[0].rawValue);
              return;
            }
          }
        } catch (_) {}
        if (!stopped) requestAnimationFrame(scanLoop);
      };
      scanLoop();
    } else {
      // No BarcodeDetector — notify user
      document.getElementById('qrHint').textContent = '⚠️ مرورگر از اسکن خودکار پشتیبانی نمی‌کند — کد را دستی وارد کنید';
      document.getElementById('qrHint').style.background = 'rgba(245,158,11,0.9)';
    }
  } catch (e) {
    NABZ._closeQR();
    if (e.name === 'NotAllowedError') {
      alert('اجازه دسترسی به دوربین داده نشد.');
    } else {
      alert('خطا: ' + e.message);
    }
  }
};

NABZ._closeQR = function() {
  const modal = document.querySelector('.qr-modal');
  if (!modal) return;
  if (modal._stream) {
    modal._stream.getTracks().forEach(t => t.stop());
  }
  modal.remove();
};

NABZ._qrManualPrompt = function() {
  const code = prompt('کد QR را وارد کنید:');
  if (code) NABZ._qrProcess(code);
};

NABZ._qrManualInput = function() {
  const inp = document.getElementById('qrManual');
  if (!inp || !inp.value.trim()) return;
  NABZ._qrProcess(inp.value.trim());
};

NABZ._qrProcess = async function(code) {
  NABZ._closeQR();
  NABZ._toast('در حال بررسی کد...');
  try {
    const r = await NABZ._api('/api/qr/scan', { method: 'POST', body: JSON.stringify({ code: code }) });
    const action = r.action === 'checkin' ? 'ثبت ورود' : 'ثبت خروج';
    NABZ._toast('✅ ' + action + ' — بخش ' + r.ward);
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    // Refresh current panel
    if (NABZ.state.current) NABZ.show(NABZ.state.current);
  } catch (e) {
    alert('❌ ' + e.message);
  }
};
