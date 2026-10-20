import { theme } from "../../theme";

// React Native Web removes the browser outline on Pressable. Restore it only
// for keyboard focus, including the existing custom controls in other screens.
export function FocusStyles() {
  return (
    <style>{`
    :is([role="button"], [role="tab"], [role="checkbox"], input, textarea, select, a):focus-visible {
      outline: 2px solid ${theme.accent};
      outline-offset: 2px;
    }
    #study-navigation :is([role="button"], [role="tab"]):focus-visible {
      outline-color: ${theme.amber};
      outline-offset: -3px;
    }
  `}</style>
  );
}
