import { toast } from "sonner";
import { getApiErrorMessage, isCanceledError } from "@/lib/client/api";

/** Show a destructive toast for API / unexpected errors (skips canceled requests). */
export function toastError(error: unknown, fallback = "Something went wrong") {
  if (isCanceledError(error)) return;
  toast.error(getApiErrorMessage(error, fallback));
}

/** Show a success toast. */
export function toastSuccess(message: string) {
  toast.success(message);
}

/** Show an informational toast. */
export function toastInfo(message: string) {
  toast.info(message);
}
