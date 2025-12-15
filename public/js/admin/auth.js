// public/js/admin/auth.js
import { API_URL, getHeaders } from './config.js';
import { loadDashboard } from './dashboard.js';

const loginForm = document.getElementById('login-form');
const setupView = document.getElementById('setup-view');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const setupForm = document.getElementById('setup-form');

export function initAuth() {
    // Initial Check
    (async () => {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();

            if (data.setupRequired) {
                setupView.style.display = 'flex';
                loginView.style.display = 'none';
                dashboardView.style.display = 'none';
            } else {
                verifyAuth();
            }
        } catch (e) {
            console.error("Auth status check failed", e);
            // Fallback to login view
            verifyAuth();
        }
    })();

    // Setup Handler
    setupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('setup-username').value;
        const password = document.getElementById('setup-password').value;

        try {
            const res = await fetch('/api/auth/setup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                // Auto login
                const authString = btoa(`${username}:${password}`);
                localStorage.setItem('auth', authString);
                window.location.reload();
            } else {
                alert('Erreur lors de la création du compte');
            }
        } catch (e) {
            alert('Erreur réseau');
        }
    });

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                const authString = btoa(`${username}:${password}`);
                localStorage.setItem('auth', authString);

                // Clear fields to prevent autofill on other forms
                document.getElementById('username').value = '';
                document.getElementById('password').value = '';

                verifyAuth();
            } else {
                document.getElementById('login-error').style.display = 'block';
            }
        } catch (e) {
            console.error(e);
            document.getElementById('login-error').style.display = 'block';
        }
    });
}

export async function verifyAuth() {
    const auth = localStorage.getItem('auth');
    if (!auth) {
        showLogin();
        return;
    }

    try {
        const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
        if (res.ok) {
            showDashboard();
            loadDashboard(true);
        } else {
            console.warn('Auth failed or expired');
            localStorage.removeItem('auth');
            showLogin();
        }
    } catch (err) {
        console.error(err);
        localStorage.removeItem('auth');
        showLogin();
    }
}

function showLogin() {
    loginView.style.display = 'flex';
    dashboardView.style.display = 'none';
    setupView.style.display = 'none';
}

function showDashboard() {
    loginView.style.display = 'none';
    dashboardView.style.display = 'block';
    setupView.style.display = 'none';
}

export function logout() {
    localStorage.removeItem('auth');
    location.reload();
}

window.logout = logout; // Expose to window for onclick
