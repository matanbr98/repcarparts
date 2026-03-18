import React from "react";
import { Link } from "react-router-dom";
import Button from "./Button";

export default function Navbar({ rightSlot }) {
  return (
    <header className="navbar">
      <div className="navbar__inner">
        <Link to="/" className="navbar__brand">
          repcarparts
        </Link>

        <div className="navbar__right">
          {rightSlot}
        </div>
      </div>
    </header>
  );
}

