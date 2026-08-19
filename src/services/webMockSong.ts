import { Asset } from 'expo-asset';
import { Platform } from 'react-native';
import * as db from '@/src/services/database';
import type { Song } from '@/src/types/music';

export const WEB_MOCK_SONG_ID = 'web-mock-midnight-echo';

const WEB_MOCK_AUDIO = require('../../assets/audio/midnight-echo.wav');

export async function ensureWebMockSong(): Promise<void> {
  if (Platform.OS !== 'web') return;

  const existing = await db.getSongById(WEB_MOCK_SONG_ID);
  if (existing) return;

  const asset = Asset.fromModule(WEB_MOCK_AUDIO);
  await asset.downloadAsync();
  const localPath = asset.localUri ?? asset.uri;
  if (!localPath) return;

  const song: Song = {
    id: WEB_MOCK_SONG_ID,
    title: 'Midnight Echo',
    artist: 'VibX Demo',
    album: 'Web Preview',
    previewUrl: null,
    downloadUrl: null,
    duration: 0,
    previewDuration: 30,
    artwork: null,
    localPath,
    isDownloaded: 1,
    isDemo: 1,
    createdAt: Date.now(),
  };

  await db.upsertSong(song);
}
