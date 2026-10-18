export default function Card({ as: Tag = "section", className = "", flush, interactive, children, ...rest }) {
  const cls = ["card", flush ? "card--flush" : "", interactive ? "card--interactive" : "", className]
    .filter(Boolean)
    .join(" ");
  const El = Tag;
  return (
    <El className={cls} {...rest}>
      {children}
    </El>
  );
}
