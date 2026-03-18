import React from "react";

export default function Button({
  variant = "primary",
  as: As = "button",
  className = "",
  ...props
}) {
  return <As className={`btn btn--${variant} ${className}`.trim()} {...props} />;
}

