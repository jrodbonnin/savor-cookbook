import test from 'node:test';
import assert from 'node:assert/strict';
import { SourceSchema, RecipeSchema, SaveSchema, ImportSchema } from '../lib/recipes/schema.ts';
const recipe = {
  title: 'Schema test', titleInferred: true,
  ingredients: [{ name: 'Pasta', quantity: '', nameInferred: false, quantityInferred: false }],
  instructions: [{ text: 'Follow the source directions.', inferred: false }],
  cookingTime: { minutes: null, inferred: false }, notes: [],
};
test('source text is trimmed and constrained before any AI call', () => {
  assert.equal(SourceSchema.safeParse('short').success, false);
  assert.equal(SourceSchema.safeParse('a'.repeat(6001)).success, false);
  assert.equal(SourceSchema.parse('  ' + 'a'.repeat(40) + '  ').length, 40);
});
test('a recipe may preserve missing quantities and unknown cooking time', () => {
  assert.equal(RecipeSchema.safeParse(recipe).success, true);
});
test('provenance labels cannot be omitted', () => {
  const missingLabel = structuredClone(recipe);
  delete missingLabel.ingredients[0].quantityInferred;
  assert.equal(RecipeSchema.safeParse(missingLabel).success, false);
});
test('recipe titles, collection sizes, steps and times have limits', () => {
  assert.equal(RecipeSchema.safeParse({ ...recipe, title: '' }).success, false);
  assert.equal(RecipeSchema.safeParse({ ...recipe, ingredients: [] }).success, false);
  assert.equal(RecipeSchema.safeParse({ ...recipe, instructions: [] }).success, false);
  assert.equal(RecipeSchema.safeParse({ ...recipe, cookingTime: { minutes: -1, inferred: true } }).success, false);
  assert.equal(RecipeSchema.safeParse({ ...recipe, ingredients: Array(51).fill(recipe.ingredients[0]) }).success, false);
});
test('save and import bodies cannot supply an owner or change model settings', () => {
  const id = 'b4b4844e-9665-4cef-967d-b53da13b024b';
  const source = 'a'.repeat(40);
  assert.equal(SaveSchema.safeParse({ id, recipe, sourceText: source }).success, true);
  assert.equal(SaveSchema.safeParse({ id, recipe, sourceText: source, userId: 'other-user' }).success, false);
  assert.equal(ImportSchema.safeParse({ text: source, requestId: id, model: 'expensive-model' }).success, false);
});

test('unstated quantities and computed times receive conservative inference labels', async () => {
  const { normalizeProvenance } = await import('../lib/recipes/schema.ts');
  const value = structuredClone(recipe);
  value.cookingTime = { minutes: 19, inferred: false };
  value.ingredients[0].quantity = '200 g';
  const normalized = normalizeProvenance(value, 'Boil pasta for 10 minutes, then simmer the sauce for 8 minutes.');
  assert.equal(normalized.cookingTime.inferred, true);
  assert.equal(normalized.ingredients[0].quantityInferred, true);
  value.ingredients[0].quantity = '';
  value.ingredients[0].quantityInferred = true;
  assert.equal(normalizeProvenance(value, 'pasta').ingredients[0].quantityInferred, false);
});
