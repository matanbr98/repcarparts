import { assetUrl } from "../services/api";

export default function Avatar({ url, name, size = 40 }) {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {url ? <img src={assetUrl(url)} alt="" /> : <span aria-hidden="true">{initial}</span>}
    </span>
  );
}
