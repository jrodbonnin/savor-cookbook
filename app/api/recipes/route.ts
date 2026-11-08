import { z } from 'zod';
import { requireUser, sameOrigin, readJson, json, handle, RecipeError } from '@/lib/recipes/http';
import { listRecipes, saveRecipe } from '@/lib/recipes/repository';
import { SaveSchema } from '@/lib/recipes/schema';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return handle(async () => {
    const userId = await requireUser();
    const offset = z.coerce.number().int().min(0).max(10000).safeParse(new URL(request.url).searchParams.get('offset') ?? 0);
    if (!offset.success) throw new RecipeError(400, 'INVALID_PAGE', 'This cookbook page is invalid.');
    return json({ recipes: await listRecipes(userId, offset.data) });
  });
}
export async function POST(request: Request) {
  return handle(async () => {
    sameOrigin(request);
    const userId = await requireUser();
    const parsed = SaveSchema.safeParse(await readJson(request));
    if (!parsed.success) throw new RecipeError(400, 'INVALID_RECIPE', 'Review the recipe fields: a title, at least one ingredient, and one instruction are required. Keep the source between 40 and 6,000 characters.');
    const { id, recipe, sourceText } = parsed.data;
    if (!await saveRecipe(userId, id, recipe, sourceText)) throw new RecipeError(404, 'NOT_FOUND', 'That recipe is not available in your cookbook.');
    return json({ id }, 200);
  });
}
