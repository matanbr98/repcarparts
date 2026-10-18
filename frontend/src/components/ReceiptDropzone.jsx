import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./ui/Icon";
import Button from "./ui/Button";
import { assetUrl } from "../services/api";

/**
 * Drag-and-drop image picker with preview.
 * props: file (File|null), existingUrl (string|null: the saved receipt, if it is still kept),
 * onChange(file|null), onRemoveExisting(), error
 *
 * With a replacement selected there are two distinct, explicitly labelled actions:
 *   "Keep current receipt" - discard the new file and go back to the saved one
 *   "Remove receipt"       - discard the new file AND delete the saved receipt
 */
export default function ReceiptDropzone({ file, existingUrl, onChange, onRemoveExisting, error, label = "Receipt photo" }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const shown = preview || (existingUrl ? assetUrl(existingUrl) : "");

  function pick(f) {
    if (f) onChange(f);
  }

  return (
    <div className="field">
      <span className="field__label">
        {label} <span className="opt">(optional)</span>
      </span>
      {shown ? (
        <div className="dropzone dropzone--filled">
          <img src={shown} alt="Receipt preview" className="dropzone__preview" />
          <div className="cluster">
            <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
              <Icon name="upload" size={14} /> {file ? "Choose another" : "Replace"}
            </Button>
            {file && existingUrl && (
              <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
                Keep current receipt
              </Button>
            )}
            <Button
              size="sm"
              variant="danger-ghost"
              onClick={() => {
                if (file) onChange(null);
                if (!file || existingUrl) onRemoveExisting?.();
              }}
            >
              <Icon name="trash" size={14} /> Remove receipt
            </Button>
          </div>
          {file && existingUrl && (
            <p className="muted small">This photo will replace the receipt that is currently saved.</p>
          )}
        </div>
      ) : (
        <div
          className={`dropzone${dragging ? " dropzone--drag" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            pick(e.dataTransfer.files?.[0]);
          }}
        >
          <Icon name="image" size={28} />
          <p>Drag a photo here, or</p>
          <Button size="sm" variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          <p className="muted small">JPG, PNG or WebP, up to 5 MB</p>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        aria-label={`${label} file`}
        data-testid="receipt-input"
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <span className="field__error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
