import { useCallback, useMemo, useRef, useState } from "react";
import { ToastContext } from "./toastContext";
import Icon from "./Icon";
import { t } from "../../i18n";

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback(
    (message, kind = "info") => {
      const id = nextId.current++;
      setToasts((t) => [...t, { id, message, kind }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="region" aria-label={t("Notifications")} aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className={`toast toast--${item.kind}`} role={item.kind === "error" ? "alert" : "status"}>
            <Icon
              name={item.kind === "error" ? "alert" : item.kind === "info" ? "info" : "check-circle"}
              size={18}
              className="toast__icon"
            />
            <span>{item.message}</span>
            <button type="button" className="toast__close" aria-label={t("Dismiss notification")} onClick={() => dismiss(item.id)}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
