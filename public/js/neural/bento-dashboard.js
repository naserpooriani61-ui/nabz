function renderNeuralDashboard(containerId = 'dashboard-root') {
    const container = document.getElementById(containerId); if (!container) return;
    const hour = new Date().getHours();
    const isMorning = hour >= 6 && hour < 14;
    const userName = (window.currentUser && window.currentUser.name) ? window.currentUser.name : 'همکار گرامی';
    const widgets = [
        { id: 'greeting', title: isMorning ? 'صبح بخیر' : 'عصر بخیر', icon: '👋', span: 'col-span-4', theme: 'success', data: `${userName}، سیستم NABZ آماده است.`, actionText: 'شروع', actionLink: '#' },
        { id: 'urgent', title: 'اقدامات فوری', icon: '🚨', span: 'col-span-2', theme: 'critical', data: 'موارد نیاز به بررسی', actionText: 'مشاهده', actionLink: '/emergency/codes' },
        { id: 'beds', title: 'وضعیت تخت‌ها', icon: '🛏️', span: 'col-span-2', theme: 'normal', data: 'ظرفیت بخش‌ها', actionText: 'مدیریت', actionLink: '/bedboard/wards' }
    ];
    container.innerHTML = `<div class="neural-bento-grid">${widgets.map(w => `<div class="neural-bento-card ${w.span} ${w.theme}"><div class="neural-card-header"><div class="neural-card-title"><span>${w.icon}</span><span>${w.title}</span></div></div><p style="color: #6b7280; margin-bottom: 16px;">${w.data}</p><a href="${w.actionLink}" class="neural-card-action">${w.actionText} →</a></div>`).join('')}</div>`;
}
window.renderNeuralDashboard = renderNeuralDashboard;
