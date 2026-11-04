import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareVersions } from './semver.ts';

test('compareVersions', () => {
  assert.ok(compareVersions('v1.2.0', '1.1.9') > 0);
  assert.ok(compareVersions('1.10.0', '1.9.0') > 0);
  assert.equal(compareVersions('v1.1', '1.1.0'), 0);
  assert.ok(compareVersions('1.0.0', '1.0.1') < 0);
  assert.ok(compareVersions('2.0.0-beta', '1.9.9') > 0);
});
