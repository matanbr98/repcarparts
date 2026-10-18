import { Link } from "react-router-dom";
import Icon from "./Icon";

export default function PageHeader({ title, subtitle, back, actions }) {
  return (
    <header className="page-header">
      {back && (
        <Link to={back.to} className="page-header__back">
          <Icon name="back" size={16} /> {back.label}
        </Link>
      )}
      <div className="page-header__row">
        <div className="page-header__text">
          <h1>{title}</h1>
          {subtitle && <p className="muted">{subtitle}</p>}
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
