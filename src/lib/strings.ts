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
  'rec.saveFailed': 'Could not save', 'rec.saveFailedBody': 'Your recording is safe. Tap the finish flag to try again.',
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
  'fr.title': 'Friends', 'fr.leaderboard': 'Friends leaderboard', 'fr.leaderboardSub': "Compare this week's km with friends",
  'fr.introTitle': 'Run with friends', 'fr.introBody': "Add friends with their friend ID and see who covers the most distance this week. Friends only see your name and this week's km, never your routes or locations.",
  'fr.turnOn': 'Turn on friends', 'fr.yourId': 'Your friend ID', 'fr.shareId': 'Share my ID', 'fr.shareMsg': 'Add me as a friend on Stride. My friend ID is',
  'fr.add': 'Add a friend', 'fr.addHint': "Enter your friend's ID (e.g. STR-7K3P9). They get a request to accept.", 'fr.send': 'Send request',
  'fr.sent': 'Request sent. It shows up once they accept.', 'fr.accepted': 'You are now friends!',
  'fr.requests': 'Friend requests', 'fr.accept': 'Accept', 'fr.decline': 'Decline', 'fr.waiting': 'Waiting for', 'fr.cancel': 'Cancel',
  'fr.thisWeek': 'This week', 'fr.you': 'You', 'fr.noFriends': 'No friends yet. Share your ID or add theirs.',
  'fr.remove': 'Remove friend', 'fr.removeQ': 'Remove this friend? You stop seeing each other on the leaderboard.',
  'fr.turnOff': 'Turn off friends', 'fr.turnOffQ': 'This removes all your friends and stops sharing your km. Your activities stay on this phone.',
  'fr.setupTitle': 'Friends are not set up yet', 'fr.setupBody': 'This build has no Firebase project configured. See "Friends & leaderboard" in the README.',
  'fr.updated': 'updated', 'fr.settingsSub': 'Add friends and compare weekly km',
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
  'rec.saveFailed': 'सेव नहीं हो पाया', 'rec.saveFailedBody': 'आपकी रिकॉर्डिंग सुरक्षित है। फिर से कोशिश करने के लिए फ़िनिश फ़्लैग दबाएँ।',
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
  'fr.title': 'दोस्त', 'fr.leaderboard': 'दोस्तों का लीडरबोर्ड', 'fr.leaderboardSub': 'इस हफ़्ते के किलोमीटर दोस्तों से मिलाएँ',
  'fr.introTitle': 'दोस्तों के साथ दौड़ें', 'fr.introBody': 'दोस्तों को उनकी फ़्रेंड ID से जोड़ें और देखें इस हफ़्ते सबसे ज़्यादा दूरी किसने तय की। दोस्त सिर्फ़ आपका नाम और इस हफ़्ते के किलोमीटर देखते हैं, आपका रास्ता या लोकेशन कभी नहीं।',
  'fr.turnOn': 'दोस्त फ़ीचर चालू करें', 'fr.yourId': 'आपकी फ़्रेंड ID', 'fr.shareId': 'अपनी ID भेजें', 'fr.shareMsg': 'Stride पर मुझे दोस्त बनाएँ। मेरी फ़्रेंड ID है',
  'fr.add': 'दोस्त जोड़ें', 'fr.addHint': 'दोस्त की ID डालें (जैसे STR-7K3P9)। उन्हें एक रिक्वेस्ट जाएगी।', 'fr.send': 'रिक्वेस्ट भेजें',
  'fr.sent': 'रिक्वेस्ट भेज दी। उनके मानने पर वो यहाँ दिखेंगे।', 'fr.accepted': 'अब आप दोस्त हैं!',
  'fr.requests': 'फ़्रेंड रिक्वेस्ट', 'fr.accept': 'मानें', 'fr.decline': 'मना करें', 'fr.waiting': 'इंतज़ार:', 'fr.cancel': 'रद्द करें',
  'fr.thisWeek': 'इस हफ़्ते', 'fr.you': 'आप', 'fr.noFriends': 'अभी कोई दोस्त नहीं। अपनी ID भेजें या उनकी डालें।',
  'fr.remove': 'दोस्त हटाएँ', 'fr.removeQ': 'इस दोस्त को हटाएँ? आप एक-दूसरे को लीडरबोर्ड पर नहीं देखेंगे।',
  'fr.turnOff': 'दोस्त फ़ीचर बंद करें', 'fr.turnOffQ': 'इससे सारे दोस्त हट जाएँगे और आपके किलोमीटर शेयर होना बंद हो जाएगा। आपकी एक्टिविटी इसी फ़ोन में रहेंगी।',
  'fr.setupTitle': 'दोस्त फ़ीचर अभी सेट नहीं है', 'fr.setupBody': 'इस बिल्ड में Firebase प्रोजेक्ट नहीं जुड़ा है। README में "Friends & leaderboard" देखें।',
  'fr.updated': 'अपडेट', 'fr.settingsSub': 'दोस्त जोड़ें और हफ़्ते के किलोमीटर मिलाएँ',
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
    lap: (no: number, km: string, sec: number) => { const s = Math.round(sec); return `Lap ${no}. ${km} kilometres in ${n(Math.floor(s / 60), 'minute', 'minutes')} ${n(s % 60, 'second', 'seconds')}.`; } },
  hi: { paused: 'ऑटो पॉज़', resumed: 'फिर से शुरू', faster: 'थोड़ा तेज़ चलिए', slower: 'थोड़ा धीमे, आप टारगेट से आगे हैं',
    lap: (no: number, km: string, sec: number) => `लैप ${no}। ${km} किलोमीटर, ${spokenDurationHi(sec)} में।` },
};
export const speechLanguage = (lang: Lang) => (lang === 'hi' ? 'hi-IN' : 'en-US');
