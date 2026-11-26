import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPinRecord, verifyPin, isValidPin, isWeakPin, lockoutSeconds, shouldLockAfter } from './pin.js';

test('الرمز: يتحفظ كـ hash ويتحقق صح', async () => {
  const rec = await createPinRecord('4821');
  assert.equal(rec.pinLength, 4);
  assert.ok(!JSON.stringify(rec).includes('4821'));
  assert.equal(await verifyPin('4821', rec), true);
  assert.equal(await verifyPin('4822', rec), false);
  assert.equal(await verifyPin('482', rec), false);
  const rec2 = await createPinRecord('4821');
  assert.notEqual(rec.hash, rec2.hash); // salt مختلف
});

test('الرمز: الصيغة والرموز الضعيفة', () => {
  assert.equal(isValidPin('123'), false);
  assert.equal(isValidPin('1234567'), false);
  assert.equal(isValidPin('12a4'), false);
  assert.equal(isValidPin('905731'), true);
  assert.equal(isWeakPin('1111'), true);
  assert.equal(isWeakPin('1234'), true);
  assert.equal(isWeakPin('6543'), true);
  assert.equal(isWeakPin('4821'), false);
});

test('القفل: الانتظار بعد المحاولات الغلط ووقت القفل التلقائي', () => {
  assert.equal(lockoutSeconds(4), 0);
  assert.equal(lockoutSeconds(5), 30);
  assert.equal(lockoutSeconds(8), 60);
  assert.equal(lockoutSeconds(50), 900);
  assert.equal(shouldLockAfter(null, 1000, 0), false);
  assert.equal(shouldLockAfter(1000, 1000, 0), true);
  assert.equal(shouldLockAfter(0, 59_000, 1), false);
  assert.equal(shouldLockAfter(0, 60_000, 1), true);
});
