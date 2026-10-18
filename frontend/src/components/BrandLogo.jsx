/**
 * The real Repcarparts logo (public/logo.jpg), shown unmodified. The artwork is a wide picture with
 * a lot of empty background, so it is displayed through a fixed-ratio window (pure CSS, no
 * stretching, no second image file):
 *   variant="full" - emblem + wordmark + tagline (sidebar, login, register)
 *   variant="mark" - the shield emblem only (compact mobile top bar)
 */
const WINDOWS = {
  // x, y, width, height of the visible region in the 1024x559 source image
  full: { x: 190, y: 75, w: 650, h: 450 },
  mark: { x: 365, y: 90, w: 300, h: 280 },
};

export default function BrandLogo({ variant = "full", className = "", label = "Repcarparts" }) {
  const win = WINDOWS[variant] || WINDOWS.full;
  return (
    <span
      className={`brand-crop brand-crop--${variant} ${className}`.trim()}
      style={{ "--bx": win.x, "--by": win.y, "--bw": win.w, "--bh": win.h }}
    >
      <img src="/logo.jpg" alt={variant === "full" ? label : ""} width="1024" height="559" draggable="false" />
    </span>
  );
}
