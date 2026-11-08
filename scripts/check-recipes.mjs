// Opt-in live check: uses one real OpenAI extraction and creates one isolation
// test user through normal signup. It never deletes or changes existing users.
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
if (process.env.RUN_RECIPE_CHECKS !== 'yes' || !process.env.SAVOR_TEST_EMAIL || !process.env.SAVOR_TEST_PASSWORD) {
  console.error('Explicit opt-in and test-account credentials in process environment are required. Never commit credentials.');
  process.exit(2);
}
const base = process.env.SAVOR_TEST_ORIGIN || 'http://localhost:3000';
const source = 'Quick tomato pasta: Boil 200 g spaghetti in salted water for 10 minutes. Warm 1 tbsp olive oil, add 2 minced garlic cloves and cook for 1 minute. Stir in 250 g chopped tomatoes and simmer for 8 minutes. Toss with drained pasta and a handful of fresh basil. Season with salt. Serve warm.';
async function request(path, { body, cookie, origin = base } = {}) {
  const response = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Origin: origin, ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => null);
  return { response, data, cookie: response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ') };
}
function check(value, label) { assert.ok(value, label); console.log('PASS ' + label); }
let cookieA, cookieB;
try {
  check((await request('/api/recipes')).response.status === 401, 'anonymous cookbook access is denied');
  const login = await request('/api/auth/sign-in/email', { body: { email: process.env.SAVOR_TEST_EMAIL, password: process.env.SAVOR_TEST_PASSWORD, rememberMe: true } });
  check(login.response.ok, 'existing test account authenticates'); cookieA = login.cookie;
  check((await request('/api/recipes/import', { cookie: cookieA, origin: 'https://untrusted.example', body: { text: source, requestId: randomUUID() } })).response.status === 403, 'cross-origin import blocked');
  check((await request('/api/recipes/import', { cookie: cookieA, body: { text: 'too short', requestId: randomUUID() } })).response.status === 400, 'invalid input rejected before AI usage');
  const id = randomUUID();
  const generated = await request('/api/recipes/import', { cookie: cookieA, body: { text: source, requestId: id } });
  if (!generated.response.ok) { console.log('Import diagnostic:',generated.response.status,generated.data?.code || 'UNKNOWN'); }
  check(generated.response.ok && generated.data?.recipe?.ingredients?.length > 0, 'real Responses API returns an organized recipe');
  const recipe = generated.data.recipe;
  check(recipe.ingredients.every(v => typeof v.quantityInferred === 'boolean' && typeof v.nameInferred === 'boolean') && recipe.instructions.every(v => typeof v.inferred === 'boolean'), 'inference labels are present for ingredients and instructions');
  const replay = await request('/api/recipes/import', { cookie: cookieA, body: { text: source, requestId: id } });
  check(replay.response.ok && replay.data.cached === true, 'replayed import uses cached result without another AI request');
  const limited = await request('/api/recipes/import', { cookie: cookieA, body: { text: source, requestId: randomUUID() } });
  check(limited.response.status === 429, 'persistent cooldown blocks a second AI request');
  const recipeId = randomUUID(); recipe.title += ' · local verification';
  const payload = { id: recipeId, recipe, sourceText: source };
  check((await request('/api/recipes', { cookie: cookieA, body: payload })).response.ok, 'edited recipe saves to Neon');
  const reopened = await request('/api/recipes/' + recipeId, { cookie: cookieA });
  check(reopened.data?.recipe?.title === recipe.title && reopened.data.sourceText === source, 'saved recipe reopens with edited fields and original source');
  check((await request('/api/recipes', { cookie: cookieA })).data.recipes.some(r => r.id === recipeId), 'saved recipe appears in the personal cookbook');
  const second = await request('/api/auth/sign-up/email', { body: { name: 'Savor recipe isolation check', email: `savor-isolation-${randomBytes(8).toString('hex')}@example.com`, password: randomBytes(24).toString('base64url') + 'aA9!' } });
  check(second.response.ok, 'second isolated test identity created through normal auth'); cookieB = second.cookie;
  check((await request('/api/recipes/' + recipeId, { cookie: cookieB })).response.status === 404, 'other authenticated user cannot read the recipe');
  check(!(await request('/api/recipes', { cookie: cookieB })).data.recipes.some(r => r.id === recipeId), 'other authenticated user cannot list the recipe');
  check((await request('/api/recipes', { cookie: cookieB, body: { ...payload, recipe: { ...recipe, title: 'Unauthorized edit' } } })).response.status === 404, 'other authenticated user cannot overwrite the recipe');
  check((await request('/api/recipes', { cookie: cookieB, body: { ...payload, userId: login.data.user.id } })).response.status === 400, 'client-supplied owner ID is rejected');
  check((await request('/api/recipes/' + recipeId, { cookie: cookieA })).data.recipe.title === recipe.title, 'original recipe remains unchanged after unauthorized attempts');
  console.log('Verification complete. One real recipe and the isolated test identity are retained; no users were deleted.');
} catch (error) { console.error('FAIL',error instanceof Error ? error.message : 'Recipe checks failed'); process.exitCode = 1; }
finally {
  for (const cookie of [cookieA,cookieB]) if (cookie) await request('/api/auth/sign-out',{ cookie, body:{} }).catch(()=>{});
}
