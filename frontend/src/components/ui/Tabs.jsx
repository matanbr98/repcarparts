import { useRef } from "react";

/** Controlled tabs. tabs: [{ id, label }]. Arrow keys move between tabs. */
export default function Tabs({ tabs, value, onChange, label = "Sections" }) {
  const refs = useRef({});

  function onKeyDown(e, index) {
    let next = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (next !== null) {
      e.preventDefault();
      const t = tabs[next];
      onChange(t.id);
      refs.current[t.id]?.focus();
    }
  }

  return (
    <div className="tabs" role="tablist" aria-label={label}>
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
        </button>
      ))}
    </div>
  );
}
