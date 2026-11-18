import { describe, expect, it } from "vitest";
import { daysFromToday, exportBaseName, relativeDay } from "./format";

describe("exportBaseName", () => {
  it("keeps Hebrew and other non-ASCII names readable", () => {
    expect(exportBaseName({ nickname: "רכב משפחתי" }, 3)).toBe("רכב_משפחתי");
    expect(exportBaseName({ nickname: "Škoda Fabia" }, 3)).toBe("Škoda_Fabia");
  });
  it("falls back to the plate, then to the vehicle id", () => {
    expect(exportBaseName({ nickname: "", license_plate: "12-345-67" }, 3)).toBe("12-345-67");
    expect(exportBaseName({ nickname: "!!!" }, 9)).toBe("vehicle-9");
    expect(exportBaseName(null, 4)).toBe("vehicle-4");
  });
  it("strips path separators and other unsafe characters", () => {
    const backslash = String.fromCharCode(92);
    expect(exportBaseName({ nickname: `a/b${backslash}c:d*e` }, 1)).toBe("a_b_c_d_e");
  });
});

describe("relativeDay", () => {
  const today = "2026-03-10";
  it("describes nearby days in words", () => {
    expect(relativeDay("2026-03-10", today)).toBe("Today");
    expect(relativeDay("2026-03-11", today)).toBe("Tomorrow");
    expect(relativeDay("2026-03-09", today)).toBe("Yesterday");
  });
  it("counts days across month boundaries", () => {
    expect(relativeDay("2026-04-01", today)).toBe("In 22 days");
    expect(relativeDay("2026-02-28", today)).toBe("10 days ago");
    expect(daysFromToday("2026-03-31", "2026-03-29")).toBe(2);
  });
  it("returns empty text for missing dates", () => {
    expect(relativeDay(null, today)).toBe("");
    expect(daysFromToday("", today)).toBe(null);
  });
});
