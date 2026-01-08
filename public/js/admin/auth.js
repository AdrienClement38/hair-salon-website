// public/js/admin/auth.js
import { API_URL, getHeaders } from './config.js';
import { loadDashboard } from './dashboard.js';

const loginForm = document.getElementById('login-form');
const setupView = document.getElementById('setup-view');
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loadingView = document.getElementById('loading-view'); // New
const setupForm = document.getElementById('setup-form');

export function initAuth() {
    // Initial Check
    (async () => {
        try {
            const res = await fetch('/api/auth/status');
            const data = await res.json();

            if (data.setupRequired) {
                if (loadingView) loadingView.style.display = 'none';
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

                // Reload to initialize everything (settings, etc.) with new auth
                window.location.reload();
            } else {
                let errorMsg = 'Identifiants incorrects';
                try {
                    const data = await res.json();
                    if (data.error) errorMsg = data.error;
                } catch (jsonErr) {
                    console.warn('Non-JSON error response');
                }
                const errorEl = document.getElementById('login-error');
                errorEl.textContent = errorMsg;
                errorEl.style.display = 'block';
            }
        } catch (e) {
            console.error(e);

            document.getElementById('login-error').style.display = 'block';
        }
    });

    // Forgot Password Logic
    const forgotLink = document.getElementById('forgot-password-link');
    const forgotModal = document.getElementById('forgotPasswordModal'); // Fixed ID
    const closeForgot = forgotModal ? forgotModal.querySelector('.close-modal') : null;
    const forgotForm = document.getElementById('forgotPasswordForm'); // Fixed ID
    // resetMessage removed as not in HTML anymore

    if (forgotLink && forgotModal) {
        forgotLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotModal.style.display = 'block'; // Ensure block display
        });
    }

    if (closeForgot) {
        closeForgot.addEventListener('click', () => {
            forgotModal.style.display = 'none';
        });
    }

    // Close on outside click
    window.addEventListener('click', (e) => {
        if (e.target == forgotModal) {
            forgotModal.style.display = 'none';
        }
    });

    // Forgot Password Form Submission
    // The original code uses `forgotForm` and `forgotModal`. I will adapt the new code to use these existing variables.
    if (forgotForm) { // Assuming forgotForm is the element with id 'forgot-password-form'
        forgotForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = forgotForm.querySelector('button[type="submit"]');
            const originalText = submitBtn.textContent;

            submitBtn.textContent = 'Envoi en cours...';
            submitBtn.disabled = true;

            try {
                // No username required anymore
                const res = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({})
                });

                const contentType = res.headers.get("content-type");
                if (contentType && contentType.indexOf("application/json") !== -1) {
                    const data = await res.json();

                    if (data.success) {
                        forgotModal.style.display = 'none';
                        alert("✅ Un email de réinitialisation a bien été envoyé !\n\nVérifiez la boîte mail du salon (celle configurée dans les paramètres) pour y trouver le lien.");
                    } else {
                        alert('Erreur: ' + (data.error || 'Erreur inconnue'));
                    }
                } else {
                    const text = await res.text();
                    console.error('Server Error:', text);
                    alert('Erreur Serveur (Non-JSON) : ' + text.substring(0, 500)); // Show first 500 chars
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Une erreur est survenue : ' + error.message);
            } finally {
                submitBtn.textContent = originalText;
                submitBtn.disabled = false;
            }
        });
    }
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

export function logout() {
    localStorage.removeItem('auth');
    location.reload();
}

window.logout = logout; // Expose to window for onclick
