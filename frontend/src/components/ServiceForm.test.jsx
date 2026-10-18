import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../services/api", () => ({
  api: {
    updateRecord: vi.fn().mockResolvedValue({ id: 1, warnings: [] }),
    addRecord: vi.fn().mockResolvedValue({ id: 2, warnings: [] }),
    replaceRecordImage: vi.fn(),
    removeRecordImage: vi.fn(),
  },
}));

import { api } from "../services/api";
import ServiceForm from "./ServiceForm";

// a pre-upgrade record: free-text title, no treatment_type, no tire/position data
const legacy = {
  id: 1,
  car_id: 7,
  title: "Oil change + filter",
  treatment_type: null,
  service_date: "2025-05-01",
  odometer_km: 50000,
  cost: 300,
  notes: "",
  parts_replaced: "Oil, filter",
  position: null,
  tire_position: null,
  tires_count: null,
  image_url: null,
};

function renderForm(props) {
  return render(
    <MemoryRouter>
      <ServiceForm carId="7" {...props} />
    </MemoryRouter>
  );
}

beforeEach(() => vi.clearAllMocks());

describe("ServiceForm (edit)", () => {
  it("sends only the changed field, leaving legacy type/parts untouched", async () => {
    const user = userEvent.setup();
    renderForm({ record: legacy });
    await user.type(screen.getByLabelText(/notes/i), "checked twice");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(api.updateRecord).toHaveBeenCalledTimes(1));
    const [, , patch] = api.updateRecord.mock.calls[0];
    expect(patch).toEqual({ notes: "checked twice" });
    expect(patch).not.toHaveProperty("treatment_type");
    expect(patch).not.toHaveProperty("parts_replaced");
  });

  it("does not call the API when nothing changed", async () => {
    const user = userEvent.setup();
    renderForm({ record: legacy });
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(api.updateRecord).not.toHaveBeenCalled();
  });

  it("clearing the odometer sends null, not a missing value", async () => {
    const user = userEvent.setup();
    renderForm({ record: legacy });
    await user.clear(screen.getByLabelText(/odometer/i));
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(api.updateRecord).toHaveBeenCalled());
    expect(api.updateRecord.mock.calls[0][2]).toEqual({ odometer_km: null });
  });
});

describe("ServiceForm validation", () => {
  it("blocks a date more than a year ahead without calling the API", async () => {
    const user = userEvent.setup();
    renderForm({});
    const date = screen.getByLabelText(/^date/i);
    await user.clear(date);
    await user.type(date, "2099-01-01");
    await user.click(screen.getByRole("button", { name: /save service/i }));
    expect(await screen.findByText(/more than a year ahead/i)).toBeInTheDocument();
    expect(api.addRecord).not.toHaveBeenCalled();
  });

  it("rejects an absurd odometer and cost", async () => {
    const user = userEvent.setup();
    renderForm({});
    await user.type(screen.getByLabelText(/odometer/i), "8750000");
    await user.type(screen.getByLabelText(/cost/i), "999999999999");
    await user.click(screen.getByRole("button", { name: /save service/i }));
    expect(await screen.findByText(/odometer reading is too high/i)).toBeInTheDocument();
    expect(screen.getByText(/amount is too high/i)).toBeInTheDocument();
    expect(api.addRecord).not.toHaveBeenCalled();
  });

  it("requires a title for the Other type", async () => {
    const user = userEvent.setup();
    renderForm({});
    await user.click(screen.getByLabelText(/^other$/i));
    await user.type(screen.getByLabelText(/service title/i), "   ");
    await user.click(screen.getByRole("button", { name: /save service/i }));
    expect(await screen.findByText(/enter a title/i)).toBeInTheDocument();
    expect(api.addRecord).not.toHaveBeenCalled();
  });
});
