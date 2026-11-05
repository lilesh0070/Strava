import { useEffect, useState } from 'react';
import { Alert, Linking, Text, TextInput, View } from 'react-native';
import { connect, disconnect, loadSyncMeta, pullFromGithub, pushToGithub, setAutoSync, useGithubSync } from '../lib/githubSync';
import { useT } from '../lib/i18n';
import { useTheme } from '../lib/theme';
import { IconWell, NeuButton, NeuCard, NeuSwitch } from './Neu';

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=TBDI%20FitTrack%20backup';

export default function GithubSyncCard() {
  const { C, S, F } = useTheme();
  const { t } = useT();
  const { meta, busy } = useGithubSync();
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  useEffect(() => { loadSyncMeta(); }, []);

  const run = async (fn: () => Promise<unknown>, ok: (v: never) => string) => {
    try { const v = await fn(); Alert.alert(t('gh.done'), ok(v as never)); }
    catch (e) { Alert.alert(t('gh.sync'), String((e as Error)?.message ?? e)); }
  };

  return (
    <NeuCard radius={28} style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <IconWell icon="github" size={52} />
        <View style={{ flex: 1 }}>
          <Text style={F.h2}>{t('gh.title')}</Text>
          <Text style={{ color: C.muted, fontSize: 12 }}>
            {meta.login ? t('gh.connectedAs').replace('{login}', meta.login) : t('gh.intro')}
          </Text>
        </View>
      </View>

      {meta.login ? (
        <>
          <Text style={{ color: meta.lastError ? C.danger : C.text, fontSize: 13 }}>
            {busy ? t('gh.syncing') : meta.lastError ? meta.lastError
              : meta.lastSyncAt ? t('gh.lastBackup').replace('{t}', new Date(meta.lastSyncAt).toLocaleString()) : t('gh.notYet')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <NeuButton small accent icon="cloud-upload-outline" label={t('gh.backupNow')} style={{ flex: 1 }} disabled={busy}
              onPress={() => run(pushToGithub, (n: number) => t('gh.saved').replace('{n}', String(n)))} />
            <NeuButton small icon="cloud-download-outline" label={t('gh.restore')} style={{ flex: 1 }} disabled={busy || !meta.gistId}
              onPress={() => run(pullFromGithub, (n: number) => t('gh.merged').replace('{n}', String(n)))} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Text style={{ color: C.text, flex: 1 }}>{t('gh.auto')}</Text>
            <NeuSwitch accessibilityLabel={t('gh.autoA11y')} value={meta.auto} onValueChange={(v) => setAutoSync(v)} />
          </View>
          {meta.gistId ? (
            <NeuButton small icon="open-in-new" label={t('gh.view')}
              onPress={() => Linking.openURL(`https://gist.github.com/${meta.login}/${meta.gistId}`)} />
          ) : null}
          <NeuButton small icon="link-off" label={t('gh.disconnect')} onPress={() => Alert.alert(t('gh.disconnectQ'), t('gh.disconnectBody'),
            [{ text: t('gh.cancel'), style: 'cancel' }, { text: t('gh.disconnect'), style: 'destructive', onPress: () => disconnect() }])} />
        </>
      ) : (
        <>
          <Text style={{ color: C.muted, fontSize: 12 }}>{t('gh.steps')}</Text>
          <NeuButton small icon="key-plus" label={t('gh.createToken')} onPress={() => Linking.openURL(TOKEN_URL)} />
          <TextInput value={token} onChangeText={setToken} placeholder="ghp_… or github_pat_…" placeholderTextColor={C.muted}
            autoCapitalize="none" autoCorrect={false} secureTextEntry accessibilityLabel={t('gh.tokenA11y')}
            style={{ color: C.text, backgroundColor: C.bg, boxShadow: S.insetSm, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 12 }} />
          <NeuButton accent icon="github" label={connecting ? t('gh.connecting') : t('gh.connect')} disabled={connecting || !token.trim()}
            onPress={async () => {
              setConnecting(true);
              try { await connect(token); setToken(''); }
              catch (e) { Alert.alert(t('gh.connectFailed'), String((e as Error)?.message ?? e)); }
              finally { setConnecting(false); }
            }} />
        </>
      )}
    </NeuCard>
  );
}
