import { statusMeta, treatmentLabel } from "./treatments";

/** One-line description of the most urgent maintenance item for a garage vehicle. */
export function urgencyLabel(car) {
  const status = car.status || "unknown";
  const item = car.most_urgent;
  const cov = car.coverage;
  if (status === "ok") return "Healthy";
  if (status === "unknown") {
    if (!cov || cov.known === 0) return "No service history yet";
    return `Not enough data (${cov.known} of ${cov.tracked} tracked)`;
  }
  if (!item) return statusMeta(status).label;
  const name = item.label || treatmentLabel(item.item || item.part);
  return `${name} ${statusMeta(item.status || status).label.toLowerCase()}`;
}
