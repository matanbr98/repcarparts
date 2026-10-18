import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import DataChecksPanel from "./DataChecksPanel";

describe("DataChecksPanel", () => {
  it("renders nothing when there are no warnings", () => {
    const { container } = render(
      <MemoryRouter>
        <DataChecksPanel carId="1" warnings={[]} />
      </MemoryRouter>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("lists warnings, says they are non-blocking, and links to the entry", () => {
    render(
      <MemoryRouter>
        <DataChecksPanel
          carId="1"
          warnings={[{ code: "odometer_regression", message: "Oil shows 90,000 km, lower than 100,000 km", record_ids: [12] }]}
        />
      </MemoryRouter>
    );
    expect(screen.getByText(/lower than 100,000 km/)).toBeInTheDocument();
    expect(screen.getByText(/still saved and counted/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /review entry/i })).toHaveAttribute("href", "/car/1/edit-record/12");
  });
});
