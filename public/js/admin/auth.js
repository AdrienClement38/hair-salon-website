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
    // Login Handler
    // Login Handler
    const errorEl = document.getElementById('login-error');

    // Clear error on input
    if (loginForm && errorEl) {
        try {
            loginForm.querySelectorAll('input').forEach(input => {
                input.addEventListener('input', () => {
                    errorEl.style.display = 'none';
                });
            });
        } catch (e) {
            console.warn('Error attaching input listeners', e);
        }
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const submitBtn = loginForm.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;

            // Reset state
            errorEl.style.display = 'none';
            submitBtn.disabled = true;
            submitBtn.textContent = 'Connexion...';

            // UX: Artificial delay to ensure user sees the "Processing" state
            await new Promise(r => setTimeout(r, 600));

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

                    errorEl.textContent = errorMsg;
                    errorEl.style.display = 'block';

                    // Restore button
                    submitBtn.disabled = false;
                    submitBtn.textContent = originalBtnText;
                }
            } catch (e) {
                console.error(e);
                errorEl.textContent = 'Erreur réseau';
                errorEl.style.display = 'block';

                // Restore button
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        });

        // Forgot Password Logic - Native Alert Implementation
        const forgotLink = document.getElementById('forgot-password-link');

        if (forgotLink) {
            forgotLink.addEventListener('click', async (e) => {
                e.preventDefault();

                if (confirm("Réinitialisation du mot de passe\n\nUn lien de réinitialisation sera envoyé à l'adresse email configurée pour le salon.\n\nVoulez-vous continuer ?")) {
                    try {
                        // Visual feedback during request (optional, but good for UX)
                        const originalText = forgotLink.textContent;
                        forgotLink.textContent = "Envoi en cours...";
                        forgotLink.style.pointerEvents = "none";
                        forgotLink.style.color = "#999";

                        const res = await fetch('/api/auth/forgot-password', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({})
                        });

                        // Restore link state
                        forgotLink.textContent = originalText;
                        forgotLink.style.pointerEvents = "auto";
                        forgotLink.style.color = "#666";

                        const contentType = res.headers.get("content-type");
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                            const data = await res.json();
                            if (data.success) {
                                alert("✅ Un email de réinitialisation a bien été envoyé !\n\nVérifiez la boîte mail du salon pour y trouver le lien.");
                            } else {
                                alert('Erreur: ' + (data.error || 'Erreur inconnue'));
                            }
                        } else {
                            const text = await res.text();
                            console.error('Server Error:', text);
                            alert('Erreur Serveur (Non-JSON) : ' + text.substring(0, 500));
                        }

                    } catch (error) {
                        console.error('Error:', error);
                        alert('Une erreur est survenue : ' + error.message);

                        // Restore link state in case of error
                        forgotLink.textContent = "Mot de passe oublié ?";
                        forgotLink.style.pointerEvents = "auto";
                        forgotLink.style.color = "#666";
                    }
                }
            });
        }
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
