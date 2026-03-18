const API_URL = "http://127.0.0.1:8000";

function authHeaders(extra = {}) {
  const token = localStorage.getItem("token");
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

export const api = {
  async _readError(res, fallback) {
    try {
      const data = await res.json();
      if (typeof data?.detail === "string") return data.detail;
      return fallback;
    } catch {
      return fallback;
    }
  },
  async login(username, password) {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error(await api._readError(res, "Login failed"));
    return res.json();
  },
  async register(payload) {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await api._readError(res, "Register failed"));
    return res.json();
  },
  async getCars() {
    const res = await fetch(`${API_URL}/cars`, { headers: authHeaders() });
    return res.json();
  },
  async createCar(carData) {
    const res = await fetch(`${API_URL}/cars`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(carData),
    });
    return res.json();
  },
  async deleteCar(carId) {
    const res = await fetch(`${API_URL}/cars/${carId}`, { method: "DELETE", headers: authHeaders() });
    return res.json();
  },
  async getRecords(carId) {
    const res = await fetch(`${API_URL}/cars/${carId}/records`, { headers: authHeaders() });
    return res.json();
  },
  async addRecord(carId, recordData) {
    // recordData is now a FormData object
    const res = await fetch(`${API_URL}/cars/${carId}/records`, {
      method: "POST",
      headers: authHeaders(),
      body: recordData, // No headers needed, browser handles it for FormData
    });
    return res.json();
  }
  ,
  async updateRecord(carId, recordId, patch) {
    const res = await fetch(`${API_URL}/cars/${carId}/records/${recordId}`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    });
    return res.json();
  },
  async deleteRecord(carId, recordId) {
    const res = await fetch(`${API_URL}/cars/${carId}/records/${recordId}`, { method: "DELETE", headers: authHeaders() });
    return res.json();
  },
  async managerUsers() {
    const res = await fetch(`${API_URL}/manager/users`, { headers: authHeaders() });
    return res.json();
  },
  async managerStats() {
    const res = await fetch(`${API_URL}/manager/stats`, { headers: authHeaders() });
    return res.json();
  },
  async managerPartAverages() {
    const res = await fetch(`${API_URL}/manager/parts-averages`, { headers: authHeaders() });
    return res.json();
  },
  async myCostSummary() {
    const res = await fetch(`${API_URL}/me/cost-summary`, { headers: authHeaders() });
    return res.json();
  },
  async carCostSummary(carId) {
    const res = await fetch(`${API_URL}/cars/${carId}/cost-summary`, { headers: authHeaders() });
    return res.json();
  },
  async myReminders() {
    const res = await fetch(`${API_URL}/me/reminders`, { headers: authHeaders() });
    return res.json();
  },
  async maintenanceDue(carId) {
    const res = await fetch(`${API_URL}/cars/${carId}/maintenance-due`, { headers: authHeaders() });
    return res.json();
  },
  async managerSendReminder(formData) {
    const res = await fetch(`${API_URL}/manager/reminders`, {
      method: "POST",
      headers: authHeaders(),
      body: formData,
    });
    return res.json();
  },
  async me() {
    const res = await fetch(`${API_URL}/me`, { headers: authHeaders() });
    return res.json();
  },
  async updateMe(patch) {
    const res = await fetch(`${API_URL}/me`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(patch),
    });
    return res.json();
  },
  async changePassword(current_password, new_password) {
    const res = await fetch(`${API_URL}/me/password`, {
      method: "PUT",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ current_password, new_password }),
    });
    return res.json();
  },
  async uploadProfilePicture(file) {
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch(`${API_URL}/me/profile-picture`, {
      method: "POST",
      headers: authHeaders(),
      body: fd,
    });
    return res.json();
  },
};