import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StatusPill from "./StatusPill";

describe("StatusPill", () => {
  it("always renders a text label, not colour alone", () => {
    render(<StatusPill status="overdue" />);
    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });
  it("falls back to unknown styling for unexpected statuses", () => {
    const { container } = render(<StatusPill status="weird" label="Mystery" />);
    expect(screen.getByText("Mystery")).toBeInTheDocument();
    expect(container.firstChild.className).toContain("badge--unknown");
  });
});
