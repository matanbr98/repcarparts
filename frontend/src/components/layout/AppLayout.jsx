import BrandLogo from "../BrandLogo";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { clearAuth } from "../../auth";
import { useAuth } from "../../hooks/useAuth";
import { useAsync } from "../../hooks/useAsync";
import { api } from "../../services/api";
import { vehicleTitle } from "../../lib/format";
import { onProfileUpdated } from "../../lib/profileEvents";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Button from "../ui/Button";
import Menu, { MenuItem, MenuLabel, MenuSeparator } from "../ui/Menu";
import Avatar from "../Avatar";

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
      <Icon name={icon} size={18} />
      <span>{label}</span>
    </NavLink>
  );
}

/** Opens the add-service flow: straight to the current vehicle, otherwise asks which vehicle. */
function LogServiceAction({ className, children }) {
  const navigate = useNavigate();
  const onCar = useMatch("/car/:id/*");
  const [open, setOpen] = useState(false);
  const [cars, setCars] = useState(null);
  const [error, setError] = useState("");

  async function start() {
    const id = onCar?.params?.id;
    if (id && id !== "undefined") {
      navigate(`/car/${id}/add-record`);
      return;
    }
    setOpen(true);
    setError("");
    setCars(null);
    try {
      const list = await api.getCars();
      if (list.length === 0) {
        setOpen(false);
        navigate("/add-car");
      } else if (list.length === 1) {
        setOpen(false);
        navigate(`/car/${list[0].id}/add-record`);
      } else {
        setCars(list);
      }
    } catch (e) {
      setError(e.message || "Could not load your vehicles.");
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={start}>
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Log a service for..."
        actions={
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        }
      >
        {error && <p role="alert" className="form-error">{error}</p>}
        {!cars && !error && <p className="muted">Loading vehicles...</p>}
        {cars && (
          <ul className="pick-list">
            {cars.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className="pick-list__item"
                  onClick={() => {
                    setOpen(false);
                    navigate(`/car/${c.id}/add-record`);
                  }}
                >
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name="car" size={16} />
                  </span>
                  <span className="pick-list__name">{vehicleTitle(c)}</span>
                  {c.license_plate && <span className="plate">{c.license_plate}</span>}
                  <Icon name="chevron-right" size={16} className="pick-list__chev" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

function useCurrentUser() {
  const me = useAsync(() => api.me(), []);
  const { reload } = me;
  useEffect(() => onProfileUpdated(reload), [reload]);
  return me.data;
}

function AccountMenuItems({ me, isManager }) {
  return (
    <>
      <MenuLabel>
        Signed in as <strong className="strong">{me?.username || (isManager ? "manager" : "user")}</strong>
      </MenuLabel>
      <MenuItem to="/profile" icon="user">
        Profile
      </MenuItem>
      <MenuItem to="/change-password" icon="lock">
        Change password
      </MenuItem>
      <MenuSeparator />
      <MenuItem icon="logout" onSelect={() => clearAuth()}>
        Log out
      </MenuItem>
    </>
  );
}

export default function AppLayout() {
  const { isManager } = useAuth();
  const me = useCurrentUser();
  const displayName = me?.name || me?.username || "";
  const roleLabel = isManager ? "Manager" : "Owner";

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary">
        <Link to="/" className="sidebar__brand" aria-label="Repcarparts - Garage">
          <BrandLogo variant="mark" />
          <span className="sidebar__brand-text">
            <span className="sidebar__brand-name">Repcarparts</span>
            <span className="sidebar__brand-sub">Service manager</span>
          </span>
        </Link>

        {!isManager && (
          <LogServiceAction className="btn btn--accent btn--block sidebar__cta">
            <Icon name="plus" size={16} /> Log service
          </LogServiceAction>
        )}

        <nav className="sidebar__nav" aria-label="Main navigation">
          <p className="sidebar__section">Workspace</p>
          <NavItem to="/" end icon="garage" label="Garage" />
          <NavItem to="/reminders" icon="bell" label="Reminders" />
          {isManager && (
            <>
              <p className="sidebar__section">Administration</p>
              <NavItem to="/manager" icon="shield" label="Manager" />
            </>
          )}
          <p className="sidebar__section">Account</p>
          <NavItem to="/profile" icon="user" label="Profile" />
        </nav>

        <div className="sidebar__foot">
          <Menu
            label="Account menu"
            placement="menu__panel--up menu__panel--stretch"
            triggerClassName="user-chip"
            trigger={
              <>
                <Avatar url={me?.profile_image_url} name={displayName || roleLabel} size={32} />
                <span className="user-chip__text">
                  <span className="user-chip__name truncate">{displayName || "Account"}</span>
                  <span className="user-chip__role">{roleLabel}</span>
                </span>
                <Icon name="chevron-up-down" size={16} className="user-chip__chev" />
              </>
            }
          >
            <AccountMenuItems me={me} isManager={isManager} />
          </Menu>
        </div>
      </aside>

      <header className="topbar">
        <Link to="/" className="topbar__brand" aria-label="Repcarparts - Garage">
          <BrandLogo variant="mark" />
          <span>Repcarparts</span>
        </Link>
        <Menu
          label="Account menu"
          triggerClassName="topbar__account"
          trigger={<Avatar url={me?.profile_image_url} name={displayName || roleLabel} size={32} />}
        >
          <AccountMenuItems me={me} isManager={isManager} />
        </Menu>
      </header>

      <main id="main" className="main">
        <div className="main__inner">
          <Outlet />
        </div>
      </main>

      <nav className="tabbar" aria-label="Primary">
        <NavItem to="/" end icon="garage" label="Garage" />
        {!isManager && (
          <LogServiceAction className="tabbar__fab">
            <span className="tabbar__fab-icon" aria-hidden="true">
              <Icon name="plus" size={20} />
            </span>
            <span>Log service</span>
          </LogServiceAction>
        )}
        <NavItem to="/reminders" icon="bell" label="Reminders" />
        {isManager && <NavItem to="/manager" icon="shield" label="Manager" />}
        <NavItem to="/profile" icon="user" label="Profile" />
      </nav>
    </div>
  );
}
