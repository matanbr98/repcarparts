import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { clearAuth, getAuth } from "../auth";
import Container from "./Container";
import Navbar from "./Navbar";
import Button from "./Button";

export default function AppShell({ children }) {
  const navigate = useNavigate();
  const { token, role } = getAuth();

  function logout() {
    clearAuth();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <Navbar
        rightSlot={
          <>
            {token && role !== "manager" && (
              <Button as={Link} to="/add-car" variant="primary">
                Add Car
              </Button>
            )}
            {token && (
              <Button as={Link} to="/profile" variant="ghost" className="avatar">
                <span className="avatar__dot" />
              </Button>
            )}
            {token && (
              <Button variant="ghost" onClick={logout}>
                Logout
              </Button>
            )}
          </>
        }
      />

      <main className="main">
        <Container>{children}</Container>
      </main>
    </div>
  );
}

