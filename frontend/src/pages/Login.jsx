import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";
import { setAuth } from "../auth";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      const res = await api.login(username, password);
      setAuth({ token: res.access_token, role: res.role });
      navigate(res.role === "manager" ? "/manager" : "/");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Login</h2>
        <form onSubmit={onSubmit}>
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <div className="input-grid">
            <input
              placeholder="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className="btn btn--ghost"
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              style={{ whiteSpace: "nowrap" }}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
          <button className="btn btn--primary" type="submit">Login</button>
        </form>

        <p style={{ marginTop: 12 }}>
          No account? <Link to="/register">Register</Link>
        </p>
        <p style={{ marginTop: 12, fontSize: 12, color: "#666" }}>
          Manager account: <b>aa</b> / <b>aa</b>
        </p>
      </div>
    </div>
  );
}

