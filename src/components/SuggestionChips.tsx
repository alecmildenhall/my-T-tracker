// src/components/SuggestionChips.tsx
import React from "react";
import { normalizeValue } from "../utils/suggestions";

interface SuggestionChipsProps {
  /** Human-readable field name, used for the group's accessible label. */
  label: string;
  suggestions: string[];
  /** Current field value, so the matching chip can be marked as selected. */
  value: string;
  onSelect: (value: string) => void;
}

/**
 * Tap-to-reuse chips of values entered on past shots. Renders nothing until
 * there is history to suggest. Chips are real buttons for keyboard and screen
 * reader access; the one matching the current field value is marked as the
 * current selection (aria-current, not aria-pressed — tapping fills the field,
 * it isn't a toggle).
 */
export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
  label,
  suggestions,
  value,
  onSelect,
}) => {
  if (suggestions.length === 0) return null;

  const current = normalizeValue(value);

  return (
    <div className="suggestion-chips" role="group" aria-label={`Recent ${label} values`}>
      {suggestions.map((suggestion) => {
        const active = normalizeValue(suggestion) === current;
        return (
          <button
            key={suggestion}
            type="button"
            className={`chip${active ? " chip--active" : ""}`}
            aria-current={active || undefined}
            onClick={() => onSelect(suggestion)}
          >
            {suggestion}
          </button>
        );
      })}
    </div>
  );
};
