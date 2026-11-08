import { createHash } from 'node:crypto';
import { database } from '@/lib/recipes/db';
import { ImportSchema, RecipeSchema } from '@/lib/recipes/schema';
import { extractRecipe } from '@/lib/recipes/extract';
import { requireUser, sameOrigin, readJson, json, handle, RecipeError } from '@/lib/recipes/http';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const userId = await requireUser();
    const parsed = ImportSchema.safeParse(await readJson(request, 26000));
    if (!parsed.success) throw new RecipeError(400, 'INVALID_INPUT', 'Paste 40–6,000 characters of recipe text. Video links alone are not supported yet.');
    if (!process.env.OPENAI_API_KEY) throw new RecipeError(503, 'AI_NOT_CONFIGURED', 'Recipe importing is not configured yet. Please contact the project owner.');
    const { text, requestId } = parsed.data;
    const hash = createHash('sha256').update(text).digest('hex');
    const sql = database();
    const inserted = await sql`INSERT INTO savor.ai_imports (id, user_id, source_hash, status)
      VALUES (${requestId}, ${userId}, ${hash}, 'pending') ON CONFLICT (id) DO NOTHING RETURNING id`;
    if (!inserted.length) {
      const rows = await sql`SELECT source_hash, status, recipe, error_code FROM savor.ai_imports WHERE id = ${requestId} AND user_id = ${userId}`;
      const prior = rows[0];
      if (!prior || prior.source_hash !== hash) throw new RecipeError(409, 'REQUEST_CONFLICT', 'Start a new import for this text.');
      if (prior.status === 'succeeded') return json({ recipe: RecipeSchema.parse(prior.recipe), cached: true });
      throw new RecipeError(409, prior.status === 'pending' ? 'IMPORT_PENDING' : 'IMPORT_FAILED', prior.status === 'pending' ? 'This import is already processing. Wait, then retry to recover its result.' : 'This import did not finish. Start a new import if you want to try again.');
    }
    try {
      // A single atomic statement reserves per-user and shared budget slots.
      // Counters persist across server restarts and Vercel instances. Failures
      // conservatively consume attempts: no hidden provider retries or refunds.
      const slots = await sql`WITH user_slot AS (
        INSERT INTO savor.ai_usage (scope, day) VALUES (${`user:${userId}`}, (now() AT TIME ZONE 'UTC')::date)
        ON CONFLICT (scope, day) DO UPDATE SET attempts = savor.ai_usage.attempts + 1, last_attempt = now()
        WHERE savor.ai_usage.attempts < 5 AND savor.ai_usage.last_attempt <= now() - interval '30 seconds'
        RETURNING attempts
      ), global_slot AS (
        INSERT INTO savor.ai_usage (scope, day) SELECT 'global', (now() AT TIME ZONE 'UTC')::date FROM user_slot
        ON CONFLICT (scope, day) DO UPDATE SET attempts = savor.ai_usage.attempts + 1, last_attempt = now()
        WHERE savor.ai_usage.attempts < 30 RETURNING attempts
      ) SELECT attempts FROM global_slot`;
      if (!slots.length) throw new RecipeError(429, 'IMPORT_LIMIT', 'Please wait 30 seconds between imports. Each account can try 5 imports per UTC day; Savor also has a shared 30-attempt daily budget.');
      const recipe = await extractRecipe(text);
      await sql`UPDATE savor.ai_imports SET status = 'succeeded', recipe = ${JSON.stringify(recipe)}::jsonb WHERE id = ${requestId} AND user_id = ${userId}`;
      return json({ recipe, cached: false });
    } catch (error) {
      await sql`UPDATE savor.ai_imports SET status = 'failed', error_code = ${error instanceof RecipeError ? error.code : 'INTERNAL_ERROR'} WHERE id = ${requestId} AND user_id = ${userId}`;
      throw error;
    }
  });
}
