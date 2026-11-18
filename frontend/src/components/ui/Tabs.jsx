import { useRef } from "react";
import { isRTL, t } from "../../i18n";

/** Controlled tabs. tabs: [{ id, label, count? }]. Arrow keys move between tabs. */
export default function Tabs({ tabs, value, onChange, label }) {
  const refs = useRef({});

  function onKeyDown(e, index) {
    let next = null;
    // in right-to-left layouts the visual order is mirrored, so the arrow keys are too
    const forward = isRTL() ? "ArrowLeft" : "ArrowRight";
    const backward = isRTL() ? "ArrowRight" : "ArrowLeft";
    if (e.key === forward) next = (index + 1) % tabs.length;
    if (e.key === backward) next = (index - 1 + tabs.length) % tabs.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabs.length - 1;
    if (next !== null) {
      e.preventDefault();
      const t = tabs[next];
      onChange(t.id);
      refs.current[t.id]?.focus();
    }
  }

  return (
    <div className="tabs" role="tablist" aria-label={label ?? t("Sections")}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[t.id] = el;
          }}
          id={`tab-${t.id}`}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          aria-controls={`panel-${t.id}`}
          tabIndex={value === t.id ? 0 : -1}
          className="tabs__tab"
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.label}
          {t.count !== undefined && t.count !== null && <span className="tabs__count num">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}
