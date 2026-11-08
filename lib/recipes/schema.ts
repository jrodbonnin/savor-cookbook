import { z } from 'zod';
export const MAX_SOURCE_LENGTH = 6000;
export const SourceSchema = z.string().trim().min(40, 'Paste at least 40 characters of recipe text.').max(MAX_SOURCE_LENGTH);
export const RecipeSchema = z.object({
  title: z.string().trim().min(1).max(140),
  titleInferred: z.boolean(),
  ingredients: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    nameInferred: z.boolean(),
    quantity: z.string().trim().max(80),
    quantityInferred: z.boolean(),
  }).strict()).min(1).max(50),
  instructions: z.array(z.object({
    text: z.string().trim().min(1).max(800),
    inferred: z.boolean(),
  }).strict()).min(1).max(30),
  cookingTime: z.object({ minutes: z.number().int().min(1).max(1440).nullable(), inferred: z.boolean() }).strict(),
  notes: z.array(z.string().trim().min(1).max(250)).max(8),
}).strict();
export const ExtractionSchema = z.object({
  isRecipe: z.boolean(),
  reason: z.string().max(250),
  recipe: RecipeSchema.nullable(),
}).strict();
export const ImportSchema = z.object({ text: SourceSchema, requestId: z.uuid() }).strict();
export const SaveSchema = z.object({ id: z.uuid(), recipe: RecipeSchema, sourceText: SourceSchema }).strict();
export type RecipeDraft = z.infer<typeof RecipeSchema>;
export type SavedRecipe = { id: string; recipe: RecipeDraft; sourceText: string; createdAt: string };
export type RecipeSummary = { id: string; title: string; minutes: number | null; createdAt: string };

// Conservatively label numeric estimates even if the model overlooked a flag.
// This supplements the model's provenance labels; it does not prove accuracy.
export function normalizeProvenance(recipe: RecipeDraft, source: string): RecipeDraft {
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, ' ').trim();
  const normalizedSource = normalize(source);
  const minutes = recipe.cookingTime.minutes;
  const statedMinutes = minutes !== null && new RegExp(`\\b${minutes}\\s*(?:minutes?|mins?)\\b`, 'i').test(source);
  return {
    ...recipe,
    titleInferred: recipe.titleInferred || !normalizedSource.includes(normalize(recipe.title)),
    ingredients: recipe.ingredients.map(item => ({
      ...item,
      nameInferred: item.nameInferred || !normalizedSource.includes(normalize(item.name)),
      quantityInferred: item.quantity.length > 0 && (item.quantityInferred || !normalizedSource.includes(normalize(item.quantity))),
    })),
    cookingTime: { minutes, inferred: minutes !== null && (recipe.cookingTime.inferred || !statedMinutes) },
  };
}
