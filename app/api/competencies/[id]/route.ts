import { validateCompetencyUpdate } from "../../../../src/validation/domain.js";
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
    const competency = await getRepository().updateCompetency(
      await routeId(context),
      validateCompetencyUpdate(await readJson(request))
    );
    return json(200, { competency });
  });
}
