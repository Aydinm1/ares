import {
  validateCompetencyCreate
} from "../../../src/validation/domain.js";
import { getRepository, json, readJson, routeJson } from "../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return routeJson(async () => json(200, {
    competencies: await getRepository().listCompetencyOverview()
  }));
}

export async function POST(request: Request): Promise<Response> {
  return routeJson(async () => {
    const input = validateCompetencyCreate(await readJson(request));
    return json(201, {
      competency: await getRepository().createCompetency(
        input.name,
        input.category,
        input.vision,
        input.description
      )
    });
  });
}
