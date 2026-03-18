export function getAuth() {
  const token = localStorage.getItem("token") || "";
  const role = localStorage.getItem("role") || "";
  return { token, role };
}

export function setAuth({ token, role }) {
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
}

