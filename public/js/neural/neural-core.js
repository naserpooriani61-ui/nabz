const NABZ_Neural = (function() {
    'use strict';
    const state = { isOpen: false, query: '', selectedIndex: 0 };
    const commands = [
        { id: 'sup_report', title: 'گزارش سوپروایزر', category: 'مدیریت', icon: '📋', action: () => navigateTo('/supervisor/report') },
        { id: 'ed_visits', title: 'مراجعین اورژانس', category: 'بالینی', icon: '🚨', action: () => navigateTo('/emergency/visits') },
        { id: 'bed_board', title: 'تخته تخت‌ها', category: 'عملیات', icon: '🛏️', action: () => navigateTo('/bedboard/wards') },
        { id: 'cdss_alerts', title: 'هشدارهای CDSS', category: 'ایمنی', icon: '🧠', action: () => navigateTo('/cdss/alerts') },
        { id: 'shift_roster', title: 'برنامه شیفت', category: 'منابع', icon: '📅', action: () => navigateTo('/ops/rosters') },
        { id: 'patient_search', title: 'جستجوی بیمار', category: 'بالینی', icon: '🔍', action: () => navigateTo('/clinical/patients') }
    ];
    function navigateTo(path) { closeOmnibar(); window.location.href = path; }
    function getFilteredCommands(query) {
        if (!query) return commands;
        const q = query.toLowerCase();
        return commands.map(cmd => {
            let score = 0; const title = cmd.title.toLowerCase();
            if (title === q) score = 100; else if (title.startsWith(q)) score = 90; else if (title.includes(q)) score = 80;
            return { ...cmd, score };
        }).filter(cmd => cmd.score > 0).sort((a, b) => b.score - a.score);
    }
    function renderOmnibar() {
        let overlay = document.getElementById('neural-omnibar');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'neural-omnibar'; overlay.className = 'neural-omnibar-overlay';
            overlay.innerHTML = '<div class="neural-omnibar-box"><input type="text" class="neural-omnibar-input" placeholder="فرمان خود را تایپ کنید (مثلاً: گزارش، بیمار...)"><div class="neural-omnibar-list"></div></div>';
            document.body.appendChild(overlay);
            const input = overlay.querySelector('.neural-omnibar-input');
            input.addEventListener('input', (e) => { state.query = e.target.value; state.selectedIndex = 0; renderList(); });
            input.addEventListener('keydown', handleKeydown);
            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOmnibar(); });
        }
        renderList();
    }
    function renderList() {
        const listEl = document.querySelector('.neural-omnibar-list'); if (!listEl) return;
        const filtered = getFilteredCommands(state.query);
        listEl.innerHTML = filtered.map((cmd, index) => `<div class="neural-omnibar-item ${index === state.selectedIndex ? 'selected' : ''}" data-index="${index}"><span class="icon">${cmd.icon}</span><span class="title">${cmd.title}</span><span class="meta">${cmd.category}</span></div>`).join('');
        listEl.querySelectorAll('.neural-omnibar-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.dataset.index);
                if (filtered[idx]) { const cmdIndex = commands.findIndex(c => c.id === filtered[idx].id); if (cmdIndex !== -1) commands[cmdIndex].action(); }
            });
        });
    }
    function handleKeydown(e) {
        const filtered = getFilteredCommands(state.query);
        if (e.key === 'ArrowDown') { e.preventDefault(); state.selectedIndex = (state.selectedIndex + 1) % filtered.length; renderList(); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); state.selectedIndex = (state.selectedIndex - 1 + filtered.length) % filtered.length; renderList(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (filtered[state.selectedIndex]) { const cmdIndex = commands.findIndex(c => c.id === filtered[state.selectedIndex].id); if (cmdIndex !== -1) commands[cmdIndex].action(); } }
        else if (e.key === 'Escape') { closeOmnibar(); }
    }
    function toggleOmnibar() {
        state.isOpen = !state.isOpen; const overlay = document.getElementById('neural-omnibar');
        if (state.isOpen) { overlay.classList.add('active'); setTimeout(() => overlay.querySelector('input').focus(), 100); }
        else { closeOmnibar(); }
    }
    function closeOmnibar() {
        state.isOpen = false; state.query = ''; state.selectedIndex = 0;
        const overlay = document.getElementById('neural-omnibar');
        if (overlay) { overlay.classList.remove('active'); overlay.querySelector('input').value = ''; }
    }
    return {
        init: function() {
            document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); toggleOmnibar(); } });
            console.log('✅ NABZ Neural Core Initialized (Press Ctrl+K)');
        }
    };
})();
if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => NABZ_Neural.init()); } else { NABZ_Neural.init(); }
