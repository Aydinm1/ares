import { validateCompetencyOrder } from "../../../../src/validation/domain.js";
import { getRepository, json, readJson, routeJson } from "../../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request): Promise<Response> {
  return routeJson(async () => {
    const competencyIds = validateCompetencyOrder(await readJson(request));
    await getRepository().reorderCompetencies(competencyIds);
    return json(200, { ok: true });
  });
}
