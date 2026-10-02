/** Safe, corrective copy created by application code, never raw server messages. */
export class ActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ActionError";
  }
}

export function actionErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ActionError ? error.message : fallback;
}

export function databaseActionError(error: { code?: string }, fallback: string): ActionError {
  if (["42703", "42P01", "PGRST204", "PGRST205", "PGRST202"].includes(error.code ?? "")) {
    return new ActionError("This update is temporarily unavailable. Please contact support if it continues.");
  }
  if (["42501", "PGRST301", "PGRST302", "PGRST303"].includes(error.code ?? "")) {
    return new ActionError("Your account could not save this update. Sign in again and retry.");
  }
  return new ActionError(fallback);
}
