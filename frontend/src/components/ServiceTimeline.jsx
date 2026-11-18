import { useMemo } from "react";
import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import { formatDate, formatKm, formatMoney, yearOf } from "../lib/format";
import { displayTitle, humanize, treatmentInfo } from "../lib/treatments";
import { assetUrl } from "../services/api";
import { todayISO } from "../lib/format";
import { t, tp } from "../i18n";

const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** Secondary facts worth showing on a card (only the ones that carry information). */
function detailChips(rec) {
  const chips = [];
  const info = treatmentInfo(rec.treatment_type);
  if (rec.treatment_type && !same(info.label, displayTitle(rec.title))) {
    chips.push({ key: "type", icon: info.icon, text: info.label });
  }
  if (rec.treatment_type === "tires") {
    const count = rec.tires_count ? tp(rec.tires_count, "1 tire", "{n} tires") : "";
    const where = rec.tire_position && rec.tire_position !== "all" ? humanize(rec.tire_position) : "";
    const text = [count, where].filter(Boolean).join(" · ");
    if (text) chips.push({ key: "tires", icon: "tire", text });
  } else if (rec.position && rec.position !== "all") {
    chips.push({ key: "position", icon: "disc", text: humanize(rec.position) });
  }
  const parts = (rec.parts_replaced || "").trim();
  if (parts && !same(parts, rec.title) && !same(displayTitle(parts), displayTitle(rec.title))) {
    chips.push({ key: "parts", icon: "wrench", text: parts });
  }
  return chips;
}

export default function ServiceTimeline({ carId, records, flaggedIds, onDelete, onOpenReceipt }) {
  const groups = useMemo(() => {
    const map = new Map();
    records.forEach((r) => {
      const y = yearOf(r.service_date) || t("Undated");
      if (!map.has(y)) map.set(y, []);
      map.get(y).push(r);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  return (
    <div className="timeline">
      {groups.map(([year, items]) => {
        const yearTotal = items.reduce((sum, r) => sum + Number(r.cost || 0), 0);
        return (
          <section key={year} className="timeline__year" aria-label={t("Services in {year}", { year })}>
            <div className="timeline__year-head">
              <h3 className="timeline__year-label">{year}</h3>
              <span className="timeline__year-meta num">
                {tp(items.length, "1 service", "{n} services")}
                {yearTotal > 0 ? ` · ${formatMoney(yearTotal)}` : ""}
              </span>
            </div>
            <ol className="timeline__list">
              {items.map((rec) => {
                const info = treatmentInfo(rec.treatment_type);
                const title = displayTitle(rec.title);
                const chips = detailChips(rec);
                return (
                  <li key={rec.id} className="timeline__item">
                    <div className="timeline__icon" aria-hidden="true">
                      <Icon name={info.icon} size={18} />
                    </div>
                    <div className="card timeline__card">
                      <div className="timeline__body">
                        <div className="timeline__content">
                          <div className="timeline__head">
                            <h4 className="timeline__title">{title}</h4>
                            <span className="num timeline__cost">{formatMoney(rec.cost ?? 0)}</span>
                            <div className="timeline__actions">
                              <Button
                                as={Link}
                                to={`/car/${carId}/edit-record/${rec.id}`}
                                state={{ rec }}
                                size="sm"
                                variant="ghost"
                                className="btn--icon"
                                aria-label={t("Edit {title}", { title })}
                                data-tooltip={t("Edit")}
                              >
                                <Icon name="edit" size={15} />
                              </Button>
                              <Button
                                size="sm"
                                variant="danger-ghost"
                                className="btn--icon"
                                onClick={() => onDelete(rec)}
                                aria-label={t("Delete {title}", { title })}
                                data-tooltip={t("Delete")}
                              >
                                <Icon name="trash" size={15} />
                              </Button>
                            </div>
                          </div>
                          <p className="muted small timeline__meta">
                            <span>
                              <Icon name="calendar" size={13} />{" "}
                              <time dateTime={rec.service_date}>{formatDate(rec.service_date)}</time>
                            </span>
                            {rec.odometer_km !== null && rec.odometer_km !== undefined && (
                              <span className="num">
                                <Icon name="gauge" size={13} /> {formatKm(rec.odometer_km)}
                              </span>
                            )}
                          </p>
                          {rec.service_date > todayISO() && (
                            <p className="timeline__scheduled">
                              <Icon name="clock" size={13} /> {t("Scheduled - not counted for maintenance until this date")}
                            </p>
                          )}
                          {flaggedIds?.has(rec.id) && (
                            <p className="timeline__flag">
                              <Icon name="alert" size={13} /> {t("Check this entry - see the data checks above")}
                            </p>
                          )}
                          {chips.length > 0 && (
                            <ul className="chips">
                              {chips.map((c) => (
                                <li key={c.key} className="chip">
                                  <Icon name={c.icon} size={13} /> {c.text}
                                </li>
                              ))}
                            </ul>
                          )}
                          {rec.notes && <p className="timeline__notes">{rec.notes}</p>}
                        </div>
                        {rec.image_url && (
                          <button
                            type="button"
                            className="receipt-thumb"
                            onClick={() => onOpenReceipt(rec)}
                            aria-label={t("View receipt for {title}", { title })}
                          >
                            <img src={assetUrl(rec.image_url)} alt="" loading="lazy" />
                            <span className="receipt-thumb__label">
                              <Icon name="eye" size={12} /> {t("Receipt")}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
