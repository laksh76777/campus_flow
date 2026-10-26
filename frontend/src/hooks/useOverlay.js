import { useEffect, useRef } from "react";

/**
 * Shared behaviour for drawers, dialogs and popovers:
 * closes on Escape and (optionally) locks page scroll while open.
 */
export default function useOverlay(isOpen, onClose, { lockScroll = true } = {}) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
    };
    document.addEventListener("keydown", handleKeyDown);

    let previousOverflow;
    if (lockScroll) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (lockScroll) document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, lockScroll]);
}
