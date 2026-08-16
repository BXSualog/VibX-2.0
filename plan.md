# VibX 2.0 — Master Product Plan

## Vision

**VibX 2.0** is a premium offline-first music player inspired by Spotify's navigation, playback flow, and overall UX polish, but built around a distinctive modern blue identity and a local AI voice assistant called **Vyze**.

The app allows users to browse a large internet music catalog, hear **30-second previews**, download authorized full tracks into **Downloads/VibX/**, play them completely offline, and control playback hands-free using natural voice commands processed locally through a Python-powered AI assistant.

The goal is a music app that feels like a commercial streaming platform while remaining fast, offline-capable, and deeply optimized for Android.

---

# Core User Experience

1. Open VibX 2.0
2. Browse songs from an online catalog
3. Tap a song
4. Hear a **30-second preview**
5. Tap **Download**
6. Save the full song to **Downloads/VibX/**
7. Listen offline
8. Control playback using **Vyze** with voice commands such as:

   * "Play Midnight Echo"
   * "Pause"
   * "Resume"
   * "Shuffle"
   * "Randomize the vibe"

---

# Technology Stack

## Frontend

| Layer            | Technology                   |
| ---------------- | ---------------------------- |
| Mobile Framework | React Native (Expo)          |
| Language         | TypeScript                   |
| Navigation       | Expo Router                  |
| Styling          | NativeWind (Tailwind CSS)    |
| Animations       | React Native Reanimated      |
| Gestures         | React Native Gesture Handler |

---

## Audio

| Purpose               | Technology                |
| --------------------- | ------------------------- |
| Audio Playback        | react-native-track-player |
| Background Playback   | react-native-track-player |
| Notification Controls | react-native-track-player |
| Lock Screen Controls  | react-native-track-player |

---

## Local Storage

| Purpose        | Technology       |
| -------------- | ---------------- |
| Local Files    | expo-file-system |
| Local Database | SQLite           |

---

## Backend

| Layer            | Technology |
| ---------------- | ---------- |
| Language         | Rust       |
| Framework        | Axum       |
| Async Runtime    | Tokio      |
| HTTP Client      | Reqwest    |
| ORM              | SQLx       |
| Database         | PostgreSQL |
| Authentication   | JWT        |
| Cache (optional) | Redis      |

---

## Cloud Storage

| Purpose      | Technology       |
| ------------ | ---------------- |
| Song Storage | Supabase Storage |
| Metadata     | PostgreSQL       |

---

## AI

| Purpose            | Technology             |
| ------------------ | ---------------------- |
| Voice Assistant    | Python                 |
| API                | FastAPI                |
| Speech Recognition | Whisper (local model)  |
| Communication      | Local HTTP / WebSocket |

---

# Architecture

```
React Native (VibX 2.0)
│
├── Rust Backend (Axum)
│       ├── Song Catalog
│       ├── Search
│       ├── Downloads
│       ├── Playlists
│       ├── Favorites
│       └── Sync
│
├── Deezer API
│       ├── Songs
│       ├── Artists
│       ├── Albums
│       └── 30s Preview URLs
│
├── Supabase Storage
│       └── Downloadable Songs
│
├── SQLite
│       ├── Downloads
│       ├── Playlists
│       ├── Favorites
│       └── Recent History
│
└── Python (Vyze)
        ├── Whisper
        ├── Intent Parser
        ├── Fuzzy Matching
        └── Playback Commands
```

---

# Design System

## Brand

**Name:** VibX 2.0

**Style:** Premium, minimal, futuristic

**Mood:** Calm, immersive, modern

---

## Color Palette

| Role             | Color   |
| ---------------- | ------- |
| Primary          | #2563EB |
| Accent           | #60A5FA |
| Background       | #0B1220 |
| Surface          | #111827 |
| Elevated Surface | #1F2937 |
| Primary Text     | #F8FAFC |
| Secondary Text   | #94A3B8 |
| Highlight        | #3B82F6 |
| Success          | #22C55E |

---

## Typography

* Inter
* SF Pro Display
* Large bold headers
* Rounded components
* Spacious layout
* Soft shadows

---

# Navigation

Bottom navigation similar to Spotify.

## Tabs

* Home
* Search
* Library
* Downloads
* Profile

A **persistent mini-player** remains above the tab bar on every screen.

---

# Screen Architecture

## Home

* Greeting
* **Vyze AI Assistant**
* Recently Played
* Continue Listening
* Favorite Artists
* Downloaded Mixes
* Recommended Albums
* Playlists

---

## Search

* Large animated search bar
* Genre cards
* Trending searches
* Songs
* Albums
* Artists

---

## Library

* Playlists
* Albums
* Artists
* Liked Songs
* Downloaded Songs
* Recently Added

---

## Downloads

* Offline-only toggle
* Storage usage
* Download queue
* Download progress
* Delete downloads

---

## Profile

* Theme
* Audio quality
* Cache management
* Storage management
* Import local music
* About VibX

---

# Mini Player

Visible on every screen.

Displays:

* Album artwork
* Song title
* Artist
* Play/Pause
* Next

Tapping expands into the full-screen player.

---

# Full-Screen Player

Displays:

* Large album artwork
* Dynamic blurred blue background
* Song title
* Artist
* Progress bar
* Shuffle
* Previous
* Play/Pause
* Next
* Repeat
* Queue
* Lyrics
* Favorite
* Download

---

# Browsing & Preview System

## Online Catalog

Songs are browsed using the **Deezer API**.

Each result includes:

* Song title
* Artist
* Album
* Artwork
* **30-second preview URL**

---

## Preview Playback

When a song is **not downloaded**:

* Play **30-second preview**
* Show "Preview" badge
* Progress bar limited to 30 seconds
* Stop automatically after preview ends

---

## Preview Flow

```
Browse Song
→ Tap Song
→ Stream 30s Preview
→ Show Download Button
```

---

# Download System

## Download Flow

```
Tap Download
→ Rust Backend
→ Fetch authorized song file
→ Download MP3
→ Save to Downloads/VibX/
→ Update SQLite
→ Enable Offline Playback
```

---

## Local Folder

```
Downloads/
└── VibX/
    ├── Midnight Echo - Aether.mp3
    ├── Blue Horizon - Atlas.mp3
    ├── Ocean Drive - Lumen.mp3
    └── Neon Skies - Aurora.mp3
```

---

## Playback Logic

### Not Downloaded

Play **30-second preview**

### Downloaded

Play **full local file**

### Offline

Only downloaded songs are playable

---

# Notification Media Controls

Android notification panel displays:

* Album artwork
* Song title
* Artist
* Previous
* Play/Pause
* Next
* Playback progress

### Preview Mode

Displays:

"Preview • 30s"

### Downloaded Mode

Displays the normal full media player.

---

# Lock Screen Controls

Android lock screen displays:

* Album artwork
* Song title
* Artist
* Previous
* Play/Pause
* Next
* Progress bar

Works during:

* Preview playback
* Full offline playback
* Background playback

---

# Vyze AI Assistant

## Concept

**Vyze** is a local offline AI music assistant located on the Home screen.

The user **presses and holds a microphone button**, speaks naturally, and Vyze controls **only the downloaded music library** stored in Downloads/VibX/.

---

## Voice Commands

### Playback

* Play Midnight Echo
* Play Blue Horizon
* Pause
* Resume
* Stop

### Navigation

* Next song
* Previous song

### Queue

* Shuffle
* Random
* Randomize
* Randomize the vibe

### Library

* Play downloaded songs
* Play my favorites
* Play something chill
* Play something energetic

---

## Natural Language

Vyze understands variations such as:

* "Could you play Midnight Echo?"
* "I want to hear Blue Horizon."
* "Pause the music."
* "Shuffle everything."
* "Give me a random vibe."

---

## Fuzzy Matching

Examples:

"Play Horizon"

can still match:

"Blue Horizon"

---

## Randomize the Vibe

Vyze builds a mood-based queue using metadata such as:

* Genre
* Mood
* BPM
* Energy
* Acousticness
* Danceability

Example Queue:

1. Blue Horizon
2. Midnight Echo
3. Ocean Drive
4. Neon Skies

---

## Offline AI

Vyze works completely offline.

Uses:

* Whisper tiny/base
* Local Python inference
* SQLite song index

No internet required.

---

# Python Architecture

```
React Native
│
▼
Audio Recording
│
▼
FastAPI
│
▼
Whisper
│
▼
Intent Parser
│
▼
Playback Command
│
▼
React Native Track Player
```

---

# Example Intent Parser

```python
def parse_command(text):
    text = text.lower()

    if 'pause' in text:
        return {'action': 'pause'}

    if 'resume' in text:
        return {'action': 'resume'}

    if 'stop' in text:
        return {'action': 'stop'}

    if 'shuffle' in text:
        return {'action': 'shuffle'}

    if 'randomize the vibe' in text:
        return {'action': 'vibe'}

    if 'random' in text:
        return {'action': 'random'}

    if 'play' in text:
        song = text.replace('play', '').strip()
        return {'action': 'play', 'song': song}

    return {'action': 'unknown'}
```

---

# Database Schema

## songs

* id
* title
* artist
* album
* previewUrl
* downloadUrl
* duration
* previewDuration
* artwork
* localPath
* isDownloaded
* createdAt

---

## playlists

* id
* name
* createdAt

---

## playlist_songs

* playlistId
* songId
* position

---

## favorites

* songId

---

## recent

* songId
* playedAt

---

# Folder Structure

```
app/
  (tabs)/
    home.tsx
    search.tsx
    library.tsx
    downloads.tsx
    profile.tsx
  player.tsx

src/
  components/
    MiniPlayer/
    Player/
    SongCard/
    AlbumCard/
    PlaylistCard/
    SearchBar/
    Vyze/
  services/
    audio/
    downloads/
    database/
    vyze/
  stores/
    playerStore.ts
    libraryStore.ts
    downloadStore.ts
    vyzeStore.ts
  hooks/
  utils/
  types/

backend/
  rust/
    src/
    Cargo.toml

python/
  api.py
  speech.py
  parser.py
  library.py
  commands.py

assets/
  icons/
  artwork/
  logo/
  avatars/
  vyze.png
```

---

# UX Interactions

## Gestures

* Swipe down to minimize player
* Swipe left/right on artwork
* Drag queue items
* Pull to refresh
* Long press songs
* Press and hold Vyze button

---

## Context Menu

* Play Next
* Add to Queue
* Add to Playlist
* Download
* Remove Download
* View Album
* View Artist
* Share

---

# Queue System

Spotify-style queue.

Sections:

* Now Playing
* Next Up
* Later in Queue

Supports drag-and-drop reordering.

---

# Animations

React Native Reanimated.

### Required Animations

* Mini-player → Full player transition
* Shared artwork animation
* Dynamic background blur
* Smooth progress bar
* Tab transitions
* Queue drag animation
* Download progress animation
* Button ripple effects
* Vyze listening pulse
* Vyze waveform animation
* Vyze glow animation

Target: **60 FPS**

---

# Performance Goals

* Instant local playback
* Lazy-loaded lists
* Artwork caching
* SQLite indexing
* Low memory usage
* Fast startup
* Smooth scrolling
* Offline voice recognition
* Fast command execution

---

# Android Storage Strategy

Use **MediaStore API**.

Advantages:

* Saves directly into Downloads
* Scoped storage compatible
* User-visible files
* Modern Android compliant

---

# Development Roadmap

## Phase 1 — Foundation

* Expo
* TypeScript
* Expo Router
* NativeWind
* Theme
* Navigation

---

## Phase 2 — Library

* Song list
* Albums
* Artists
* Search
* Library screen

---

## Phase 3 — Playback

* Track Player
* Queue
* Mini-player
* Full-screen player

---

## Phase 4 — Preview System

* 30-second previews
* Preview UI
* Preview state management

---

## Phase 5 — Download System

* Rust download API
* Save to Downloads/VibX/
* SQLite integration
* Offline playback

---

## Phase 6 — Vyze AI

* FastAPI
* Whisper
* Intent parsing
* Fuzzy matching
* Local library indexing
* Voice commands
* Randomize the vibe

---

## Phase 7 — System Integration

* Notification controls
* Lock screen controls
* Background playback
* Media Session support

---

## Phase 8 — Polish

* Reanimated transitions
* Gestures
* Dynamic backgrounds
* Performance optimization
* UI refinement
* Avatar animations

---

# Final Vision

**VibX 2.0** should feel like a **next-generation offline music ecosystem**.

It combines:

* Spotify-inspired browsing
* A premium blue interface
* Internet music discovery
* 30-second previews
* One-tap downloads
* Offline playback
* Background playback
* Notification controls
* Lock screen controls
* A blazing-fast Rust backend
* And a fully offline Python-powered AI assistant called **Vyze**

The result is a music application that is beautiful, extremely fast, offline-capable, and uniquely differentiated by its local voice-controlled experience.
