import Modal from "./ui/Modal";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { assetUrl } from "../services/api";

export default function ReceiptLightbox({ imageUrl, title, onClose }) {
  const src = imageUrl ? assetUrl(imageUrl) : "";
  return (
    <Modal
      open={!!imageUrl}
      onClose={onClose}
      wide
      label={title ? `Receipt: ${title}` : "Receipt"}
      actions={
        <>
          {src && (
            <Button as="a" href={src} target="_blank" rel="noopener noreferrer" variant="ghost">
              <Icon name="eye" size={16} /> Open full size
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Close
          </Button>
        </>
      }
    >
      {src && <img className="lightbox__img" src={src} alt={title ? `Receipt for ${title}` : "Receipt"} />}
    </Modal>
  );
}
