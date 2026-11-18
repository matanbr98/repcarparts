import Icon from "./Icon";
import Button from "./Button";
import { t } from "../../i18n";

export default function ErrorState({ error, title, onRetry }) {
  const message = typeof error === "string" ? error : error?.message || t("Please try again.");
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon">
        <Icon name="alert" size={22} />
      </div>
      <div className="state__title">{title ?? t("Something went wrong")}</div>
      <p className="state__text">{message}</p>
      {onRetry && (
        <div className="state__actions">
          <Button variant="secondary" onClick={onRetry}>
            {t("Try again")}
          </Button>
        </div>
      )}
    </div>
  );
}
