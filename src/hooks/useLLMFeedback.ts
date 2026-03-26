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

function getFallbackMessage(result: SessionResult): string {
  const { stars, perfect, miss, totalNotes, maxCombo } = result;

  if (stars === 3) {
    return `Incrivel! ${perfect} notas perfeitas de ${totalNotes}! Voce arrasou! Tente a proxima licao pra continuar evoluindo.`;
  }
  if (stars === 2) {
    return `Bom trabalho! Voce acertou a maioria. Tente de novo pra pegar as 3 estrelas — foco nas notas que voce errou!`;
  }
  if (stars === 1) {
    return `Esta no caminho certo! Voce conseguiu ${totalNotes - miss} de ${totalNotes} notas. Use o modo Praticar pra ir no seu ritmo.`;
  }
  // 0 stars
  if (miss === totalNotes) {
    return `Nao desanima! Use o modo Praticar — ele pausa e espera voce acertar cada nota. Comece devagar e vai aumentando o ritmo!`;
  }
  return `Errar faz parte do aprendizado! Voce acertou ${totalNotes - miss} nota${totalNotes - miss !== 1 ? 's' : ''}. Tente o modo Praticar — ele te ajuda a acertar uma nota de cada vez.`;
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
        setFeedback(getFallbackMessage(result));
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
          setFeedback(getFallbackMessage(result));
        }
      } catch (err: unknown) {
        // Don't update state if this request was aborted (a newer request replaced it)
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setFeedback(getFallbackMessage(result));
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
