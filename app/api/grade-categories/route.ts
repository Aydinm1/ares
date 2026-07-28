import {
  getRepository,
  json,
  readJson,
  routeJson,
  shouldRefreshCache
} from "../_lib/schoolRoutes.js";
import { validateGradeCategoryWrite } from "../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return routeJson(async () =>
    json(200, {
      gradeCategories: await getRepository().listGradeCategories({
        refresh: shouldRefreshCache(request)
      })
    })
  );
}

export async function POST(request: Request): Promise<Response> {
  return routeJson(async () => {
    const update = validateGradeCategoryWrite(await readJson(request));
    return json(201, {
      gradeCategory: await getRepository().createGradeCategory(update)
    });
  });
}
