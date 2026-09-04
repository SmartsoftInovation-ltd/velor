/**
 * Helpers for surfacing the server's own error message to the user.
 *
 * The backend answers every failure through `apiResponse` / `globalErrorHandeler`,
 * so the useful text always lives at `response.data.message`. These helpers pull
 * that out and only fall back to a generic string when the request never reached
 * the server (network failure) or the response carried no message.
 */
import toast from "react-hot-toast";

/** Extract the server-provided message from an unknown thrown value. */
export const getApiErrorMessage = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  const err = error as any;
  const data = err?.response?.data;

  if (data) {
    if (typeof data === "string" && data.trim()) return data;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
    // Some validators answer with a list of field errors instead of one message.
    if (Array.isArray(data.errors) && data.errors.length) {
      const joined = data.errors
        .map((e: any) => (typeof e === "string" ? e : e?.message))
        .filter(Boolean)
        .join(", ");
      if (joined) return joined;
    }
  }

  // Request never got a response (offline, CORS, server down).
  if (err?.request && !err?.response) {
    return "Cannot reach the server. Check your connection and try again.";
  }

  if (typeof err?.message === "string" && err.message.trim()) return err.message;

  return fallback;
};

/** Show the server-provided error message as a toast. */
export const showApiError = (
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string => {
  const message = getApiErrorMessage(error, fallback);
  toast.error(message);
  return message;
};
