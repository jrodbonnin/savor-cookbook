/**
 * @typedef {{ plan: 'free' | 'premium', source: 'none' | 'demo' }} Entitlement
 */

/**
 * Pure identity policy. Call only with a user ID from a validated server session
 * and the demo ID from private server configuration, never request/body fields.
 * Email addresses, names, and profile metadata are deliberately not inputs.
 * @param {string | null | undefined} authenticatedUserId
 * @param {string | null | undefined} configuredDemoId
 * @returns {Entitlement}
 */
export function resolveDemoEntitlement(authenticatedUserId, configuredDemoId) {
  if (typeof authenticatedUserId === 'string' && authenticatedUserId.length > 0 &&
      typeof configuredDemoId === 'string' && configuredDemoId.trim().length > 0 &&
      authenticatedUserId === configuredDemoId) {
    return { plan: 'premium', source: 'demo' };
  }
  return { plan: 'free', source: 'none' };
}
