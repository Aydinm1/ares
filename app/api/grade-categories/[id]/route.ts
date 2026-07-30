import {
  getRepository,
  json,
  readJson,
  routeId,
  routeJson,
  type RouteContext
} from "../../_lib/schoolRoutes.js";
import { validateGradeCategoryWrite } from "../../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    const update = validateGradeCategoryWrite(await readJson(request));
    return json(200, {
      gradeCategory: await getRepository().updateGradeCategory(await routeId(context), update)
    });
  });
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    await getRepository().deleteGradeCategory(await routeId(context));
    return json(200, { deleted: true });
  });
}
