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

const BY_VALUE = Object.fromEntries(TREATMENTS.map((t) => [t.value, t]));

export function treatmentInfo(value) {
  return BY_VALUE[value] || { value: value || "other", label: value || "Service", icon: "wrench" };
}

export function treatmentLabel(value) {
  if (!value) return "Service";
  return BY_VALUE[value]?.label || String(value).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const STATUS_META = {
  ok: { label: "Healthy", icon: "check-circle" },
  due_soon: { label: "Upcoming", icon: "clock" },
  overdue: { label: "Overdue", icon: "alert" },
  unknown: { label: "Not enough data", icon: "help" },
};

export function statusMeta(status) {
  return STATUS_META[status] || STATUS_META.unknown;
}

/** "front_left" -> "Front left" */
export function humanize(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}
