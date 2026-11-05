'use client';
import { createAuthClient } from '@neondatabase/auth/next';
// Requests go through our same-origin API. No database credentials reach the browser.
export const authClient = createAuthClient();
