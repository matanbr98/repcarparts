export default function Button({
  as: Tag = "button",
  variant = "secondary",
  size,
  block = false,
  loading = false,
  disabled,
  className = "",
  children,
  type,
  ...rest
}) {
  const cls = [
    "btn",
    `btn--${variant}`,
    size ? `btn--${size}` : "",
    block ? "btn--block" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const isButton = Tag === "button";
  return (
    <Tag
      className={cls}
      type={isButton ? type || "button" : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-disabled={!isButton && disabled ? true : undefined}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className="btn__spinner" aria-hidden="true" />}
      {children}
    </Tag>
  );
}
