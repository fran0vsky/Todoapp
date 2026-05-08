/** Comma-separated origins; always includes localhost:4200 for dev if not listed. */
export function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')?.trim();
  const defaults = ['http://localhost:4200', 'http://127.0.0.1:4200'];
  if (!raw) {
    return defaults;
  }
  const fromEnv = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const set = new Set([...defaults, ...fromEnv]);
  return Array.from(set);
}

export function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  const allowed = getAllowedOrigins();
  let allow = '*';
  if (Deno.env.get('ALLOW_ANY_ORIGIN') === 'true') {
    allow = origin ?? '*';
  } else if (origin && allowed.includes(origin)) {
    allow = origin;
  } else if (!origin) {
    allow = '*';
  } else {
    allow = 'null';
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

export function jsonResponse(
  req: Request,
  body: unknown,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeadersFor(req),
    },
  });
}

export function emptyResponse(req: Request, status: number): Response {
  return new Response(null, {
    status,
    headers: corsHeadersFor(req),
  });
}

export function preflightResponse(req: Request): Response {
  return new Response(null, { status: 204, headers: corsHeadersFor(req) });
}
