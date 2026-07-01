import { validateHabitCheckInDate } from "../../../../../../src/validation/domain.js";
import { getRepository, json, routeJson } from "../../../../_lib/schoolRoutes.js";

type CheckInRouteContext = {
  params: Promise<{ id: string; date: string }>;
};

export const dynamic = "force-dynamic";

export async function PUT(
  _request: Request,
  context: CheckInRouteContext
): Promise<Response> {
  return routeJson(async () => {
    const params = await context.params;
    const habitId = decodeURIComponent(params.id);
    const date = validateHabitCheckInDate(decodeURIComponent(params.date));
    const checkIn = await getRepository().setHabitCheckIn(habitId, date);
    return json(200, { checkIn });
  });
}

export async function DELETE(
  _request: Request,
  context: CheckInRouteContext
): Promise<Response> {
  return routeJson(async () => {
    const params = await context.params;
    const habitId = decodeURIComponent(params.id);
    const date = validateHabitCheckInDate(decodeURIComponent(params.date));
    await getRepository().removeHabitCheckIn(habitId, date);
    return json(200, { completed: false });
  });
}
