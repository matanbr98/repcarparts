import BrandLogo from "../BrandLogo";
import { useState } from "react";
import { Link, NavLink, Outlet, useMatch, useNavigate } from "react-router-dom";
import { clearAuth } from "../../auth";
import { useAuth } from "../../hooks/useAuth";
import { api } from "../../services/api";
import { vehicleTitle } from "../../lib/format";
import Icon from "../ui/Icon";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

function NavItem({ to, icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => `nav-link${isActive ? " nav-link--active" : ""}`}>
      <Icon name={icon} size={20} />
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
                  <Icon name="car" size={18} />
                  <span>{vehicleTitle(c)}</span>
                  <span className="muted small">{c.license_plate}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}

export default function AppLayout() {
  const { isManager } = useAuth();

  function logout() {
    clearAuth(); // route guards redirect to /login
  }

  return (
    <div className="app">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary">
        <Link to="/" className="sidebar__brand" aria-label="Repcarparts - Garage">
          <BrandLogo variant="full" />
        </Link>
        <nav className="sidebar__nav">
          <NavItem to="/" end icon="garage" label="Garage" />
          <NavItem to="/reminders" icon="bell" label="Reminders" />
          <NavItem to="/profile" icon="user" label="Profile" />
          {isManager && <NavItem to="/manager" icon="shield" label="Manager" />}
        </nav>
        <div className="sidebar__foot">
          {!isManager && (
            <LogServiceAction className="btn btn--accent btn--block">
              <Icon name="plus" size={16} /> Log service
            </LogServiceAction>
          )}
          <button type="button" className="nav-link nav-link--button" onClick={logout}>
            <Icon name="logout" size={20} />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <header className="topbar">
        <Link to="/" className="topbar__brand">
          <BrandLogo variant="mark" />
          <span>Repcarparts</span>
        </Link>
        <button type="button" className="topbar__logout" onClick={logout} aria-label="Log out">
          <Icon name="logout" size={20} />
        </button>
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
            <Icon name="plus" size={22} />
            <span>Log service</span>
          </LogServiceAction>
        )}
        <NavItem to="/reminders" icon="bell" label="Reminders" />
        <NavItem to="/profile" icon="user" label="Profile" />
        {isManager && <NavItem to="/manager" icon="shield" label="Manager" />}
      </nav>
    </div>
  );
}
