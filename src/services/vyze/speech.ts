import { Platform } from 'react-native';

type SpeechStartResult =
  | { ok: true }
  | { ok: false; reason: 'permission' | 'unavailable'; message: string };

export type VoiceMeter = {
  level: number;
  frequency: number;
};

type Subscription = { remove: () => void };

let lastTranscript = '';
let listening = false;
let subs: Subscription[] = [];
let endWaiter: ((value: string) => void) | null = null;
let meterListener: ((meter: VoiceMeter) => void) | null = null;
const volumeHistory: number[] = [];
let smoothedFrequency = 0;

export function setVoiceMeterListener(listener: ((meter: VoiceMeter) => void) | null) {
  meterListener = listener;
}

async function getModule() {
  const speech = await import('expo-speech-recognition');
  return speech.ExpoSpeechRecognitionModule;
}

function emitMeter(level: number, frequency: number) {
  meterListener?.({ level, frequency });
}

function resetVoiceMeter() {
  volumeHistory.length = 0;
  smoothedFrequency = 0;
  emitMeter(0, 0);
}

function analyzeVolume(raw: number): VoiceMeter {
  // expo-speech-recognition reports -2..10; anything at or below 0 is inaudible.
  if (raw <= 0) {
    volumeHistory.length = 0;
    smoothedFrequency = 0;
    return { level: 0, frequency: 0 };
  }

  const gated = Math.max(0, raw - 0.35);
  const level = Math.min(1, gated / 6.2);
  if (level <= 0.02) {
    volumeHistory.length = 0;
    smoothedFrequency = 0;
    return { level: 0, frequency: 0 };
  }

  volumeHistory.push(level);
  if (volumeHistory.length > 10) volumeHistory.shift();

  let flux = 0;
  for (let i = 1; i < volumeHistory.length; i += 1) {
    flux += Math.abs(volumeHistory[i] - volumeHistory[i - 1]);
  }
  const meanFlux = flux / Math.max(1, volumeHistory.length - 1);
  const rawFrequency = Math.min(1, meanFlux / 0.22);
  smoothedFrequency = smoothedFrequency * 0.55 + rawFrequency * 0.45;

  return { level, frequency: smoothedFrequency };
}

function detachListeners() {
  for (const sub of subs) sub.remove();
  subs = [];
}

function attachListeners(module: Awaited<ReturnType<typeof getModule>>) {
  detachListeners();
  subs.push(
    module.addListener('result', (event) => {
      const transcript = event.results?.[0]?.transcript?.trim() ?? '';
      if (transcript) lastTranscript = transcript;
      if (event.isFinal && transcript && endWaiter) {
        const resolve = endWaiter;
        endWaiter = null;
        resolve(transcript);
      }
    })
  );
  subs.push(
    module.addListener('volumechange', (event) => {
      if (!listening) return;
      const meter = analyzeVolume(event.value);
      emitMeter(meter.level, meter.frequency);
    })
  );
}

export async function startSpeechRecognition(): Promise<SpeechStartResult> {
  if (Platform.OS === 'web') {
    return {
      ok: false,
      reason: 'unavailable',
      message: 'Voice commands work on the phone app, not on web.',
    };
  }

  try {
    const module = await getModule();
    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      return {
        ok: false,
        reason: 'permission',
        message: 'I need microphone access to hear you.',
      };
    }

    lastTranscript = '';
    listening = true;
    resetVoiceMeter();
    attachListeners(module);
    module.start({
      lang: 'en-US',
      interimResults: true,
      continuous: true,
      addsPunctuation: false,
      contextualStrings: [
        'play',
        'pause',
        'shuffle',
        'next song',
        'previous song',
        'play vibed',
        'justin bieber',
        'ariana grande',
      ],
      androidIntentOptions: {
        EXTRA_LANGUAGE_MODEL: 'free_form',
        EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500,
        EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
      },
      volumeChangeEventOptions: {
        enabled: true,
        intervalMillis: 50,
      },
    });
    return { ok: true };
  } catch {
    listening = false;
    resetVoiceMeter();
    return {
      ok: false,
      reason: 'unavailable',
      message: 'I could not reach the microphone. Rebuild the app after the voice update, then try again.',
    };
  }
}

export async function stopSpeechRecognition(): Promise<string> {
  if (!listening) return lastTranscript.trim();
  listening = false;
  resetVoiceMeter();

  try {
    const module = await getModule();
    const spoken = await new Promise<string>((resolve) => {
      const timeout = setTimeout(() => {
        endWaiter = null;
        resolve(lastTranscript.trim());
      }, 900);
      endWaiter = (value) => {
        clearTimeout(timeout);
        resolve(value.trim());
      };
      module.stop();
    });
    return spoken || lastTranscript.trim();
  } catch {
    return lastTranscript.trim();
  }
}

export async function abortSpeechRecognition(): Promise<void> {
  listening = false;
  endWaiter = null;
  lastTranscript = '';
  resetVoiceMeter();
  try {
    const module = await getModule();
    module.abort();
  } catch {
    // Native module may be missing in Expo Go / web.
  }
}
