import type { UserProgress, SessionResult } from '../types';
import { LESSONS } from '../lessons/lessonData';

const STORAGE_KEY = 'keyboard-hero-progress';

const LEVEL_THRESHOLDS = buildLevelThresholds(20);

function buildLevelThresholds(maxLevel: number): number[] {
  const thresholds = [0];
  let gap = 100;
  let total = 0;
  for (let i = 1; i < maxLevel; i++) {
    total += gap;
    thresholds.push(total);
    gap += 100;
  }
  return thresholds;
}

function calculateLevel(xp: number): number {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (xp >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function getDefaultProgress(): UserProgress {
  return {
    name: '',
    level: 1,
    xp: 0,
    bestScores: {},
    stars: {},
    practiceDays: [],
    badges: [],
  };
}

export function loadProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    return JSON.parse(raw) as UserProgress;
  } catch {
    return getDefaultProgress();
  }
}

export function saveProgress(progress: UserProgress): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

export function addPracticeDay(progress: UserProgress): UserProgress {
  const today = new Date().toISOString().slice(0, 10);
  if (progress.practiceDays.includes(today)) return progress;
  return {
    ...progress,
    practiceDays: [...progress.practiceDays, today],
  };
}

export function addXP(progress: UserProgress, xp: number): UserProgress {
  const newXP = progress.xp + xp;
  return {
    ...progress,
    xp: newXP,
    level: calculateLevel(newXP),
  };
}

export function updateBestScore(
  progress: UserProgress,
  lessonId: string,
  result: SessionResult
): UserProgress {
  const current = progress.bestScores[lessonId];
  const isBetter = !current || result.score > current.score;

  const newStars = Math.max(progress.stars[lessonId] ?? 0, result.stars);

  return {
    ...progress,
    bestScores: isBetter
      ? { ...progress.bestScores, [lessonId]: result }
      : progress.bestScores,
    stars: { ...progress.stars, [lessonId]: newStars },
  };
}

function hasConsecutiveDays(days: string[], count: number): boolean {
  if (days.length < count) return false;
  const sorted = [...days].sort();
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffMs = curr.getTime() - prev.getTime();
    if (diffMs === 86_400_000) {
      streak++;
      if (streak >= count) return true;
    } else if (diffMs > 86_400_000) {
      streak = 1;
    }
  }
  return streak >= count;
}

export function checkAndAwardBadges(progress: UserProgress): UserProgress {
  const badges = new Set(progress.badges);

  if (Object.keys(progress.bestScores).length > 0) {
    badges.add('first_lesson');
  }

  const hasThreeStars = Object.values(progress.stars).some(s => s >= 3);
  if (hasThreeStars) {
    badges.add('perfect_score');
  }

  const hasCombo50 = Object.values(progress.bestScores).some(r => r.maxCombo >= 50);
  if (hasCombo50) {
    badges.add('combo_50');
  }

  if (hasConsecutiveDays(progress.practiceDays, 3)) {
    badges.add('streak_3');
  }

  if (hasConsecutiveDays(progress.practiceDays, 7)) {
    badges.add('streak_7');
  }

  const allLessonIds = LESSONS.map(l => l.id);
  const allHaveStar = allLessonIds.every(id => (progress.stars[id] ?? 0) >= 1);
  if (allHaveStar) {
    badges.add('all_stars');
  }

  const newBadges = Array.from(badges);
  if (newBadges.length === progress.badges.length) return progress;

  return { ...progress, badges: newBadges };
}
