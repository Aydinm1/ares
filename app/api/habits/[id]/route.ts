import { validateHabitUpdate } from "../../../../src/validation/domain.js";
import {
  getRepository,
  json,
  readJson,
  routeId,
  routeJson,
  type RouteContext
} from "../../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    const habit = await getRepository().updateHabit(
      await routeId(context),
      validateHabitUpdate(await readJson(request))
    );
    return json(200, { habit });
  });
}
