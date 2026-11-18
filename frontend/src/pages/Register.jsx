import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { useAuth } from "../hooks/useAuth";
import AuthLayout from "../components/layout/AuthLayout";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Input } from "../components/ui/Field";
import { useToast } from "../components/ui/toastContext";
import { t } from "../i18n";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[A-Za-z0-9_.-]{3,40}$/;

export default function Register() {
  const [form, setForm] = useState({ name: "", phone: "", email: "", username: "", password: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useToast();
  const { isAuthenticated } = useAuth();

  if (isAuthenticated && !busy) return <Navigate to="/" replace />;

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    const v = {};
    if (!USERNAME_RE.test(form.username)) v.username = t("3-40 characters: letters, numbers, dot, dash or underscore.");
    if (form.password.length < 8) v.password = t("Use at least 8 characters.");
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) v.email = t("Enter a valid email address.");
    setErrors(v);
    if (Object.keys(v).length) return;

    setBusy(true);
    try {
      await api.register({
        username: form.username,
        password: form.password,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
      });
      toast.success(t("Account created. You can log in now."));
      navigate("/login", { replace: true });
    } catch (err) {
      setErrors((p) => ({ ...p, ...(err.fields || {}) }));
      setFormError(err.message || t("Could not create the account."));
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title={t("Create your account")}
      subtitle={t("Keep every service, receipt and reminder in one place.")}
      footer={
        <>
          {t("Already have an account?")} <Link to="/login">{t("Log in")}</Link>
        </>
      }
    >
      <form className="stack" onSubmit={onSubmit} noValidate>
        <Input label={t("Full name")} optional autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
        <div className="grid-2">
          <Input label={t("Phone")} optional type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
          <Input label={t("Email")} optional type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
        </div>
        <Input
          label={t("Username")}
          autoComplete="username"
          autoCapitalize="none"
          value={form.username}
          onChange={set("username")}
          error={errors.username}
        />
        <Input
          label={t("Password")}
          type="password"
          autoComplete="new-password"
          hint={t("At least 8 characters.")}
          value={form.password}
          onChange={set("password")}
          error={errors.password}
        />
        {formError && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={16} /> {formError}
          </p>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={busy}>
          {t("Create account")}
        </Button>
      </form>
    </AuthLayout>
  );
}
