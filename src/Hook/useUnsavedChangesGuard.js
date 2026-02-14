// useUnsavedChangesGuard.js
import { useEffect, useContext } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";

export default function useUnsavedChangesGuard(isDirty) {
  // --- Browser refresh / close ---
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = ""; // Required for Chrome
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  // --- React Router navigation block ---
  const { navigator } = useContext(UNSAFE_NavigationContext);

  useEffect(() => {
    if (!isDirty) return;

    const push = navigator.push;
    navigator.push = (...args) => {
      const confirmLeave = window.confirm(
        "⚠️ You have unsaved changes. If you leave, they will be lost. Continue?"
      );
      if (confirmLeave) {
        navigator.push = push; // restore default
        push(...args);
      }
    };

    return () => {
      navigator.push = push; // restore on cleanup
    };
  }, [navigator, isDirty]);
}
