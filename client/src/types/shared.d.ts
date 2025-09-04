// Common types used across components
export type ErrorResponse = {
  message: string;
  code?: number;
  details?: Record<string, unknown>;
};

export type ApiResponse<T> = {
  data: T;
  error?: ErrorResponse;
};

export type MutationConfig<T = unknown> = {
  onSuccess?: (data: T) => void;
  onError?: (error: ErrorResponse) => void;
};

// Add more shared types as needed
