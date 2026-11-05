/* =========================================================
  DR. MUHAMMAD ZAHEER ANJUM CLINIC
  STAFF LOGIN JAVASCRIPT
========================================================= */

const API_BASE = "/api";

document.addEventListener("DOMContentLoaded", () => {
    // Redirect if already logged in
    const existingToken = localStorage.getItem("mza_admin_token");
    if (existingToken) {
        verifyExistingToken(existingToken);
    }

    setupPasswordToggle();
    setupLoginForm();
    if (window.lucide) window.lucide.createIcons();

});

// Verify existing token validity
async function verifyExistingToken(token) {
    try {

        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: { "Authorization": `Bearer ${token}` }

        });
        const json = await res.json();
        if (json.success) {
            window.location.href = "admin.html";
        } else {
            localStorage.removeItem("mza_admin_token");
        }
    } catch (e) {
        // Continue to show login form
    }
}

// Password visibility toggle
function setupPasswordToggle() {
    const passwordInput = document.getElementById("password");
    const toggleButton = document.getElementById("togglePassword");

    if (toggleButton && passwordInput) {
        toggleButton.addEventListener("click", () => {
            const isPassword = passwordInput.type === "password";
            passwordInput.type = isPassword ? "text" : "password";
            toggleButton.innerHTML = isPassword ? '<i data-lucide="eye-off"></i>' : '<i data-lucide="eye"></i>';
            if (window.lucide) window.lucide.createIcons();
        });
    }
}

// Login Form Submit Handler
function setupLoginForm() {
    const loginForm = document.getElementById("loginForm");
    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const signInButton = document.getElementById("signInButton");
    const loginError = document.getElementById("loginError");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const username = emailInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            showError("Please enter your email/username and password.");
            return;
        }

        // Set Loading State
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (data.success && data.data?.token) {
                // Store auth token safely
                localStorage.setItem("mza_admin_token", data.data.token);
                if (data.data.user) {
                    localStorage.setItem("mza_admin_user", JSON.stringify(data.data.user));
                }

                // Redirect immediately to admin dashboard (zero delay)
                window.location.replace("admin.html");
            } else {
                showError("Invalid email or password.");
                setLoading(false);
            }
        } catch (error) {
            console.error("Login request error:", error);
            showError("Invalid email or password.");
            setLoading(false);
        }
    });

    function showError(message) {
        if (loginError) {
            loginError.textContent = message;
            loginError.classList.remove("hidden");

        }
    }

    function setLoading(isLoading) {
        if (signInButton) {
            signInButton.disabled = isLoading;
            signInButton.innerHTML = isLoading
                ? '<span>Signing in...</span>'
                : '<span>Authenticate to Dashboard</span><i data-lucide="arrow-right" class="btn-icon"></i>';
            if (window.lucide) window.lucide.createIcons();
        }
    }
}







