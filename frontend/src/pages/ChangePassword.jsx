import { useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/layout/AuthLayout";
import ChangePasswordForm from "../components/ChangePasswordForm";
import { clearAuth, getAuth } from "../auth";
import { useAuth } from "../hooks/useAuth";

/** Forced password-change screen (shown when the account has must_change_password set). */
export default function ChangePassword() {
  const { mustChangePassword } = useAuth();
  const navigate = useNavigate();
  const wasForced = useRef(mustChangePassword).current;
  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={
        mustChangePassword
          ? "For your security you need to set a new password before continuing."
          : "Update the password for your account."
      }
      footer={
        mustChangePassword ? (
          <button type="button" className="link-button" onClick={() => clearAuth()}>
            Log out
          </button>
        ) : (
          <Link to="/">Back to garage</Link>
        )
      }
    >
      <ChangePasswordForm
        submitLabel="Set new password"
        onDone={() => {
          if (wasForced) navigate(getAuth().role === "manager" ? "/manager" : "/", { replace: true });
        }}
      />
    </AuthLayout>
  );
}
