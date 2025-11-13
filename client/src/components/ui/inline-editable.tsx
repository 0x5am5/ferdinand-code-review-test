import { Check, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
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
  /** Whether to show explicit save/cancel buttons */
  showControls?: boolean;
  /** Optional validation function that returns error message or null */
  validate?: (value: string) => string | null;
  /** Callback when validation fails */
  onValidationError?: (error: string) => void;
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
      showControls = false,
      validate,
      onValidationError,
    },
    ref
  ) => {
    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(value);
    const [validationError, setValidationError] = React.useState<string | null>(
      null
    );
    const [originalValue, setOriginalValue] = React.useState(value);
    const inputRef = React.useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    const debounceTimerRef = React.useRef<NodeJS.Timeout | null>(null);
    const errorId = React.useId();

    // Update edit value when prop value changes
    React.useEffect(() => {
      setEditValue(value);
      setOriginalValue(value);
    }, [value]);

    // Focus input when entering edit mode
    React.useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        // Select all text for easy editing
        inputRef.current.select();
        // Store original value when entering edit mode
        setOriginalValue(value);
        // Clear validation errors when entering edit mode
        setValidationError(null);
      }
    }, [isEditing, value]);

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

      // Run validation if provided
      if (validate) {
        const error = validate(trimmedValue);
        if (error) {
          setValidationError(error);
          if (onValidationError) {
            onValidationError(error);
          }
          return; // Don't save if validation fails
        }
      }

      // Clear any validation errors
      setValidationError(null);

      // Only save if value changed
      if (trimmedValue !== value) {
        onSave(trimmedValue);
      }
      setIsEditing(false);
    }, [editValue, value, onSave, validate, onValidationError]);

    const handleCancel = React.useCallback(() => {
      // Revert to original value
      setEditValue(originalValue);
      setValidationError(null);
      setIsEditing(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }, [originalValue]);

    const handleChange = React.useCallback(
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setEditValue(newValue);

        // Clear validation error when user starts typing
        if (validationError) {
          setValidationError(null);
        }

        // Handle debounced autosave (only if controls are not shown)
        if (debounceMs > 0 && !showControls) {
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }
          debounceTimerRef.current = setTimeout(() => {
            const trimmedValue = newValue.trim();
            if (trimmedValue !== value && trimmedValue.length > 0) {
              // Run validation before auto-saving
              if (validate) {
                const error = validate(trimmedValue);
                if (error) {
                  setValidationError(error);
                  if (onValidationError) {
                    onValidationError(error);
                  }
                  return;
                }
              }
              onSave(trimmedValue);
            }
          }, debounceMs);
        }
      },
      [
        debounceMs,
        value,
        onSave,
        showControls,
        validate,
        onValidationError,
        validationError,
      ]
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

    const handleBlur = React.useCallback(
      (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        // If showControls is true, don't auto-save on blur
        // User must explicitly click save or cancel
        if (showControls) {
          // Check if the blur is because user clicked save/cancel button
          const relatedTarget = e.relatedTarget as HTMLElement;
          if (relatedTarget?.closest("[data-inline-editable-controls]")) {
            // User clicked on a control button, don't do anything
            // The button click handler will handle save/cancel
            return;
          }
          // If blur is to something else, treat as cancel
          handleCancel();
          return;
        }

        // Original behavior: auto-save on blur
        // Clear any pending debounce timer
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        // Save on blur
        handleSave();
      },
      [handleSave, handleCancel, showControls]
    );

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
        className: cn(
          editClassName,
          validationError && "border-destructive focus-visible:ring-destructive"
        ),
        "aria-label": ariaLabel || "Editable text field",
        "aria-invalid": !!validationError,
        "aria-describedby": validationError ? errorId : undefined,
      };

      return (
        <div ref={ref} className={cn("w-full space-y-2", className)}>
          <div className="flex items-start gap-2">
            <div className="flex-1">
              {inputType === "textarea" ? (
                <Textarea {...commonProps} />
              ) : (
                <Input {...commonProps} />
              )}
              {validationError && (
                <p
                  id={errorId}
                  className="text-sm text-destructive mt-1"
                  role="alert"
                >
                  {validationError}
                </p>
              )}
            </div>
            {showControls && (
              <div
                className="flex items-center gap-1 shrink-0"
                data-inline-editable-controls
              >
                <Button
                  type="button"
                  size="icon"
                  variant="default"
                  className="h-8 w-8"
                  onClick={handleSave}
                  aria-label="Save changes"
                  title="Save changes"
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={handleCancel}
                  aria-label="Cancel changes"
                  title="Cancel changes"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
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
