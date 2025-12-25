// public/js/admin/ui.js

const ICON_EYE = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
const ICON_EYE_OFF = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07-2.3 2.3"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

export function initUI() {
    // Lock/Unlock Old Password field based on New Password input
    const newPassInput = document.getElementById('profile-new-pass');
    const oldPassInput = document.getElementById('profile-old-pass');

    if (newPassInput && oldPassInput) {
        newPassInput.addEventListener('input', (e) => {
            if (e.target.value.length > 0) {
                oldPassInput.disabled = false;
                oldPassInput.required = true;
            } else {
                oldPassInput.disabled = true;
                oldPassInput.required = false;
                oldPassInput.value = '';
            }
        });
    }

    // Restore active tab
    const savedTab = localStorage.getItem('adminActiveTab') || 'appointments';
    switchTab(savedTab);
}

export function switchTab(tab) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    // Convert 'photos' legacy tab call to 'content' if needed
    if (tab === 'photos') tab = 'content';

    const tabContent = document.getElementById(`tab-${tab}`);
    const tabBtn = document.getElementById(`tab-btn-${tab}`);

    if (tabContent) tabContent.classList.add('active');
    if (tabBtn) tabBtn.classList.add('active');

    // Save state
    localStorage.setItem('adminActiveTab', tab);
}

export function togglePassword(btn) {
    const input = btn.previousElementSibling;
    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = ICON_EYE_OFF;
    } else {
        input.type = 'password';
        btn.innerHTML = ICON_EYE;
    }
}

// Expose for onclick handlers
window.switchTab = switchTab;
window.togglePassword = togglePassword;
