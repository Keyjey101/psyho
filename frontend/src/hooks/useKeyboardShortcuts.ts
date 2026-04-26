import { useEffect } from "react";

interface KeyboardShortcutsOptions {
  onNewChat: () => void;
  onCloseOverlay: () => void;
  onToggleActions: () => void;
}

export function useKeyboardShortcuts({
  onNewChat,
  onCloseOverlay,
  onToggleActions,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === "k") {
        e.preventDefault();
        onNewChat();
        return;
      }

      if (e.key === "Escape") {
        onCloseOverlay();
        return;
      }

      if (mod && e.key === "/") {
        e.preventDefault();
        onToggleActions();
        return;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onNewChat, onCloseOverlay, onToggleActions]);
}
