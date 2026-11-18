import BrandLogo from "../BrandLogo";

/** Split screen: brand panel (desktop) + form panel. Used by Login, Register and the password change. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <aside className="auth__brand-panel" aria-hidden="true">
        <div className="auth__brand-logo">
          <BrandLogo variant="full" label="" />
        </div>
        <ul className="auth__points">
          <li>Every vehicle, service and receipt in one place</li>
          <li>Know what maintenance is due before it is overdue</li>
          <li>Spend by vehicle, service type and month</li>
        </ul>
      </aside>

      <main className="auth__main">
        <div className="auth__panel">
          <div className="auth__brand-mobile">
            <BrandLogo variant="mark" />
            <span>Repcarparts</span>
          </div>
          <div className="auth__head">
            <h1>{title}</h1>
            {subtitle && <p className="auth__sub">{subtitle}</p>}
          </div>
          {children}
          {footer && <div className="auth__footer">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
