import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { toGpx } from './coach';
import { sportInfo, type Activity } from './types';

export async function shareGpx(a: Activity) {
  const safe = a.name.replace(/[^a-z0-9-_ ]/gi, '').trim().replace(/\s+/g, '_') || 'activity';
  const file = new File(Paths.cache, `${safe}_${a.id}.gpx`);
  file.create({ overwrite: true });
  await file.write(toGpx(a.name, sportInfo(a.sport).label.toLowerCase(), a.startedAt, a.segments)); // async in SDK 58
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device');
  await Sharing.shareAsync(file.uri, { mimeType: 'application/gpx+xml', dialogTitle: 'Export GPX', UTI: 'com.topografix.gpx' });
}
