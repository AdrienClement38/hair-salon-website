// public/js/reset-password.js

document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    const loadingMsg = document.getElementById('loading-msg');
    const errorMsg = document.getElementById('error-msg');
    const resetForm = document.getElementById('reset-form');
    const tokenInput = document.getElementById('reset-token');
    const formError = document.getElementById('form-error');

    if (!token) {
        showError("Lien invalide (token manquant).");
        return;
    }

    // Verify Token immediately
    try {
        const res = await fetch(`/api/auth/verify-token/${token}`);
        const data = await res.json();

        if (res.ok && data.valid) {
            loadingMsg.style.display = 'none';
            resetForm.style.display = 'block';
            tokenInput.value = token;
        } else {
            showError(data.error || "Ce lien a expiré ou est invalide.");
        }
    } catch (e) {
        console.error(e);
        showError("Erreur de connexion serveur.");
    }

    function showError(msg) {
        loadingMsg.style.display = 'none';
        resetForm.style.display = 'none';
        errorMsg.textContent = msg;
        errorMsg.style.display = 'block';
    }

    // Helper function to display messages (assuming this is intended to replace formError and loadingMsg for submit)
    function showMessage(msg, type) {
        if (type === 'error') {
            formError.textContent = msg;
            formError.style.display = 'block';
            loadingMsg.style.display = 'none';
        } else if (type === 'success') {
            loadingMsg.textContent = msg;
            loadingMsg.style.color = 'green';
            loadingMsg.style.display = 'block';
            formError.style.display = 'none';
        }
    }

    // Handle Submit
    resetForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        const username = document.getElementById('username').value;
        const submitBtn = document.getElementById('submit-btn'); // Keep submitBtn for disabling

        if (newPassword !== confirmPassword) {
            showMessage('Les mots de passe ne correspondent pas.', 'error');
            return;
        }

        if (!username) {
            showMessage('Veuillez entrer votre identifiant de connexion.', 'error');
            return;
        }

        // Clear previous messages and disable button
        showMessage('', 'error'); // Clear error
        submitBtn.disabled = true;
        submitBtn.textContent = "Enregistrement...";

        try {
            const res = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, newPassword, username })
            });

            const data = await res.json();

            if (data.success) { // Changed condition from res.ok to data.success
                showMessage('Mot de passe mis à jour ! Redirection...', 'success');
                resetForm.style.display = 'none'; // Hide form on success
                setTimeout(() => window.location.href = 'admin.html', 2000);
            } else {
                showMessage(data.error || 'Erreur lors de la mise à jour.', 'error');
                submitBtn.disabled = false;
                submitBtn.textContent = "Enregistrer";
            }
        } catch (e) {
            console.error(e);
            formError.textContent = "Erreur réseau.";
            submitBtn.disabled = false;
            submitBtn.textContent = "Enregistrer";
        }
    });
});


// Global function for password toggle
window.togglePassword = function (btn) {
    const wrapper = btn.closest('.password-wrapper');
    const input = wrapper.querySelector('input');

    if (input.type === 'password') {
        input.type = 'text';
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;
    } else {
        input.type = 'password';
        btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    }
};
