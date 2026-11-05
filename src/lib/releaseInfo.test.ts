import assert from 'node:assert/strict';
import { test } from 'node:test';
import { friendlyError, fromApiRelease, fromManifest, newestRelease, pickUpdate } from './releaseInfo.ts';

const base = 'https://github.com/lilesh0070/Strava/releases';
const apiRel = (tag: string, extra: object = {}) => ({
  tag_name: tag, body: `notes ${tag}`, html_url: `${base}/tag/${tag}`, draft: false, prerelease: false,
  assets: [{ name: `tbdi-fittrack-${tag}.apk`, browser_download_url: `${base}/download/${tag}/tbdi-fittrack-${tag}.apk`, size: 48e6 },
    { name: 'update.json', browser_download_url: `${base}/download/${tag}/update.json`, size: 300 }],
  ...extra,
});

test('update.json manifest', () => {
  const m = fromManifest({ version: '1.3.3', apk: 'tbdi-fittrack-v1.3.3.apk', url: `${base}/download/v1.3.3/tbdi-fittrack-v1.3.3.apk`,
    page: `${base}/tag/v1.3.3`, size: 48500000, notes: 'hi' });
  assert.deepEqual(m, { version: '1.3.3', url: `${base}/download/v1.3.3/tbdi-fittrack-v1.3.3.apk`, notes: 'hi', size: 48500000,
    name: 'tbdi-fittrack-v1.3.3.apk', htmlUrl: `${base}/tag/v1.3.3` });
  assert.equal(fromManifest({ version: '1.3.3', url: 'http://evil/x.apk' }), null); // https only
  assert.equal(fromManifest({ version: 'abc', url: `${base}/x.apk` }), null);
  assert.equal(fromManifest('<html>Not Found</html>'), null);
});

test('API releases: the APK asset is found, drafts are ignored, test builds are newest-aware', () => {
  const r = fromApiRelease(apiRel('v1.3.2'))!;
  assert.equal(r.version, '1.3.2');
  assert.ok(r.url.endsWith('.apk'));
  assert.equal(fromApiRelease(apiRel('v1.4.0', { draft: true })), null);
  assert.equal(fromApiRelease(apiRel('v1.4.0', { assets: [] })), null);
  const list = [apiRel('v1.2.0'), apiRel('v1.3.10', { prerelease: true }), apiRel('v1.3.9'), apiRel('v2.0.0', { draft: true })];
  assert.equal(newestRelease(list)!.version, '1.3.10');
  assert.equal(newestRelease(list)!.prerelease, true);
  assert.equal(newestRelease({ message: 'API rate limit exceeded' }), null);
});

test('only newer versions are offered', () => {
  const r = fromApiRelease(apiRel('v1.3.2'))!;
  assert.equal(pickUpdate(r, '1.3.1'), r);
  assert.equal(pickUpdate(r, '1.3.2'), null);
  assert.equal(pickUpdate(r, '1.10.0'), null);
  assert.equal(pickUpdate(null, '1.0.0'), null);
});

test('friendly errors', () => {
  assert.match(friendlyError(new TypeError('Network request failed')), /No internet/);
  assert.match(friendlyError(new Error('GitHub responded 403')), /busy/);
  assert.equal(friendlyError(new Error('Disk full')), 'Disk full');
});
