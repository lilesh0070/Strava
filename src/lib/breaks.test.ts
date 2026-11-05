import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BREAK_MESSAGES, STRETCH, STRETCH_SEC, breakSlots, isBreakKind } from './breaks.ts';

test('break reminder slots: inside work hours, rotating, capped', () => {
  const s = breakSlots({ everyMin: 60, startH: 9, endH: 18, days: 'mon-fri' });
  const monday = s.filter((x) => x.weekday === 2);
  assert.deepEqual(monday.map((x) => x.hour), [10, 11, 12, 13, 14, 15, 16, 17]);
  assert.deepEqual(monday.slice(0, 5).map((x) => x.kind), ['stretch', 'water', 'eyes', 'walk', 'stretch']);
  assert.equal(s.length, 40);
  assert.ok(!s.some((x) => x.weekday === 1 || x.weekday === 7)); // no weekend
  const sat = breakSlots({ everyMin: 90, startH: 9, endH: 18, days: 'mon-sat' });
  assert.deepEqual(sat.filter((x) => x.weekday === 7).map((x) => `${x.hour}:${x.minute}`), ['10:30', '12:0', '13:30', '15:0', '16:30']);
  assert.equal(breakSlots({ everyMin: 45, startH: 9, endH: 18, days: 'mon-sat' }, 60).length, 60); // iOS cap
  assert.deepEqual(breakSlots({ everyMin: 60, startH: 17, endH: 18, days: 'mon-fri' }), []); // nothing in the last 15 min
});

test('stretch routine and messages are complete', () => {
  assert.equal(STRETCH_SEC, 170);
  for (const m of STRETCH) assert.ok(m.name.en && m.name.hi && m.how.en && m.how.hi, m.id);
  for (const m of Object.values(BREAK_MESSAGES)) assert.ok(m.title.hi && m.body.hi && m.url.startsWith('/'));
  assert.equal(isBreakKind('eyes'), true);
  assert.equal(isBreakKind('nap'), false);
});
