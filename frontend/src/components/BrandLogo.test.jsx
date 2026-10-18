import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BrandLogo from "./BrandLogo";

describe("BrandLogo", () => {
  it("shows the real logo file with an accessible name", () => {
    render(<BrandLogo />);
    const img = screen.getByAltText("Repcarparts");
    expect(img.getAttribute("src")).toBe("/logo.jpg");
  });
  it("the emblem-only variant is decorative (name is rendered as text beside it)", () => {
    const { container } = render(<BrandLogo variant="mark" />);
    expect(container.querySelector("img").getAttribute("alt")).toBe("");
  });
});
