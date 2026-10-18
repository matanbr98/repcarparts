import { describe, expect, it } from "vitest";
import { exportBaseName } from "./format";

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
