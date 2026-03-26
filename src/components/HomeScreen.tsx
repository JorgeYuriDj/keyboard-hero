import { useState } from 'react';
import type { UserProgress } from '../types';

interface HomeScreenProps {
  progress: UserProgress;
  onStartPractice: () => void;
  onSettings: () => void;
  onNameChange: (name: string) => void;
}

const LEVEL_TITLES: Record<number, string> = {
  1: 'Novato 🐣',
  2: 'Aprendiz 🎵',
  3: 'Fera do Teclado 🔥',
  4: 'Mestre das Teclas 🎹',
  5: 'Lenda Musical 👑',
};

/** XP necessario para alcancar cada nivel */
const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 500,
  3: 1500,
  4: 3500,
  5: 7000,
};

function getXpForNextLevel(level: number): number {
  return XP_THRESHOLDS[Math.min(level + 1, 5)] ?? 9999;
}

function getXpForCurrentLevel(level: number): number {
  return XP_THRESHOLDS[level] ?? 0;
}

function getStreakDays(practiceDays: string[]): number {
  if (practiceDays.length === 0) return 0;

  const sorted = [...practiceDays]
    .map((d) => new Date(d).getTime())
    .sort((a, b) => b - a);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayMs = today.getTime();
  const oneDay = 86_400_000;

  // Check if the most recent practice day is today or yesterday
  const mostRecent = sorted[0];
  if (todayMs - mostRecent > oneDay) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = sorted[i - 1] - sorted[i];
    if (diff <= oneDay) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export default function HomeScreen({
  progress,
  onStartPractice,
  onSettings,
  onNameChange,
}: HomeScreenProps) {
  const [isEditingName, setIsEditingName] = useState(!progress.name);
  const [nameInput, setNameInput] = useState(progress.name);

  const levelTitle = LEVEL_TITLES[progress.level] ?? 'Iniciante';
  const xpCurrent = progress.xp - getXpForCurrentLevel(progress.level);
  const xpNeeded = getXpForNextLevel(progress.level) - getXpForCurrentLevel(progress.level);
  const xpPercent = Math.min((xpCurrent / xpNeeded) * 100, 100);
  const streak = getStreakDays(progress.practiceDays);

  const totalStars = Object.values(progress.stars).reduce((a, b) => a + b, 0);
  const lessonsCompleted = Object.keys(progress.bestScores).length;
  const totalPracticeDays = progress.practiceDays.length;

  function handleNameSubmit() {
    const trimmed = nameInput.trim();
    if (trimmed) {
      onNameChange(trimmed);
      setIsEditingName(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f0d1a] flex flex-col items-center px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
          <span className="mr-2">🎹</span>KeyBoard Hero
        </h1>
        <p className="text-gray-400 text-sm">Aprenda teclado no seu ritmo</p>
      </div>

      {/* User Name */}
      <div className="w-full max-w-md mb-6">
        {isEditingName ? (
          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="Seu nome..."
              autoFocus
              className="flex-1 bg-[#1a1730] border border-purple-800/30 rounded-xl px-4 py-3 text-white placeholder-gray-500 outline-none focus:border-purple-500 transition-all duration-300"
            />
            <button
              onClick={handleNameSubmit}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-5 py-3 font-semibold transition-all duration-300"
            >
              OK
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditingName(true)}
            className="text-2xl font-semibold text-white hover:text-purple-300 transition-all duration-300"
          >
            {progress.name || 'Jogador'}
          </button>
        )}
      </div>

      {/* Level Badge */}
      <div className="bg-[#1a1730] border border-purple-800/30 rounded-2xl px-6 py-4 mb-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-3">
          <span className="text-lg font-semibold text-white">
            Nível {progress.level} — {levelTitle}
          </span>
          <span className="text-sm text-gray-400">
            {progress.xp} XP
          </span>
        </div>

        {/* XP Progress Bar */}
        <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-purple-600 to-cyan-400 transition-all duration-500"
            style={{ width: `${xpPercent}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-1 text-right">
          {xpCurrent} / {xpNeeded} XP
        </p>
      </div>

      {/* Streak */}
      {streak > 0 && (
        <div className="bg-[#1a1730] border border-purple-800/30 rounded-xl px-5 py-3 mb-6 w-full max-w-md text-center">
          <span className="text-xl font-bold text-orange-400">
            🔥 {streak} dia{streak !== 1 ? 's' : ''} seguido{streak !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md mb-8">
        <button
          onClick={onStartPractice}
          className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-6 py-4 font-semibold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 shadow-lg shadow-purple-900/40"
        >
          🎵 Praticar
        </button>
        <button
          onClick={onSettings}
          className="flex-1 bg-[#1a1730] hover:bg-[#252040] border border-purple-800/30 text-white rounded-xl px-6 py-4 font-semibold text-lg transition-all duration-300 hover:scale-[1.02] active:scale-95"
        >
          ⚙️ Configurações
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3 w-full max-w-md">
        <div className="bg-[#1a1730] border border-purple-800/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">⭐ {totalStars}</p>
          <p className="text-xs text-gray-400 mt-1">Estrelas</p>
        </div>
        <div className="bg-[#1a1730] border border-purple-800/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-cyan-400">{lessonsCompleted}</p>
          <p className="text-xs text-gray-400 mt-1">Lições</p>
        </div>
        <div className="bg-[#1a1730] border border-purple-800/30 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{totalPracticeDays}</p>
          <p className="text-xs text-gray-400 mt-1">Dias</p>
        </div>
      </div>
    </div>
  );
}
