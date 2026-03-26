import { useState, useEffect, useCallback } from 'react';
import type { Lesson, SessionResult, UserProgress, MidiDevice } from './types';
import { LESSONS } from './lessons/lessonData';
import {
  loadProgress,
  saveProgress,
  addPracticeDay,
  addXP,
  updateBestScore,
  checkAndAwardBadges,
} from './engine/storage';
import { initMidi } from './engine/midiInput';
import { calculateXP } from './engine/scoring';
import { useLLMFeedback } from './hooks/useLLMFeedback';

import HomeScreen from './components/HomeScreen';
import LessonMap from './components/LessonMap';
import GameCanvas from './components/GameCanvas';
import ResultScreen from './components/ResultScreen';

type Screen = 'home' | 'lessons' | 'game' | 'result' | 'settings';

function getUnlockedLessons(progress: UserProgress): Lesson[] {
  return LESSONS.map((lesson, i) => {
    if (i === 0) return { ...lesson, unlocked: true };
    const prevId = LESSONS[i - 1].id;
    const prevStars = progress.stars[prevId] ?? 0;
    return { ...lesson, unlocked: prevStars >= 1 };
  });
}

// ─── Settings Screen (inline) ──────────────────────────────────────────────────

interface SettingsScreenProps {
  midiDeviceId: string | null;
  onSelectDevice: (id: string | null) => void;
  onResetProgress: () => void;
  onBack: () => void;
}

function SettingsScreen({
  midiDeviceId,
  onSelectDevice,
  onResetProgress,
  onBack,
}: SettingsScreenProps) {
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [useKeyboard, setUseKeyboard] = useState(midiDeviceId === null);
  const [volume, setVolume] = useState(80);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    initMidi()
      .then(setDevices)
      .catch(() => setDevices([]));
  }, []);

  const handleDeviceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === '__keyboard__') {
      setUseKeyboard(true);
      onSelectDevice(null);
    } else {
      setUseKeyboard(false);
      onSelectDevice(val);
    }
  };

  const handleKeyboardToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setUseKeyboard(checked);
    if (checked) {
      onSelectDevice(null);
    } else if (devices.length > 0) {
      onSelectDevice(devices[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <h1 className="text-3xl font-bold text-center">Configuracoes</h1>

        {/* MIDI Device */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400">
            Dispositivo MIDI
          </label>
          <select
            value={useKeyboard ? '__keyboard__' : midiDeviceId ?? '__keyboard__'}
            onChange={handleDeviceChange}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="__keyboard__">Teclado do computador</option>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.manufacturer})
              </option>
            ))}
          </select>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={useKeyboard}
              onChange={handleKeyboardToggle}
              className="w-5 h-5 rounded bg-gray-800 border-gray-600 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-300">
              Usar teclado do computador
            </span>
          </label>
        </div>

        {/* Volume */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-400">
            Volume: {volume}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-full accent-purple-500"
          />
        </div>

        {/* Reset Progress */}
        <div className="space-y-3 pt-4 border-t border-gray-800">
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full bg-red-900/40 hover:bg-red-900/60 text-red-400 font-semibold py-3 rounded-lg transition-colors"
            >
              Resetar Progresso
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-red-400 text-sm text-center">
                Tem certeza? Isso vai apagar todo o seu progresso!
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    onResetProgress();
                    setShowConfirm(false);
                  }}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg transition-colors"
                >
                  Sim, resetar
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Back */}
        <button
          onClick={onBack}
          className="w-full bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-lg transition-colors mt-6"
        >
          Voltar
        </button>
      </div>
    </div>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────────

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [progress, setProgress] = useState<UserProgress>(() => loadProgress());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [selectedMode, setSelectedMode] = useState<'practice' | 'performance'>('practice');
  const [lastResult, setLastResult] = useState<SessionResult | null>(null);
  const [midiDeviceId, setMidiDeviceId] = useState<string | null>(null);
  const [newBadges, setNewBadges] = useState<string[]>([]);

  const { feedback, isLoading: isLoadingFeedback, requestFeedback } = useLLMFeedback();

  // Persist progress whenever it changes
  useEffect(() => {
    saveProgress(progress);
  }, [progress]);

  const handleNameChange = useCallback((name: string) => {
    setProgress((prev) => ({ ...prev, name }));
  }, []);

  const handleStartPractice = useCallback(() => {
    setScreen('lessons');
  }, []);

  const handleSettings = useCallback(() => {
    setScreen('settings');
  }, []);

  const handleSelectLesson = useCallback(
    (lessonId: string, mode: 'practice' | 'performance') => {
      const lessons = getUnlockedLessons(progress);
      const lesson = lessons.find((l) => l.id === lessonId);
      if (!lesson || !lesson.unlocked) return;

      setSelectedLesson(lesson);
      setSelectedMode(mode);
      setScreen('game');
    },
    [progress]
  );

  const handleGameComplete = useCallback(
    (result: SessionResult) => {
      if (!selectedLesson) return;

      // Calculate XP
      const xpGained = calculateXP(
        result.stars,
        selectedLesson.difficulty,
        result.maxCombo
      );

      // Update progress
      let updated = { ...progress };
      updated = addPracticeDay(updated);
      updated = addXP(updated, xpGained);
      updated = updateBestScore(updated, selectedLesson.id, result);

      const beforeBadges = new Set(updated.badges);
      updated = checkAndAwardBadges(updated);
      const afterBadges = new Set(updated.badges);

      // Find newly earned badges
      const earned = [...afterBadges].filter((b) => !beforeBadges.has(b));
      setNewBadges(earned);

      setProgress(updated);
      setLastResult(result);
      setScreen('result');

      // Request AI feedback async
      requestFeedback(result, selectedLesson);
    },
    [progress, selectedLesson, requestFeedback]
  );

  const handleRetry = useCallback(() => {
    if (!selectedLesson) return;
    setLastResult(null);
    setNewBadges([]);
    setScreen('game');
  }, [selectedLesson]);

  const handleNext = useCallback(() => {
    setLastResult(null);
    setNewBadges([]);
    setScreen('lessons');
  }, []);

  const handleHome = useCallback(() => {
    setLastResult(null);
    setNewBadges([]);
    setSelectedLesson(null);
    setScreen('home');
  }, []);

  const handleResetProgress = useCallback(() => {
    const fresh: UserProgress = {
      name: '',
      level: 1,
      xp: 0,
      bestScores: {},
      stars: {},
      practiceDays: [],
      badges: [],
    };
    setProgress(fresh);
    saveProgress(fresh);
    setScreen('home');
  }, []);

  const handleBack = useCallback(() => {
    switch (screen) {
      case 'lessons':
      case 'settings':
        setScreen('home');
        break;
      case 'game':
        setScreen('lessons');
        break;
      case 'result':
        setScreen('lessons');
        break;
      default:
        setScreen('home');
    }
  }, [screen]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  switch (screen) {
    case 'home':
      return (
        <HomeScreen
          progress={progress}
          onStartPractice={handleStartPractice}
          onSettings={handleSettings}
          onNameChange={handleNameChange}
        />
      );

    case 'lessons':
      return (
        <LessonMap
          lessons={getUnlockedLessons(progress)}
          progress={progress}
          onSelectLesson={handleSelectLesson}
          onBack={handleBack}
        />
      );

    case 'game':
      if (!selectedLesson) {
        setScreen('lessons');
        return null;
      }
      return (
        <GameCanvas
          lesson={selectedLesson}
          mode={selectedMode}
          midiDeviceId={midiDeviceId}
          onComplete={handleGameComplete}
          onBack={handleBack}
        />
      );

    case 'result':
      if (!lastResult || !selectedLesson) {
        setScreen('home');
        return null;
      }
      return (
        <ResultScreen
          result={lastResult}
          lesson={selectedLesson}
          aiFeedback={feedback}
          isLoadingFeedback={isLoadingFeedback}
          newBadges={newBadges}
          onRetry={handleRetry}
          onNext={handleNext}
          onHome={handleHome}
        />
      );

    case 'settings':
      return (
        <SettingsScreen
          midiDeviceId={midiDeviceId}
          onSelectDevice={setMidiDeviceId}
          onResetProgress={handleResetProgress}
          onBack={handleBack}
        />
      );

    default:
      return null;
  }
}

export default App;
