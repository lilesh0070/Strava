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

test('compareVersions orders pre-releases before their release', () => {
  assert.ok(compareVersions('v1.3.0', '1.3.0-rc.1') > 0); // an RC install must still be offered 1.3.0
  assert.ok(compareVersions('1.3.0-rc.1', '1.3.0') < 0);
  assert.ok(compareVersions('1.3.0-rc.2', '1.3.0-rc.1') > 0);
  assert.ok(compareVersions('1.3.0-rc.10', '1.3.0-rc.2') > 0);
  assert.ok(compareVersions('1.3.0-rc.1', '1.3.0-beta.5') > 0);
  assert.ok(compareVersions('1.3.0-rc', '1.3.0-rc.1') < 0);
  assert.equal(compareVersions('1.3.0+build.7', '1.3.0'), 0);
  assert.equal(compareVersions('v1.3.0-rc.1', '1.3.0-rc.1'), 0);
});
