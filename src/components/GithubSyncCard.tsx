import { useEffect, useState } from 'react';
import { Alert, Linking, Text, TextInput, View } from 'react-native';
import { connect, disconnect, loadSyncMeta, pullFromGithub, pushToGithub, setAutoSync, useGithubSync } from '../lib/githubSync';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton, NeuCard, NeuSwitch } from './Neu';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=TBDI%20FitTrack%20backup';

export default function GithubSyncCard() {
  const { C, S, F } = useTheme();
  const { meta, busy } = useGithubSync();
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  useEffect(() => { loadSyncMeta(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: (v: never) => string) => {
    try { const v = await fn(); Alert.alert('Done', ok(v as never)); }
    catch (e) { Alert.alert('GitHub sync', String((e as Error)?.message ?? e)); }
  };

  return (
    <NeuCard radius={28} style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconWell icon="github" size={52} />
        <View style={{ flex: 1 }}>
          <Text style={F.h2}>GitHub cloud backup</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {meta.login ? `Connected as @${meta.login}` : 'Keep your activities safe in a private Gist on your GitHub'}
          </Text>
        </View>
      </View>

      {meta.login ? (
        <>
          <Text style={{ color: meta.lastError ? C.danger : C.text, fontSize: 13 }}>
            {busy ? 'Syncing…' : meta.lastError ? meta.lastError
              : meta.lastSyncAt ? `Last backup ${new Date(meta.lastSyncAt).toLocaleString()}` : 'Not backed up yet'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <NeuButton small accent icon="cloud-upload-outline" label="Back up now" style={{ flex: 1 }} disabled={busy}
              onPress={() => run(pushToGithub, (n: number) => `${n} activities saved to GitHub.`)} />
            <NeuButton small icon="cloud-download-outline" label="Restore" style={{ flex: 1 }} disabled={busy || !meta.gistId}
              onPress={() => run(pullFromGithub, (n: number) => `${n} activities merged from GitHub.`)} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: C.text, flex: 1 }}>Back up after every activity</Text>
            <NeuSwitch accessibilityLabel="Automatic GitHub backup" value={meta.auto} onValueChange={(v) => setAutoSync(v)} />
          </View>
          {meta.gistId ? (
            <NeuButton small icon="open-in-new" label="View backup on GitHub"
              onPress={() => Linking.openURL(`https://gist.github.com/${meta.login}/${meta.gistId}`)} />
          ) : null}
          <NeuButton small icon="link-off" label="Disconnect" onPress={() => Alert.alert('Disconnect GitHub?',
            'The token is removed from this phone. Your backup stays on GitHub.',
            [{ text: 'Cancel', style: 'cancel' }, { text: 'Disconnect', style: 'destructive', onPress: () => disconnect() }])} />
        </>
      ) : (
        <>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            1. Create a token with only the “gist” permission.{'\n'}2. Paste it here. It is stored encrypted on this phone.
          </Text>
          <NeuButton small icon="key-plus" label="Create token on GitHub" onPress={() => Linking.openURL(TOKEN_URL)} />
          <TextInput value={token} onChangeText={setToken} placeholder="ghp_… or github_pat_…" placeholderTextColor={C.muted}
            autoCapitalize="none" autoCorrect={false} secureTextEntry accessibilityLabel="GitHub token"
            style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 }} />
          <NeuButton accent icon="github" label={connecting ? 'Connecting…' : 'Connect'} disabled={connecting || !token.trim()}
            onPress={async () => {
              setConnecting(true);
              try { await connect(token); setToken(''); }
              catch (e) { Alert.alert('Could not connect', String((e as Error)?.message ?? e)); }
              finally { setConnecting(false); }
            }} />
        </>
      )}
    </NeuCard>
  );
}
