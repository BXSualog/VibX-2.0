import { useState } from 'react';
import { Alert, Modal, Pressable, Text, TextInput, View } from 'react-native';
import type { Song } from '@/src/types/music';
import { Artwork } from '@/src/components/Artwork';
import { useLibraryStore } from '@/src/stores/libraryStore';
import { usePlayerStore } from '@/src/stores/playerStore';
import { useDownloadStore } from '@/src/stores/downloadStore';
import { colors } from '@/src/theme/colors';
import { VIBED_PLAYLIST_ID } from '@/src/constants/playlists';
import { normalizeTrackLabels } from '@/src/utils/metadata';
import { isCatalogSong, isPreviewSong } from '@/src/utils/catalog';

type Props = {
  song: Song | null;
  onClose: () => void;
  queue?: Song[];
};

export function SongContextMenu({ song, onClose, queue }: Props) {
  const playlists = useLibraryStore((state) => state.playlists);
  const librarySongs = useLibraryStore((state) => state.songs);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);
  const addToPlaylist = useLibraryStore((state) => state.addToPlaylist);
  const toggleFavorite = useLibraryStore((state) => state.toggleFavorite);
  const isFavorite = useLibraryStore((state) => state.isFavorite);
  const playNext = usePlayerStore((state) => state.playNext);
  const addToQueue = usePlayerStore((state) => state.addToQueue);
  const playSong = usePlayerStore((state) => state.playSong);
  const downloadSong = useDownloadStore((state) => state.downloadSong);
  const removeCatalogDownload = useDownloadStore((state) => state.removeCatalogDownload);
  const job = useDownloadStore((state) => (song ? state.jobs[song.id] : undefined));
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  if (!song) return null;
  const labels = normalizeTrackLabels(song.title, song.artist);
  const saved = librarySongs.some((item) => item.id === song.id);
  const catalog = isCatalogSong(song);
  const preview = isPreviewSong(song) && !saved;
  const downloading = job?.status === 'queued' || job?.status === 'downloading';

  async function run(label: string, fn: () => void | Promise<void>) {
    await fn();
    if (label !== 'playlist-open') onClose();
  }

  return (
    <Modal transparent animationType="fade" visible={Boolean(song)} onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/70" onPress={onClose}>
        <Pressable className="rounded-t-3xl border-t border-white/10 bg-vibx-surface px-5 pb-10 pt-4" onPress={() => {}}>
          <View className="mb-4 items-center">
            <View className="h-1.5 w-12 rounded-full bg-white/20" />
          </View>
          <View className="mb-4 flex-row items-center">
            <Artwork uri={song.artwork} title={labels.title} artist={labels.artist} size={52} rounded={10} />
            <View className="ml-3 flex-1">
              <Text className="text-lg font-bold text-vibx-text" numberOfLines={1}>
                {labels.title}
              </Text>
              <Text className="text-sm text-vibx-muted" numberOfLines={1}>
                {labels.artist}
                {preview ? ' · Preview' : saved ? ' · In library' : ''}
              </Text>
            </View>
          </View>

          <MenuItem
            label="Play"
            onPress={() => run('play', () => playSong(song, queue ?? (saved ? librarySongs : [song])))}
          />
          <MenuItem label="Play Next" onPress={() => run('next', () => playNext(song))} />
          {saved ? (
            <MenuItem label="Add to Queue" onPress={() => run('queue', () => addToQueue(song))} />
          ) : null}

          {catalog ? (
            saved ? (
              <MenuItem
                label="Remove Download"
                danger
                onPress={() =>
                  Alert.alert('Remove download?', labels.title, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Remove',
                      style: 'destructive',
                      onPress: () => run('del', () => removeCatalogDownload(song)),
                    },
                  ])
                }
              />
            ) : (
              <MenuItem
                label={downloading ? 'Downloading…' : 'Download'}
                onPress={() => {
                  onClose();
                  void (async () => {
                    const ok = await downloadSong(song);
                    if (!ok && !song.downloadUrl) {
                      Alert.alert(
                        'Full track not available',
                        'Deezer only provides a 30-second preview. VibX will not save that clip as the full song.',
                      );
                    }
                  })();
                }}
              />
            )
          ) : (
            <MenuItem
              label="Remove Download"
              danger
              onPress={() =>
                Alert.alert('Remove download?', labels.title, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () =>
                      run('del', () => useLibraryStore.getState().removeSong(song)),
                  },
                ])
              }
            />
          )}

          {saved ? (
            <>
              <MenuItem
                label={isFavorite(song.id) ? 'Remove from Vibed' : 'Add to Vibed'}
                onPress={() =>
                  run('fav', async () => {
                    await toggleFavorite(song.id);
                  })
                }
              />
              {playlists
                .filter((playlist) => playlist.id !== VIBED_PLAYLIST_ID)
                .map((playlist) => (
                  <MenuItem
                    key={playlist.id}
                    label={`Add to ${playlist.name}`}
                    onPress={() => run('pl', () => addToPlaylist(playlist.id, song.id))}
                  />
                ))}
              <MenuItem label="New Playlist" onPress={() => setNaming(true)} />
            </>
          ) : null}

          {naming && saved ? (
            <View className="mt-3">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Playlist name"
                placeholderTextColor={colors.muted}
                className="rounded-2xl bg-vibx-elevated px-4 py-3.5 text-vibx-text"
              />
              <Pressable
                className="mt-3 items-center rounded-2xl bg-vibx-primary py-3.5"
                onPress={async () => {
                  if (!name.trim()) return;
                  const playlist = await createPlaylist(name.trim());
                  await addToPlaylist(playlist.id, song.id);
                  setName('');
                  setNaming(false);
                  onClose();
                }}
              >
                <Text className="font-semibold text-white">Create and add</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} className="rounded-xl py-3.5 active:bg-white/5">
      <Text className={danger ? 'text-base text-red-400' : 'text-base text-vibx-text'}>{label}</Text>
    </Pressable>
  );
}
