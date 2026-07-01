import { getRepository, json, readJson, routeJson } from "../_lib/schoolRoutes.js";
import { validateInboxCapture } from "../../../src/validation/domain.js";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return routeJson(async () =>
    json(200, { items: await getRepository().listInboxItems() })
  );
}

export async function POST(request: Request): Promise<Response> {
  return routeJson(async () => {
    const text = validateInboxCapture(await readJson(request));
    return json(201, { item: await getRepository().createInboxItem(text) });
  });
}
