import { t } from "../i18n";
import { itemLabel, statusMeta } from "./treatments";

/** One-line description of the most urgent maintenance item for a garage vehicle. */
export function urgencyLabel(car) {
  const status = car.status || "unknown";
  const item = car.most_urgent;
  const cov = car.coverage;
  if (status === "ok") return t("Healthy");
  if (status === "unknown") {
    if (!cov || cov.known === 0) return t("No service history yet");
    return t("Not enough data ({known} of {tracked} tracked)", { known: cov.known, tracked: cov.tracked });
  }
  if (!item) return statusMeta(status).label;
  const s = item.status || status;
  return s === "overdue"
    ? t("{name} overdue", { name: itemLabel(item) })
    : t("{name} due soon", { name: itemLabel(item) });
}
