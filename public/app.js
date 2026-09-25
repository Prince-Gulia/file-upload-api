// ── Configuration ──────────────────────────────────────
// Change these to match your backend.
const API_BASE_URL = "https://file-upload-api-k981.onrender.com";
const ENDPOINTS = {
  login: "/auth/login",
  signup: "/auth/signup",
  upload: "/upload",        // POST  multipart, field "file"
  files: "/files",          // GET   list all files
  file: "/files",           // GET   /files/:id  (id appended)
  deleteFile: "/files",     // DELETE /files/:id
};
const POLL_INTERVAL_MS = 4000;

// ── State ──────────────────────────────────────────────
let accessToken = localStorage.getItem("access_token") || null;
let refreshToken = localStorage.getItem("refresh_token") || null;
let userEmail = localStorage.getItem("user_email") || "";
let pollTimer = null;
let selectedFile = null;

// ── DOM refs ───────────────────────────────────────────
const loginView = document.getElementById("login-view");
const appView = document.getElementById("app-view");
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

const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");

const dropZone = document.getElementById("drop-zone");
const dropLabel = document.getElementById("drop-label");
const fileInput = document.getElementById("file-input");
const selectedFileEl = document.getElementById("selected-file");
const selectedNameEl = document.getElementById("selected-name");
const selectedSizeEl = document.getElementById("selected-size");
const clearFileBtn = document.getElementById("clear-file");
const uploadBtn = document.getElementById("upload-btn");
const uploadError = document.getElementById("upload-error");
const uploadSuccess = document.getElementById("upload-success");

const refreshBtn = document.getElementById("refresh-btn");
const jobsError = document.getElementById("jobs-error");
const jobsEmpty = document.getElementById("jobs-empty");
const jobsTableWrap = document.getElementById("jobs-table-wrap");
const jobsBody = document.getElementById("jobs-body");

// ── Helpers ────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function showMsg(el, text) {
  el.textContent = text;
  el.hidden = false;
}

function hideMsg(el) {
  el.textContent = "";
  el.hidden = true;
}

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];
const MAX_SIZE = 10 * 1024 * 1024;

function validateFile(file) {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "File type not allowed. Use JPEG, PNG, WebP, or PDF.";
  }
  if (file.size > MAX_SIZE) {
    return "File exceeds 10 MB limit.";
  }
  return null;
}

async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {};
  if (accessToken) {
    headers["Authorization"] = "Bearer " + accessToken;
  }
  // Don't set Content-Type for FormData (browser sets boundary)
  if (!(opts.body instanceof FormData)) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  const res = await fetch(API_BASE_URL + path, { ...opts, headers });
  if (res.status === 401) {
    logout();
    throw new Error("Session expired. Please log in again.");
  }
  return res;
}

// ── Auth ───────────────────────────────────────────────

function showApp() {
  loginView.hidden = true;
  appView.hidden = false;
  userEmailEl.textContent = userEmail;
  loadJobs();
  startPolling();
}

function showLogin() {
  loginView.hidden = false;
  appView.hidden = true;
  stopPolling();
}

function logout() {
  accessToken = null;
  refreshToken = null;
  userEmail = "";
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_email");
  showLogin();
}

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
    accessToken = data.accessToken;
    refreshToken = data.refreshToken;
    userEmail = loginEmailInput.value.trim();
    localStorage.setItem("access_token", accessToken);
    localStorage.setItem("refresh_token", refreshToken);
    localStorage.setItem("user_email", userEmail);
    loginForm.reset();
    showApp();
  } catch (err) {
    showMsg(loginError, err.message);
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = "Log in";
  }
});

logoutBtn.addEventListener("click", logout);

// ── Signup ─────────────────────────────────────────────

showSignupBtn.addEventListener("click", () => {
  loginForm.hidden = true;
  signupForm.hidden = false;
  hideMsg(loginError);
  hideMsg(signupError);
  hideMsg(signupSuccess);
});

showLoginBtn.addEventListener("click", () => {
  signupForm.hidden = true;
  loginForm.hidden = false;
  hideMsg(loginError);
  hideMsg(signupError);
  hideMsg(signupSuccess);
});

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
      accessToken = loginData.accessToken;
      refreshToken = loginData.refreshToken;
      userEmail = email;
      localStorage.setItem("access_token", accessToken);
      localStorage.setItem("refresh_token", refreshToken);
      localStorage.setItem("user_email", userEmail);
      signupForm.reset();
      showApp();
    } else {
      showMsg(signupSuccess, "Account created! Please switch to login.");
      loginEmailInput.value = email;
    }
  } catch (err) {
    showMsg(signupError, err.message);
  } finally {
    signupBtn.disabled = false;
    signupBtn.textContent = "Sign up";
  }
});

// ── File selection ─────────────────────────────────────

function setFile(file) {
  hideMsg(uploadError);
  hideMsg(uploadSuccess);

  const err = validateFile(file);
  if (err) {
    showMsg(uploadError, err);
    return;
  }

  selectedFile = file;
  selectedNameEl.textContent = file.name;
  selectedSizeEl.textContent = formatBytes(file.size);
  selectedFileEl.hidden = false;
  uploadBtn.disabled = false;
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  selectedFileEl.hidden = true;
  uploadBtn.disabled = true;
  hideMsg(uploadError);
  hideMsg(uploadSuccess);
}

dropZone.addEventListener("click", () => fileInput.click());

dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("drag-over");
  if (e.dataTransfer.files.length) {
    setFile(e.dataTransfer.files[0]);
  }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) {
    setFile(fileInput.files[0]);
  }
});

clearFileBtn.addEventListener("click", clearFile);

// ── Upload ─────────────────────────────────────────────

uploadBtn.addEventListener("click", async () => {
  if (!selectedFile) return;

  hideMsg(uploadError);
  hideMsg(uploadSuccess);
  uploadBtn.disabled = true;
  uploadBtn.textContent = "Uploading…";

  try {
    const form = new FormData();
    form.append("file", selectedFile);

    const res = await apiFetch(ENDPOINTS.upload, {
      method: "POST",
      body: form,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || "Upload failed");
    }
    showMsg(uploadSuccess, "Uploaded — job " + data.fileId);
    clearFile();
    loadJobs();
  } catch (err) {
    showMsg(uploadError, err.message);
  } finally {
    uploadBtn.disabled = !selectedFile;
    uploadBtn.textContent = "Upload";
  }
});

// ── Jobs list ──────────────────────────────────────────

async function loadJobs() {
  hideMsg(jobsError);

  try {
    const res = await apiFetch(ENDPOINTS.files);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Failed to load jobs");

    const files = data.files || [];
    renderJobs(files);
  } catch (err) {
    showMsg(jobsError, err.message);
  }
}

function renderJobs(files) {
  if (!files.length) {
    jobsEmpty.hidden = false;
    jobsTableWrap.hidden = true;
    return;
  }
  jobsEmpty.hidden = true;
  jobsTableWrap.hidden = false;

  jobsBody.innerHTML = files
    .map(
      (f) => `
    <tr>
      <td class="col-id">${f.id}</td>
      <td class="col-name">${escapeHtml(f.original_name)}</td>
      <td class="col-type">${f.file_type || "—"}</td>
      <td><span class="status status-${f.status}">${f.status}</span></td>
      <td class="col-time">${formatTime(f.created_at)}</td>
      <td><button class="delete-btn" data-id="${f.id}">delete</button></td>
    </tr>`
    )
    .join("");
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ── Delete ─────────────────────────────────────────────

jobsBody.addEventListener("click", async (e) => {
  if (!e.target.classList.contains("delete-btn")) return;
  const id = e.target.dataset.id;
  e.target.textContent = "…";
  e.target.disabled = true;
  try {
    const res = await apiFetch(ENDPOINTS.deleteFile + "/" + id, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || "Delete failed");
    }
    loadJobs();
  } catch (err) {
    showMsg(jobsError, err.message);
    e.target.textContent = "delete";
    e.target.disabled = false;
  }
});

refreshBtn.addEventListener("click", loadJobs);

// ── Polling ────────────────────────────────────────────

function startPolling() {
  stopPolling();
  pollTimer = setInterval(loadJobs, POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ── Init ───────────────────────────────────────────────

if (accessToken) {
  showApp();
} else {
  showLogin();
}
