import {
  json,
  readJson,
  getRepository,
  routeId,
  routeJson,
  type RouteContext
} from "../../_lib/schoolRoutes.js";
import { validateAssignmentCompletionWrite } from "../../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    const status = validateAssignmentCompletionWrite(await readJson(request));
    return json(200, {
      assignment: await getRepository().updateAssignmentCompletion(
        await routeId(context),
        status
      )
    });
  });
}
