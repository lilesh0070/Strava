import assert from 'node:assert/strict';
import { test } from 'node:test';
import { badgeDetailKey, badgeKey, dictionarySize, missingHindi, translate, type Key } from './strings.ts';
import { PRESETS, stepKey } from './workouts.ts';
import { evaluateAchievements } from './achievements.ts';
import { wellnessBadges } from './health.ts';
import { defaultName } from './types.ts';

test('every English key has a Hindi translation', () => {
  assert.deepEqual(missingHindi, [], `missing Hindi for: ${missingHindi.join(', ')}`);
  assert.ok(dictionarySize > 500);
});

test('translate falls back to English and keeps placeholders', () => {
  assert.equal(translate('en', 'tab.feed'), 'History');
  assert.equal(translate('hi', 'tab.feed'), 'इतिहास');
  // placeholders survive translation so the screens can substitute values
  for (const k of ['h.streak', 'upd.available', 'set.dailySub', 'gear.left', 'pr.longest', 'ach.earnedOf'] as Key[]) {
    const en = translate('en', k).match(/\{\w+\}/g) ?? [];
    const hi = translate('hi', k).match(/\{\w+\}/g) ?? [];
    assert.deepEqual([...hi].sort(), [...en].sort(), `placeholders differ for ${k}`);
  }
});

test('badges, workouts and step labels all have dictionary entries', () => {
  const noLog = {} as Parameters<typeof wellnessBadges>[0];
  for (const b of [...evaluateAchievements([]), ...wellnessBadges(noLog, [], 70)]) {
    assert.equal(translate('en', badgeKey(b.id)), b.title, b.id);
    assert.equal(translate('en', badgeDetailKey(b.id)), b.detail, b.id);
    assert.notEqual(translate('hi', badgeKey(b.id)), b.title, `${b.id} has no Hindi title`);
  }
  for (const w of PRESETS) {
    assert.equal(translate('en', w.nameKey), w.name);
    assert.equal(translate('en', w.descKey), w.description);
    assert.ok(translate('hi', w.nameKey));
  }
  for (const kind of ['warmup', 'work', 'rest', 'cooldown'] as const) assert.ok(translate('hi', stepKey({ kind, by: 'time', value: 60 })));
});

test('default activity names follow the app language', () => {
  const morning = new Date(2026, 10, 5, 7).getTime();
  assert.equal(defaultName('run', morning), 'Morning Run');
  assert.equal(defaultName('run', morning, 'hi'), 'सुबह की दौड़');
  assert.equal(defaultName('ride', new Date(2026, 10, 5, 19).getTime(), 'hi'), 'शाम की राइड');
});
