import BrandLogo from "../BrandLogo";

/** Centred card on a navy panel, used by Login, Register and the forced password change. */
export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth__panel">
        <div className="auth__brand">
          <BrandLogo variant="full" />
        </div>
        <div className="card auth__card">
          <h1>{title}</h1>
          {subtitle && <p className="muted auth__sub">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="auth__footer">{footer}</div>}
      </div>
    </div>
  );
}
