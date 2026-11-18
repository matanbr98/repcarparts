import { getLanguage, t } from "../i18n";

/**
 * The backend phrases data-check warnings in English ({ code, message, record_ids }). In English the
 * server text is shown as is (it carries exact dates and readings); in other languages each known
 * code gets a translated summary, and unknown codes fall back to the server text.
 */
export const MESSAGES = {
  future_date: "This entry is dated in the future. It is saved as scheduled and is not counted for maintenance until that date.",
  before_model_year: "This entry is dated before the vehicle's model year.",
  possible_duplicate: "The same service appears more than once on the same day with the same cost - possible duplicate.",
  same_day_category_mismatch: "Entries of the same type on the same day have different odometer readings. The higher reading is used.",
  same_day_mismatch: "Entries on the same day have different odometer readings.",
  odometer_regression: "The odometer reading is lower than an earlier entry. Check the readings.",
  manual_regression: "Your current odometer entry is lower than a reading in the service history.",
  implausible_distance: "The distance between two entries looks implausible for the time between them.",
  large_jump: "That is a big jump from the last known reading. Make sure it is correct - mileage-based reminders will use it.",
};

export function warningMessage(w) {
  if (!w) return "";
  if (getLanguage() === "en" || !MESSAGES[w.code]) return w.message || "";
  return t(MESSAGES[w.code]);
}
