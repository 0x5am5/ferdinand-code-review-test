import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEditable } from "../inline-editable";

describe("InlineEditable", () => {
  const mockOnSave = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    // Run all pending timers to ensure cleanup
    jest.runOnlyPendingTimers();
    // Clear all timers
    jest.clearAllTimers();
    // Restore real timers
    jest.useRealTimers();
  });

  describe("Initial Rendering", () => {
    it("should render in view mode by default", () => {
      render(<InlineEditable value="Test value" onSave={mockOnSave} />);

      expect(screen.getByText("Test value")).toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("should display placeholder when value is empty and showPlaceholderInView is true", () => {
      render(
        <InlineEditable
          value=""
          onSave={mockOnSave}
          placeholder="Click to edit..."
          showPlaceholderInView={true}
        />
      );

      expect(screen.getByText("Click to edit...")).toBeInTheDocument();
    });

    it("should not display placeholder when value is empty and showPlaceholderInView is false", () => {
      render(
        <InlineEditable
          value=""
          onSave={mockOnSave}
          placeholder="Click to edit..."
          showPlaceholderInView={false}
        />
      );

      expect(screen.queryByText("Click to edit...")).not.toBeInTheDocument();
    });

    it("should render with custom className", () => {
      const { container } = render(
        <InlineEditable
          value="Test"
          onSave={mockOnSave}
          className="custom-class"
        />
      );

      const element = container.querySelector(".custom-class");
      expect(element).toBeInTheDocument();
    });

    it("should render with custom viewClassName", () => {
      const { container } = render(
        <InlineEditable
          value="Test"
          onSave={mockOnSave}
          viewClassName="custom-view-class"
        />
      );

      const element = container.querySelector(".custom-view-class");
      expect(element).toBeInTheDocument();
    });
  });

  describe("View Mode Interactions", () => {
    it("should switch to edit mode when clicked", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Test value" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test value");
      await user.click(viewElement);

      // Should now show input with the value
      await waitFor(() => {
        const input = screen.getByDisplayValue("Test value");
        expect(input).toBeInTheDocument();
      });
    });

    it("should switch to edit mode when Enter key is pressed", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Test value" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test value");
      viewElement.focus();
      await user.keyboard("{Enter}");

      // Should now show input
      await waitFor(() => {
        const input = screen.getByDisplayValue("Test value");
        expect(input).toBeInTheDocument();
      });
    });

    it("should switch to edit mode when Space key is pressed", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Test value" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test value");
      viewElement.focus();
      await user.keyboard(" ");

      // Should now show input
      await waitFor(() => {
        const input = screen.getByDisplayValue("Test value");
        expect(input).toBeInTheDocument();
      });
    });

    it("should not switch to edit mode when disabled", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Test value"
          onSave={mockOnSave}
          disabled={true}
        />
      );

      const viewElement = screen.getByText("Test value");
      await user.click(viewElement);

      // Should still be in view mode
      expect(screen.queryByDisplayValue("Test value")).not.toBeInTheDocument();
    });

    it("should have tabIndex of -1 when disabled", () => {
      render(
        <InlineEditable
          value="Test value"
          onSave={mockOnSave}
          disabled={true}
        />
      );

      const viewElement = screen.getByText("Test value");
      expect(viewElement).toHaveAttribute("tabIndex", "-1");
    });

    it("should have tabIndex of 0 when not disabled", () => {
      render(<InlineEditable value="Test value" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test value");
      expect(viewElement).toHaveAttribute("tabIndex", "0");
    });
  });

  describe("Edit Mode - Input Type", () => {
    it("should render input element when inputType is 'input'", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Test value"
          onSave={mockOnSave}
          inputType="input"
        />
      );

      const viewElement = screen.getByText("Test value");
      await user.click(viewElement);

      await waitFor(() => {
        const input = screen.getByDisplayValue("Test value");
        expect(input.tagName).toBe("INPUT");
      });
    });

    it("should render textarea element when inputType is 'textarea'", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Test value"
          onSave={mockOnSave}
          inputType="textarea"
        />
      );

      const viewElement = screen.getByText("Test value");
      await user.click(viewElement);

      await waitFor(() => {
        const textarea = screen.getByDisplayValue("Test value");
        expect(textarea.tagName).toBe("TEXTAREA");
      });
    });

    it("should focus and select text when entering edit mode", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Test value" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test value");
      await user.click(viewElement);

      await waitFor(() => {
        const input = screen.getByDisplayValue(
          "Test value"
        ) as HTMLInputElement;
        expect(input).toHaveFocus();
        // Text should be selected (selectionStart should be 0, selectionEnd should be length)
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("Test value".length);
      });
    });

    it("should render with custom editClassName", async () => {
      const user = userEvent.setup({ delay: null });
      const { container } = render(
        <InlineEditable
          value="Test"
          onSave={mockOnSave}
          editClassName="custom-edit-class"
        />
      );

      const viewElement = screen.getByText("Test");
      await user.click(viewElement);

      await waitFor(() => {
        const element = container.querySelector(".custom-edit-class");
        expect(element).toBeInTheDocument();
      });
    });
  });

  describe("Value Changes", () => {
    it("should update input value when typing", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Test" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Test");
        await user.clear(input);
        await user.type(input, "New value");
        expect(input).toHaveValue("New value");
      });
    });

    it("should update editValue when prop value changes", () => {
      const { rerender } = render(
        <InlineEditable value="Initial" onSave={mockOnSave} />
      );

      expect(screen.getByText("Initial")).toBeInTheDocument();

      rerender(<InlineEditable value="Updated" onSave={mockOnSave} />);

      expect(screen.getByText("Updated")).toBeInTheDocument();
    });

    it("should show placeholder in edit mode when value is empty", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value=""
          onSave={mockOnSave}
          placeholder="Enter text..."
        />
      );

      const viewElement = screen.getByRole("button");
      await user.click(viewElement);

      await waitFor(() => {
        const input = screen.getByPlaceholderText("Enter text...");
        expect(input).toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Interactions - Input Type", () => {
    it("should save on Enter key for input type", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Original"
          onSave={mockOnSave}
          inputType="input"
        />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "Modified");
        await user.keyboard("{Enter}");

        expect(mockOnSave).toHaveBeenCalledWith("Modified");
      });
    });

    it("should cancel on Escape key", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Original" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "Modified");
        await user.keyboard("{Escape}");

        expect(mockOnSave).not.toHaveBeenCalled();
        // Should return to view mode with original value
        expect(screen.getByText("Original")).toBeInTheDocument();
      });
    });

    it("should trim whitespace before saving", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Original" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "  Modified  ");
        await user.keyboard("{Enter}");

        expect(mockOnSave).toHaveBeenCalledWith("Modified");
      });
    });

    it("should not call onSave when value is unchanged", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Original" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        screen.getByDisplayValue("Original");
        await user.keyboard("{Enter}");

        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("should exit edit mode after saving", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Original" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "Modified");
        await user.keyboard("{Enter}");

        // Should be back in view mode
        expect(screen.queryByDisplayValue("Modified")).not.toBeInTheDocument();
      });
    });
  });

  describe("Keyboard Interactions - Textarea Type", () => {
    it("should not save on Enter key alone for textarea", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Original"
          onSave={mockOnSave}
          inputType="textarea"
        />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      const textarea = await screen.findByDisplayValue("Original");
      await user.clear(textarea);
      await user.type(textarea, "Modified");
      await user.keyboard("{Enter}");

      // Should not save, still in edit mode
      expect(mockOnSave).not.toHaveBeenCalled();
      // After pressing Enter in textarea, a newline is added
      const updatedTextarea = screen.getByRole(
        "textbox"
      ) as HTMLTextAreaElement;
      expect(updatedTextarea.value).toContain("Modified");
    });

    it("should save on Ctrl+Enter for textarea", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Original"
          onSave={mockOnSave}
          inputType="textarea"
        />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");
        await user.keyboard("{Control>}{Enter}{/Control}");

        expect(mockOnSave).toHaveBeenCalledWith("Modified");
      });
    });

    it("should cancel on Escape key for textarea", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Original"
          onSave={mockOnSave}
          inputType="textarea"
        />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const textarea = screen.getByDisplayValue("Original");
        await user.clear(textarea);
        await user.type(textarea, "Modified");
        await user.keyboard("{Escape}");

        expect(mockOnSave).not.toHaveBeenCalled();
        expect(screen.getByText("Original")).toBeInTheDocument();
      });
    });
  });

  describe("Blur Behavior", () => {
    it("should save on blur", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <div>
          <InlineEditable value="Original" onSave={mockOnSave} />
          <button type="button">Other element</button>
        </div>
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "Modified");

        // Click outside to trigger blur
        const otherButton = screen.getByText("Other element");
        await user.click(otherButton);

        expect(mockOnSave).toHaveBeenCalledWith("Modified");
      });
    });

    it("should not save on blur if value is unchanged", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <div>
          <InlineEditable value="Original" onSave={mockOnSave} />
          <button type="button">Other element</button>
        </div>
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        screen.getByDisplayValue("Original");

        // Click outside to trigger blur without changing value
        const otherButton = screen.getByText("Other element");
        await user.click(otherButton);

        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });
  });

  describe("Debounced Autosave", () => {
    it("should not trigger autosave when debounceMs is 0", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable value="Original" onSave={mockOnSave} debounceMs={0} />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      const input = await screen.findByDisplayValue("Original");
      await user.type(input, " Modified");

      // Advance timers
      jest.advanceTimersByTime(1000);

      // Should not have called onSave automatically
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("should trigger autosave after debounce delay", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable value="Original" onSave={mockOnSave} debounceMs={500} />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "Modified");

        // Should not call immediately
        expect(mockOnSave).not.toHaveBeenCalled();

        // Advance timers by debounce delay
        jest.advanceTimersByTime(500);

        await waitFor(() => {
          expect(mockOnSave).toHaveBeenCalledWith("Modified");
        });
      });
    });

    it("should reset debounce timer on each keystroke", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="" onSave={mockOnSave} debounceMs={500} />);

      const viewElement = screen.getByRole("button");
      await user.click(viewElement);

      const input = await screen.findByRole("textbox");

      await user.type(input, "T");
      jest.advanceTimersByTime(300);

      await user.type(input, "e");
      jest.advanceTimersByTime(300);

      await user.type(input, "s");
      jest.advanceTimersByTime(300);

      await user.type(input, "t");

      // Should not have called yet
      expect(mockOnSave).not.toHaveBeenCalled();

      // Now advance the full debounce time
      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith("Test");
      });
    });

    it("should not autosave empty values", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable value="Original" onSave={mockOnSave} debounceMs={500} />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);

        jest.advanceTimersByTime(500);

        // Should not save empty value
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("should cancel pending autosave on Escape", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable value="Original" onSave={mockOnSave} debounceMs={500} />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.type(input, " Modified");

        // Advance timers partway through debounce
        jest.advanceTimersByTime(300);

        // Cancel with Escape
        await user.keyboard("{Escape}");

        // Advance the rest of the time
        jest.advanceTimersByTime(200);

        // Should not have called onSave
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("should clear pending autosave on blur", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <div>
          <InlineEditable
            value="Original"
            onSave={mockOnSave}
            debounceMs={500}
          />
          <button type="button">Other element</button>
        </div>
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.clear(input);
        await user.type(input, "Modified");

        // Advance timers partway through debounce
        jest.advanceTimersByTime(300);

        // Blur should trigger immediate save and clear debounce
        const otherButton = screen.getByText("Other element");
        await user.click(otherButton);

        // Should have called onSave once from blur
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith("Modified");

        // Advance remaining time - should not trigger another call
        jest.advanceTimersByTime(200);

        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("Accessibility", () => {
    it("should have role='button' in view mode", () => {
      render(<InlineEditable value="Test" onSave={mockOnSave} />);

      const element = screen.getByRole("button");
      expect(element).toBeInTheDocument();
    });

    it("should have default aria-label in view mode", () => {
      render(<InlineEditable value="Test" onSave={mockOnSave} />);

      const element = screen.getByLabelText("Click to edit");
      expect(element).toBeInTheDocument();
    });

    it("should use custom ariaLabel in view mode", () => {
      render(
        <InlineEditable
          value="Test"
          onSave={mockOnSave}
          ariaLabel="Edit task name"
        />
      );

      const element = screen.getByLabelText("Edit task name");
      expect(element).toBeInTheDocument();
    });

    it("should have aria-disabled when disabled", () => {
      render(
        <InlineEditable value="Test" onSave={mockOnSave} disabled={true} />
      );

      const element = screen.getByRole("button");
      expect(element).toHaveAttribute("aria-disabled", "true");
    });

    it("should have default aria-label in edit mode", async () => {
      const user = userEvent.setup({ delay: null });
      render(<InlineEditable value="Test" onSave={mockOnSave} />);

      const viewElement = screen.getByText("Test");
      await user.click(viewElement);

      await waitFor(() => {
        const input = screen.getByLabelText("Editable text field");
        expect(input).toBeInTheDocument();
      });
    });

    it("should use custom ariaLabel in edit mode", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable
          value="Test"
          onSave={mockOnSave}
          ariaLabel="Edit task name"
        />
      );

      const viewElement = screen.getByText("Test");
      await user.click(viewElement);

      await waitFor(() => {
        const input = screen.getByLabelText("Edit task name");
        expect(input).toBeInTheDocument();
      });
    });

    it("should be keyboard navigable", async () => {
      render(<InlineEditable value="Test" onSave={mockOnSave} />);

      const element = screen.getByRole("button");

      // Should be focusable
      element.focus();
      expect(element).toHaveFocus();
    });
  });

  describe("Disabled State", () => {
    it("should apply disabled styles", () => {
      const { container } = render(
        <InlineEditable value="Test" onSave={mockOnSave} disabled={true} />
      );

      // Check for opacity-50 class which is applied when disabled
      const element = container.querySelector(".opacity-50");
      expect(element).toBeInTheDocument();
    });

    it("should apply cursor-not-allowed when disabled", () => {
      const { container } = render(
        <InlineEditable value="Test" onSave={mockOnSave} disabled={true} />
      );

      const element = container.querySelector(".cursor-not-allowed");
      expect(element).toBeInTheDocument();
    });

    it("should not respond to keyboard events when disabled", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable value="Test" onSave={mockOnSave} disabled={true} />
      );

      const element = screen.getByText("Test");
      element.focus();
      await user.keyboard("{Enter}");

      // Should still be in view mode
      expect(screen.queryByDisplayValue("Test")).not.toBeInTheDocument();
    });
  });

  describe("Empty State Styling", () => {
    it("should apply muted text color when empty", () => {
      const { container } = render(
        <InlineEditable
          value=""
          onSave={mockOnSave}
          showPlaceholderInView={true}
        />
      );

      const element = container.querySelector(".text-muted-foreground");
      expect(element).toBeInTheDocument();
    });

    it("should not apply muted text color when value exists", () => {
      render(<InlineEditable value="Test" onSave={mockOnSave} />);

      const viewButton = screen.getByText("Test");
      expect(viewButton).not.toHaveClass("text-muted-foreground");
    });
  });

  describe("Cleanup", () => {
    it("should cleanup debounce timer on unmount", async () => {
      const user = userEvent.setup({ delay: null });
      const { unmount } = render(
        <InlineEditable value="Original" onSave={mockOnSave} debounceMs={500} />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      await waitFor(async () => {
        const input = screen.getByDisplayValue("Original");
        await user.type(input, " Modified");

        // Unmount before debounce completes
        unmount();

        // Advance timers
        jest.advanceTimersByTime(500);

        // Should not have called onSave after unmount
        expect(mockOnSave).not.toHaveBeenCalled();
      });
    });

    it("should not leak memory with multiple rapid edits", async () => {
      const user = userEvent.setup({ delay: null });
      render(
        <InlineEditable value="Original" onSave={mockOnSave} debounceMs={500} />
      );

      const viewElement = screen.getByText("Original");
      await user.click(viewElement);

      const input = await screen.findByDisplayValue("Original");

      // Type multiple times rapidly
      for (let i = 0; i < 10; i++) {
        await user.type(input, "x");
        jest.advanceTimersByTime(100);
      }

      // Complete the debounce
      jest.advanceTimersByTime(500);

      await waitFor(() => {
        // Should only call once with final value
        expect(mockOnSave).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe("ForwardRef", () => {
    it("should forward ref to the container div", () => {
      const ref = { current: null };
      render(<InlineEditable value="Test" onSave={mockOnSave} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });

    it("should maintain ref when switching modes", async () => {
      const user = userEvent.setup({ delay: null });
      const ref = { current: null };
      render(<InlineEditable value="Test" onSave={mockOnSave} ref={ref} />);

      const initialRef = ref.current;

      const viewElement = screen.getByText("Test");
      await user.click(viewElement);

      await waitFor(() => {
        screen.getByDisplayValue("Test");
        // Ref should remain the same
        expect(ref.current).toBe(initialRef);
      });
    });
  });
});
