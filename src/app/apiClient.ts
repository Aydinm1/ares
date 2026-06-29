import type { Assignment, Course } from "../domain/index.js";

export async function loadAssignments(): Promise<Assignment[]> {
  const response = await fetchJson<{ assignments: Assignment[] }>("/api/assignments");
  return response.assignments;
}

export async function loadCourses(): Promise<Course[]> {
  const response = await fetchJson<{ courses: Course[] }>("/api/courses");
  return response.courses;
}

export async function updateAssignmentCompletion(
  id: string,
  completed: boolean
): Promise<Assignment> {
  const response = await fetchJson<{ assignment: Assignment }>(
    `/api/assignments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: completed ? "submitted" : "not_started"
      })
    }
  );
  return response.assignment;
}

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly issues?: string[]
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);

  if (!response.ok) {
    const body = await response.text();
    let message = `Request failed with status ${response.status}.`;
    let issues: string[] | undefined;

    try {
      const parsed = JSON.parse(body) as { error?: unknown; issues?: unknown };
      if (typeof parsed.error === "string") message = parsed.error;
      if (
        Array.isArray(parsed.issues) &&
        parsed.issues.every((issue) => typeof issue === "string")
      ) {
        issues = parsed.issues;
      }
    } catch {
      // Non-JSON failures use the stable status-based message.
    }

    throw new ApiClientError(message, response.status, issues);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiClientError("The server returned an invalid response.", response.status);
  }
}
