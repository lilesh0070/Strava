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

test('update.json: sha256 and signing fingerprint are read and normalised; key changes need a reinstall', async () => {
  const { fromManifest, needsReinstall, normSigner } = await import('./releaseInfo.ts');
  const DEBUG = 'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';
  const OTHER = '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00';
  const m = { version: '1.3.11', url: 'https://github.com/x/y/releases/download/v1.3.11/a.apk', sha256: 'AB'.repeat(32), signer: DEBUG.toLowerCase() };
  const r = fromManifest(m)!;
  assert.equal(r.sha256, 'ab'.repeat(32));
  assert.equal(r.signer, DEBUG);
  assert.equal(normSigner(DEBUG.replace(/:/g, '')), DEBUG);
  assert.equal(normSigner('not a fingerprint'), '');
  // junk values are ignored, not trusted
  const j = fromManifest({ ...m, sha256: 'xyz', signer: 'abc' })!;
  assert.equal(j.sha256, undefined);
  assert.equal(j.signer, undefined);
  // same key: normal in-app update; new key: one-time reinstall; unknown on either side: normal
  assert.equal(needsReinstall(r, DEBUG), false);
  assert.equal(needsReinstall(fromManifest({ ...m, signer: OTHER }), DEBUG), true);
  assert.equal(needsReinstall(r, ''), false);
  assert.equal(needsReinstall(fromManifest({ ...m, signer: undefined }), DEBUG), false);
  assert.equal(needsReinstall(null, DEBUG), false);
});

test('key rotation: update.json lineage is parsed strictly; an app whose key is in it updates in place', async () => {
  const { fromManifest, needsReinstall, parseLineage } = await import('./releaseInfo.ts');
  const DEBUG = 'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C';
  const REL = '53:44:1A:53:D9:3B:29:D6:01:65:31:5E:8F:32:CA:99:E1:3F:3D:C4:F8:BE:75:1B:93:A6:1F:BF:91:6A:83:4B';
  const LOST = '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00';
  const m = { version: '1.3.12', url: 'https://github.com/x/y/releases/download/v1.3.12/a.apk', signer: REL, lineage: [DEBUG, REL] };

  // what the release workflow writes after `apksigner rotate` (debug key → release key)
  const r = fromManifest(m)!;
  assert.equal(r.signer, REL);
  assert.deepEqual(r.lineage, [DEBUG, REL]);
  // fingerprints are normalised like `signer` (case, separators)
  assert.deepEqual(fromManifest({ ...m, lineage: [DEBUG.replace(/:/g, '').toLowerCase(), REL.toLowerCase()] })!.lineage, [DEBUG, REL]);
  // longer chains (a second rotation later) are fine
  assert.deepEqual(parseLineage([DEBUG, LOST, REL], REL), [DEBUG, LOST, REL]);

  // anything odd is ignored as a whole
  for (const bad of [
    undefined, null, 'FA:C6', {}, [], [REL], // missing, not a list, nothing to rotate from
    [DEBUG, 'junk', REL], [DEBUG, 42, REL], // a junk entry
    [REL, DEBUG], [DEBUG, LOST], // the last entry must be the signer
    [DEBUG, DEBUG, REL], [REL, REL], // repeated keys
  ]) assert.equal(fromManifest({ ...m, lineage: bad })!.lineage, undefined, JSON.stringify(bad));
  assert.equal(parseLineage([DEBUG, REL], ''), undefined); // no signer, no lineage
  assert.equal(fromManifest({ ...m, signer: 'abc' })!.lineage, undefined);

  // the switch from the debug key installs in place: the phone's key is in the lineage
  assert.equal(needsReinstall(r, DEBUG), false);
  assert.equal(needsReinstall(r, DEBUG.toLowerCase()), false);
  // later releases with the same key, after the switch
  assert.equal(needsReinstall(r, REL), false);
  // a key that is not in the lineage still needs the one-time reinstall
  assert.equal(needsReinstall(r, LOST), true);
  // a key change without a lineage (or with a broken one) needs it too
  assert.equal(needsReinstall(fromManifest({ ...m, lineage: undefined }), DEBUG), true);
  assert.equal(needsReinstall(fromManifest({ ...m, lineage: [DEBUG, 'junk', REL] }), DEBUG), true);
  // going back to the debug key after the switch is a rollback the lineage does not allow
  assert.equal(needsReinstall(fromManifest({ ...m, signer: DEBUG, lineage: undefined }), REL), true);
  // unknown on either side: normal update
  assert.equal(needsReinstall(r, ''), false);
  assert.equal(needsReinstall(fromManifest({ ...m, signer: undefined }), DEBUG), false);
});
