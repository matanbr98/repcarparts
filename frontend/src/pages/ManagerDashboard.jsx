import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { getAuth } from "../auth";

export default function ManagerDashboard() {
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [parts, setParts] = useState([]);
  const [send, setSend] = useState({
    title: "",
    message: "",
    broadcast_all_users: true,
    target_user_id: "",
    target_car_id: "",
    due_date: "",
  });
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const { role } = getAuth();
    if (role !== "manager") navigate("/login");
  }, [navigate]);

  useEffect(() => {
    async function load() {
      setErr("");
      try {
        const [u, s, p] = await Promise.all([
          api.managerUsers(),
          api.managerStats(),
          api.managerPartAverages(),
        ]);
        setUsers(u);
        setStats(s);
        setParts(p);
      } catch (e) {
        setErr(String(e.message || e));
      }
    }
    load();
  }, []);

  async function onSendReminder(e) {
    e.preventDefault();
    setErr("");
    setOkMsg("");
    try {
      const fd = new FormData();
      fd.append("title", send.title);
      fd.append("message", send.message);
      fd.append("broadcast_all_users", String(!!send.broadcast_all_users));
      if (!send.broadcast_all_users) fd.append("target_user_id", String(Number(send.target_user_id)));
      if (send.target_car_id) fd.append("target_car_id", String(Number(send.target_car_id)));
      if (send.due_date) fd.append("due_date", send.due_date);
      if (file) fd.append("image", file);

      const res = await api.managerSendReminder(fd);
      setOkMsg(`Sent ${Array.isArray(res) ? res.length : 0} reminder(s).`);
      setSend({ ...send, title: "", message: "" });
      setFile(null);
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div>
      <h2>Manager Dashboard</h2>

      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
      {okMsg && <p style={{ color: "#93c5fd" }}>{okMsg}</p>}

      {stats && (
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Stats</h3>
          <p>Users: <b>{stats.users}</b></p>
          <p>Cars: <b>{stats.cars}</b></p>
          <p>Records: <b>{stats.records}</b></p>
          <p>Total cost: <b>{stats.total_cost}</b></p>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Users</h3>
        {users.length === 0 ? (
          <p>No users</p>
        ) : (
          <ul>
            {users.map((u) => (
              <li key={u.id}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                  <span style={{ width: 24, height: 24, borderRadius: 999, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
                    {u.profile_image_url ? (
                      <img
                        src={`http://127.0.0.1:8000/${u.profile_image_url}`}
                        alt="profile"
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <span style={{ display: "grid", placeItems: "center", width: "100%", height: "100%", fontSize: 12 }}>
                        {(u.username || "?").slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                  <span>
                    <b>#{u.id}</b> — <b>{u.username}</b> — {u.role}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Send reminder</h3>
        <form onSubmit={onSendReminder}>
          <input
            placeholder="Title"
            value={send.title}
            onChange={(e) => setSend({ ...send, title: e.target.value })}
            required
          />
          <textarea
            placeholder="Message"
            value={send.message}
            onChange={(e) => setSend({ ...send, message: e.target.value })}
            required
          />

          <label className="row" style={{ justifyContent: "flex-start", gap: 10 }}>
            <input
              type="checkbox"
              checked={send.broadcast_all_users}
              onChange={(e) => setSend({ ...send, broadcast_all_users: e.target.checked })}
            />
            <span className="muted">Broadcast to all users</span>
          </label>

          {!send.broadcast_all_users && (
            <select
              value={send.target_user_id}
              onChange={(e) => setSend({ ...send, target_user_id: e.target.value })}
              required
            >
              <option value="" disabled>
                Select user…
              </option>
              {users
                .filter((u) => u.role !== "manager")
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    #{u.id} — {u.username}
                  </option>
                ))}
            </select>
          )}

          <input
            placeholder="Optional car id (number)"
            value={send.target_car_id}
            onChange={(e) => setSend({ ...send, target_car_id: e.target.value })}
          />
          <input
            type="date"
            value={send.due_date}
            onChange={(e) => setSend({ ...send, due_date: e.target.value })}
          />

          <div>
            <div className="muted" style={{ marginBottom: 8 }}>Attach image (optional)</div>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <button className="btn btn--primary" type="submit">Send reminder</button>
        </form>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Average cost per part</h3>
        {parts.length === 0 ? (
          <p>No parts data yet</p>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {parts.slice(0, 30).map((p) => (
              <div key={p.part} style={{ display: "flex", justifyContent: "space-between" }}>
                <span><b>{p.part}</b> (n={p.count})</span>
                <span>{Number(p.avg_cost).toFixed(2)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

