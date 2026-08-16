import 'react-native-gesture-handler';

const TrackPlayer = require('@rntp/player').default;
const { PlaybackService } = require('./src/services/audio/playbackService');

if (typeof TrackPlayer.registerBackgroundEventHandler === 'function') {
  TrackPlayer.registerBackgroundEventHandler(() => PlaybackService);
}

require('expo-router/entry');
