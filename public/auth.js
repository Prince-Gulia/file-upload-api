// ── Configuration ──────────────────────────────────────
const API_BASE_URL = "https://file-upload-api-k981.onrender.com";
const ENDPOINTS = {
  login: "/auth/login",
  signup: "/auth/signup",
};

// Check if already logged in -> redirect to dashboard
if (localStorage.getItem("access_token")) {
  window.location.href = "dashboard.html";
}

// ── DOM refs ───────────────────────────────────────────
const loginForm = document.getElementById("login-form");
const loginEmailInput = document.getElementById("login-email");
const loginPasswordInput = document.getElementById("login-password");
const loginError = document.getElementById("login-error");
const loginBtn = document.getElementById("login-btn");

const signupForm = document.getElementById("signup-form");
const signupEmailInput = document.getElementById("signup-email");
const signupPasswordInput = document.getElementById("signup-password");
const signupError = document.getElementById("signup-error");
const signupSuccess = document.getElementById("signup-success");
const signupBtn = document.getElementById("signup-btn");
const showSignupBtn = document.getElementById("show-signup");
const showLoginBtn = document.getElementById("show-login");

// ── Helpers ────────────────────────────────────────────

function showMsg(el, text) {
  el.textContent = text;
  el.hidden = false;
  el.style.display = "block";
}

function hideMsg(el) {
  el.textContent = "";
  el.hidden = true;
  el.style.display = "none";
}

// ── Toggle Login / Signup ──────────────────────────────

showSignupBtn.addEventListener("click", () => {
  loginForm.hidden = true;
  loginForm.style.display = "none";
  signupForm.hidden = false;
  signupForm.style.display = "block";
  hideMsg(loginError);
  hideMsg(signupError);
  hideMsg(signupSuccess);
});

showLoginBtn.addEventListener("click", () => {
  signupForm.hidden = true;
  signupForm.style.display = "none";
  loginForm.hidden = false;
  loginForm.style.display = "block";
  hideMsg(loginError);
  hideMsg(signupError);
  hideMsg(signupSuccess);
});

// ── Login Submit ───────────────────────────────────────

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(loginError);
  loginBtn.disabled = true;
  loginBtn.textContent = "Logging in…";

  try {
    const res = await fetch(API_BASE_URL + ENDPOINTS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: loginEmailInput.value.trim(),
        password: loginPasswordInput.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Login failed");
    }

    localStorage.setItem("access_token", data.accessToken);
    localStorage.setItem("refresh_token", data.refreshToken);
    localStorage.setItem("user_email", loginEmailInput.value.trim());

    // Redirect to Dashboard page
    window.location.href = "dashboard.html";
  } catch (err) {
    showMsg(loginError, err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log in";
  }
});

// ── Signup Submit ──────────────────────────────────────

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideMsg(signupError);
  hideMsg(signupSuccess);
  signupBtn.disabled = true;
  signupBtn.textContent = "Signing up…";

  const email = signupEmailInput.value.trim();
  const password = signupPasswordInput.value;

  try {
    const res = await fetch(API_BASE_URL + ENDPOINTS.signup, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Signup failed");
    }

    // Auto log in after successful signup
    signupBtn.textContent = "Logging in…";
    const loginRes = await fetch(API_BASE_URL + ENDPOINTS.login, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const loginData = await loginRes.json();
    if (loginRes.ok && loginData.accessToken) {
      localStorage.setItem("access_token", loginData.accessToken);
      localStorage.setItem("refresh_token", loginData.refreshToken);
      localStorage.setItem("user_email", email);

      // Redirect to Dashboard page
      window.location.href = "dashboard.html";
    } else {
      showMsg(signupSuccess, "Account created! Switch to login.");
      loginEmailInput.value = email;
    }
  } catch (err) {
    showMsg(signupError, err.message);
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = "Sign up";
  }
});
