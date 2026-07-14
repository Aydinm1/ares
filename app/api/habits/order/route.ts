import { validateHabitOrder } from "../../../../src/validation/domain.js";
import { getRepository, json, readJson, routeJson } from "../../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  return routeJson(async () => {
    const habitIds = validateHabitOrder(await readJson(request));
    await getRepository().reorderHabits(habitIds);
    return json(200, { ok: true });
  });
}
