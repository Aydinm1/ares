import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const ACADEMIC_TIME_ZONE = "America/Los_Angeles";

export interface AssignmentDueInputParts {
  dueDate: string;
  dueTime: string;
}

export function assignmentDueInputParts(dueAt: string | undefined): AssignmentDueInputParts {
  if (!dueAt) return { dueDate: "", dueTime: "" };
  const instant = new Date(dueAt);
  if (Number.isNaN(instant.getTime())) return { dueDate: "", dueTime: "" };

  const due = toZonedTime(instant, ACADEMIC_TIME_ZONE);
  const storedTime = format(due, "HH:mm");
  return {
    dueDate: format(due, "yyyy-MM-dd"),
    dueTime: storedTime === "23:59" ? "" : storedTime
  };
}

export function formatAssignmentDeadline(dueAt: string | undefined): string | undefined {
  const parts = assignmentDueInputParts(dueAt);
  if (!parts.dueDate) return undefined;
  const date = new Date(`${parts.dueDate}T12:00:00`);
  const dateLabel = format(date, "MMM d, yyyy");
  if (!parts.dueTime) return dateLabel;
  const [hour, minute] = parts.dueTime.split(":").map(Number);
  date.setHours(hour!, minute!, 0, 0);
  return `${dateLabel} · ${format(date, "h:mm a")}`;
}
