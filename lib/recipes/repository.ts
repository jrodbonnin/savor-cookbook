import 'server-only';
import { database } from './db';
import { RecipeSchema, type RecipeDraft, type SavedRecipe } from './schema';

// All queries are parameterized and scoped to an ID from the verified session.
// These functions are server-only; no API accepts a user ID from the browser.
export async function listRecipes(userId: string, offset = 0) {
  const rows = await database()`SELECT id, recipe->>'title' AS title,
    recipe->'cookingTime'->>'minutes' AS minutes, created_at
    FROM savor.recipes WHERE user_id = ${userId}
    ORDER BY created_at DESC, id DESC LIMIT 25 OFFSET ${offset}`;
  return rows.map(row => ({ id: String(row.id), title: String(row.title), minutes: row.minutes === null ? null : Number(row.minutes), createdAt: new Date(row.created_at).toISOString() }));
}
export async function getRecipe(userId: string, id: string): Promise<SavedRecipe | null> {
  const rows = await database()`SELECT id, recipe, source_text, created_at FROM savor.recipes
    WHERE user_id = ${userId} AND id = ${id} LIMIT 1`;
  const row = rows[0];
  return row ? { id: String(row.id), recipe: RecipeSchema.parse(row.recipe), sourceText: String(row.source_text), createdAt: new Date(row.created_at).toISOString() } : null;
}
export async function saveRecipe(userId: string, id: string, recipe: RecipeDraft, sourceText: string) {
  const rows = await database()`INSERT INTO savor.recipes (id, user_id, recipe, source_text)
    VALUES (${id}, ${userId}, ${JSON.stringify(recipe)}::jsonb, ${sourceText})
    ON CONFLICT (id) DO UPDATE SET recipe = EXCLUDED.recipe, source_text = EXCLUDED.source_text, updated_at = now()
    WHERE savor.recipes.user_id = ${userId} RETURNING id`;
  return rows.length === 1;
}
