import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

/** Layout-route guard: unauthenticated -> /login; forced password change -> /change-password. */
export function RequireAuth() {
  const { isAuthenticated, mustChangePassword } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (mustChangePassword && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }
  return <Outlet />;
}

/** Managers only; everyone else is sent to the garage. */
export function RequireManager() {
  const { isAuthenticated, isManager } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isManager) return <Navigate to="/" replace />;
  return <Outlet />;
}
