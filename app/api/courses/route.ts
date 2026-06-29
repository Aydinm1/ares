import {
  getRepository,
  json,
  routeJson
} from "../_lib/schoolRoutes.js";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return routeJson(async () => json(200, { courses: await getRepository().listCourses() }));
}
