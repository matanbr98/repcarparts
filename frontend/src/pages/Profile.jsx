import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";

export default function Profile() {
  const [me, setMe] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "" });
  const [editing, setEditing] = useState({ name: false, phone: false, email: false });
  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [pic, setPic] = useState(null);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  function isValidEmail(value) {
    if (!value) return true; // allow clearing email
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  useEffect(() => {
    api
      .me()
      .then((u) => {
        setMe(u);
        setForm({ name: u.name || "", phone: u.phone || "", email: u.email || "" });
      })
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  async function saveField(field) {
    setErr("");
    setOk("");
    if (field === "email" && !isValidEmail(form.email)) {
      setErr("Please enter a valid email address.");
      return;
    }
    try {
      const updated = await api.updateMe({ [field]: form[field] });
      setMe(updated);
      setEditing((prev) => ({ ...prev, [field]: false }));
      setOk("Saved.");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function onChangePassword(e) {
    e.preventDefault();
    setErr("");
    setOk("");
    if (!pwd.next || pwd.next !== pwd.confirm) {
      setErr("New password and confirmation must match.");
      return;
    }
    try {
      const res = await api.changePassword(pwd.current, pwd.next);
      if (res?.detail) throw new Error(res.detail);
      setPwd({ current: "", next: "", confirm: "" });
      setOk("Password changed.");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  async function onUploadPicture() {
    if (!pic) return;
    setErr("");
    setOk("");
    try {
      const updated = await api.uploadProfilePicture(pic);
      setMe(updated);
      setPic(null);
      setOk("Profile picture updated.");
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div className="card col-6">
      <h2>My Profile</h2>
      <div className="row" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
        <Link to="/" className="btn btn--ghost">← My Garage</Link>
      </div>

      {me && (
        <div className="row" style={{ alignItems: "center", justifyContent: "flex-start", gap: 14 }}>
          <div style={{ width: 54, height: 54, borderRadius: 999, overflow: "hidden", border: "1px solid rgba(255,255,255,0.18)" }}>
            {me.profile_image_url ? (
              <img
                src={`http://127.0.0.1:8000/${me.profile_image_url}`}
                alt="profile"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", background: "rgba(255,255,255,0.06)" }}>
                <span style={{ fontWeight: 800 }}>{(me.username || "?").slice(0, 1).toUpperCase()}</span>
              </div>
            )}
          </div>
          <div>
            <div className="muted">Username</div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{me.username}</div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Info</h3>

        <div style={{ display: "grid", gap: 10 }}>
          {/* Name */}
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="muted">Name</div>
              {editing.name ? (
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              ) : (
                <div style={{ fontWeight: 650 }}>{me?.name || "—"}</div>
              )}
            </div>
            {editing.name ? (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn--primary" type="button" onClick={() => saveField("name")}>Save</button>
                <button className="btn btn--ghost" type="button" onClick={() => { setForm((f) => ({ ...f, name: me?.name || "" })); setEditing((p) => ({ ...p, name: false })); }}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn--ghost" type="button" onClick={() => setEditing((p) => ({ ...p, name: true }))}>Change</button>
            )}
          </div>

          {/* Phone */}
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="muted">Phone</div>
              {editing.phone ? (
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              ) : (
                <div style={{ fontWeight: 650 }}>{me?.phone || "—"}</div>
              )}
            </div>
            {editing.phone ? (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn--primary" type="button" onClick={() => saveField("phone")}>Save</button>
                <button className="btn btn--ghost" type="button" onClick={() => { setForm((f) => ({ ...f, phone: me?.phone || "" })); setEditing((p) => ({ ...p, phone: false })); }}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn--ghost" type="button" onClick={() => setEditing((p) => ({ ...p, phone: true }))}>Change</button>
            )}
          </div>

          {/* Email */}
          <div className="row">
            <div style={{ flex: 1 }}>
              <div className="muted">Email</div>
              {editing.email ? (
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              ) : (
                <div style={{ fontWeight: 650 }}>{me?.email || "—"}</div>
              )}
            </div>
            {editing.email ? (
              <div className="row" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn--primary" type="button" onClick={() => saveField("email")}>Save</button>
                <button className="btn btn--ghost" type="button" onClick={() => { setForm((f) => ({ ...f, email: me?.email || "" })); setEditing((p) => ({ ...p, email: false })); }}>Cancel</button>
              </div>
            ) : (
              <button className="btn btn--ghost" type="button" onClick={() => setEditing((p) => ({ ...p, email: true }))}>Change</button>
            )}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Profile picture</h3>
        <div className="row" style={{ justifyContent: "flex-start" }}>
          <input type="file" accept="image/*" onChange={(e) => setPic(e.target.files?.[0] || null)} />
          <button className="btn btn--primary" type="button" onClick={onUploadPicture} disabled={!pic}>
            Upload
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Change password</h3>
        <form onSubmit={onChangePassword}>
          <input
            type="password"
            placeholder="Current password"
            value={pwd.current}
            onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
          />
          <input
            type="password"
            placeholder="New password"
            value={pwd.next}
            onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={pwd.confirm}
            onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })}
          />
          <button className="btn btn--primary" type="submit">Update password</button>
        </form>
      </div>

      {err && <p style={{ color: "crimson", marginTop: 12 }}>Error: {err}</p>}
      {ok && <p style={{ color: "#93c5fd", marginTop: 12 }}>{ok}</p>}
    </div>
  );
}

