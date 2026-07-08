import {
  json,
  getRepository,
  routeJson,
  shouldRefreshCache
} from "../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return routeJson(async () =>
    json(200, {
      assignments: await getRepository().listAssignments({
        refresh: shouldRefreshCache(request)
      })
    })
  );
}
