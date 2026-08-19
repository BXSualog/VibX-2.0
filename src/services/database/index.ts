import * as SQLite from 'expo-sqlite';
import { createId } from '@/src/utils/id';
import { VIBED_PLAYLIST_ID } from '@/src/constants/playlists';
import type { Playlist, Song } from '@/src/types/music';
import { dedupeSongs, duplicateGroups, preferSong } from '@/src/utils/songIdentity';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('vibx.db');
  }
  return dbPromise;
}

export async function initDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT NOT NULL,
      previewUrl TEXT,
      downloadUrl TEXT,
      duration REAL NOT NULL DEFAULT 0,
      previewDuration REAL NOT NULL DEFAULT 30,
      artwork TEXT,
      localPath TEXT NOT NULL,
      isDownloaded INTEGER NOT NULL DEFAULT 1,
      isDemo INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      locked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS playlist_songs (
      playlistId TEXT NOT NULL,
      songId TEXT NOT NULL,
      position INTEGER NOT NULL,
      PRIMARY KEY (playlistId, songId),
      FOREIGN KEY (playlistId) REFERENCES playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS favorites (
      songId TEXT PRIMARY KEY NOT NULL,
      FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recent (
      songId TEXT PRIMARY KEY NOT NULL,
      playedAt INTEGER NOT NULL,
      FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS play_stats (
      songId TEXT PRIMARY KEY NOT NULL,
      completedCount INTEGER NOT NULL DEFAULT 0,
      lastCompletedAt INTEGER,
      FOREIGN KEY (songId) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
    CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
    CREATE INDEX IF NOT EXISTS idx_recent_playedAt ON recent(playedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_play_stats_completed ON play_stats(completedCount DESC);
  `);

  try {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(playlists)');
    if (!columns.some((column) => column.name === 'locked')) {
      await db.execAsync('ALTER TABLE playlists ADD COLUMN locked INTEGER NOT NULL DEFAULT 0');
    }
  } catch {
    // Older databases may already have the column, or PRAGMA may be unavailable.
  }

  try {
    await db.runAsync(
      `INSERT INTO playlists (id, name, createdAt, locked) VALUES (?, ?, ?, 1)
       ON CONFLICT(id) DO UPDATE SET name=excluded.name, locked=1`,
      [VIBED_PLAYLIST_ID, 'Vibed', 0]
    );
  } catch {
    await db.runAsync(
      `INSERT OR IGNORE INTO playlists (id, name, createdAt) VALUES (?, ?, ?)`,
      [VIBED_PLAYLIST_ID, 'Vibed', 0]
    );
  }

  return db;
}

export async function updateSongDuration(id: string, duration: number, force = false): Promise<void> {
  if (!Number.isFinite(duration) || duration <= 0) return;
  const db = await getDb();
  if (force) {
    await db.runAsync('UPDATE songs SET duration = ? WHERE id = ?', [duration, id]);
    return;
  }
  await db.runAsync(
    'UPDATE songs SET duration = ? WHERE id = ? AND (duration IS NULL OR duration <= 0 OR ABS(duration - ?) > 1.5)',
    [duration, id, duration]
  );
}

export async function upsertSong(song: Song): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO songs (id, title, artist, album, previewUrl, downloadUrl, duration, previewDuration, artwork, localPath, isDownloaded, isDemo, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       artist=excluded.artist,
       album=excluded.album,
       localPath=excluded.localPath,
       duration=excluded.duration,
       artwork=excluded.artwork,
       previewUrl=excluded.previewUrl,
       downloadUrl=excluded.downloadUrl,
       previewDuration=excluded.previewDuration,
       isDownloaded=excluded.isDownloaded`,
    [
      song.id,
      song.title,
      song.artist,
      song.album,
      song.previewUrl,
      song.downloadUrl,
      song.duration,
      song.previewDuration,
      song.artwork,
      song.localPath,
      song.isDownloaded,
      song.isDemo,
      song.createdAt,
    ]
  );
}

export async function getSongs(): Promise<Song[]> {
  const db = await getDb();
  return db.getAllAsync<Song>('SELECT * FROM songs ORDER BY createdAt DESC');
}

export async function getSongById(id: string): Promise<Song | null> {
  const db = await getDb();
  return db.getFirstAsync<Song>('SELECT * FROM songs WHERE id = ?', [id]);
}

export async function getSongByPath(localPath: string): Promise<Song | null> {
  const db = await getDb();
  return db.getFirstAsync<Song>('SELECT * FROM songs WHERE localPath = ?', [localPath]);
}

export async function getSongByFilename(filename: string): Promise<Song | null> {
  const db = await getDb();
  const name = filename.trim();
  if (!name) return null;
  return db.getFirstAsync<Song>(
    `SELECT * FROM songs
     WHERE localPath LIKE ? COLLATE NOCASE
        OR localPath LIKE ? COLLATE NOCASE
     LIMIT 1`,
    [`%/${name}`, `%\\${name}`]
  );
}

export async function searchSongs(query: string): Promise<Song[]> {
  const db = await getDb();
  const like = `%${query}%`;
  return db.getAllAsync<Song>(
    `SELECT * FROM songs
     WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
     ORDER BY title COLLATE NOCASE`,
    [like, like, like]
  );
}

export async function deleteDemoSongs(): Promise<Song[]> {
  const db = await getDb();
  const demos = await db.getAllAsync<Song>('SELECT * FROM songs WHERE isDemo = 1');
  if (demos.length > 0) {
    await db.runAsync('DELETE FROM songs WHERE isDemo = 1');
  }
  return demos;
}

export async function deleteSong(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM songs WHERE id = ?', [id]);
}

export async function mergeDuplicateSongs(): Promise<Song[]> {
  const songs = await getSongs();
  const extras: Song[] = [];

  for (const group of duplicateGroups(songs)) {
    const keep = group.reduce(preferSong);
    for (const song of group) {
      if (song.id !== keep.id) extras.push(song);
    }

    const db = await getDb();
    for (const extra of group) {
      if (extra.id === keep.id) continue;
      await db.runAsync(
        'INSERT OR IGNORE INTO favorites (songId) SELECT ? WHERE EXISTS (SELECT 1 FROM favorites WHERE songId = ?)',
        [keep.id, extra.id]
      );
      await db.runAsync(
        `INSERT OR IGNORE INTO playlist_songs (playlistId, songId, position)
         SELECT playlistId, ?, position FROM playlist_songs WHERE songId = ?`,
        [keep.id, extra.id]
      );

      const extraRecent = await db.getFirstAsync<{ playedAt: number }>(
        'SELECT playedAt FROM recent WHERE songId = ?',
        [extra.id]
      );
      if (extraRecent) {
        await db.runAsync(
          `INSERT INTO recent (songId, playedAt) VALUES (?, ?)
           ON CONFLICT(songId) DO UPDATE SET playedAt = MAX(playedAt, excluded.playedAt)`,
          [keep.id, extraRecent.playedAt]
        );
      }

      const extraStats = await db.getFirstAsync<{ completedCount: number; lastCompletedAt: number | null }>(
        'SELECT completedCount, lastCompletedAt FROM play_stats WHERE songId = ?',
        [extra.id]
      );
      if (extraStats) {
        const keepStats = await db.getFirstAsync<{ completedCount: number; lastCompletedAt: number | null }>(
          'SELECT completedCount, lastCompletedAt FROM play_stats WHERE songId = ?',
          [keep.id]
        );
        if (keepStats) {
          await db.runAsync(
            `UPDATE play_stats
             SET completedCount = completedCount + ?,
                 lastCompletedAt = CASE
                   WHEN lastCompletedAt IS NULL THEN ?
                   WHEN ? IS NULL THEN lastCompletedAt
                   WHEN ? > lastCompletedAt THEN ?
                   ELSE lastCompletedAt
                 END
             WHERE songId = ?`,
            [
              extraStats.completedCount,
              extraStats.lastCompletedAt,
              extraStats.lastCompletedAt,
              extraStats.lastCompletedAt,
              extraStats.lastCompletedAt,
              keep.id,
            ]
          );
        } else {
          await db.runAsync(
            'INSERT INTO play_stats (songId, completedCount, lastCompletedAt) VALUES (?, ?, ?)',
            [keep.id, extraStats.completedCount, extraStats.lastCompletedAt]
          );
        }
      }

      await db.runAsync('DELETE FROM songs WHERE id = ?', [extra.id]);
    }
  }

  return extras;
}

export async function getFavorites(): Promise<Song[]> {
  const db = await getDb();
  return db.getAllAsync<Song>(
    `SELECT s.* FROM songs s
     INNER JOIN favorites f ON f.songId = s.id
     ORDER BY s.title COLLATE NOCASE`
  );
}

export async function isFavorite(songId: string): Promise<boolean> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ songId: string }>('SELECT songId FROM favorites WHERE songId = ?', [
    songId,
  ]);
  return Boolean(row);
}

export async function toggleFavorite(songId: string): Promise<boolean> {
  const db = await getDb();
  const exists = await isFavorite(songId);
  if (exists) {
    await db.runAsync('DELETE FROM favorites WHERE songId = ?', [songId]);
    return false;
  }
  await db.runAsync('INSERT INTO favorites (songId) VALUES (?)', [songId]);
  return true;
}

export async function recordPlay(songId: string): Promise<void> {
  const db = await getDb();
  const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM songs WHERE id = ?', [songId]);
  if (!exists) return;
  await db.runAsync(
    `INSERT INTO recent (songId, playedAt) VALUES (?, ?)
     ON CONFLICT(songId) DO UPDATE SET playedAt=excluded.playedAt`,
    [songId, Date.now()]
  );
}

export async function getRecent(limit = 20): Promise<Song[]> {
  const db = await getDb();
  return db.getAllAsync<Song>(
    `SELECT s.* FROM songs s
     INNER JOIN recent r ON r.songId = s.id
     ORDER BY r.playedAt DESC
     LIMIT ?`,
    [limit]
  );
}

export async function recordCompletedPlay(songId: string): Promise<void> {
  const db = await getDb();
  const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM songs WHERE id = ?', [songId]);
  if (!exists) return;
  await db.runAsync(
    `INSERT INTO play_stats (songId, completedCount, lastCompletedAt) VALUES (?, 1, ?)
     ON CONFLICT(songId) DO UPDATE SET
       completedCount = completedCount + 1,
       lastCompletedAt = excluded.lastCompletedAt`,
    [songId, Date.now()]
  );
}

export async function getPopular(limit = 8): Promise<Song[]> {
  const db = await getDb();
  return db.getAllAsync<Song>(
    `SELECT s.* FROM songs s
     INNER JOIN play_stats p ON p.songId = s.id
     WHERE p.completedCount > 0
     ORDER BY p.completedCount DESC, p.lastCompletedAt DESC
     LIMIT ?`,
    [limit]
  );
}

export async function getPlayStats(): Promise<Record<string, number>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ songId: string; completedCount: number }>(
    'SELECT songId, completedCount FROM play_stats WHERE completedCount > 0'
  );
  return Object.fromEntries(rows.map((row) => [row.songId, row.completedCount]));
}

export async function getPlaylists(): Promise<Playlist[]> {
  const db = await getDb();
  let rows: Playlist[] = [];
  try {
    rows = await db.getAllAsync<Playlist>('SELECT * FROM playlists ORDER BY locked DESC, createdAt DESC');
  } catch {
    rows = await db.getAllAsync<Playlist>('SELECT * FROM playlists ORDER BY createdAt DESC');
  }
  return rows.map((playlist) => ({
    ...playlist,
    locked: playlist.id === VIBED_PLAYLIST_ID ? 1 : playlist.locked ?? 0,
  }));
}

export async function createPlaylist(name: string): Promise<Playlist> {
  const db = await getDb();
  const trimmed = name.trim();
  if (trimmed.toLowerCase() === 'vibed') {
    const existing = await db.getFirstAsync<Playlist>('SELECT * FROM playlists WHERE id = ?', [VIBED_PLAYLIST_ID]);
    if (existing) return { ...existing, locked: 1 };
  }

  const playlist: Playlist = {
    id: createId(),
    name: trimmed,
    createdAt: Date.now(),
    locked: 0,
  };
  try {
    await db.runAsync('INSERT INTO playlists (id, name, createdAt, locked) VALUES (?, ?, ?, 0)', [
      playlist.id,
      playlist.name,
      playlist.createdAt,
    ]);
  } catch {
    await db.runAsync('INSERT INTO playlists (id, name, createdAt) VALUES (?, ?, ?)', [
      playlist.id,
      playlist.name,
      playlist.createdAt,
    ]);
  }
  return playlist;
}

export async function deletePlaylist(id: string): Promise<void> {
  if (id === VIBED_PLAYLIST_ID) return;
  const db = await getDb();
  const playlist = await db.getFirstAsync<Playlist>('SELECT * FROM playlists WHERE id = ?', [id]);
  if (!playlist || playlist.locked === 1) return;
  await db.runAsync('DELETE FROM playlists WHERE id = ?', [id]);
}

export async function removeSongFromPlaylist(playlistId: string, songId: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM playlist_songs WHERE playlistId = ? AND songId = ?', [playlistId, songId]);
}

export async function addSongToPlaylist(playlistId: string, songId: string): Promise<void> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ maxPos: number | null }>(
    'SELECT MAX(position) as maxPos FROM playlist_songs WHERE playlistId = ?',
    [playlistId]
  );
  const position = (row?.maxPos ?? -1) + 1;
  await db.runAsync(
    `INSERT OR IGNORE INTO playlist_songs (playlistId, songId, position) VALUES (?, ?, ?)`,
    [playlistId, songId, position]
  );
}

export async function getPlaylistSongs(playlistId: string): Promise<Song[]> {
  const db = await getDb();
  const songs = await db.getAllAsync<Song>(
    `SELECT s.* FROM songs s
     INNER JOIN playlist_songs ps ON ps.songId = s.id
     WHERE ps.playlistId = ?
     ORDER BY ps.position`,
    [playlistId]
  );
  return dedupeSongs(songs);
}

export async function getAlbums(): Promise<{ album: string; artist: string; count: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT album, artist, COUNT(*) as count
     FROM songs
     GROUP BY album, artist
     ORDER BY album COLLATE NOCASE`
  );
}

export async function getArtists(): Promise<{ artist: string; count: number }[]> {
  const db = await getDb();
  return db.getAllAsync(
    `SELECT artist, COUNT(*) as count
     FROM songs
     GROUP BY artist
     ORDER BY artist COLLATE NOCASE`
  );
}

export async function getSongsByAlbum(album: string, artist: string): Promise<Song[]> {
  const db = await getDb();
  return db.getAllAsync<Song>('SELECT * FROM songs WHERE album = ? AND artist = ? ORDER BY title COLLATE NOCASE', [
    album,
    artist,
  ]);
}

export async function getSongsByArtist(artist: string): Promise<Song[]> {
  const db = await getDb();
  return db.getAllAsync<Song>('SELECT * FROM songs WHERE artist = ? ORDER BY album, title COLLATE NOCASE', [
    artist,
  ]);
}
