import { t } from "../i18n";

/**
 * Service categories. `label` is the canonical English name: it is what gets saved as a record's
 * title, so stored data stays language-neutral. Use treatmentLabel() / displayTitle() for display.
 */
export const TREATMENTS = [
  { value: "oil_change", label: "Oil change", icon: "droplet" },
  { value: "oil_filter", label: "Oil filter", icon: "filter" },
  { value: "air_filter", label: "Air filter", icon: "wind" },
  { value: "brake_pads", label: "Brake pads", icon: "disc", fields: ["position"] },
  { value: "battery", label: "Battery", icon: "battery" },
  { value: "tires", label: "Tires", icon: "tire", fields: ["tires"] },
  { value: "lights", label: "Lights", icon: "bulb" },
  { value: "wipers", label: "Wipers", icon: "wipers" },
  { value: "other", label: "Other", icon: "wrench", fields: ["custom_title"] },
];

const BY_VALUE = Object.fromEntries(TREATMENTS.map((x) => [x.value, x]));
const ENGLISH_LABELS = new Set(TREATMENTS.map((x) => x.label.toLowerCase()));

/** Category info with a translated label. */
export function treatmentInfo(value) {
  const known = BY_VALUE[value];
  if (known) return { ...known, label: t(known.label) };
  return { value: value || "other", label: value || t("Service"), icon: "wrench" };
}

/** Translated category name; unknown values are humanized ("timing_belt" -> "Timing belt"). */
export function treatmentLabel(value) {
  if (!value) return t("Service");
  if (BY_VALUE[value]) return t(BY_VALUE[value].label);
  return String(value).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

/**
 * Title to show for a stored record or maintenance item. Titles that are just the canonical English
 * category name (saved by the service form) are translated; anything the user typed is shown as is.
 */
export function displayTitle(title) {
  if (!title) return t("Service");
  return ENGLISH_LABELS.has(String(title).trim().toLowerCase()) ? t(String(title).trim().replace(/^./, (c) => c.toUpperCase())) : title;
}

/** Name for a maintenance item from /maintenance-due ({ part, label }). */
export function itemLabel(item) {
  if (!item) return "";
  const part = item.part || item.item;
  if (BY_VALUE[part]) return t(BY_VALUE[part].label);
  return item.label ? displayTitle(item.label) : treatmentLabel(part);
}

export const STATUS_META = {
  ok: { label: "Healthy", icon: "check-circle" },
  due_soon: { label: "Upcoming", icon: "clock" },
  overdue: { label: "Overdue", icon: "alert" },
  unknown: { label: "Not enough data", icon: "help" },
};

/** Status label (translated) + icon. */
export function statusMeta(status) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  return { ...meta, label: t(meta.label) };
}

const POSITIONS = {
  all: "All",
  front: "Front",
  rear: "Rear",
  front_left: "Front left",
  front_right: "Front right",
  rear_left: "Rear left",
  rear_right: "Rear right",
};

/** "front_left" -> "Front left" (translated when it is a known position). */
export function humanize(value) {
  if (!value) return "";
  if (POSITIONS[value]) return t(POSITIONS[value]);
  return String(value).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
