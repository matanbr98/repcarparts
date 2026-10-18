import Icon from "./Icon";
import Button from "./Button";

export default function ErrorState({ error, title = "Something went wrong", onRetry }) {
  const message = typeof error === "string" ? error : error?.message || "Please try again.";
  return (
    <div className="state state--error" role="alert">
      <div className="state__icon">
        <Icon name="alert" size={28} />
      </div>
      <div className="state__title">{title}</div>
      <p className="state__text">{message}</p>
      {onRetry && (
        <div className="state__actions">
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}
