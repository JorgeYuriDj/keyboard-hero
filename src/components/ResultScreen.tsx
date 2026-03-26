import { useEffect, useState } from 'react';
import type { Lesson, SessionResult } from '../types';

interface ResultScreenProps {
  result: SessionResult;
  lesson: Lesson;
  aiFeedback: string | null;
  isLoadingFeedback: boolean;
  newBadges: string[];
  xpEarned: number;
  onRetry: () => void;
  onNext: () => void;
  onHome: () => void;
}

const BADGE_NAMES: Record<string, string> = {
  'first_lesson': '🎵 Primeira Lição!',
  'perfect_score': '⭐ Score Perfeito!',
  'combo_50': '🔥 Combo de 50!',
  'streak_3': '📅 3 Dias Seguidos!',
  'streak_7': '🏆 7 Dias Seguidos!',
  'all_stars': '👑 Todas as Estrelas!',
};

function AnimatedStars({ count }: { count: number }) {
  const [visible, setVisible] = useState(0);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= 3; i++) {
      timers.push(setTimeout(() => setVisible(i), i * 400));
    }
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="flex justify-center gap-3 mb-3">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={`text-4xl transition-all duration-500 ${
            visible >= i
              ? i <= count
                ? 'scale-110 opacity-100'
                : 'scale-100 opacity-40'
              : 'scale-50 opacity-0'
          }`}
        >
          {i <= count ? '⭐' : '☆'}
        </span>
      ))}
    </div>
  );
}

function StatCell({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-[#0f0d1a] rounded-xl p-2 text-center border border-purple-800/20">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  );
}

export default function ResultScreen({
  result,
  lesson,
  aiFeedback,
  isLoadingFeedback,
  newBadges,
  xpEarned,
  onRetry,
  onNext,
  onHome,
}: ResultScreenProps) {
  const [showBadgePopup, setShowBadgePopup] = useState(newBadges.length > 0);
  const [xpAnimated, setXpAnimated] = useState(false);
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);

  // Calculate precision percentage based on hit quality
  const precision =
    result.totalNotes > 0
      ? Math.round(
          ((result.perfect * 100 + result.good * 75 + result.ok * 50) /
            (result.totalNotes * 100)) *
            100
        )
      : 0;

  useEffect(() => {
    const timer = setTimeout(() => setXpAnimated(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#0f0d1a] flex flex-col relative">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-28 flex flex-col items-center">
        {/* Lesson Title */}
        <p className="text-gray-400 text-sm mb-1">{lesson.title}</p>
        <p className="text-gray-500 text-xs mb-4">
          {result.mode === 'practice' ? 'Modo Prática' : 'Modo Desafio'}
        </p>

        {/* Stars Animation */}
        <AnimatedStars count={result.stars} />

        {/* Score as points */}
        <div className="text-center mb-1">
          <p className="text-4xl font-bold text-white mb-0.5">
            {Math.round(result.score)} pontos
          </p>
          <p className="text-gray-400 text-sm">Pontuação</p>
        </div>

        {/* Precision percentage */}
        <p className="text-lg text-purple-300 mb-3">
          Precisão: {precision}%
        </p>

        {/* XP Earned */}
        <div
          className={`mb-4 text-center transition-all duration-700 ${
            xpAnimated ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <span className="text-xl font-bold text-purple-400">
            +{xpEarned} XP
          </span>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-2 w-full max-w-lg mb-4">
          <StatCell label="Perfeito" value={result.perfect} color="text-green-400" />
          <StatCell label="Bom" value={result.good} color="text-yellow-400" />
          <StatCell label="Ok" value={result.ok} color="text-orange-400" />
          <StatCell label="Erro" value={result.miss} color="text-red-400" />
        </div>

        {/* Max Combo */}
        <div className="bg-[#1a1730] border border-purple-800/30 rounded-xl px-6 py-2 mb-4 w-full max-w-lg text-center">
          <span className="text-sm text-gray-400">Combo Máximo: </span>
          <span className="text-xl font-bold text-cyan-400">
            {result.maxCombo}x
          </span>
        </div>

        {/* AI Feedback Card — collapsible */}
        <div className="w-full max-w-lg mb-4">
          <div className="bg-gradient-to-br from-purple-700 to-purple-900 rounded-2xl p-4 border border-purple-600/30 shadow-lg shadow-purple-900/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">🤖</span>
              <h3 className="text-white font-semibold text-sm">Coach IA</h3>
            </div>
            {isLoadingFeedback ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-purple-200 text-sm">Analisando sua performance...</p>
              </div>
            ) : aiFeedback ? (
              <div>
                <p
                  className={`text-white text-sm leading-relaxed whitespace-pre-wrap ${
                    !feedbackExpanded ? 'line-clamp-3' : ''
                  }`}
                >
                  {aiFeedback}
                </p>
                {aiFeedback.length > 150 && (
                  <button
                    onClick={() => setFeedbackExpanded(!feedbackExpanded)}
                    className="text-purple-200 text-xs mt-1 underline hover:text-white transition-colors"
                  >
                    {feedbackExpanded ? 'ver menos' : 'ver mais'}
                  </button>
                )}
              </div>
            ) : (
              <p className="text-purple-200 text-sm italic">
                Feedback indisponível no momento.
              </p>
            )}
          </div>
        </div>

        {/* Back to home link (inside scrollable area) */}
        <button
          onClick={onHome}
          className="text-gray-500 hover:text-gray-300 text-sm transition-all duration-300"
        >
          Voltar ao início
        </button>
      </div>

      {/* Fixed bottom action buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0f0d1a] border-t border-purple-800/20 px-4 py-3">
        <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto">
          <button
            onClick={onRetry}
            className="flex-1 bg-[#1a1730] hover:bg-[#252040] border border-purple-800/30 text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95"
          >
            🔄 Tentar Novamente
          </button>
          <button
            onClick={onNext}
            className="flex-1 bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-95"
          >
            ➡️ Próxima Lição
          </button>
        </div>
      </div>

      {/* Badge Popup */}
      {showBadgePopup && newBadges.length > 0 && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
          onClick={() => setShowBadgePopup(false)}
        >
          <div
            className="bg-[#1a1730] border border-yellow-500/50 rounded-2xl p-8 text-center max-w-sm w-full shadow-lg shadow-yellow-600/20 transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-5xl mb-4">🏆</p>
            <h3 className="text-xl font-bold text-yellow-400 mb-2">
              Nova Conquista!
            </h3>
            <div className="flex flex-col gap-2 mb-6">
              {newBadges.map((badge) => (
                <span
                  key={badge}
                  className="text-white bg-yellow-600/20 border border-yellow-500/30 rounded-lg px-4 py-2 text-sm font-semibold"
                >
                  {BADGE_NAMES[badge] ?? badge}
                </span>
              ))}
            </div>
            <button
              onClick={() => setShowBadgePopup(false)}
              className="bg-purple-600 hover:bg-purple-500 text-white rounded-xl px-6 py-3 font-semibold transition-all duration-300"
            >
              Continuar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
