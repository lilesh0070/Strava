// Guided micro-break: desk stretch, box breathing or a 20-20-20 eye break. Timed with the wall
// clock (accurate even if the JS thread is busy), spoken in the app language, logged on completion.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, ScrollView, Text, View } from 'react-native';
import GoalRing from '../components/GoalRing';
import { IconWell, NeuButton, NeuCard, NeuProgress, NeuSegmented } from '../components/Neu';
import { BOX_PHASE_SEC, BREATHE_PHASES, EYES_SEC, STRETCH, STRETCH_SEC, isBreakKind, type BreakKind } from '../lib/breaks';
import { fill } from '../lib/health';
import { speechLanguage, useT } from '../lib/i18n';
import { getSettings } from '../lib/storage';
import { useTheme } from '../lib/theme';
import { logBreak, logMindful } from '../lib/wellnessStore';

type Phase = 'intro' | 'running' | 'paused' | 'done';

function KeepAwake() { useKeepAwake(); return null; }

/** Elapsed seconds of a pausable session, measured with the wall clock. */
function useClock(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const base = useRef(0); // seconds banked before the current run
  const since = useRef(0);
  useEffect(() => {
    if (!running) { base.current = elapsed; return; }
    since.current = Date.now();
    const id = setInterval(() => setElapsed(base.current + (Date.now() - since.current) / 1000), 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);
  const reset = (to = 0) => { base.current = to; since.current = Date.now(); setElapsed(to); };
  return { elapsed, reset };
}

export default function BreakScreen() {
  const { C, F } = useTheme();
  const { t, lang } = useT();
  const params = useLocalSearchParams<{ kind?: string }>();
  const kind: BreakKind = isBreakKind(params.kind) ? params.kind : 'stretch';
  const [phase, setPhase] = useState<Phase>('intro');
  const [minutes, setMinutes] = useState<'1' | '2' | '3'>('2');
  const [voice, setVoice] = useState(true);
  const [loggedText, setLoggedText] = useState('');
  const { elapsed, reset } = useClock(phase === 'running');
  const logged = useRef(false);

  useEffect(() => { getSettings().then((s) => setVoice(s.voiceCues)).catch(() => undefined); }, []);
  useEffect(() => () => { Speech.stop(); }, []);
  const say = (text: string) => { if (voice) { Speech.stop(); Speech.speak(text, { language: speechLanguage(lang), rate: 0.95 }); } };

  const total = kind === 'stretch' ? STRETCH_SEC : kind === 'eyes' ? EYES_SEC : Number(minutes) * 60;
  const title = t(kind === 'stretch' ? 'b.stretchTitle' : kind === 'eyes' ? 'b.eyesTitle' : 'b.breatheTitle');

  // ----- stretch: which move are we on? -----
  let moveIdx = 0, moveStart = 0;
  if (kind === 'stretch') {
    while (moveIdx < STRETCH.length - 1 && elapsed >= moveStart + STRETCH[moveIdx].sec) { moveStart += STRETCH[moveIdx].sec; moveIdx++; }
  }
  const move = STRETCH[moveIdx];
  const moveLeft = Math.max(0, Math.ceil(moveStart + move.sec - elapsed));

  // ----- breathing: which phase? -----
  const breathIdx = Math.floor(elapsed / BOX_PHASE_SEC) % 4;
  const breathLeft = Math.max(1, Math.ceil(BOX_PHASE_SEC - (elapsed % BOX_PHASE_SEC)));
  const scale = useRef(new Animated.Value(0.55)).current;

  // cues when the step changes
  const step = phase === 'running' ? (kind === 'stretch' ? moveIdx : kind === 'breathe' ? Math.floor(elapsed / BOX_PHASE_SEC) : 0) : -1;
  useEffect(() => {
    if (step < 0) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    if (kind === 'stretch') say(`${move.name[lang]}. ${move.how[lang]}`);
    if (kind === 'eyes') say(t('b.eyesBody'));
    if (kind === 'breathe') {
      const target = breathIdx === 0 ? 1 : breathIdx === 2 ? 0.55 : null;
      if (target != null) Animated.timing(scale, { toValue: target, duration: BOX_PHASE_SEC * 1000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }).start();
      if (voice && step < 8) say(t(BREATHE_PHASES[breathIdx])); // speak the first two rounds, then let them breathe in silence
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);
  useEffect(() => { if (phase !== 'running') scale.stopAnimation(); }, [phase, scale]);

  const finish = (completed: boolean) => {
    if (logged.current) return;
    if (kind === 'breathe') {
      const mins = elapsed >= 45 ? Math.max(1, Math.round(elapsed / 60)) : 0;
      if (mins) { logged.current = true; logMindful(mins); setLoggedText(fill(t('b.loggedMind'), { n: mins })); }
    } else if (completed || elapsed >= total * 0.6) {
      logged.current = true;
      logBreak(kind === 'eyes' ? 'eyes' : 'stretch');
      setLoggedText(t('b.logged'));
    }
    Speech.stop();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    setPhase('done');
  };
  useEffect(() => { if (phase === 'running' && elapsed >= total) finish(true); });

  const start = () => { logged.current = false; setLoggedText(''); reset(0); scale.setValue(0.55); setPhase('running'); };

  return (
    <>
      <Stack.Screen options={{ title }} />
      {phase === 'running' && <KeepAwake />}
      <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 60, flexGrow: 1 }}>
        {phase === 'intro' && (
          <NeuCard radius={30} style={{ alignItems: 'center', gap: 18, paddingVertical: 28 }}>
            <IconWell icon={kind === 'stretch' ? 'human-handsup' : kind === 'eyes' ? 'eye-outline' : 'meditation'} size={96} />
            <Text style={[F.h1, { textAlign: 'center' }]}>{title}</Text>
            <Text style={{ color: C.muted, textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
              {t(kind === 'stretch' ? 'b.stretchIntro' : kind === 'eyes' ? 'b.eyesIntro' : 'b.breatheIntro')}
            </Text>
            {kind === 'breathe' && (
              <View style={{ alignSelf: 'stretch' }}>
                <NeuSegmented value={minutes} onChange={setMinutes}
                  options={(['1', '2', '3'] as const).map((m) => ({ key: m, label: fill(t('b.minutes'), { n: m }) }))} />
              </View>
            )}
            {kind === 'stretch' && <Text style={{ color: C.muted, fontSize: 12, textAlign: 'center' }}>{t('b.safety')}</Text>}
            <NeuButton accent icon="play" label={t('b.start')} onPress={start} style={{ alignSelf: 'stretch' }} />
          </NeuCard>
        )}

        {(phase === 'running' || phase === 'paused') && (
          <>
            <NeuProgress value={elapsed / total} />
            {kind === 'stretch' && (
              <NeuCard radius={30} style={{ alignItems: 'center', gap: 16, paddingVertical: 26 }}>
                <Text style={F.label}>{moveIdx + 1} / {STRETCH.length}</Text>
                <IconWell icon={move.icon as never} size={96} />
                <Text style={[F.h1, { fontSize: 24, textAlign: 'center' }]}>{move.name[lang]}</Text>
                <Text style={{ color: C.text, textAlign: 'center', fontSize: 16, lineHeight: 23 }}>{move.how[lang]}</Text>
                <GoalRing value={moveLeft / move.sec} label={String(moveLeft)} sub="s" size={104} />
                {moveIdx < STRETCH.length - 1 && (
                  <Text style={{ color: C.muted, fontSize: 13 }}>{fill(t('b.next'), { s: STRETCH[moveIdx + 1].name[lang] })}</Text>
                )}
              </NeuCard>
            )}
            {kind === 'breathe' && (
              <NeuCard radius={30} style={{ alignItems: 'center', gap: 18, paddingVertical: 30 }}>
                <View style={{ width: 230, height: 230, alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115,
                    backgroundColor: C.accent, opacity: 0.18, transform: [{ scale }] }} />
                  <Animated.View style={{ position: 'absolute', width: 170, height: 170, borderRadius: 85,
                    backgroundColor: C.accent, opacity: 0.35, transform: [{ scale }] }} />
                  <Text style={{ color: C.text, fontSize: 22, fontWeight: '800' }}>{t(BREATHE_PHASES[breathIdx])}</Text>
                  <Text style={{ color: C.muted, fontSize: 32, fontWeight: '900', fontVariant: ['tabular-nums'] }}>{breathLeft}</Text>
                </View>
                <Text style={{ color: C.muted, fontVariant: ['tabular-nums'] }}>
                  {Math.floor(Math.max(0, total - elapsed) / 60)}:{String(Math.floor(Math.max(0, total - elapsed) % 60)).padStart(2, '0')}
                </Text>
              </NeuCard>
            )}
            {kind === 'eyes' && (
              <NeuCard radius={30} style={{ alignItems: 'center', gap: 18, paddingVertical: 30 }}>
                <IconWell icon="eye-outline" size={96} />
                <Text style={{ color: C.text, textAlign: 'center', fontSize: 17, lineHeight: 25 }}>{t('b.eyesBody')}</Text>
                <GoalRing value={(total - elapsed) / total} label={String(Math.max(0, Math.ceil(total - elapsed)))} sub="s" size={120} />
              </NeuCard>
            )}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <NeuButton icon={phase === 'running' ? 'pause' : 'play'} label={t(phase === 'running' ? 'b.pause' : 'b.resume')}
                style={{ flex: 1 }} onPress={() => setPhase(phase === 'running' ? 'paused' : 'running')} />
              {kind === 'stretch' && moveIdx < STRETCH.length - 1 && (
                <NeuButton icon="skip-next" label={t('b.skip')} style={{ flex: 1 }} onPress={() => reset(moveStart + move.sec)} />
              )}
              <NeuButton icon="check" label={t('b.done')} style={{ flex: 1 }} onPress={() => finish(false)} />
            </View>
          </>
        )}

        {phase === 'done' && (
          <NeuCard radius={30} style={{ alignItems: 'center', gap: 16, paddingVertical: 30 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: C.success, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialCommunityIcons name="check" size={52} color="#fff" />
            </View>
            <Text style={[F.h1, { textAlign: 'center', fontSize: 24 }]}>{loggedText || title}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
              <NeuButton icon="restart" label={t('b.again')} style={{ flex: 1 }} onPress={start} />
              <NeuButton accent icon="check" label={t('b.done')} style={{ flex: 1 }} onPress={() => (router.canGoBack() ? router.back() : router.replace('/health'))} />
            </View>
          </NeuCard>
        )}
      </ScrollView>
    </>
  );
}
