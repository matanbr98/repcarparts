import { createContext, useContext } from "react";

export const ToastContext = createContext({ show: () => {} });

/** const toast = useToast(); toast.success("Saved"); toast.error("Failed"); */
export function useToast() {
  const ctx = useContext(ToastContext);
  return {
    success: (message) => ctx.show(message, "success"),
    error: (message) => ctx.show(message, "error"),
    info: (message) => ctx.show(message, "info"),
  };
}
