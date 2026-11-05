// "Share this app": a message with the download link for the newest Android APK, so anyone can
// install TBDI FitTrack. From the Friends screen it also carries your friend ID.
import { Share } from 'react-native';
import { inviteText } from './invite';
import type { Key } from './strings';
import { latestApkLink } from './updates';

export async function shareApp(t: (k: Key) => string, friendCode?: string | null) {
  const url = await latestApkLink();
  await Share.share({ message: inviteText(t('app.shareMsg'), url, friendCode ? t('app.shareMsgId') : null, friendCode) });
}
