import { useCallback, useEffect } from "react";

const DISCARD_MESSAGE =
  "まだ保存していない入力があります。このページを離れますか？";

export function useUnsavedChanges(isDirty: boolean) {
  const confirmDiscard = useCallback(
    () => !isDirty || window.confirm(DISCARD_MESSAGE),
    [isDirty],
  );

  useEffect(() => {
    if (!isDirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const handleLinkClick = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const element =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (!element || element.target === "_blank" || element.hasAttribute("download")) {
        return;
      }

      const destination = new URL(element.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin !== current.origin ||
        (destination.pathname === current.pathname &&
          destination.search === current.search &&
          destination.hash === current.hash)
      ) {
        return;
      }

      if (!window.confirm(DISCARD_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleLinkClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleLinkClick, true);
    };
  }, [isDirty]);

  return confirmDiscard;
}
