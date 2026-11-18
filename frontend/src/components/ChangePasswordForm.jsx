import { useState } from "react";
import { api } from "../services/api";
import { clearAuth, getAuth, setAuth } from "../auth";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Input } from "./ui/Field";
import { useToast } from "./ui/toastContext";
import { t } from "../i18n";

/**
 * Password change. The server bumps `pwd_v` on success, which invalidates old tokens, so:
 * if the response carries a fresh `access_token` we keep the session, otherwise we sign the user out
 * and the route guard sends them to /login.
 */
export default function ChangePasswordForm({ submitLabel, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    setFormError("");
    const v = {};
    if (!form.current) v.current = t("Enter your current password.");
    if (form.next.length < 8) v.next = t("Use at least 8 characters.");
    else if (form.next === form.current) v.next = t("Choose a password different from the current one.");
    if (form.confirm !== form.next) v.confirm = t("Passwords do not match.");
    setErrors(v);
    if (Object.keys(v).length) return;

    setSaving(true);
    try {
      const res = await api.changePassword(form.current, form.next);
      const { role } = getAuth();
      if (res?.access_token) {
        setAuth({ token: res.access_token, role: res.role || role, mustChangePassword: false });
        toast.success(t("Password updated"));
      } else {
        clearAuth();
        toast.success(t("Password updated. Please sign in again."));
      }
      setForm({ current: "", next: "", confirm: "" });
      if (res?.access_token) onDone?.();
    } catch (err) {
      const f = err.fields || {};
      setErrors({
        current: f.current_password,
        next: f.new_password,
      });
      setFormError(err.message || t("Could not change the password."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <Input
        label={t("Current password")}
        type="password"
        autoComplete="current-password"
        value={form.current}
        onChange={set("current")}
        error={errors.current}
      />
      <Input
        label={t("New password")}
        type="password"
        autoComplete="new-password"
        hint={t("At least 8 characters.")}
        value={form.next}
        onChange={set("next")}
        error={errors.next}
      />
      <Input
        label={t("Confirm new password")}
        type="password"
        autoComplete="new-password"
        value={form.confirm}
        onChange={set("confirm")}
        error={errors.confirm}
      />
      {formError && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {formError}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" variant="primary" loading={saving}>
          {submitLabel ?? t("Update password")}
        </Button>
      </div>
    </form>
  );
}
