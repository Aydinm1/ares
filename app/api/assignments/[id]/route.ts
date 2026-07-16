import {
  json,
  readJson,
  getRepository,
  routeId,
  routeJson,
  type RouteContext
} from "../../_lib/schoolRoutes.js";
import { validateAssignmentWrite } from "../../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    const update = validateAssignmentWrite(await readJson(request));
    return json(200, {
      assignment: await getRepository().updateAssignment(
        await routeId(context),
        update
      )
    });
  });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    await getRepository().deleteAssignment(await routeId(context));
    return json(200, { deleted: true });
  });
}
