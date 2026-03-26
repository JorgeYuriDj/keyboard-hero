import { useState, useCallback, useRef } from 'react';
import type { SessionResult, Lesson } from '../types';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT =
  'Voce e um professor de teclado musical experiente e motivador. ' +
  'Seu aluno e um adolescente aprendendo teclado. ' +
  'Analise os resultados da sessao de pratica e de um feedback curto (maximo 3-4 frases) em portugues brasileiro. ' +
  'Seja positivo, identifique o ponto forte, sugira uma melhoria especifica, e de uma missao para a proxima sessao. ' +
  'Use linguagem jovem e motivadora.';

function getFallbackMessage(stars: number): string {
  switch (stars) {
    case 3:
      return 'Incrivel! Voce mandou muito bem!';
    case 2:
      return 'Bom trabalho! Continue praticando.';
    case 1:
      return 'Esta no caminho certo, nao desista!';
    default:
      return 'Cada erro e um aprendizado. Tente de novo!';
  }
}

export function useLLMFeedback(): {
  feedback: string | null;
  isLoading: boolean;
  requestFeedback: (result: SessionResult, lesson: Lesson) => void;
} {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const requestFeedback = useCallback(
    async (result: SessionResult, lesson: Lesson) => {
      // Abort any in-flight request before starting a new one
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setFeedback(null);
      setIsLoading(true);

      const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined;

      if (!apiKey) {
        setFeedback(getFallbackMessage(result.stars));
        setIsLoading(false);
        return;
      }

      const userMessage = JSON.stringify({
        licao: lesson.title,
        modo: result.mode,
        score: result.score,
        estrelas: result.stars,
        perfect: result.perfect,
        good: result.good,
        ok: result.ok,
        miss: result.miss,
        maxCombo: result.maxCombo,
        totalNotas: result.totalNotes,
        duracao: `${Math.round(result.duration)}s`,
      });

      try {
        const response = await fetch(GROQ_API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: userMessage },
            ],
            temperature: 0.7,
            max_tokens: 256,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status}`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content;

        if (typeof content === 'string' && content.trim().length > 0) {
          setFeedback(content.trim());
        } else {
          setFeedback(getFallbackMessage(result.stars));
        }
      } catch (err: unknown) {
        // Don't update state if this request was aborted (a newer request replaced it)
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFeedback(getFallbackMessage(result.stars));
      } finally {
        // Only clear loading if this is still the active request
        if (abortRef.current === controller) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  return { feedback, isLoading, requestFeedback };
}
