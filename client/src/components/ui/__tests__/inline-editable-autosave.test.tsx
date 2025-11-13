import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEditable } from "../inline-editable";

describe("InlineEditable - Autosave Functionality", () => {
  let mockOnSave: jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers();
    mockOnSave = jest.fn();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe("Debounce Behavior", () => {
    it("should not save immediately while typing", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial value"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      // Click to enter edit mode
      const viewElement = screen.getByText("Initial value");
      await user.click(viewElement);

      // Get input and type
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New value");

      // Verify save not called immediately
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("should trigger save after debounce delay", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial value"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      // Enter edit mode
      const viewElement = screen.getByText("Initial value");
      await user.click(viewElement);

      // Type new value
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "New value");

      // Fast-forward time by 500ms
      jest.advanceTimersByTime(500);

      // Verify save was called with trimmed value
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith("New value");
      });
    });

    it("should only trigger one save for multiple rapid changes", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      // Enter edit mode
      await user.click(screen.getByText("Initial"));

      // Type multiple characters rapidly
      const input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "A");
      jest.advanceTimersByTime(100);

      await user.type(input, "B");
      jest.advanceTimersByTime(100);

      await user.type(input, "C");
      jest.advanceTimersByTime(100);

      await user.type(input, "D");
      jest.advanceTimersByTime(100);

      // At this point, 400ms have passed, no save yet
      expect(mockOnSave).not.toHaveBeenCalled();

      // Wait for final debounce
      jest.advanceTimersByTime(500);

      // Should only save once with final value
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith("ABCD");
      });
    });

    it("should cancel previous pending save when new changes occur", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      // First change
      await user.clear(input);
      await user.type(input, "First");
      jest.advanceTimersByTime(400);

      // Second change before first debounce completes
      await user.clear(input);
      await user.type(input, "Second");
      jest.advanceTimersByTime(400);

      // Third change before second debounce completes
      await user.clear(input);
      await user.type(input, "Third");

      // Complete the debounce
      jest.advanceTimersByTime(500);

      // Should only save the last value once
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith("Third");
      });
    });

    it("should not trigger autosave for empty values", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial value"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial value"));
      const input = screen.getByRole("textbox");

      // Clear to empty
      await user.clear(input);

      // Wait for debounce
      jest.advanceTimersByTime(500);

      // Should not save empty value
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("should not trigger autosave when value unchanged", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Same value"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Same value"));
      const input = screen.getByRole("textbox");

      // Type the same value
      await user.clear(input);
      await user.type(input, "Same value");

      // Wait for debounce
      jest.advanceTimersByTime(500);

      // Should not save when value is the same
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe("Blur Behavior", () => {
    it("should clear pending debounce on blur", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      // Type and blur before debounce completes
      await user.clear(input);
      await user.type(input, "New value");
      jest.advanceTimersByTime(300); // Only 300ms, debounce not complete

      // Blur the input
      fireEvent.blur(input);

      // Should save on blur, not wait for debounce
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledTimes(1);
        expect(mockOnSave).toHaveBeenCalledWith("New value");
      });

      // Advance remaining time - should not trigger another save
      jest.advanceTimersByTime(200);
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it("should save on blur even with debounce", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "Blur value");

      // Blur immediately
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("Blur value");
      });
    });
  });

  describe("Cancel Behavior", () => {
    it("should cancel pending save on Escape key", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      // Type and press Escape before debounce
      await user.clear(input);
      await user.type(input, "Canceled value");
      jest.advanceTimersByTime(300);

      // Press Escape
      fireEvent.keyDown(input, { key: "Escape" });

      // Should not save
      expect(mockOnSave).not.toHaveBeenCalled();

      // Advance remaining time - should still not save
      jest.advanceTimersByTime(500);
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it("should revert to original value on Escape", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Original"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Original"));
      const input = screen.getByRole("textbox") as HTMLInputElement;

      await user.clear(input);
      await user.type(input, "Changed");

      // Press Escape
      fireEvent.keyDown(input, { key: "Escape" });

      // Should exit edit mode and show original value
      await waitFor(() => {
        expect(screen.getByText("Original")).toBeInTheDocument();
      });

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe("Component Cleanup", () => {
    it("should clear debounce timer on unmount", async () => {
      const user = userEvent.setup({ delay: null });

      const { unmount } = render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "New value");

      // Unmount before debounce completes
      unmount();

      // Advance time - should not save after unmount
      jest.advanceTimersByTime(500);
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe("Textarea Mode", () => {
    it("should debounce autosave in textarea mode", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          inputType="textarea"
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const textarea = screen.getByRole("textbox");

      await user.clear(textarea);
      await user.type(textarea, "Multiline{Enter}text");

      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("Multiline\ntext");
      });
    });

    it("should save on blur in textarea mode", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          inputType="textarea"
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const textarea = screen.getByRole("textbox");

      await user.clear(textarea);
      await user.type(textarea, "New text");

      fireEvent.blur(textarea);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("New text");
      });
    });
  });

  describe("Edge Cases", () => {
    it("should handle whitespace trimming correctly", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "  Trimmed value  ");

      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("Trimmed value");
      });
    });

    it("should handle rapid edit mode toggling", async () => {
      const user = userEvent.setup({ delay: null });

      const { rerender } = render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      // Enter and exit edit mode quickly
      await user.click(screen.getByText("Initial"));
      let input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "First");
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("First");
      });

      // Rerender with new value to simulate prop update
      rerender(
        <InlineEditable
          value="First"
          onSave={mockOnSave}
          debounceMs={500}
          placeholder="Click to edit"
        />
      );

      // Enter edit mode again
      await user.click(screen.getByText("First"));
      input = screen.getByRole("textbox");
      await user.clear(input);
      await user.type(input, "Second");

      jest.advanceTimersByTime(500);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("Second");
      });
    });

    it("should handle disabled state", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={500}
          disabled={true}
          placeholder="Click to edit"
        />
      );

      const viewElement = screen.getByText("Initial");
      await user.click(viewElement);

      // Should not enter edit mode when disabled
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe("No Debounce Mode", () => {
    it("should not autosave when debounceMs is 0", async () => {
      const user = userEvent.setup({ delay: null });

      render(
        <InlineEditable
          value="Initial"
          onSave={mockOnSave}
          debounceMs={0}
          placeholder="Click to edit"
        />
      );

      await user.click(screen.getByText("Initial"));
      const input = screen.getByRole("textbox");

      await user.clear(input);
      await user.type(input, "New value");

      // Advance time significantly
      jest.advanceTimersByTime(1000);

      // Should not autosave
      expect(mockOnSave).not.toHaveBeenCalled();

      // But should save on blur
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("New value");
      });
    });
  });
});
