import { useSyncExternalStore } from "react";
import { getAuth, subscribeAuth } from "../auth";

let cached = null;
function snapshot() {
  const next = getAuth();
  if (
    cached &&
    cached.token === next.token &&
    cached.role === next.role &&
    cached.mustChangePassword === next.mustChangePassword
  ) {
    return cached;
  }
  cached = next;
  return cached;
}

/** Reactive view of the stored session. */
export function useAuth() {
  const a = useSyncExternalStore(subscribeAuth, snapshot, snapshot);
  return {
    ...a,
    isAuthenticated: !!a.token,
    isManager: a.role === "manager",
  };
}
