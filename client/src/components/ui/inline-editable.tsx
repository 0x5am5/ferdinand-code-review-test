import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface InlineEditableProps {
  /** The current value to display/edit */
  value: string;
  /** Callback when value is saved */
  onSave: (value: string) => void;
  /** Type of input field - input for single line, textarea for multi-line */
  inputType?: "input" | "textarea";
  /** Placeholder text when empty */
  placeholder?: string;
  /** Additional className for the container */
  className?: string;
  /** Additional className for the view mode */
  viewClassName?: string;
  /** Additional className for the edit mode */
  editClassName?: string;
  /** Debounce delay in milliseconds for autosave (0 to disable) */
  debounceMs?: number;
  /** Whether to show empty state as placeholder in view mode */
  showPlaceholderInView?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** ARIA label for accessibility */
  ariaLabel?: string;
}

/**
 * InlineEditable - A reusable inline editable component
 * Toggles between view and edit modes on click, with keyboard support
 *
 * Features:
 * - Click to edit
 * - Enter to save
 * - Escape to cancel
 * - Optional debounced autosave
 * - Supports both input and textarea
 * - Fully accessible with ARIA attributes
 */
export const InlineEditable = React.forwardRef<
  HTMLDivElement,
  InlineEditableProps
>(
  (
    {
      value,
      onSave,
      inputType = "input",
      placeholder = "Click to edit...",
      className,
      viewClassName,
      editClassName,
      debounceMs = 0,
      showPlaceholderInView = true,
      disabled = false,
      ariaLabel,
    },
    ref
  ) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(value);
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);

    // Update edit value when prop value changes
    React.useEffect(() => {
      setEditValue(value);
    }, [value]);

    // Focus input when entering edit mode
    React.useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        // Select all text for easy editing
        inputRef.current.select();
      }
    }, [isEditing]);

    // Cleanup debounce timer on unmount
    React.useEffect(() => {
      return () => {
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }
      };
    }, []);

    const handleSave = React.useCallback(() => {
      const trimmedValue = editValue.trim();
      if (trimmedValue !== value) {
        onSave(trimmedValue);
      }
      setIsEditing(false);
    }, [editValue, value, onSave]);

    const handleCancel = React.useCallback(() => {
      setEditValue(value);
      setIsEditing(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }, [value]);

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setEditValue(newValue);

        // Handle debounced autosave
        if (debounceMs > 0) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            const trimmedValue = newValue.trim();
            if (trimmedValue !== value && trimmedValue.length > 0) {
              onSave(trimmedValue);
            }
          }, debounceMs);
        }
      },
      [debounceMs, value, onSave]
    );

    const handleKeyDown = React.useCallback(
      (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        if (e.key === "Enter" && inputType === "input") {
          // For single-line input, Enter saves
          e.preventDefault();
          handleSave();
        } else if (e.key === "Enter" && e.ctrlKey && inputType === "textarea") {
          // For textarea, Ctrl+Enter saves
          e.preventDefault();
          handleSave();
        } else if (e.key === "Escape") {
          // Escape always cancels
          e.preventDefault();
          handleCancel();
        }
      },
      [inputType, handleSave, handleCancel]
    );

    const handleBlur = React.useCallback(() => {
      // Clear any pending debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      // Save on blur
      handleSave();
    }, [handleSave]);

    const handleViewClick = React.useCallback(() => {
      if (!disabled) {
        setIsEditing(true);
      }
    }, [disabled]);

    const displayValue = value || (showPlaceholderInView ? placeholder : "");
    const isEmpty = !value;

    if (isEditing) {
      const commonProps = {
        ref: inputRef as React.RefObject<
          HTMLInputElement & HTMLTextAreaElement
        >,
        value: editValue,
        onChange: handleChange,
        onKeyDown: handleKeyDown,
        onBlur: handleBlur,
        placeholder,
        className: cn(editClassName),
        "aria-label": ariaLabel || "Editable text field",
      };

      return (
        <div ref={ref} className={cn("w-full", className)}>
          {inputType === "textarea" ? (
            <Textarea {...commonProps} />
          ) : (
            <Input {...commonProps} />
          )}
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn(
          "w-full cursor-text rounded-md px-3 py-2 text-sm transition-colors",
          "hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          isEmpty && "text-muted-foreground",
          disabled && "cursor-not-allowed opacity-50",
          viewClassName,
          className
        )}
        onClick={handleViewClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleViewClick();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel || "Click to edit"}
        aria-disabled={disabled}
      >
        {displayValue}
      </div>
    );
  }
);

InlineEditable.displayName = "InlineEditable";
