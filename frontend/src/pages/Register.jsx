import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

export default function Register() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  function isValidEmail(value) {
    if (!value) return true; // optional
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    try {
      if (!isValidEmail(email)) {
        setErr("Please enter a valid email address.");
        return;
      }
      const cleanedEmail = String(email || "").trim();
      await api.register({
        username,
        password,
        name,
        phone,
        email: cleanedEmail ? cleanedEmail : null,
      });
      navigate("/login");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2>Register</h2>
        <form onSubmit={onSubmit}>
          <input placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} />
          <input placeholder="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input placeholder="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          <input
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
          <button className="btn btn--primary" type="submit">Create account</button>
        </form>
        <p style={{ marginTop: 12 }}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}

