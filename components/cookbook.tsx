'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, BookOpen, Check, Clock3, FileText, Leaf, LoaderCircle, Plus, Save, Sparkles, X } from 'lucide-react';
import { MAX_SOURCE_LENGTH, RecipeSchema, type RecipeDraft, type RecipeSummary, type SavedRecipe } from '@/lib/recipes/schema';

class CookbookError extends Error {
  constructor(message: string, public code?: string) { super(message); }
}
async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { ...options?.headers, ...(options?.body ? { 'Content-Type': 'application/json' } : {}) } });
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new CookbookError(result?.error || 'Savor could not complete that request. Please try again.', result?.code);
  return result as T;
}
function Inferred({ value }: { value: boolean }) { return value ? <span className="inferred-tag"><Sparkles size={10}/> AI inferred</span> : null; }
function InferenceToggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <label className="inference-toggle"><input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} aria-label={label}/> AI inferred</label>;
}
export function Cookbook() {
  const [source, setSource] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [draftSource, setDraftSource] = useState('');
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [notice, setNotice] = useState('');
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [listError, setListError] = useState('');

  const loadRecipes = useCallback(async (offset = 0) => {
    setLoading(true); setListError('');
    try {
      const result = await api<{ recipes: RecipeSummary[] }>(`/api/recipes?offset=${offset}`);
      setRecipes(current => offset ? [...current, ...result.recipes] : result.recipes);
      setMore(result.recipes.length === 25);
    } catch (e) { setListError(e instanceof Error ? e.message : 'We could not load your recipes.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadRecipes(); }, [loadRecipes]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function canLeaveDraft() { return !dirty || window.confirm('You have an unsaved recipe. Discard it and continue?'); }
  function report(e: unknown) {
    setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    setErrorCode(e instanceof CookbookError ? e.code || '' : 'NETWORK');
  }
  function change(next: RecipeDraft) { setDraft(next); setDirty(true); setNotice(''); }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !canLeaveDraft()) return;
    setBusy('generate'); setError(''); setErrorCode(''); setNotice('');
    const key = requestId || crypto.randomUUID(); setRequestId(key);
    try {
      const result = await api<{ recipe: RecipeDraft }>('/api/recipes/import', { method: 'POST', body: JSON.stringify({ text: source, requestId: key }) });
      setDraft(result.recipe); setDraftSource(source.trim()); setRecipeId(crypto.randomUUID());
      setSaved(false); setEditing(true); setDirty(true);
      setNotice('Recipe extracted. Review and edit the details below, then save it to your cookbook.');
    } catch (e) {
      report(e);
      // Reuse the key after an uncertain network result; the server will recover
      // an already completed response without charging for a second AI call.
      if (e instanceof CookbookError && e.code !== 'IMPORT_PENDING') setRequestId(null);
    } finally { setBusy(''); }
  }
  async function save() {
    if (!draft || !recipeId || busy) return;
    const parsed = RecipeSchema.safeParse({ ...draft, notes: draft.notes.map(note => note.trim()).filter(Boolean) });
    if (!parsed.success) { setError('Please add a title, ingredient names, and cooking steps. Check that the cooking time is 1–1,440 minutes or leave it blank.'); return; }
    setBusy('save'); setError(''); setErrorCode(''); setNotice('');
    try {
      await api('/api/recipes', { method: 'POST', body: JSON.stringify({ id: recipeId, recipe: parsed.data, sourceText: draftSource }) });
      setDraft(parsed.data); setSaved(true); setEditing(false); setDirty(false); setNotice('Saved to your personal cookbook. You can reopen it any time.');
      await loadRecipes();
    } catch (e) { report(e); }
    finally { setBusy(''); }
  }
  async function open(id: string) {
    if (busy || !canLeaveDraft()) return;
    setBusy('open'); setError(''); setErrorCode(''); setNotice('');
    try {
      const result = await api<SavedRecipe>(`/api/recipes/${id}`);
      setDraft(result.recipe); setRecipeId(result.id); setDraftSource(result.sourceText);
      setSaved(true); setEditing(false); setDirty(false);
    } catch (e) { report(e); }
    finally { setBusy(''); }
  }

  return <div className="cookbook-workspace">
    <section className="recipe-import-card" aria-labelledby="recipe-import-title">
      <div className="eyebrow"><Sparkles size={14}/> FROM INSPIRATION TO INSTRUCTIONS</div>
      <h2 id="recipe-import-title">That recipe you saved?<br/><em>Let’s make it.</em></h2>
      <p>Paste a recipe caption, transcript, or description. Savor will organize it into something you can cook.</p>
      <form onSubmit={generate}>
        <label className="recipe-label" htmlFor="recipe-source">Your recipe text</label>
        <textarea id="recipe-source" value={source} minLength={40} maxLength={MAX_SOURCE_LENGTH} required disabled={!!busy} rows={6}
          placeholder="Paste the ingredients and cooking directions here…" onChange={e => { setSource(e.target.value); setRequestId(null); }}/>
        <div className="import-meta"><span>Text only for now · 40–6,000 characters</span><span>{source.length.toLocaleString()} / 6,000</span></div>
        <div className="import-actions"><button className="button button-dark" type="submit" disabled={!!busy || source.trim().length < 40}>{busy === 'generate' ? <><LoaderCircle size={16} className="account-spinner"/> Organizing your recipe…</> : <><Sparkles size={15}/> Organize with AI <ArrowUpRight size={16}/></>}</button><span>5 attempts / account / UTC day<br/>30 seconds between imports</span></div>
        <p className="import-privacy">Your text is sent to OpenAI to extract the recipe. Don’t include private information. Nothing is added to your cookbook until you save.</p>
      </form>
    </section>
    {error && <div className="account-message account-error" role="alert">{error}{errorCode === 'SIGN_IN_REQUIRED' && <> <Link href="/login">Log in again</Link></>}{errorCode === 'IMPORT_PENDING' && <button type="button" className="account-inline-button" disabled={!!busy} onClick={() => document.getElementById('recipe-source')?.focus()}> Return to the import form</button>}</div>}
    {notice && <p className="account-message" role="status"><Check size={14}/> {notice}</p>}
    {draft && <section className="recipe-detail" aria-labelledby="recipe-detail-title">
      <div className="recipe-detail-top"><div className="eyebrow"><FileText size={14}/> {editing ? saved ? 'EDIT YOUR RECIPE' : 'REVIEW BEFORE SAVING' : 'FROM YOUR COOKBOOK'}</div>{!editing && <button className="recipe-secondary" disabled={!!busy} onClick={() => { setEditing(true); setNotice(''); }}>Edit recipe</button>}</div>
      <p className="recipe-review-note">Review AI output for accuracy. Orange labels identify estimates or details added by AI. A missing quantity means the source didn’t specify it.</p>
      {editing ? <fieldset className="recipe-editor" disabled={!!busy}><h2 id="recipe-detail-title">Review your recipe</h2>
        <label className="recipe-label" htmlFor="recipe-title">Recipe title</label><input id="recipe-title" value={draft.title} maxLength={140} onChange={e => change({ ...draft, title: e.target.value })}/>
        <InferenceToggle label="Title inferred by AI" checked={draft.titleInferred} onChange={v => change({ ...draft, titleInferred: v })}/>
        <div className="recipe-time-input"><label className="recipe-label" htmlFor="cooking-minutes">Cooking time (minutes)<input id="cooking-minutes" type="number" min={1} max={1440} value={draft.cookingTime.minutes ?? ''} placeholder="Not stated" onChange={e => change({ ...draft, cookingTime: { ...draft.cookingTime, minutes: e.target.value ? Number(e.target.value) : null } })}/></label><InferenceToggle label="Cooking time inferred by AI" checked={draft.cookingTime.inferred} onChange={v => change({ ...draft, cookingTime: { ...draft.cookingTime, inferred: v } })}/></div>
        <h3>Ingredients</h3>
        {draft.ingredients.map((item, i) => <div className="ingredient-editor" key={i}><div><label className="recipe-label" htmlFor={`ingredient-${i}`}>Ingredient {i + 1}<input id={`ingredient-${i}`} value={item.name} maxLength={120} onChange={e => change({ ...draft, ingredients: draft.ingredients.map((v, n) => n === i ? { ...v, name: e.target.value } : v) })}/></label><InferenceToggle label={`Ingredient ${i + 1} name inferred by AI`} checked={item.nameInferred} onChange={value => change({ ...draft, ingredients: draft.ingredients.map((v, n) => n === i ? { ...v, nameInferred: value } : v) })}/></div><div><label className="recipe-label" htmlFor={`quantity-${i}`}>Quantity<input id={`quantity-${i}`} value={item.quantity} maxLength={80} placeholder="Not stated" onChange={e => change({ ...draft, ingredients: draft.ingredients.map((v, n) => n === i ? { ...v, quantity: e.target.value } : v) })}/></label><InferenceToggle label={`Ingredient ${i + 1} quantity inferred by AI`} checked={item.quantityInferred} onChange={value => change({ ...draft, ingredients: draft.ingredients.map((v, n) => n === i ? { ...v, quantityInferred: value } : v) })}/></div><button className="recipe-icon-button" aria-label={`Remove ingredient ${i + 1}`} onClick={() => change({ ...draft, ingredients: draft.ingredients.filter((_, n) => n !== i) })}><X size={16}/></button></div>)}
        <button className="recipe-secondary" disabled={draft.ingredients.length >= 50} onClick={() => change({ ...draft, ingredients: [...draft.ingredients, { name: '', quantity: '', nameInferred: false, quantityInferred: false }] })}><Plus size={14}/> Add ingredient</button>
        <h3>Instructions</h3>
        {draft.instructions.map((step, i) => <div className="step-editor" key={i}><div><label className="recipe-label" htmlFor={`step-${i}`}>Step {i + 1}<textarea id={`step-${i}`} rows={2} maxLength={800} value={step.text} onChange={e => change({ ...draft, instructions: draft.instructions.map((v, n) => n === i ? { ...v, text: e.target.value } : v) })}/></label><InferenceToggle label={`Step ${i + 1} contains details inferred by AI`} checked={step.inferred} onChange={value => change({ ...draft, instructions: draft.instructions.map((v, n) => n === i ? { ...v, inferred: value } : v) })}/></div><button className="recipe-icon-button" aria-label={`Remove step ${i + 1}`} onClick={() => change({ ...draft, instructions: draft.instructions.filter((_, n) => n !== i) })}><X size={16}/></button></div>)}
        <button className="recipe-secondary" disabled={draft.instructions.length >= 30} onClick={() => change({ ...draft, instructions: [...draft.instructions, { text: '', inferred: false }] })}><Plus size={14}/> Add step</button>
        <label className="recipe-label recipe-notes-label" htmlFor="recipe-notes">Notes & uncertainties (one per line, up to 8)<textarea id="recipe-notes" rows={3} value={draft.notes.join('\n')} maxLength={2008} onChange={e => change({ ...draft, notes: e.target.value.split('\n') })}/></label>
        <div className="recipe-save-actions"><button className="button button-dark" onClick={save} disabled={!!busy}>{busy === 'save' ? <><LoaderCircle size={15} className="account-spinner"/> Saving…</> : <><Save size={15}/> {saved ? 'Save changes' : 'Save to my cookbook'}</>}</button><span>Only your account can reopen this recipe.</span></div>
      </fieldset> : <div className="recipe-readable"><h2 id="recipe-detail-title">{draft.title} <Inferred value={draft.titleInferred}/></h2><div className="recipe-time"><Clock3 size={15}/> {draft.cookingTime.minutes ? `${draft.cookingTime.minutes} minutes` : 'Cooking time not stated'} <Inferred value={draft.cookingTime.inferred}/></div><h3>Ingredients</h3><ul>{draft.ingredients.map((v, i) => <li key={i}><strong>{v.quantity || 'Quantity not stated'}<Inferred value={v.quantityInferred}/></strong> {v.name}<Inferred value={v.nameInferred}/></li>)}</ul><h3>Instructions</h3><ol>{draft.instructions.map((v, i) => <li key={i}>{v.text} <Inferred value={v.inferred}/></li>)}</ol>{draft.notes.length > 0 && <><h3>Notes & uncertainties</h3><ul>{draft.notes.map((v, i) => <li key={i}>{v}</li>)}</ul></>}</div>}
      <details className="recipe-source"><summary>View original source text</summary><p>{draftSource}</p></details>
    </section>}
    <section className="saved-cookbook" aria-labelledby="saved-recipes-title"><div className="saved-heading"><div><div className="eyebrow"><BookOpen size={14}/> YOUR PERSONAL COLLECTION</div><h2 id="saved-recipes-title">A little book of <em>favorites.</em></h2></div><button className="recipe-secondary" disabled={loading || !!busy} onClick={() => loadRecipes()}>Refresh cookbook</button></div>
      {listError && <p className="account-message account-error" role="alert">{listError} <button className="account-inline-button" onClick={() => loadRecipes()}>Try again</button></p>}
      {loading && <p className="cookbook-loading" role="status">Opening your cookbook…</p>}
      {!loading && !listError && recipes.length === 0 && <div className="cookbook-empty"><Leaf size={30}/><h3>Your first favorite starts above.</h3><p>Paste some recipe text, review the details, and save it here for another day.</p></div>}
      <div className="saved-recipe-grid">{recipes.map(recipe => <button className={`saved-recipe-card ${recipeId === recipe.id ? 'selected-recipe' : ''}`} disabled={!!busy} key={recipe.id} onClick={() => open(recipe.id)}><div className="saved-card-art"><BookOpen size={30} strokeWidth={1.3}/><Leaf size={16}/></div><span className="saved-card-title">{recipe.title}</span><span className="saved-card-meta"><Clock3 size={12}/>{recipe.minutes ? `${recipe.minutes} min` : 'Time not stated'}<ArrowUpRight size={14}/></span></button>)}</div>
      {more && <button className="recipe-secondary load-more" disabled={loading || !!busy} onClick={() => loadRecipes(recipes.length)}>Load more recipes</button>}
    </section>
  </div>;
}
