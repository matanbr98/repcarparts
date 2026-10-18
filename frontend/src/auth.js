// Session storage helpers. Kept API-compatible: getAuth / setAuth / clearAuth.
// A tiny pub/sub lets React (useAuth) react to changes, including 401 logouts.

const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* ignore listener errors */
    }
  });
}

export function subscribeAuth(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getAuth() {
  const token = localStorage.getItem("token") || "";
  const role = localStorage.getItem("role") || "";
  const mustChangePassword = localStorage.getItem("must_change_password") === "1";
  return { token, role, mustChangePassword };
}

export function setAuth({ token, role, mustChangePassword }) {
  localStorage.setItem("token", token);
  localStorage.setItem("role", role);
  if (mustChangePassword) localStorage.setItem("must_change_password", "1");
  else localStorage.removeItem("must_change_password");
  emit();
}

export function setMustChangePassword(value) {
  if (value) localStorage.setItem("must_change_password", "1");
  else localStorage.removeItem("must_change_password");
  emit();
}

export function clearAuth() {
  localStorage.removeItem("token");
  localStorage.removeItem("role");
  localStorage.removeItem("must_change_password");
  emit();
}
