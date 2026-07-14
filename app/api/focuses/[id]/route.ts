import { validateCompetencyFocusUpdate } from "../../../../src/validation/domain.js";
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
    const focus = await getRepository().updateCompetencyFocus(
      await routeId(context),
      validateCompetencyFocusUpdate(await readJson(request))
    );
    return json(200, { focus });
  });
}
