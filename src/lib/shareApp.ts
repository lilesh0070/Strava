// "Share this app": a message with the download link for the newest Android APK, so anyone can
// install TBDI FitTrack. From the Friends screen it also carries your friend ID.
import { Platform, Share } from 'react-native';
import { inviteText } from './invite';
import type { Key } from './strings';
import { latestApkLink, releasePageLink } from './updates';

export async function shareApp(t: (k: Key) => string, friendCode?: string | null) {
  // from an iPhone, send the release page (Android APK + iPhone .ipa for AltStore) instead of the APK itself
  const ios = Platform.OS === 'ios';
  const url = ios ? releasePageLink() : await latestApkLink();
  await Share.share({ message: inviteText(t(ios ? 'app.shareMsgAll' : 'app.shareMsg'), url, friendCode ? t('app.shareMsgId') : null, friendCode) });
}
