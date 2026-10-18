import { clearAuth, getAuth, setMustChangePassword } from "../auth";

export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = "", fields = {} } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Absolute URL for an uploaded asset (`uploads/<file>`). Returns "" for empty values. */
export function assetUrl(path) {
  if (!path) return "";
  if (/^(https?:|blob:|data:)/i.test(path)) return path;
  return `${API_URL}/${String(path).replace(/^\/+/, "")}`;
}

function parseErrorBody(data, status, fallback) {
  let message = fallback;
  let code = "";
  let fields = {};
  if (data && typeof data === "object") {
    if (data.error && typeof data.error === "object") {
      message = data.error.message || message;
      code = data.error.code || "";
      fields = data.error.fields || {};
    } else if (typeof data.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      // legacy FastAPI validation errors
      data.detail.forEach((d) => {
        const key = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : "";
        if (key && typeof key === "string") fields[key] = d.msg;
      });
      message = data.detail.map((d) => d.msg).filter(Boolean).join("; ") || message;
    }
  }
  return new ApiError(message, { status, code, fields });
}

function buildQuery(query) {
  if (!query) return "";
  const p = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * The single fetch helper.
 * opts: { method, json, body (FormData), query, auth (default true), responseType: 'json'|'blob' }
 * On 401 for an authenticated call the session is cleared; route guards then redirect to /login.
 */
export async function apiFetch(path, opts = {}) {
  const { method = "GET", json, body, query, auth = true, responseType = "json" } = opts;
  const headers = {};
  if (auth) {
    const { token } = getAuth();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let payload;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(json);
  } else if (body !== undefined) {
    payload = body;
  }

  let res;
  try {
    res = await fetch(`${API_URL}${path}${buildQuery(query)}`, { method, headers, body: payload });
  } catch {
    throw new ApiError("Cannot reach the server. Check your connection and try again.", {
      status: 0,
      code: "network",
    });
  }

  if (!res.ok) {
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON error body */
    }
    const err = parseErrorBody(data, res.status, `Request failed (${res.status})`);
    if (res.status === 401 && auth) clearAuth();
    if (res.status === 403 && auth && err.code === "password_change_required") setMustChangePassword(true);
    throw err;
  }

  if (res.status === 204) return null;
  if (responseType === "blob") return res.blob();
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function recordQuery(filters = {}) {
  const { q, type, year, date_from, date_to } = filters;
  return { q, type, year, date_from, date_to };
}

export const api = {
  // auth
  login: (username, password) =>
    apiFetch("/auth/login", { method: "POST", json: { username, password }, auth: false }),
  register: (payload) => apiFetch("/auth/register", { method: "POST", json: payload, auth: false }),

  // profile
  me: () => apiFetch("/me"),
  updateMe: (patch) => apiFetch("/me", { method: "PUT", json: patch }),
  changePassword: (current_password, new_password) =>
    apiFetch("/me/password", { method: "PUT", json: { current_password, new_password } }),
  uploadProfilePicture: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return apiFetch("/me/profile-picture", { method: "POST", body: fd });
  },

  // vehicles
  garage: () => apiFetch("/garage"),
  getCars: () => apiFetch("/cars"),
  getCar: (carId) => apiFetch(`/cars/${carId}`),
  carOverview: (carId) => apiFetch(`/cars/${carId}/overview`),
  setOdometer: (carId, odometer_km) =>
    apiFetch(`/cars/${carId}/odometer`, { method: "PUT", json: { odometer_km } }),
  createCar: (data) => apiFetch("/cars", { method: "POST", json: data }),
  updateCar: (carId, patch) => apiFetch(`/cars/${carId}`, { method: "PUT", json: patch }),
  deleteCar: (carId) => apiFetch(`/cars/${carId}`, { method: "DELETE" }),

  // records
  getRecords: (carId, filters) => apiFetch(`/cars/${carId}/records`, { query: recordQuery(filters) }),
  addRecord: (carId, formData) => apiFetch(`/cars/${carId}/records`, { method: "POST", body: formData }),
  updateRecord: (carId, recordId, patch) =>
    apiFetch(`/cars/${carId}/records/${recordId}`, { method: "PUT", json: patch }),
  deleteRecord: (carId, recordId) => apiFetch(`/cars/${carId}/records/${recordId}`, { method: "DELETE" }),
  replaceRecordImage: (carId, recordId, file) => {
    const fd = new FormData();
    fd.append("image", file);
    return apiFetch(`/cars/${carId}/records/${recordId}/image`, { method: "PUT", body: fd });
  },
  removeRecordImage: (carId, recordId) =>
    apiFetch(`/cars/${carId}/records/${recordId}/image`, { method: "DELETE" }),
  exportRecordsCsv: (carId, filters) =>
    apiFetch(`/cars/${carId}/records.csv`, { query: recordQuery(filters), responseType: "blob" }),

  // status + expenses
  maintenanceDue: (carId) => apiFetch(`/cars/${carId}/maintenance-due`),
  expenses: (carId, year) => apiFetch(`/cars/${carId}/expenses`, { query: { year } }),
  myCostSummary: () => apiFetch("/me/cost-summary"),
  carCostSummary: (carId) => apiFetch(`/cars/${carId}/cost-summary`),

  // reminders
  myReminders: () => apiFetch("/me/reminders"),
  createReminder: (data) => apiFetch("/me/reminders", { method: "POST", json: data }),
  setReminderDone: (id, done) => apiFetch(`/me/reminders/${id}`, { method: "PATCH", json: { done } }),
  deleteReminder: (id) => apiFetch(`/me/reminders/${id}`, { method: "DELETE" }),

  // manager
  managerUsers: () => apiFetch("/manager/users"),
  managerStats: () => apiFetch("/manager/stats"),
  managerPartAverages: () => apiFetch("/manager/parts-averages"),
  managerSendReminder: (formData) => apiFetch("/manager/reminders", { method: "POST", body: formData }),
};

/** Trigger a browser download for a Blob. */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
