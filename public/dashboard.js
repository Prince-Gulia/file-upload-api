// ── Configuration ──────────────────────────────────────
const API_BASE_URL = "https://file-upload-api-k981.onrender.com";
const ENDPOINTS = {
  upload: "/upload",        // POST  multipart, field "file"
  files: "/files",          // GET   list all files
  file: "/files",           // GET   /files/:id  (id appended)
  deleteFile: "/files",     // DELETE /files/:id
};
const POLL_INTERVAL_MS = 4000;

// ── Auth Guard ─────────────────────────────────────────
let accessToken = localStorage.getItem("access_token");
let refreshToken = localStorage.getItem("refresh_token");
let userEmail = localStorage.getItem("user_email") || "";

if (!accessToken) {
  window.location.href = "index.html";
}

// ── State ──────────────────────────────────────────────
let pollTimer = null;
let selectedFile = null;

// ── DOM refs ───────────────────────────────────────────
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

// Init header email
if (userEmailEl) userEmailEl.textContent = userEmail;

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
  el.style.display = "block";
}

function hideMsg(el) {
  el.textContent = "";
  el.hidden = true;
  el.style.display = "none";
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

async function safeParseJson(res) {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return await res.json();
  }
  const text = await res.text();
  throw new Error(text.includes("<!DOCTYPE") ? "Server error occurred. Please try again." : text || `HTTP ${res.status}`);
}

async function apiFetch(path, opts = {}) {
  const headers = opts.headers || {};
  if (accessToken) {
    headers["Authorization"] = "Bearer " + accessToken;
  }
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

function logout() {
  accessToken = null;
  refreshToken = null;
  userEmail = "";
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
  localStorage.removeItem("user_email");
  window.location.href = "index.html";
}

logoutBtn.addEventListener("click", logout);

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
  selectedFileEl.style.display = "flex";
  uploadBtn.disabled = false;
}

function clearFile() {
  selectedFile = null;
  fileInput.value = "";
  selectedFileEl.hidden = true;
  selectedFileEl.style.display = "none";
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
    const data = await safeParseJson(res);
    if (!res.ok) {
      throw new Error(data.message || "Upload failed");
    }
    showMsg(uploadSuccess, "Uploaded successfully — Job ID: " + data.fileId);
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
    const data = await safeParseJson(res);
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
    jobsEmpty.style.display = "block";
    jobsTableWrap.hidden = true;
    jobsTableWrap.style.display = "none";
    return;
  }
  jobsEmpty.hidden = true;
  jobsEmpty.style.display = "none";
  jobsTableWrap.hidden = false;
  jobsTableWrap.style.display = "block";

  jobsBody.innerHTML = files
    .map(
      (f) => `
    <tr>
      <td class="col-id">${f.id}</td>
      <td class="col-name">${escapeHtml(f.original_name)}</td>
      <td class="col-type">${f.file_type || "—"}</td>
      <td><span class="status status-${f.status}">${f.status}</span></td>
      <td class="col-time">${formatTime(f.created_at)}</td>
      <td>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${
            f.cloudinary_url
              ? `<a href="${f.cloudinary_url}" target="_blank" rel="noopener noreferrer" class="view-btn">View File</a>`
              : '<span class="hint">—</span>'
          }
          ${
            f.file_type === 'pdf' && f.status === 'done'
              ? `<button class="view-text-btn link-btn" data-id="${f.id}" data-name="${escapeHtml(f.original_name)}">View Text</button>`
              : ''
          }
        </div>
      </td>
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

// ── Modal & Actions ────────────────────────────────────

const textModal = document.getElementById("text-modal");
const closeModalBtn = document.getElementById("close-modal-btn");
const modalTitle = document.getElementById("modal-title");
const modalTextContent = document.getElementById("modal-text-content");

if (closeModalBtn) {
  closeModalBtn.addEventListener("click", () => {
    if (textModal) {
      textModal.hidden = true;
      textModal.style.display = "none";
    }
  });
}

jobsBody.addEventListener("click", async (e) => {
  if (e.target.classList.contains("view-text-btn")) {
    const id = e.target.dataset.id;
    const name = e.target.dataset.name;
    if (modalTitle) modalTitle.textContent = "Extracted Text: " + name;
    if (modalTextContent) modalTextContent.textContent = "Loading extracted text…";
    if (textModal) {
      textModal.hidden = false;
      textModal.style.display = "flex";
    }
    try {
      const res = await apiFetch(ENDPOINTS.file + "/" + id);
      const data = await safeParseJson(res);
      if (res.ok && data.file) {
        if (modalTextContent) {
          modalTextContent.textContent = data.file.extracted_text || "No text extracted from this document.";
        }
      } else {
        if (modalTextContent) modalTextContent.textContent = "Failed to load extracted text.";
      }
    } catch (err) {
      if (modalTextContent) modalTextContent.textContent = "Error: " + err.message;
    }
    return;
  }

  if (!e.target.classList.contains("delete-btn")) return;
  const id = e.target.dataset.id;
  e.target.textContent = "…";
  e.target.disabled = true;
  try {
    const res = await apiFetch(ENDPOINTS.deleteFile + "/" + id, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await safeParseJson(res);
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

// ── Init Dashboard ─────────────────────────────────────
loadJobs();
startPolling();
