import { validateCompetencyFocusCreate } from "../../../../../src/validation/domain.js";
import {
  getRepository,
  json,
  readJson,
  routeId,
  routeJson,
  type RouteContext
} from "../../../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return routeJson(async () => {
    const input = validateCompetencyFocusCreate(await readJson(request));
    const focus = await getRepository().createCompetencyFocus(
      await routeId(context),
      input.title,
      input.startedAt,
      input.notes
    );
    return json(201, { focus });
  });
}
