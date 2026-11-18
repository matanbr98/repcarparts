import { Link } from "react-router-dom";
import Icon from "./Icon";

/**
 * Consistent page title block.
 * back: { to, label } breadcrumb-style link; leading: element shown left of the title (icon tile, avatar);
 * meta: row of badges under the subtitle; actions: buttons aligned right (full width on mobile).
 */
export default function PageHeader({ title, subtitle, back, actions, leading, meta }) {
  return (
    <header className="page-header">
      {back && (
        <Link to={back.to} className="page-header__back">
          <Icon name="back" size={14} /> {back.label}
        </Link>
      )}
      <div className="page-header__row">
        <div className="page-header__main">
          {leading}
          <div className="page-header__text">
            <h1>{title}</h1>
            {subtitle && <p className="page-header__subtitle">{subtitle}</p>}
            {meta && <div className="page-header__meta">{meta}</div>}
          </div>
        </div>
        {actions && <div className="page-header__actions">{actions}</div>}
      </div>
    </header>
  );
}
