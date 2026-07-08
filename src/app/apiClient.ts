import type {
  Assignment,
  Course,
  Habit,
  HabitCheckIn,
  HabitUpdate,
  HabitWeek,
  InboxItem
} from "../domain/index.js";

export interface AssignmentEditorUpdate {
  title?: string;
  courseId?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  pointsPossible?: number | null;
  weekLabel?: string | null;
}

export interface LoadOptions {
  refresh?: boolean;
}

export async function loadAssignments(options: LoadOptions = {}): Promise<Assignment[]> {
  const response = await fetchJson<{ assignments: Assignment[] }>(
    apiUrl("/api/assignments", options)
  );
  return response.assignments;
}

export async function loadCourses(options: LoadOptions = {}): Promise<Course[]> {
  const response = await fetchJson<{ courses: Course[] }>(
    apiUrl("/api/courses", options)
  );
  return response.courses;
}

export async function loadInboxItems(): Promise<InboxItem[]> {
  const response = await fetchJson<{ items: InboxItem[] }>("/api/inbox");
  return response.items;
}

export async function createInboxItem(text: string): Promise<InboxItem> {
  const response = await fetchJson<{ item: InboxItem }>("/api/inbox", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text })
  });
  return response.item;
}

export async function deleteInboxItem(id: string): Promise<void> {
  await fetchJson<{ deleted: true }>(`/api/inbox/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
}

export async function loadHabitWeek(weekStart: string): Promise<HabitWeek> {
  const response = await fetchJson<{ week: HabitWeek }>(
    `/api/habits?weekStart=${encodeURIComponent(weekStart)}`
  );
  return response.week;
}

export async function createHabit(
  name: string,
  targetDaysPerWeek: number
): Promise<Habit> {
  const response = await fetchJson<{ habit: Habit }>("/api/habits", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, targetDaysPerWeek })
  });
  return response.habit;
}

export async function updateHabit(id: string, update: HabitUpdate): Promise<Habit> {
  const response = await fetchJson<{ habit: Habit }>(
    `/api/habits/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update)
    }
  );
  return response.habit;
}

export async function setHabitCheckIn(
  habitId: string,
  date: string,
  completed: boolean
): Promise<HabitCheckIn | undefined> {
  const response = await fetchJson<{ checkIn?: HabitCheckIn; completed?: false }>(
    `/api/habits/${encodeURIComponent(habitId)}/check-ins/${encodeURIComponent(date)}`,
    { method: completed ? "PUT" : "DELETE" }
  );
  return response.checkIn;
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

export async function updateAssignmentDetails(
  id: string,
  update: AssignmentEditorUpdate
): Promise<Assignment> {
  const response = await fetchJson<{ assignment: Assignment }>(
    `/api/assignments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update)
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

function apiUrl(path: string, options: LoadOptions): string {
  if (!options.refresh) return path;
  const params = new URLSearchParams({ refresh: "1" });
  return `${path}?${params.toString()}`;
}
