// Friends: your friend ID, adding friends by their ID, requests, and this week's leaderboard.
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { IconWell, NeuButton, NeuCard, NeuProgress, NeuSegmented, NeuTile } from '../components/Neu';
import type { BoardPeriod, BoardRow, FriendRequest } from '../lib/friends';
import { friends, friendsAvailable } from '../lib/friendsApp';
import { useT } from '../lib/i18n';
import { shareApp } from '../lib/shareApp';
import { useTheme } from '../lib/theme';

type State = { enabled: boolean; code: string | null; board: BoardRow[]; incoming: FriendRequest[]; outgoing: FriendRequest[] };
const EMPTY: State = { enabled: false, code: null, board: [], incoming: [], outgoing: [] };
const message = (e: unknown) => String((e as Error)?.message ?? e);
const MEDALS = ['🥇', '🥈', '🥉'];

export default function FriendsScreen() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const [st, setSt] = useState<State | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [input, setInput] = useState('');
  const [period, setPeriod] = useState<BoardPeriod>('week');

  const load = useCallback(async () => {
    if (!friends) return;
    try {
      if (!(await friends.isEnabled())) { setSt(EMPTY); return; }
      const code = await friends.myCode(); // stored on the phone: shown even when offline
      setSt((s) => ({ ...(s ?? EMPTY), enabled: true, code }));
      const [board, incoming, outgoing] = await Promise.all([friends.board(period), friends.incoming(), friends.outgoing()]);
      setSt({ enabled: true, code, board, incoming, outgoing });
      setError(null);
    } catch (e) {
      setError(message(e));
    }
  }, [period]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  /** Run an action, then reload; problems are shown as an alert. */
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); }
    catch (e) { Alert.alert(t('fr.title'), message(e)); }
    finally { setBusy(false); load(); }
  };

  const input$ = { color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 18, fontWeight: '700' as const, letterSpacing: 1 };

  if (!friendsAvailable || !friends) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <NeuCard radius={28} style={{ gap: 12 }}>
          <IconWell icon="cloud-off-outline" />
          <Text style={F.h2}>{t('fr.setupTitle')}</Text>
          <Text style={{ color: C.muted }}>{t('fr.setupBody')}</Text>
        </NeuCard>
      </ScrollView>
    );
  }
  if (!st) return <ActivityIndicator style={{ marginTop: 40 }} color={C.accent} />;

  if (!st.enabled) {
    return (
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <NeuCard radius={30} style={{ gap: 14, alignItems: 'center', paddingVertical: 28 }}>
          <IconWell icon="account-group-outline" size={64} />
          <Text style={[F.h2, { textAlign: 'center' }]}>{t('fr.introTitle')}</Text>
          <Text style={{ color: C.muted, textAlign: 'center', lineHeight: 20 }}>{t('fr.introBody')}</Text>
          <NeuButton accent icon="account-plus-outline" label={t('fr.turnOn')} disabled={busy}
            onPress={() => run(() => friends!.enable())} style={{ alignSelf: 'stretch', marginTop: 6 }} />
          {busy && <ActivityIndicator color={C.accent} />}
        </NeuCard>
        {error && <Text style={{ color: C.danger }}>{error}</Text>}
      </ScrollView>
    );
  }

  const maxKm = Math.max(1, ...st.board.map((r) => r.weekKm));
  return (
    <ScrollView contentContainerStyle={{ padding: 20, gap: 22, paddingBottom: 60 }} keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.accent}
        onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
      {error && <Text style={{ color: C.danger }}>{error}</Text>}

      <NeuCard radius={28} style={{ gap: 12, alignItems: 'center' }}>
        <Text style={F.label}>{t('fr.yourId')}</Text>
        <Text selectable style={{ color: C.accentInk, fontSize: 30, fontWeight: '900', letterSpacing: 3 }}>{st.code ?? '—'}</Text>
        {st.code && (
          <NeuButton small icon="share-variant" label={t('fr.shareId')}
            onPress={() => shareApp(t, st.code).catch(() => undefined)} />
        )}
      </NeuCard>

      <NeuCard radius={28} style={{ gap: 12 }}>
        <Text style={F.h2}>{t('fr.add')}</Text>
        <Text style={{ color: C.muted, fontSize: 13 }}>{t('fr.addHint')}</Text>
        <TextInput value={input} onChangeText={setInput} placeholder="STR-7K3P9" placeholderTextColor={C.muted}
          autoCapitalize="characters" autoCorrect={false} style={input$} accessibilityLabel={t('fr.add')}
          onSubmitEditing={() => input.trim() && run(async () => { const r = await friends!.sendRequest(input); setInput(''); Alert.alert(t('fr.title'), r === 'accepted' ? t('fr.accepted') : t('fr.sent')); })} />
        <NeuButton accent icon="send" label={t('fr.send')} disabled={busy || !input.trim()}
          onPress={() => run(async () => { const r = await friends!.sendRequest(input); setInput(''); Alert.alert(t('fr.title'), r === 'accepted' ? t('fr.accepted') : t('fr.sent')); })} />
      </NeuCard>

      {st.incoming.length > 0 && (
        <NeuCard radius={28} style={{ gap: 12 }}>
          <Text style={F.h2}>{t('fr.requests')}</Text>
          {st.incoming.map((r) => (
            <NeuCard key={r.from} inset radius={20} padding={12} style={{ gap: 10 }}>
              <Text style={{ color: C.text, fontWeight: '700' }}>{r.fromName || r.fromCode} <Text style={{ color: C.muted, fontWeight: '400' }}>{r.fromCode}</Text></Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <NeuButton small accent label={t('fr.accept')} disabled={busy} style={{ flex: 1 }} onPress={() => run(() => friends!.accept(r))} />
                <NeuButton small label={t('fr.decline')} disabled={busy} style={{ flex: 1 }} onPress={() => run(() => friends!.decline(r))} />
              </View>
            </NeuCard>
          ))}
        </NeuCard>
      )}

      {st.outgoing.length > 0 && (
        <NeuCard radius={28} style={{ gap: 10 }}>
          {st.outgoing.map((r) => (
            <View key={r.to} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="clock-outline" size={18} color={C.muted} />
              <Text style={{ color: C.muted, flex: 1 }}>{t('fr.waiting')} {r.toCode}</Text>
              <NeuButton small label={t('fr.cancel')} disabled={busy} onPress={() => run(() => friends!.cancel(r))} />
            </View>
          ))}
        </NeuCard>
      )}

      <NeuCard radius={28} style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconWell icon="trophy-outline" />
          <Text style={F.h2}>{period === 'week' ? t('fr.thisWeek') : period === 'month' ? t('fr.month') : t('fr.allTime')}</Text>
        </View>
        <NeuSegmented value={period} onChange={setPeriod}
          options={[{ key: 'week', label: t('fr.week') }, { key: 'month', label: t('fr.month') }, { key: 'all', label: t('fr.allTime') }]} />
        {st.board.map((r) => (
          <Pressable key={r.uid} accessibilityRole={r.me ? undefined : 'button'} accessibilityHint={r.me ? undefined : t('fr.remove')}
            onLongPress={r.me ? undefined : () => Alert.alert(r.name, t('fr.removeQ'), [
              { text: t('fr.cancel'), style: 'cancel' },
              { text: t('fr.remove'), style: 'destructive', onPress: () => run(() => friends!.removeFriend(r.uid)) },
            ])}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 20, backgroundColor: C.bg,
              boxShadow: r.me ? S.insetSm : S.raisedSm }}>
            <Text style={{ width: 34, textAlign: 'center', fontSize: r.rank <= 3 ? 22 : 15, fontWeight: '800', color: C.muted }}>
              {r.rank <= 3 ? MEDALS[r.rank - 1] : r.rank}
            </Text>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={{ color: r.me ? C.accent : C.text, fontWeight: '700' }} numberOfLines={1}>{r.me ? `${r.name} · ${t('fr.you')}` : r.name}</Text>
              <NeuProgress value={r.weekKm / maxKm} />
            </View>
            <Text style={{ color: C.text, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{r.weekKm.toFixed(1)} km</Text>
          </Pressable>
        ))}
        {st.board.length <= 1 && <Text style={{ color: C.muted }}>{t('fr.noFriends')}</Text>}
      </NeuCard>

      <NeuTile icon="account-off-outline" title={t('fr.turnOff')} subtitle={t('fr.turnOffQ')}
        onPress={() => Alert.alert(t('fr.turnOff'), t('fr.turnOffQ'), [
          { text: t('fr.cancel'), style: 'cancel' },
          { text: t('fr.turnOff'), style: 'destructive', onPress: () => run(() => friends!.disable()) },
        ])} />
    </ScrollView>
  );
}
