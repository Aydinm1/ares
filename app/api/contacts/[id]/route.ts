import {
  getRepository,
  json,
  readJson,
  routeId,
  routeJson,
  type RouteContext
} from "../../_lib/schoolRoutes.js";
import { validateContactEvidenceWrite } from "../../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    const update = validateContactEvidenceWrite(await readJson(request));
    return json(200, {
      contact: await getRepository().updateContactEvidence(await routeId(context), update)
    });
  });
}
