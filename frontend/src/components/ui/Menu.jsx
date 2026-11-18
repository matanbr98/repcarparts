import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";

/**
 * Small dropdown menu.
 *   <Menu label="More actions" trigger={<Icon name="more" />} triggerClassName="btn btn--secondary btn--icon">
 *     <MenuItem icon="edit" onSelect={...}>Edit</MenuItem>
 *     <MenuItem to="/profile">Profile</MenuItem>
 *     <MenuSeparator />
 *     <MenuItem danger onSelect={...}>Delete</MenuItem>
 *   </Menu>
 * Keyboard: Enter/Space/ArrowDown open, arrows move, Escape/Tab close, focus returns to the trigger.
 */
export default function Menu({ label, trigger, triggerClassName = "btn btn--secondary", placement = "", children, tooltip }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const buttonRef = useRef(null);
  const id = useId();

  const items = () => Array.from(panelRef.current?.querySelectorAll('[role="menuitem"]') || []);

  useEffect(() => {
    if (!open) return undefined;
    items()[0]?.focus();
    function onDown(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, [open]);

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) buttonRef.current?.focus();
  }

  function onPanelKey(e) {
    const list = items();
    const i = list.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      list[(i + 1) % list.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      list[(i - 1 + list.length) % list.length]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      list[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      list[list.length - 1]?.focus();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={label}
        data-tooltip={tooltip}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={panelRef}
          id={id}
          role="menu"
          aria-label={label}
          className={`menu__panel ${placement}`.trim()}
          onKeyDown={onPanelKey}
          onClick={(e) => {
            if (e.target.closest('[role="menuitem"]')) close(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon, to, onSelect, danger = false, children }) {
  const cls = `menu__item${danger ? " menu__item--danger" : ""}`;
  const content = (
    <>
      {icon && <Icon name={icon} size={16} />}
      <span>{children}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} role="menuitem" tabIndex={-1} className={cls}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" role="menuitem" tabIndex={-1} className={cls} onClick={onSelect}>
      {content}
    </button>
  );
}

export function MenuSeparator() {
  return <div className="menu__sep" role="separator" />;
}

export function MenuLabel({ children }) {
  return <div className="menu__label">{children}</div>;
}
