import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { setAuth } from "../auth";
import { useAuth } from "../hooks/useAuth";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Input } from "../components/ui/Field";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isManager, mustChangePassword } = useAuth();

  if (isAuthenticated && !busy) {
    return <Navigate to={mustChangePassword ? "/change-password" : isManager ? "/manager" : "/"} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username.trim() || !password) {
      setError("Enter your username and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await api.login(username.trim(), password);
      const must = !!res.must_change_password;
      setAuth({ token: res.access_token, role: res.role, mustChangePassword: must });
      const from = location.state?.from;
      if (must) navigate("/change-password", { replace: true });
      else if (from && from !== "/login") navigate(from, { replace: true });
      else navigate(res.role === "manager" ? "/manager" : "/", { replace: true });
    } catch (err) {
      setError(err.status === 401 ? "Incorrect username or password." : err.message || "Login failed.");
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to see your garage."
      footer={
        <>
          New here? <Link to="/register">Create an account</Link>
        </>
      }
    >
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input
          label="Username"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <label className="check">
          <input type="checkbox" checked={showPassword} onChange={(e) => setShowPassword(e.target.checked)} />
          <span>Show password</span>
        </label>
        {error && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={16} /> {error}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          Log in
        </Button>
      </form>
    </AuthLayout>
  );
}
