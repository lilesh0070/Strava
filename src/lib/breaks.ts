// Guided micro-breaks for desk workers. The stretch routine is office-friendly (no floor work, no
// equipment), works the areas long sitting strains most (neck, shoulders, chest, spine, wrists,
// calves) and ends standing to get the blood moving. ~3 minutes in total.
import type { Lang } from './strings';

export type BreakKind = 'stretch' | 'breathe' | 'eyes';
export const isBreakKind = (k: unknown): k is BreakKind => k === 'stretch' || k === 'breathe' || k === 'eyes';

type L = Record<Lang, string>;
export type Move = { id: string; icon: string; sec: number; name: L; how: L };

export const STRETCH: Move[] = [
  { id: 'neckR', icon: 'head-outline', sec: 20,
    name: { en: 'Neck stretch · right', hi: 'गर्दन स्ट्रेच · दाएँ' },
    how: { en: 'Tilt your right ear towards your shoulder. Keep both shoulders down.', hi: 'दायाँ कान कंधे की ओर झुकाएँ। दोनों कंधे नीचे रखें।' } },
  { id: 'neckL', icon: 'head-outline', sec: 20,
    name: { en: 'Neck stretch · left', hi: 'गर्दन स्ट्रेच · बाएँ' },
    how: { en: 'Now the left ear towards the left shoulder. Breathe slowly.', hi: 'अब बायाँ कान बाएँ कंधे की ओर। धीरे साँस लें।' } },
  { id: 'shoulders', icon: 'rotate-3d-variant', sec: 20,
    name: { en: 'Shoulder rolls', hi: 'कंधे घुमाएँ' },
    how: { en: 'Roll your shoulders back in big, slow circles.', hi: 'कंधों को पीछे की ओर बड़े, धीमे घेरे में घुमाएँ।' } },
  { id: 'chest', icon: 'human-handsdown', sec: 20,
    name: { en: 'Chest opener', hi: 'छाती खोलें' },
    how: { en: 'Clasp your hands behind you, lift your chest and squeeze your shoulder blades.', hi: 'हाथ पीछे जोड़ें, छाती ऊपर उठाएँ और कंधों को पीछे की ओर दबाएँ।' } },
  { id: 'twistR', icon: 'rotate-right', sec: 15,
    name: { en: 'Seated twist · right', hi: 'बैठे-बैठे मोड़ · दाएँ' },
    how: { en: 'Sit tall and turn your upper body to the right, hand on the backrest.', hi: 'सीधे बैठें और ऊपरी शरीर दाईं ओर मोड़ें, हाथ कुर्सी की पीठ पर।' } },
  { id: 'twistL', icon: 'rotate-left', sec: 15,
    name: { en: 'Seated twist · left', hi: 'बैठे-बैठे मोड़ · बाएँ' },
    how: { en: 'Now turn to the left. Keep your hips facing forward.', hi: 'अब बाईं ओर मुड़ें। कूल्हे सामने की ओर रखें।' } },
  { id: 'wrists', icon: 'hand-back-right-outline', sec: 20,
    name: { en: 'Wrist stretch', hi: 'कलाई स्ट्रेच' },
    how: { en: 'Arm out, palm up, gently pull your fingers back. Swap hands halfway.', hi: 'हाथ आगे, हथेली ऊपर, उंगलियाँ धीरे से पीछे खींचें। बीच में हाथ बदलें।' } },
  { id: 'calves', icon: 'human-male-height', sec: 20,
    name: { en: 'Calf raises', hi: 'पंजों पर उठें' },
    how: { en: 'Stand up, rise onto your toes, then lower slowly.', hi: 'खड़े होकर पंजों पर उठें, फिर धीरे से नीचे आएँ।' } },
  { id: 'march', icon: 'walk', sec: 20,
    name: { en: 'March in place', hi: 'एक जगह कदमताल' },
    how: { en: 'Lift your knees and swing your arms to get the blood flowing.', hi: 'घुटने उठाएँ और हाथ हिलाएँ, ख़ून का दौरा बढ़ाएँ।' } },
];
export const STRETCH_SEC = STRETCH.reduce((s, m) => s + m.sec, 0);

/** Box breathing: four equal phases. */
export const BOX_PHASE_SEC = 4;
export const BREATHE_PHASES = ['b.in', 'b.hold', 'b.out', 'b.hold'] as const;
export const EYES_SEC = 20;

// ---------- workday break reminders ----------
export type ReminderKind = 'stretch' | 'water' | 'eyes' | 'walk';
const ROTATION: ReminderKind[] = ['stretch', 'water', 'eyes', 'walk'];
export type Slot = { weekday: number; hour: number; minute: number; kind: ReminderKind }; // weekday: 1 = Sunday … 7 = Saturday

/**
 * Reminder times during work hours: the first one `everyMin` after the start, none in the last
 * 15 minutes of the day. The type rotates stretch → water → eyes → walk so nudges stay fresh.
 * `cap` keeps the total under the OS limit (iOS keeps at most 64 pending notifications).
 */
export function breakSlots(o: { everyMin: number; startH: number; endH: number; days: 'mon-fri' | 'mon-sat' }, cap = 200): Slot[] {
  const every = Math.max(30, o.everyMin);
  const times: number[] = [];
  for (let m = o.startH * 60 + every; m <= o.endH * 60 - 15; m += every) times.push(m);
  const weekdays = o.days === 'mon-sat' ? [2, 3, 4, 5, 6, 7] : [2, 3, 4, 5, 6];
  const out: Slot[] = [];
  for (const weekday of weekdays) {
    times.forEach((m, i) => out.push({ weekday, hour: Math.floor(m / 60), minute: m % 60, kind: ROTATION[i % ROTATION.length] }));
  }
  return out.slice(0, cap);
}

export const BREAK_MESSAGES: Record<ReminderKind, { title: L; body: L; url: string }> = {
  stretch: { url: '/break?kind=stretch',
    title: { en: 'Stretch break 🧘', hi: 'स्ट्रेच ब्रेक 🧘' },
    body: { en: 'Stand up and stretch for 3 minutes. Your back will thank you.', hi: '3 मिनट खड़े होकर स्ट्रेच करें। आपकी कमर शुक्रिया कहेगी।' } },
  water: { url: '/health',
    title: { en: 'Water break 💧', hi: 'पानी का ब्रेक 💧' },
    body: { en: 'Drink a glass of water and tap to log it.', hi: 'एक गिलास पानी पिएँ और दर्ज करने के लिए टैप करें।' } },
  eyes: { url: '/break?kind=eyes',
    title: { en: 'Eye break 👀', hi: 'आँखों का ब्रेक 👀' },
    body: { en: '20-20-20: look 6 metres away for 20 seconds.', hi: '20-20-20: 20 सेकंड तक 6 मीटर दूर देखें।' } },
  walk: { url: '/break?kind=stretch',
    title: { en: 'Move break 🚶', hi: 'चलने का ब्रेक 🚶' },
    body: { en: 'Walk over to a colleague, refill your bottle or take the stairs.', hi: 'किसी साथी के पास चलकर जाएँ, बोतल भरें या सीढ़ियाँ लें।' } },
};
