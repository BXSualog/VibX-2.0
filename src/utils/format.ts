import { decodeDisplayName } from '@/src/utils/metadata';

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const mmss = `${mins}:${secs.toString().padStart(2, '0')}`;
  if (hours <= 0) return mmss;
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatDurationLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  if (hours <= 0) return `${Math.max(1, mins)} min`;
  return `${hours} hr ${mins} min`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function greetingForNow(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function lettersOnly(value: string): string {
  return value.replace(/[^a-zA-Z]/g, '');
}

export function initials(title: string, artist?: string): string {
  const source = decodeDisplayName(title).trim() || decodeDisplayName(artist ?? '').trim() || 'VX';
  const wordStarts = source
    .split(/\s+/)
    .map((part) => lettersOnly(part).charAt(0))
    .filter(Boolean);

  if (wordStarts.length >= 2) {
    return `${wordStarts[0]}${wordStarts[1]}`.toUpperCase();
  }

  const compact = lettersOnly(source);
  if (compact.length >= 2) return compact.slice(0, 2).toUpperCase();
  if (compact.length === 1) return compact.toUpperCase();
  return 'VX';
}
