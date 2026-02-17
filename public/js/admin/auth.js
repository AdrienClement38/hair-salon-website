// public/js/admin/auth.js
import { API_URL } from './config.js';
import { loadDashboard } from './dashboard.js';
import { apiFetch } from '../utils/api.js';

const loginForm = document.getElementById('login-form');
const setupView = document.getElementById('setup-view');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loadingView = document.getElementById('loading-view');
const setupForm = document.getElementById('setup-form');

export function initAuth() {
    // Initial Check
    (async () => {
        try {
            const res = await apiFetch('api/auth_status.php');
            const data = await res.json();

            if (data.setupRequired) {
                if (loadingView) loadingView.style.display = 'none';
                setupView.style.display = 'flex';
                loginView.style.display = 'none';
                dashboardView.style.display = 'none';
            } else if (data.isAuthenticated) {
                showDashboard();
                loadDashboard(true);
            } else {
                showLogin();
            }
        } catch (e) {
            console.error("Auth status check failed", e);
            showLogin();
        }
    })();

    // Setup Handler
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('setup-username').value;
        const password = document.getElementById('setup-password').value;

        try {
            const res = await apiFetch('api/auth/setup', {
                method: 'POST',
                body: { username, password }
            });

            if (res.ok) {
                // Login automatically
                await login(username, password);
            } else {
                alert('Erreur lors de la création du compte');
            }
        } catch (e) {
            alert('Erreur réseau');
        }
    });

    // Login Handler
    const errorEl = document.getElementById('login-error');
    if (loginForm) {
        // Clear error on input
        loginForm.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', () => {
                if (errorEl) errorEl.style.display = 'none';
            });
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            await login(username, password);
        });
    }
}

async function login(username, password) {
    const errorEl = document.getElementById('login-error');
    const submitBtn = document.querySelector('#login-form button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.textContent : 'Connexion';

    if (errorEl) errorEl.style.display = 'none';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion...';
    }

    try {
        const res = await apiFetch('api/auth_login.php', {
            method: 'POST',
            body: { username, password }
        });

        const data = await res.json();

        if (res.ok && data.success) {
            // Success
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
            window.location.reload();
        } else {
            throw new Error(data.error || 'Identifiants incorrects');
        }

    } catch (e) {
        console.error(e);
        if (errorEl) {
            errorEl.textContent = e.message || 'Erreur réseau';
            errorEl.style.display = 'block';
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    }
}

export async function verifyAuth() {
    // Kept for compatibility if other modules call it, but initAuth handles main check
    // Logic is now effectively "check status"
    try {
        const res = await apiFetch('api/auth_status.php');
        const data = await res.json();
        if (!data.isAuthenticated) {
            showLogin();
        }
    } catch (e) {
        showLogin();
    }
}

function showLogin() {
    if (loadingView) loadingView.style.display = 'none';
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
    setupView.style.display = 'none';
}

function showDashboard() {
    if (loadingView) loadingView.style.display = 'none';
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    setupView.style.display = 'none';
}

export async function logout() {
    try {
        await apiFetch('api/auth_logout.php', { method: 'POST' });
        window.location.reload();
    } catch (e) {
        window.location.reload();
    }
}

window.logout = logout;
