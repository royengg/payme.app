const ERROR_TRANSLATIONS: Record<string, string> = {
  "INR_FOREIGN_CURRENCY_BLOCKED": "PayPal India doesn't allow sending invoices to other Indian accounts. Share the payment link manually instead.",
  "RECIPIENT_UNCONFIRMED_EMAIL": "The client's email isn't verified on PayPal. They need to verify their PayPal email first.",
  "INVOICE_NOT_FOUND": "This invoice no longer exists on PayPal.",
  "INVOICE_ALREADY_CANCELLED": "This invoice has already been cancelled.",
  "INVOICE_ALREADY_PAID": "This invoice has already been paid.",
  "INVOICE_NOT_ELIGIBLE_FOR_REMINDER": "This invoice can't receive reminders - it may be too new or already reminded recently.",
  "PERMISSION_DENIED": "PayPal API permission denied. Please re-authenticate your PayPal account.",
  "RATE_LIMIT_EXCEEDED": "Too many requests to PayPal. Please wait a moment and try again.",
  "INTERNAL_SERVICE_ERROR": "PayPal is experiencing issues. Please try again later.",
  "VALIDATION_ERROR": "Invalid invoice data. Please check the amount and email address.",
  "CURRENCY_NOT_SUPPORTED": "This currency isn't supported for your PayPal account region.",
  "AMOUNT_EXCEEDS_MAXIMUM": "The invoice amount exceeds PayPal's maximum limit.",
  "DUPLICATE_INVOICE_NUMBER": "An invoice with this number already exists.",
};

export function translatePayPalError(error: string | Error | any): string {
  const errorMessage = typeof error === "string" 
    ? error 
    : error?.message || error?.toString() || "Unknown error";

  for (const [key, translation] of Object.entries(ERROR_TRANSLATIONS)) {
    if (errorMessage.includes(key)) {
      return translation;
    }
  }

  if (errorMessage.includes("ENOTFOUND") || errorMessage.includes("ETIMEDOUT")) {
    return "Couldn't connect to PayPal. Please try again.";
  }

  if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
    return "PayPal authentication failed. The bot owner needs to check API credentials.";
  }

  if (errorMessage.includes("403") || errorMessage.includes("Forbidden")) {
    return "PayPal denied this request. Your account may not have permission for this action.";
  }

  if (errorMessage.includes("500") || errorMessage.includes("503")) {
    return "PayPal is experiencing issues. Please try again later.";
  }

  return `PayPal error: ${errorMessage.substring(0, 100)}`;
}
