import { useState } from 'react';
import type { Lesson, UserProgress } from '../types';

interface LessonMapProps {
  lessons: Lesson[];
  progress: UserProgress;
  onSelectLesson: (lessonId: string, mode: 'practice' | 'performance') => void;
  onBack: () => void;
}

function DifficultyDots({ level }: { level: number }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={`w-2 h-2 rounded-full transition-all duration-300 ${
            i <= level ? 'bg-purple-400' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

function StarDisplay({ earned }: { earned: number }) {
  return (
    <span className="text-lg tracking-wide">
      {[1, 2, 3].map((i) => (
        <span key={i} className={i <= earned ? '' : 'opacity-30'}>
          {i <= earned ? '⭐' : '☆'}
        </span>
      ))}
    </span>
  );
}

export default function LessonMap({
  lessons,
  progress,
  onSelectLesson,
  onBack,
}: LessonMapProps) {
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  // Determine which lesson is the next unlockable (first locked one after all unlocked)
  const nextUnlockableIndex = lessons.findIndex((l) => !l.unlocked);
  const nextUnlockableId = nextUnlockableIndex >= 0 ? lessons[nextUnlockableIndex].id : null;

  function handleCardClick(lesson: Lesson) {
    if (!lesson.unlocked) return;
    setSelectedLesson(lesson);
  }

  const bestScore = selectedLesson
    ? progress.bestScores[selectedLesson.id]
    : null;

  return (
    <div className="min-h-screen bg-[#0f0d1a] flex flex-col items-center px-4 py-6">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center mb-6">
        <button
          onClick={onBack}
          className="bg-[#1a1730] hover:bg-[#252040] border border-purple-800/30 text-white rounded-xl px-4 py-2 font-semibold transition-all duration-300"
        >
          ← Voltar
        </button>
        <h2 className="flex-1 text-center text-2xl font-bold text-white">
          Mapa de Licoes
        </h2>
        <div className="w-20" /> {/* Spacer for centering */}
      </div>

      {/* Vertical journey line */}
      <div className="relative w-full max-w-lg">
        {/* Connecting line */}
        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-purple-800/40" />

        {/* Lesson Cards */}
        <div className="flex flex-col gap-4">
          {lessons.map((lesson, index) => {
            const stars = progress.stars[lesson.id] ?? 0;
            const best = progress.bestScores[lesson.id];
            const isLocked = !lesson.unlocked;
            const isNextUnlockable = lesson.id === nextUnlockableId;

            return (
              <button
                key={lesson.id}
                onClick={() => handleCardClick(lesson)}
                disabled={isLocked}
                className={`relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left w-full
                  ${
                    isLocked
                      ? 'bg-[#1a1730]/50 border-gray-800/30 opacity-50 cursor-not-allowed'
                      : isNextUnlockable
                        ? 'bg-[#1a1730] border-purple-500 shadow-lg shadow-purple-600/20 cursor-pointer hover:bg-[#252040]'
                        : 'bg-[#1a1730] border-purple-800/30 cursor-pointer hover:bg-[#252040] hover:border-purple-600/50'
                  }
                  ${isNextUnlockable ? 'animate-pulse' : ''}
                `}
              >
                {/* Lesson number circle */}
                <div
                  className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm
                    ${
                      isLocked
                        ? 'bg-gray-800 text-gray-500'
                        : stars > 0
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#252040] text-purple-300 border border-purple-600'
                    }
                  `}
                >
                  {isLocked ? '🔒' : index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-semibold truncate ${
                        isLocked ? 'text-gray-500' : 'text-white'
                      }`}
                    >
                      {lesson.title}
                    </h3>
                    {!isLocked && <StarDisplay earned={stars} />}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <DifficultyDots level={lesson.difficulty} />
                    {best && (
                      <span className="text-sm text-gray-400">
                        {Math.round(best.score)}%
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Lesson Detail Modal */}
      {selectedLesson && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedLesson(null)}
        >
          <div
            className="bg-[#1a1730] border border-purple-800/30 rounded-2xl p-6 w-full max-w-md transition-all duration-300 animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">
                {selectedLesson.title}
              </h3>
              <button
                onClick={() => setSelectedLesson(null)}
                className="text-gray-400 hover:text-white text-2xl transition-all duration-300"
              >
                ×
              </button>
            </div>

            {/* Description */}
            <p className="text-gray-400 text-sm mb-4 leading-relaxed">
              {selectedLesson.description}
            </p>

            {/* Difficulty & BPM */}
            <div className="flex items-center gap-4 mb-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">Dificuldade:</span>
                <DifficultyDots level={selectedLesson.difficulty} />
              </div>
              <span className="text-xs text-gray-500">
                {selectedLesson.bpm} BPM
              </span>
            </div>

            {/* Best Score Details */}
            {bestScore && (
              <div className="bg-[#0f0d1a] rounded-xl p-3 mb-5 border border-purple-800/20">
                <p className="text-sm text-gray-400 mb-1">Melhor resultado:</p>
                <div className="flex items-center justify-between">
                  <StarDisplay earned={progress.stars[selectedLesson.id] ?? 0} />
                  <span className="text-lg font-bold text-white">
                    {Math.round(bestScore.score)}%
                  </span>
                </div>
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span className="text-green-400">
                    P:{bestScore.perfect}
                  </span>
                  <span className="text-yellow-400">
                    B:{bestScore.good}
                  </span>
                  <span className="text-orange-400">
                    OK:{bestScore.ok}
                  </span>
                  <span className="text-red-400">
                    E:{bestScore.miss}
                  </span>
                </div>
              </div>
            )}

            {/* Mode Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  onSelectLesson(selectedLesson.id, 'practice');
                  setSelectedLesson(null);
                }}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                🎯 Praticar
                <span className="block text-xs font-normal text-purple-200 mt-0.5">
                  Pausas para corrigir
                </span>
              </button>
              <button
                onClick={() => {
                  onSelectLesson(selectedLesson.id, 'performance');
                  setSelectedLesson(null);
                }}
                className="flex-1 bg-[#06b6d4] hover:bg-[#22d3ee] text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95"
              >
                🎹 Tocar
                <span className="block text-xs font-normal text-cyan-100 mt-0.5">
                  Sem pausas
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
