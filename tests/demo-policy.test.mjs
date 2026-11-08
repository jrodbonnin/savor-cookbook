import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDemoEntitlement } from '../lib/access/demo-policy.mjs';
const demoId = 'test-immutable-demo-id';

test('only the configured immutable user ID receives Premium', () => {
  assert.deepEqual(resolveDemoEntitlement(demoId, demoId), { plan: 'premium', source: 'demo' });
});
test('another user is free even if their profile uses the demo email', () => {
  const user = { id: 'another-user', email: 'demo@demo.com', name: 'Savor Demo', plan: 'premium' };
  assert.equal(resolveDemoEntitlement(user.id, demoId).plan, 'free');
});
test('missing server configuration fails closed', () => {
  for (const config of [undefined, null, '', '   ']) {
    assert.equal(resolveDemoEntitlement(demoId, config).plan, 'free');
  }
});
test('anonymous callers never receive Premium', () => {
  for (const userId of [undefined, null, '']) {
    assert.equal(resolveDemoEntitlement(userId, demoId).plan, 'free');
  }
});
test('IDs use an exact match, not case folding or partial matching', () => {
  assert.equal(resolveDemoEntitlement(demoId.toUpperCase(), demoId).plan, 'free');
  assert.equal(resolveDemoEntitlement(demoId + '-extra', demoId).plan, 'free');
});
