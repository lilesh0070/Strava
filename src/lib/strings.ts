// Tiny i18n: English + Hindi. Strings are looked up by key; missing Hindi falls back to English.

export type Lang = 'en' | 'hi';

const en = {
  'tab.feed': 'Feed', 'tab.record': 'Record', 'tab.you': 'You',
  'feed.thisWeek': 'This week', 'feed.activities': 'activities', 'feed.search': 'Search activities', 'feed.all': 'All',
  'feed.emptyTitle': 'No activities yet', 'feed.emptyBody': 'Record your first run, ride or walk and it will show up here.',
  'feed.start': 'Start recording', 'feed.noMatch': 'No activities match.',
  'feed.vsLast': 'vs this time last week', 'feed.nothingLast': 'Nothing at this point last week',
  'rec.choose': 'Choose a sport', 'rec.free': 'Free run · choose workout', 'rec.time': 'Time', 'rec.distance': 'Distance',
  'rec.paceNow': 'Pace now', 'rec.speedNow': 'Speed now', 'rec.avgPace': 'Avg pace', 'rec.avgSpeed': 'Avg speed', 'rec.lap': 'Lap',
  'rec.lapDist': 'Lap dist', 'rec.paused': 'PAUSED', 'rec.autoPaused': 'AUTO-PAUSED · start moving to resume',
  'rec.gpsLost': 'GPS signal lost', 'rec.finding': 'Finding GPS…', 'rec.weak': 'Weak GPS', 'rec.keepOpen': 'Keep the app open while recording',
  'rec.finishQ': 'Finish activity?', 'rec.resume': 'Resume', 'rec.discard': 'Discard', 'rec.save': 'Save', 'rec.cancel': 'Cancel',
  'rec.weakTitle': 'GPS signal is weak', 'rec.noGpsTitle': 'No GPS signal yet',
  'rec.weakBody': 'Your route may be inaccurate for the first minute. Waiting a few seconds in open sky usually fixes it.',
  'rec.wait': 'Wait', 'rec.anyway': 'Start anyway', 'rec.nice': 'Nice work!',
  'rec.approx': 'Approximate location · tap to fix', 'rec.locOff': 'Location is off · tap to fix',
  'rec.approxTitle': 'Precise location is off',
  'rec.approxBody': 'Stride only gets an approximate position, so your route and distance can be off by hundreds of metres. Turn on “Use precise location” for Stride.',
  'rec.locOffTitle': 'Location is off', 'rec.locOffBody': 'Turn on location (GPS) on your phone to record your route.',
  'rec.openSettings': 'Open settings',
  'set.updates': 'App updates', 'set.appearance': 'Appearance', 'set.language': 'Language', 'set.recording': 'Recording',
  'set.motivation': 'Motivation', 'set.data': 'Your data', 'set.about': 'About',
  'set.voice': 'Voice updates', 'set.voiceSub': 'Time and pace every kilometre',
  'set.autoPause': 'Auto-pause', 'set.autoPauseSub': 'Pause when you stop, resume when you go',
  'set.countdown': 'Start countdown', 'set.countdownSub': '3-second countdown before recording',
  'set.check': 'Check for updates', 'set.checkAuto': 'Check automatically', 'set.checkAutoSub': 'Look for updates when the app opens',
  'ob.skip': 'Skip', 'ob.next': 'Next', 'ob.go': "Let's go",
  'ob.1t': 'Every step counts', 'ob.1b': 'Record runs, rides, walks and hikes with accurate GPS — even with the screen off.',
  'ob.2t': 'A coach in your ear', 'ob.2b': 'Voice updates every kilometre, interval workouts and a pace coach that keeps you on target.',
  'ob.3t': 'Your data, your phone', 'ob.3b': 'Everything stays on this phone. Back it up to your own GitHub whenever you like.',
  'ob.4t': 'What should we call you?', 'ob.4b': 'Location access is asked only when you start recording, and is used only to draw your route.',
  'ob.name': 'Your name',
  'toast.deleted': 'Activity deleted', 'toast.undo': 'Undo',
};

export type Key = keyof typeof en;

const hi: Partial<Record<Key, string>> = {
  'tab.feed': 'फ़ीड', 'tab.record': 'रिकॉर्ड', 'tab.you': 'आप',
  'feed.thisWeek': 'इस हफ़्ते', 'feed.activities': 'एक्टिविटी', 'feed.search': 'एक्टिविटी खोजें', 'feed.all': 'सभी',
  'feed.emptyTitle': 'अभी कोई एक्टिविटी नहीं', 'feed.emptyBody': 'अपनी पहली दौड़, राइड या वॉक रिकॉर्ड करें, वह यहाँ दिखेगी।',
  'feed.start': 'रिकॉर्डिंग शुरू करें', 'feed.noMatch': 'कोई एक्टिविटी नहीं मिली।',
  'feed.vsLast': 'पिछले हफ़्ते के इसी समय से', 'feed.nothingLast': 'पिछले हफ़्ते इस समय तक कुछ नहीं',
  'rec.choose': 'खेल चुनें', 'rec.free': 'फ़्री रन · वर्कआउट चुनें', 'rec.time': 'समय', 'rec.distance': 'दूरी',
  'rec.paceNow': 'अभी की पेस', 'rec.speedNow': 'अभी की स्पीड', 'rec.avgPace': 'औसत पेस', 'rec.avgSpeed': 'औसत स्पीड', 'rec.lap': 'लैप',
  'rec.lapDist': 'लैप दूरी', 'rec.paused': 'रुका हुआ', 'rec.autoPaused': 'ऑटो-पॉज़ · चलना शुरू करें',
  'rec.gpsLost': 'GPS सिग्नल नहीं', 'rec.finding': 'GPS ढूँढ रहे हैं…', 'rec.weak': 'कमज़ोर GPS', 'rec.keepOpen': 'रिकॉर्डिंग के दौरान ऐप खुला रखें',
  'rec.finishQ': 'एक्टिविटी ख़त्म करें?', 'rec.resume': 'जारी रखें', 'rec.discard': 'हटाएँ', 'rec.save': 'सेव करें', 'rec.cancel': 'रद्द करें',
  'rec.weakTitle': 'GPS सिग्नल कमज़ोर है', 'rec.noGpsTitle': 'अभी GPS सिग्नल नहीं',
  'rec.weakBody': 'पहले एक मिनट रास्ता थोड़ा ग़लत हो सकता है। खुले आसमान में कुछ सेकंड रुकने से आमतौर पर ठीक हो जाता है।',
  'rec.wait': 'रुकें', 'rec.anyway': 'फिर भी शुरू करें', 'rec.nice': 'शाबाश!',
  'rec.approx': 'अनुमानित लोकेशन · ठीक करने के लिए टैप करें', 'rec.locOff': 'लोकेशन बंद है · ठीक करने के लिए टैप करें',
  'rec.approxTitle': 'सटीक लोकेशन बंद है',
  'rec.approxBody': 'Stride को सिर्फ़ अनुमानित लोकेशन मिल रही है, इसलिए रास्ता और दूरी सैकड़ों मीटर ग़लत हो सकती है। Stride के लिए “सटीक लोकेशन” चालू करें।',
  'rec.locOffTitle': 'लोकेशन बंद है', 'rec.locOffBody': 'रास्ता रिकॉर्ड करने के लिए फ़ोन में लोकेशन (GPS) चालू करें।',
  'rec.openSettings': 'सेटिंग्स खोलें',
  'set.updates': 'ऐप अपडेट', 'set.appearance': 'दिखावट', 'set.language': 'भाषा', 'set.recording': 'रिकॉर्डिंग',
  'set.motivation': 'प्रेरणा', 'set.data': 'आपका डेटा', 'set.about': 'जानकारी',
  'set.voice': 'आवाज़ में अपडेट', 'set.voiceSub': 'हर किलोमीटर पर समय और पेस',
  'set.autoPause': 'ऑटो-पॉज़', 'set.autoPauseSub': 'रुकने पर रुके, चलने पर फिर शुरू',
  'set.countdown': 'शुरू से पहले गिनती', 'set.countdownSub': 'रिकॉर्डिंग से पहले 3 सेकंड की गिनती',
  'set.check': 'अपडेट देखें', 'set.checkAuto': 'अपने आप जाँचें', 'set.checkAutoSub': 'ऐप खुलने पर अपडेट देखें',
  'ob.skip': 'छोड़ें', 'ob.next': 'आगे', 'ob.go': 'चलो शुरू करें',
  'ob.1t': 'हर कदम मायने रखता है', 'ob.1b': 'दौड़, राइड, वॉक और हाइक सटीक GPS से रिकॉर्ड करें — स्क्रीन बंद होने पर भी।',
  'ob.2t': 'कान में आपका कोच', 'ob.2b': 'हर किलोमीटर पर आवाज़ में अपडेट, इंटरवल वर्कआउट और पेस कोच।',
  'ob.3t': 'आपका डेटा, आपका फ़ोन', 'ob.3b': 'सब कुछ इसी फ़ोन में रहता है। जब चाहें अपने GitHub पर बैकअप लें।',
  'ob.4t': 'आपको क्या बुलाएँ?', 'ob.4b': 'लोकेशन की अनुमति सिर्फ़ रिकॉर्डिंग शुरू करते समय माँगी जाती है, और सिर्फ़ रास्ता बनाने के लिए।',
  'ob.name': 'आपका नाम',
  'toast.deleted': 'एक्टिविटी हटा दी गई', 'toast.undo': 'वापस लाएँ',
};

export function translate(lang: Lang, key: Key): string {
  return (lang === 'hi' ? hi[key] : undefined) ?? en[key];
}

// ---------- spoken cues ----------
const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;

function spokenDurationHi(sec: number) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h} घंटे`);
  if (m) parts.push(`${m} मिनट`);
  if (s || !parts.length) parts.push(`${s} सेकंड`);
  return parts.join(' ');
}

export function kmCueHi(km: number, movingSec: number, usesPace: boolean) {
  const head = `${km} किलोमीटर पूरे। समय ${spokenDurationHi(movingSec)}।`;
  if (usesPace) return `${head} औसत पेस ${spokenDurationHi(movingSec / km)} प्रति किलोमीटर।`;
  return `${head} औसत स्पीड ${((km * 3600) / movingSec).toFixed(1)} किलोमीटर प्रति घंटा।`;
}

export const voicePhrases = {
  en: { paused: 'Auto paused', resumed: 'Resumed', faster: 'Pick up the pace', slower: 'Ease off a little, you are ahead of target',
    lap: (no: number, km: string, sec: number) => `Lap ${no}. ${km} kilometres in ${n(Math.floor(sec / 60), 'minute', 'minutes')} ${n(Math.round(sec % 60), 'second', 'seconds')}.` },
  hi: { paused: 'ऑटो पॉज़', resumed: 'फिर से शुरू', faster: 'थोड़ा तेज़ चलिए', slower: 'थोड़ा धीमे, आप टारगेट से आगे हैं',
    lap: (no: number, km: string, sec: number) => `लैप ${no}। ${km} किलोमीटर, ${spokenDurationHi(sec)} में।` },
};
export const speechLanguage = (lang: Lang) => (lang === 'hi' ? 'hi-IN' : 'en-US');
