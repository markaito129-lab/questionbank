import { PENALTY_WRONG, POINTS_CORRECT } from '../types';

export function shuffleArray<T>(items: readonly T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function formatDurationMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatScore(score: number): string {
  const rounded = Math.round(score * 100) / 100;
  return rounded.toFixed(2);
}

export function computeNetScore(correctCount: number, wrongCount: number): number {
  const raw = correctCount * POINTS_CORRECT - wrongCount * PENALTY_WRONG;
  return Math.round(raw * 100) / 100;
}

export function formatTimestampDate(ms: number): string {
  if (!ms) return 'Just now';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(ms));
}
