import {
  getRepository,
  json,
  routeId,
  routeJson,
  type RouteContext
} from "../../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    await getRepository().deleteInboxItem(await routeId(context));
    return json(200, { deleted: true });
  });
}
