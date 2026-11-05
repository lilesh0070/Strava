import assert from 'node:assert/strict';
import { test } from 'node:test';
import { inviteText } from './invite.ts';

test('invite message: link, and the friend ID only when there is one', () => {
  const msg = 'Get the app: {url}', id = 'Add me: {code}';
  assert.equal(inviteText(msg, 'https://x/app.apk'), 'Get the app: https://x/app.apk');
  assert.equal(inviteText(msg, 'https://x/app.apk', id, 'STR-7K3P9'), 'Get the app: https://x/app.apk\n\nAdd me: STR-7K3P9');
  assert.equal(inviteText(msg, 'https://x/app.apk', id, null), 'Get the app: https://x/app.apk');
});
