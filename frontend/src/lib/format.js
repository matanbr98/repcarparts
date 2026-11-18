import { getLanguage, locale, t } from "../i18n";

const formatters = {};
/** Number formatter for the current language (cached per locale). */
function nfmt() {
  const loc = locale();
  if (!formatters[loc]) formatters[loc] = new Intl.NumberFormat(loc);
  return formatters[loc];
}
const nf = { format: (n) => nfmt().format(n) };

export function formatNumber(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return nf.format(Number(n));
}

export function formatMoney(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return getLanguage() === "he" ? `${nf.format(Number(n))} ₪` : `${nf.format(Number(n))} ILS`;
}

export function formatKm(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return t("{n} km", { n: nf.format(Number(n)) });
}

function parseDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

export function formatDate(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short", year: "numeric" });
}

export function formatShortDate(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleDateString(locale(), { day: "numeric", month: "short" });
}

export function todayISO() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function yearOf(value) {
  return String(value || "").slice(0, 4);
}

export function monthLabel(ym) {
  const [y, m] = String(ym).split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(y, m - 1, 1).toLocaleDateString(locale(), { month: "short" });
}

export function vehicleTitle(car) {
  if (!car) return "";
  return car.nickname || [car.make, car.model].filter(Boolean).join(" ") || t("Vehicle");
}

export function vehicleSubtitle(car) {
  if (!car) return "";
  return [car.make, car.model, car.year].filter(Boolean).join(" ");
}

/** Human description of a maintenance item's urgency. */
export function dueText(item) {
  if (!item) return "";
  const parts = [];
  if (typeof item.remaining_days === "number") {
    const d = item.remaining_days;
    parts.push(d < 0 ? t("{n} days overdue", { n: Math.abs(d) }) : t("{n} days left", { n: d }));
  }
  if (typeof item.remaining_km === "number") {
    const k = item.remaining_km;
    parts.push(k < 0 ? t("{n} km over", { n: nf.format(Math.abs(k)) }) : t("{n} km left", { n: nf.format(k) }));
  }
  return parts.join(" / ");
}

/** Safe, readable download name that keeps non-ASCII (e.g. Hebrew) vehicle names. */
export function exportBaseName(car, id) {
  const raw = (car?.nickname || car?.license_plate || "").toString().trim();
  const cleaned = raw.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "");
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : `vehicle-${id}`;
}

/** Whole days from today to an ISO date (negative = in the past). null when the date is missing. */
export function daysFromToday(value, today = todayISO()) {
  const d = parseDate(value);
  const t = parseDate(today);
  if (!d || !t) return null;
  return Math.round((d - t) / 86400000);
}

/** "Today", "Tomorrow", "In 5 days", "Yesterday", "3 days ago". */
export function relativeDay(value, today = todayISO()) {
  const n = daysFromToday(value, today);
  if (n === null) return "";
  if (n === 0) return t("Today");
  if (n === 1) return t("Tomorrow");
  if (n === -1) return t("Yesterday");
  return n > 0 ? t("In {n} days", { n }) : t("{n} days ago", { n: Math.abs(n) });
}
