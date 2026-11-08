import 'server-only';
import { getAuth } from '@/lib/auth/server';
export class RecipeError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export async function requireUser() {
  const { data, error } = await getAuth().getSession({ query: { disableCookieCache: true } });
  if (error) throw new RecipeError(503, 'AUTH_UNAVAILABLE', 'We could not check your session. Please try again.');
  if (!data?.user) throw new RecipeError(401, 'SIGN_IN_REQUIRED', 'Please log in to use your cookbook.');
  return data.user.id;
}
export function sameOrigin(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new RecipeError(403, 'INVALID_ORIGIN', 'Open Savor in your browser and try again.');
  }
}
export async function readJson(request: Request, maxBytes = 80000) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new RecipeError(415, 'INVALID_FORMAT', 'Send recipe data as JSON.');
  if (Number(request.headers.get('content-length')) > maxBytes) throw new RecipeError(413, 'TOO_LARGE', 'This recipe is too long. Please shorten it.');
  const reader = request.body?.getReader();
  if (!reader) throw new RecipeError(400, 'INVALID_INPUT', 'Recipe data is missing.');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new RecipeError(413, 'TOO_LARGE', 'This recipe is too long. Please shorten it.'); }
    chunks.push(value);
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown; }
  catch { throw new RecipeError(400, 'INVALID_INPUT', 'Recipe data could not be read.'); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function handle(action: () => Promise<Response>) {
  try { return await action(); }
  catch (error) {
    if (error instanceof RecipeError) return json({ error: error.message, code: error.code }, error.status);
    // Never log source text, provider payloads, cookies, or database errors/URLs.
    console.error('[savor-recipes] An internal operation failed.');
    return json({ error: 'Your cookbook is temporarily unavailable. Please try again.', code: 'INTERNAL_ERROR' }, 503);
  }
}
