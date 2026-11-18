import { useMemo, useState } from "react";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/ui/toastContext";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Input, Select, Switch, Textarea } from "../components/ui/Field";
import StatCard from "../components/ui/StatCard";
import Tabs from "../components/ui/Tabs";
import Segmented from "../components/ui/Segmented";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Skeleton, { SkeletonCard } from "../components/ui/Skeleton";
import Avatar from "../components/Avatar";
import ReceiptDropzone from "../components/ReceiptDropzone";
import { validateImage } from "../lib/images";
import { formatMoney, formatNumber, vehicleTitle } from "../lib/format";
import { treatmentLabel } from "../lib/treatments";
import { t, tp } from "../i18n";

function SendReminderForm({ users, cars }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    message: "",
    broadcast_all_users: true,
    target_user_id: "",
    target_car_id: "",
    due_date: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const customers = users.filter((u) => u.role !== "manager");
  const userCars = cars.filter((c) => String(c.user_id) === String(form.target_user_id));

  async function onSubmit(e) {
    e.preventDefault();
    const v = {};
    if (!form.title.trim()) v.title = t("Enter a title.");
    if (!form.message.trim()) v.message = t("Enter a message.");
    if (!form.broadcast_all_users && !form.target_user_id) v.target_user_id = t("Choose a user.");
    if (file) {
      const m = validateImage(file);
      if (m) v.image = m;
    }
    setErrors(v);
    if (Object.keys(v).length) return;

    setSending(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title.trim());
      fd.append("message", form.message.trim());
      fd.append("broadcast_all_users", String(!!form.broadcast_all_users));
      if (!form.broadcast_all_users) {
        fd.append("target_user_id", String(Number(form.target_user_id)));
        if (form.target_car_id) fd.append("target_car_id", String(Number(form.target_car_id)));
      }
      if (form.due_date) fd.append("due_date", form.due_date);
      if (file) fd.append("image", file);
      const res = await api.managerSendReminder(fd);
      const n = Array.isArray(res) ? res.length : 1;
      toast.success(tp(n, "Sent 1 reminder", "Sent {n} reminders"));
      setForm((p) => ({ ...p, title: "", message: "", due_date: "" }));
      setFile(null);
    } catch (err) {
      setErrors({ ...(err.fields || {}), form: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <Input label={t("Title")} value={form.title} onChange={set("title")} error={errors.title} />
      <Textarea label={t("Message")} value={form.message} onChange={set("message")} error={errors.message} />

      <div className="form-section">
        <Switch
          label={t("Send to all users")}
          description={
            form.broadcast_all_users
              ? t("Every customer account ({n}) receives this reminder.", { n: customers.length })
              : t("Choose one customer and, optionally, one of their vehicles.")
          }
          checked={form.broadcast_all_users}
          onChange={(e) => setForm((p) => ({ ...p, broadcast_all_users: e.target.checked, target_car_id: "" }))}
        />

      {!form.broadcast_all_users && (
        <div className="grid-2">
          <Select
            label={t("User")}
            value={form.target_user_id}
            onChange={(e) => {
              setForm((p) => ({ ...p, target_user_id: e.target.value, target_car_id: "" }));
              setErrors((p) => ({ ...p, target_user_id: undefined }));
            }}
            error={errors.target_user_id}
          >
            <option value="">{t("Select user...")}</option>
            {customers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} (#{u.id})
              </option>
            ))}
          </Select>
          <Select
            label={t("Vehicle")}
            optional
            value={form.target_car_id}
            onChange={set("target_car_id")}
            disabled={!form.target_user_id}
            error={errors.target_car_id}
          >
            <option value="">{t("No specific vehicle")}</option>
            {userCars.map((c) => (
              <option key={c.id} value={c.id}>
                {vehicleTitle(c)} (#{c.id})
              </option>
            ))}
          </Select>
        </div>
      )}
      </div>

      <Input label={t("Due date")} type="date" optional value={form.due_date} onChange={set("due_date")} error={errors.due_date} />

      <ReceiptDropzone label={t("Attach image")} file={file} onChange={setFile} error={errors.image} />

      {errors.form && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {errors.form}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" variant="accent" loading={sending}>
          <Icon name="send" size={16} /> {t("Send reminder")}
        </Button>
      </div>
    </form>
  );
}

function UsersPanel({ users }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const managers = users.filter((u) => u.role === "manager").length;
  const query = q.trim().toLowerCase();
  const visible = users.filter((u) => {
    if (role === "manager" && u.role !== "manager") return false;
    if (role === "customer" && u.role === "manager") return false;
    if (!query) return true;
    return [u.username, u.name, u.email, u.phone, `#${u.id}`].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  return (
    <section className="card card--flush" role="tabpanel" id="panel-users" aria-labelledby="tab-users">
      <div className="card__header">
        <Input
          label={t("Search users")}
          hideLabel
          icon="search"
          type="search"
          placeholder={t("Search name, username, email or phone")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fieldClassName="toolbar__search"
        />
        <Segmented
          label={t("Filter by role")}
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: t("All"), count: users.length },
            { value: "customer", label: t("Customers"), count: users.length - managers },
            { value: "manager", label: t("Managers"), count: managers },
          ]}
        />
      </div>
      {users.length === 0 ? (
        <EmptyState compact icon="users" title={t("No users yet")} />
      ) : visible.length === 0 ? (
        <EmptyState compact icon="search" title={t("No users match")} text={t("Try a different search or role filter.")} />
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">{t("User")}</th>
                <th scope="col">{t("Role")}</th>
                <th scope="col">{t("Email")}</th>
                <th scope="col">{t("Phone")}</th>
                <th scope="col" className="table__num">{t("ID")}</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td className="table__primary">
                    <span className="user-cell">
                      <Avatar url={u.profile_image_url} name={u.username} size={32} />
                      <span className="user-cell__text">
                        <strong className="truncate">{u.username}</strong>
                        {u.name && <span className="muted small truncate">{u.name}</span>}
                      </span>
                    </span>
                  </td>
                  <td data-label={t("Role")}>
                    <span className={`badge ${u.role === "manager" ? "badge--accent" : ""}`}>
                      {u.role === "manager" && <Icon name="shield" size={12} />}
                      {u.role === "manager" ? t("Manager") : t("Customer")}
                    </span>
                  </td>
                  <td data-label={t("Email")} className="table__muted">
                    {u.email ? <a href={`mailto:${u.email}`}>{u.email}</a> : "-"}
                  </td>
                  <td data-label={t("Phone")} className="table__muted num">
                    {u.phone || "-"}
                  </td>
                  <td data-label={t("ID")} className="num table__num table__muted">
                    #{u.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PartsPanel({ parts }) {
  const [showAll, setShowAll] = useState(false);
  const max = useMemo(() => Math.max(1, ...parts.map((p) => Number(p.avg_cost) || 0)), [parts]);
  const rows = showAll ? parts : parts.slice(0, 30);

  return (
    <section className="card card--flush" role="tabpanel" id="panel-parts" aria-labelledby="tab-parts">
      <div className="card__header">
        <div>
          <h2 className="card__title">{t("Average cost per part")}</h2>
          <p className="card__subtitle">{t("Across all service records in the fleet")}</p>
        </div>
      </div>
      {parts.length === 0 ? (
        <EmptyState compact icon="chart" title={t("No parts data yet")} text={t("Averages appear once services with a cost are logged.")} />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">{t("Part")}</th>
                  <th scope="col" className="table__num">{t("Records")}</th>
                  <th scope="col" className="table__num">{t("Average (ILS)")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.part}>
                    <td className="table__primary">
                      <strong>{treatmentLabel(p.part)}</strong>
                    </td>
                    <td data-label={t("Records")} className="num table__num">
                      {p.count}
                    </td>
                    <td data-label={t("Average (ILS)")} className="num table__num">
                      <span className="table-bar">
                        <span className="table-bar__track" aria-hidden="true">
                          <span
                            className="table-bar__fill"
                            style={{ width: `${Math.round(((Number(p.avg_cost) || 0) / max) * 100)}%` }}
                          />
                        </span>
                        {Number(p.avg_cost).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parts.length > 30 && (
            <div className="table-foot">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t("Show top 30") : t("Show all {n} parts", { n: parts.length })}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ManagerDashboard() {
  const [tab, setTab] = useState("users");
  const { data, error, loading, reload } = useAsync(async () => {
    const [users, stats, parts, cars] = await Promise.all([
      api.managerUsers(),
      api.managerStats(),
      api.managerPartAverages(),
      api.getCars().catch(() => []),
    ]);
    return { users, stats, parts, cars };
  }, []);

  return (
    <div className="stack-lg">
      <PageHeader
        title={t("Manager dashboard")}
        subtitle={t("Users, spend across the fleet and reminders.")}
        actions={
          data && (
            <Button variant="accent" onClick={() => setTab("send")}>
              <Icon name="send" size={16} /> {t("Send reminder")}
            </Button>
          )
        }
      />

      {error && !data ? (
        <ErrorState error={error} title={t("Could not load the dashboard")} onRetry={reload} />
      ) : loading && !data ? (
        <div className="stack-lg" role="status" aria-label={t("Loading dashboard")}>
          <div className="grid-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={104} radius={14} />
            ))}
          </div>
          <SkeletonCard lines={5} />
        </div>
      ) : (
        <>
          <div className="grid-4">
            <StatCard label={t("Users")} value={formatNumber(data.stats.users)} icon="users" tone="info" hint={t("Registered accounts")} />
            <StatCard label={t("Vehicles")} value={formatNumber(data.stats.cars)} icon="car" hint={t("Across all users")} />
            <StatCard label={t("Service records")} value={formatNumber(data.stats.records)} icon="wrench" hint={t("Logged in total")} />
            <StatCard label={t("Total cost")} value={formatMoney(data.stats.total_cost)} icon="coins" tone="accent" hint={t("All records, all time")} />
          </div>

          <div className="stack">
            <Tabs
              label={t("Manager sections")}
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "users", label: t("Users"), count: data.users.length },
                { id: "parts", label: t("Cost per part"), count: data.parts.length },
                { id: "send", label: t("Send reminder") },
              ]}
            />

            {tab === "users" && <UsersPanel users={data.users} />}
            {tab === "parts" && <PartsPanel parts={data.parts} />}
            {tab === "send" && (
              <section className="card send-card" role="tabpanel" id="panel-send" aria-labelledby="tab-send">
                <div className="card__header card__header--bordered">
                  <div>
                    <h2 className="card__title">{t("Send reminder")}</h2>
                    <p className="card__subtitle">{t("It appears in each recipient's Reminders list, marked \"From manager\".")}</p>
                  </div>
                </div>
                <SendReminderForm users={data.users} cars={data.cars} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
