const protectedNameFields = ["firstName", "middleName", "lastName", "fullName"] as const;

export function assertEditableProfileFields(fields: Record<string, unknown>): void {
  if (protectedNameFields.some((field) => Object.prototype.hasOwnProperty.call(fields, field))) {
    throw new Error("Name changes require a separate identity review. Contact support for corrections.");
  }
}
