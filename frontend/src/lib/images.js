import { t } from "../i18n";

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Returns an error message, or "" when the file is acceptable. */
export function validateImage(file) {
  if (!file) return "";
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return t("Use a JPG, PNG or WebP image.");
  if (file.size > MAX_IMAGE_BYTES) return t("Image must be 5 MB or smaller.");
  return "";
}
