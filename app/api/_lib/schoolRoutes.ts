import { SchoolRepository } from "../../../src/airtable/repository.js";
import { ValidationError } from "../../../src/validation/domain.js";

export type RouteContext = {
  params: Promise<{ id: string }>;
};

let repository: SchoolRepository | undefined;

export function getRepository(): SchoolRepository {
  repository ??= new SchoolRepository();
  return repository;
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  return text ? JSON.parse(text) : {};
}

export function json(status: number, body: unknown): Response {
  if (status === 204 || status === 205 || status === 304) {
    return new Response(null, { status });
  }
  return Response.json(body, { status });
}

export async function routeJson(handler: () => Promise<Response>): Promise<Response> {
  try {
    return await handler();
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function routeId(context: RouteContext): Promise<string> {
  const params = await context.params;
  return decodeURIComponent(params.id);
}

function toErrorResponse(error: unknown): Response {
  if (error instanceof ValidationError) {
    return json(400, { error: "Validation failed", issues: error.issues });
  }
  if (error instanceof SyntaxError) {
    return json(400, { error: "Invalid JSON" });
  }
  const message = error instanceof Error ? error.message : "Unexpected error";
  return json(500, { error: message });
}
