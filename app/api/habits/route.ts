import { addDaysToDateKey } from "../../../src/habits/index.js";
import {
  validateHabitCreate,
  validateHabitWeekStart
} from "../../../src/validation/domain.js";
import { getRepository, json, readJson, routeJson } from "../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return routeJson(async () => {
    const weekStart = validateHabitWeekStart(new URL(request.url).searchParams.get("weekStart"));
    const weekEnd = addDaysToDateKey(weekStart, 6);
    return json(200, {
      week: await getRepository().listHabitWeek(weekStart, weekEnd)
    });
  });
}

export async function POST(request: Request): Promise<Response> {
  return routeJson(async () => {
    const input = validateHabitCreate(await readJson(request));
    return json(201, {
      habit: await getRepository().createHabit(input.name, input.targetDaysPerWeek)
    });
  });
}
