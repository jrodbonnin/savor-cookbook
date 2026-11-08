import { readFile, readdir } from 'node:fs/promises';
import { neon } from '@neondatabase/serverless';
try {
  try { process.loadEnvFile('.env.local'); } catch { /* Vercel can provide the environment directly. */ }
  if (!process.env.DATABASE_URL) throw new Error('missing configuration');
  const sql = neon(process.env.DATABASE_URL);
  const directory = new URL('../migrations/', import.meta.url);
  const files = (await readdir(directory)).filter(name => /^\d+.*\.sql$/.test(name)).sort();
  for (const file of files) {
    const source = await readFile(new URL(file, directory), 'utf8');
    const statements = source.split(';').map(s => s.trim()).filter(Boolean);
    await sql.transaction(statements.map(s => sql.query(s)));
  }
  console.log('Application tables and indexes are ready in the existing database. Auth tables and users were not modified.');
} catch {
  console.error('Application migration failed. Check DATABASE_URL and database permissions. Credentials were not printed.');
  process.exitCode = 1;
}
