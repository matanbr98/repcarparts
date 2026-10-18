import { useEffect, useRef, useState } from "react";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/ui/toastContext";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Input } from "../components/ui/Field";
import ErrorState from "../components/ui/ErrorState";
import { SkeletonCard } from "../components/ui/Skeleton";
import Avatar from "../components/Avatar";
import ChangePasswordForm from "../components/ChangePasswordForm";
import { validateImage } from "../lib/images";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ProfileForm({ me, onSaved }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: me.name || "", phone: me.phone || "", email: me.email || "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const dirty =
    form.name !== (me.name || "") || form.phone !== (me.phone || "") || form.email !== (me.email || "");

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function onSubmit(e) {
    e.preventDefault();
    if (form.email.trim() && !EMAIL_RE.test(form.email.trim())) {
      setErrors({ email: "Enter a valid email address." });
      return;
    }
    setSaving(true);
    try {
      const patch = {};
      if (form.name !== (me.name || "")) patch.name = form.name.trim();
      if (form.phone !== (me.phone || "")) patch.phone = form.phone.trim();
      if (form.email !== (me.email || "")) patch.email = form.email.trim() || null;
      const updated = await api.updateMe(patch);
      onSaved(updated);
      toast.success("Profile saved");
    } catch (err) {
      setErrors({ ...(err.fields || {}), form: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <Input label="Name" autoComplete="name" value={form.name} onChange={set("name")} error={errors.name} />
      <div className="grid-2">
        <Input label="Phone" type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")} error={errors.phone} />
        <Input label="Email" type="email" autoComplete="email" value={form.email} onChange={set("email")} error={errors.email} />
      </div>
      {errors.form && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {errors.form}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" loading={saving} disabled={!dirty}>
          Save details
        </Button>
      </div>
    </form>
  );
}

function PictureUploader({ me, onUpdated }) {
  const toast = useToast();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) return undefined;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function choose(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const msg = validateImage(f);
    setError(msg);
    setFile(msg ? null : f);
  }

  async function upload() {
    setSaving(true);
    try {
      const updated = await api.uploadProfilePicture(file);
      onUpdated(updated);
      setFile(null);
      setPreview("");
      toast.success("Profile picture updated");
    } catch (err) {
      setError(err.message || "Upload failed.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="cluster profile-pic">
      {file && preview ? (
        <span className="avatar" style={{ width: 72, height: 72 }}>
          <img src={preview} alt="New profile picture preview" />
        </span>
      ) : (
        <Avatar url={me.profile_image_url} name={me.username} size={72} />
      )}
      <div className="stack">
        <div className="cluster">
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            <Icon name="upload" size={16} /> {file ? "Choose another" : "Change picture"}
          </Button>
          {file && (
            <>
              <Button variant="primary" onClick={upload} loading={saving}>
                Save picture
              </Button>
              <Button variant="ghost" onClick={() => setFile(null)} disabled={saving}>
                Cancel
              </Button>
            </>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          aria-label="Profile picture file"
          onChange={choose}
        />
        {error ? (
          <span className="field__error" role="alert">
            {error}
          </span>
        ) : (
          <span className="field__hint">JPG, PNG or WebP, up to 5 MB.</span>
        )}
      </div>
    </div>
  );
}

export default function Profile() {
  const { data, error, loading, reload, setData } = useAsync(() => api.me(), []);

  return (
    <div className="stack-lg narrow">
      <PageHeader title="Profile" subtitle={data ? `Signed in as ${data.username}` : undefined} />
      {error && !data ? (
        <ErrorState error={error} title="Could not load your profile" onRetry={reload} />
      ) : loading && !data ? (
        <>
          <SkeletonCard />
          <SkeletonCard lines={4} />
        </>
      ) : (
        <>
          <Card>
            <h2 className="card__title">Profile picture</h2>
            <PictureUploader me={data} onUpdated={(u) => setData((p) => ({ ...p, ...u }))} />
          </Card>
          <Card>
            <h2 className="card__title">Details</h2>
            <ProfileForm me={data} onSaved={(u) => setData((p) => ({ ...p, ...u }))} />
          </Card>
          <Card>
            <h2 className="card__title">Change password</h2>
            <ChangePasswordForm />
          </Card>
        </>
      )}
    </div>
  );
}
