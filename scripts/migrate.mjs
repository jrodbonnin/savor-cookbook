import { readFile } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
try {
  try { process.loadEnvFile('.env.local'); } catch { /* Vercel can provide the environment directly. */ }
  if (!process.env.DATABASE_URL) throw new Error('missing configuration');
  const sql = neon(process.env.DATABASE_URL);
  const source = await readFile(new URL('../migrations/001_recipes.sql', import.meta.url), 'utf8');
  const statements = source.split(';').map(s => s.trim()).filter(Boolean);
  await sql.transaction(statements.map(s => sql.query(s)));
  console.log('Recipe tables and indexes are ready in the existing database. Auth tables and users were not modified.');
} catch {
  console.error('Recipe migration failed. Check DATABASE_URL and database permissions. Credentials were not printed.');
  process.exitCode = 1;
}
