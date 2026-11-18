import { afterEach, describe, expect, it } from "vitest";
import he from "./he";
import { getLanguage, isRTL, setLanguage, t, tp } from "./index";
import { STATUS_META, TREATMENTS, statusMeta, treatmentLabel, displayTitle } from "../lib/treatments";
import { MESSAGES, warningMessage } from "../lib/warnings";
import { formatMoney, formatKm } from "../lib/format";

const sources = import.meta.glob(["../**/*.{js,jsx}", "!../**/*.test.{js,jsx}", "!./he.js"], {
  query: "?raw",
  import: "default",
  eager: true,
});

const STR = String.raw`"((?:[^"\\]|\\.)*)"`;
const unescape = (s) => s.replace(/\\"/g, '"');

function usedKeys() {
  const keys = new Set();
  for (const src of Object.values(sources)) {
    for (const m of src.matchAll(new RegExp(String.raw`\bt\(\s*` + STR, "g"))) keys.add(unescape(m[1]));
    for (const m of src.matchAll(new RegExp(String.raw`\btp\([^,]+,\s*` + STR + String.raw`\s*,\s*` + STR, "g"))) {
      keys.add(unescape(m[1]));
      keys.add(unescape(m[2]));
    }
  }
  return keys;
}

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

afterEach(() => setLanguage("en"));

describe("Hebrew dictionary", () => {
  it("translates every t()/tp() string used in the app", () => {
    const keys = usedKeys();
    expect(keys.size).toBeGreaterThan(300);
    const missing = [...keys].filter((k) => !(k in he));
    expect(missing).toEqual([]);
  });

  it("translates treatment, status and warning labels", () => {
    const labels = [
      ...TREATMENTS.map((x) => x.label),
      ...Object.values(STATUS_META).map((x) => x.label),
      ...Object.values(MESSAGES),
    ];
    expect(labels.filter((k) => !(k in he))).toEqual([]);
  });

  it("keeps the same placeholders in each translation", () => {
    const broken = Object.entries(he).filter(([k, v]) => placeholders(k).join() !== placeholders(v).join());
    expect(broken).toEqual([]);
  });
});

describe("language switching", () => {
  it("switches text, direction and formatting", () => {
    setLanguage("he");
    expect(getLanguage()).toBe("he");
    expect(isRTL()).toBe(true);
    expect(document.documentElement.dir).toBe("rtl");
    expect(document.documentElement.lang).toBe("he");
    expect(t("Garage")).toBe("המוסך");
    expect(tp(3, "1 service", "{n} services")).toBe("3 טיפולים");
    expect(formatMoney(1250)).toContain("₪");
    expect(formatKm(1000)).toContain("ק״מ");
    expect(treatmentLabel("oil_change")).toBe("החלפת שמן");
    expect(statusMeta("overdue").label).toBe("באיחור");
    // stored titles stay English and are translated on display; free text is left alone
    expect(displayTitle("Oil change")).toBe("החלפת שמן");
    expect(displayTitle("Timing belt")).toBe("Timing belt");
    expect(warningMessage({ code: "large_jump", message: "server text" })).toBe(he[MESSAGES.large_jump]);
    expect(warningMessage({ code: "unknown_code", message: "server text" })).toBe("server text");

    setLanguage("en");
    expect(document.documentElement.dir).toBe("ltr");
    expect(t("Garage")).toBe("Garage");
    expect(warningMessage({ code: "large_jump", message: "server text" })).toBe("server text");
  });
});
