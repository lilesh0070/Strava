// JS side of the local Instagram story module. Optional: absent on web, iOS and in older builds,
// in which case the share screen falls back to "save sticker + open Instagram".
import { requireOptionalNativeModule } from 'expo';

type InstagramStoryModule = {
  isInstagramInstalled(): boolean;
  shareStickerToStory(stickerContentUri: string, facebookAppId: string, topColor: string, bottomColor: string): boolean;
};

export const InstagramStory = requireOptionalNativeModule<InstagramStoryModule>('InstagramStory');
