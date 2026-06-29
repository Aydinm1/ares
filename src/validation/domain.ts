export class ValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join("; "));
    this.name = "ValidationError";
  }
}

export function validateAssignmentCompletionWrite(
  value: unknown
): "submitted" | "not_started" {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError(["Request body must be an object."]);
  }

  const payload = value as Record<string, unknown>;
  const issues: string[] = [];

  if (Object.keys(payload).some((key) => key !== "status")) {
    issues.push("Only status can be changed.");
  }
  if (payload.status !== "submitted" && payload.status !== "not_started") {
    issues.push("status must be submitted or not_started.");
  }
  if (issues.length) throw new ValidationError(issues);

  return payload.status as "submitted" | "not_started";
}
