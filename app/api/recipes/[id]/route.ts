import { z } from 'zod';
import { requireUser, json, handle, RecipeError } from '@/lib/recipes/http';
import { getRecipe } from '@/lib/recipes/repository';
export const dynamic = 'force-dynamic';
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const userId = await requireUser();
    const id = z.uuid().safeParse((await params).id);
    if (!id.success) throw new RecipeError(404, 'NOT_FOUND', 'Recipe not found in your cookbook.');
    const recipe = await getRecipe(userId, id.data);
    if (!recipe) throw new RecipeError(404, 'NOT_FOUND', 'Recipe not found in your cookbook.');
    return json(recipe);
  });
}
