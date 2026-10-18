const nf = new Intl.NumberFormat("en-US");

export function formatNumber(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return nf.format(Number(n));
}

export function formatMoney(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return `${nf.format(Number(n))} ILS`;
}

export function formatKm(n) {
  if (n === null || n === undefined || n === "" || Number.isNaN(Number(n))) return "-";
  return `${nf.format(Number(n))} km`;
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
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function formatShortDate(value) {
  const d = parseDate(value);
  if (!d) return "-";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short" });
}

export function vehicleTitle(car) {
  if (!car) return "";
  return car.nickname || [car.make, car.model].filter(Boolean).join(" ") || "Vehicle";
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
    parts.push(d < 0 ? `${Math.abs(d)} days overdue` : `${d} days left`);
  }
  if (typeof item.remaining_km === "number") {
    const k = item.remaining_km;
    parts.push(k < 0 ? `${nf.format(Math.abs(k))} km over` : `${nf.format(k)} km left`);
  }
  return parts.join(" / ");
}

/** Safe, readable download name that keeps non-ASCII (e.g. Hebrew) vehicle names. */
export function exportBaseName(car, id) {
  const raw = (car?.nickname || car?.license_plate || "").toString().trim();
  const cleaned = raw.replace(/[^\p{L}\p{N}._-]+/gu, "_").replace(/^_+|_+$/g, "");
  return /[\p{L}\p{N}]/u.test(cleaned) ? cleaned : `vehicle-${id}`;
}
