import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import ReceiptDropzone from "./ReceiptDropzone";

beforeAll(() => {
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});

const file = new File(["x"], "new.png", { type: "image/png" });

describe("ReceiptDropzone", () => {
  it("with a replacement selected, 'Keep current receipt' only discards the new file", async () => {
    const onChange = vi.fn();
    const onRemoveExisting = vi.fn();
    render(<ReceiptDropzone file={file} existingUrl="uploads/old.png" onChange={onChange} onRemoveExisting={onRemoveExisting} />);
    expect(screen.getByText(/will replace the receipt that is currently saved/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /keep current receipt/i }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onRemoveExisting).not.toHaveBeenCalled();
  });

  it("with a replacement selected, 'Remove receipt' discards the file and deletes the saved receipt", async () => {
    const onChange = vi.fn();
    const onRemoveExisting = vi.fn();
    render(<ReceiptDropzone file={file} existingUrl="uploads/old.png" onChange={onChange} onRemoveExisting={onRemoveExisting} />);
    await userEvent.click(screen.getByRole("button", { name: /remove receipt/i }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onRemoveExisting).toHaveBeenCalledTimes(1);
  });

  it("without a replacement, Remove deletes the saved receipt", async () => {
    const onChange = vi.fn();
    const onRemoveExisting = vi.fn();
    render(<ReceiptDropzone file={null} existingUrl="uploads/old.png" onChange={onChange} onRemoveExisting={onRemoveExisting} />);
    expect(screen.queryByRole("button", { name: /keep current receipt/i })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /remove receipt/i }));
    expect(onRemoveExisting).toHaveBeenCalledTimes(1);
  });

  it("a new file with no saved receipt just clears the selection", async () => {
    const onChange = vi.fn();
    const onRemoveExisting = vi.fn();
    render(<ReceiptDropzone file={file} existingUrl={null} onChange={onChange} onRemoveExisting={onRemoveExisting} />);
    await userEvent.click(screen.getByRole("button", { name: /remove receipt/i }));
    expect(onChange).toHaveBeenCalledWith(null);
    expect(onRemoveExisting).not.toHaveBeenCalled();
  });
});
