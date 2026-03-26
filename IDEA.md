# IDEA.md — KeyBoard Hero

> "O IDEA.md serve como bussola, nao como especificacao final." — Akita

---

## Conceito

**O que e:** App web estilo Guitar Hero/Synthesia que ensina teclado a adolescentes com notas caindo, conexao MIDI ao Yamaha PSR-SX600 e feedback de IA.

**Problema que resolve:** Adolescente quer aprender teclado de forma divertida e interativa, sem depender de aulas presenciais caras ou apps pagos com assinatura.

**Para quem:** Adolescentes (14-17 anos) aprendendo teclado, com acesso a um teclado Yamaha PSR-SX600 e celular/notebook.

**Por que agora:** WebMIDI API permite conexao direta com teclados USB no browser. LLMs baratos (Groq free tier) viabilizam feedback personalizado. Canvas 2D tem performance excelente para falling notes.

---

## Features Principais (MVP)

1. Falling notes (notas caindo estilo Guitar Hero) com deteccao de acertos em tempo real
2. Conexao WebMIDI ao Yamaha PSR-SX600 (+ fallback teclado do computador)
3. 10 licoes progressivas (Do-Re-Mi ate acordes com melodia)
4. Feedback IA personalizado pos-sessao via Groq API (Llama 3.1 8B)
5. Gamificacao: XP, niveis, estrelas, streaks, badges

**Fora do MVP (versao futura):**
- Import de arquivos MIDI proprios
- Dashboard de analytics (graficos de progresso semanal)
- Treino auditivo (reconhecimento de intervalos)
- APK nativo via Capacitor
- LLM offline com modelo local
- Deteccao de pitch via microfone (FCPE)

---

## Stack Tecnica

| Componente | Escolha | Justificativa |
|-----------|---------|---------------|
| Linguagem | TypeScript | Type safety, ecossistema React, produtividade |
| Framework | React + Vite | Build rapido, HMR, tree-shaking otimo |
| Rendering | Canvas 2D | Performance excelente para falling notes, sem overhead de DOM |
| Audio | Tone.js | Biblioteca madura para sintese e playback MIDI |
| MIDI Parse | @tonejs/midi | Parser MIDI integrado ao ecossistema Tone.js |
| MIDI Input | WebMIDI API | Conexao direta ao Yamaha via USB, nativo no browser |
| Persistencia | localStorage | Simples, sem backend para dados do usuario no MVP |
| LLM | Groq API (Llama 3.1 8B) | Free tier, rapido, bom em portugues |
| Estilo | Tailwind CSS | UI rapida, responsiva, classes utilitarias |
| Deploy | Vercel | Deploy via git push, HTTPS gratis, CDN global |
| CI/CD | GitHub Actions | Lint + build em cada push |

**Versoes fixadas:**
```
node 22
```

---

## Arquitetura de Alto Nivel

```
[Adolescente + Yamaha PSR-SX600]
    |
    | USB-MIDI
    v
[Browser (Chrome/Edge)]
    |
    |-- [React App]
    |     |-- [Canvas 2D] -- Falling Notes Renderer
    |     |-- [WebMIDI API] -- Input do teclado
    |     |-- [Tone.js] -- Audio playback
    |     |-- [localStorage] -- Progresso salvo
    |
    |-- [Groq API] -- Feedback IA pos-sessao
```

**Fluxo principal:**
1. Usuario abre app no browser, seleciona licao
2. Notas caem no Canvas, usuario toca no teclado Yamaha via USB
3. App detecta acertos/erros em tempo real, calcula score
4. Pos-sessao: envia dados para Groq API, recebe feedback motivador
5. Progresso salvo em localStorage (XP, estrelas, badges)

---

## Decisoes Arquiteturais

| Decisao | Alternativa descartada | Motivo |
|---------|----------------------|--------|
| Web App (nao nativo) | React Native, Kotlin nativo | Prazo de 3 dias; funciona em celular E notebook; WebMIDI disponivel |
| Canvas 2D (nao WebGL) | Three.js, Pixi.js | Falling notes nao precisa de 3D; Canvas 2D mais simples e performante |
| localStorage (nao banco) | IndexedDB, SQLite | MVP simples; migrar depois se necessario |
| Groq API (nao local) | Llama.cpp local, Together.ai | Free tier generoso, latencia < 1s, bom em PT-BR |
| Tailwind (nao CSS Modules) | Styled Components, CSS Modules | Velocidade de desenvolvimento, classes utilitarias |

---

## Seguranca

- [x] Rate limiting: Groq API tem rate limit proprio; fallback local se API falhar
- [x] Input validation: dados de sessao validados antes de enviar para API
- [x] Secrets: API key em .env (VITE_GROQ_API_KEY), nunca no codigo
- [ ] CSP headers no deploy (configurar no Vercel)

---

## Deploy e Operacao

**Ambiente de desenvolvimento:**
```bash
cd C:\dev\music-app
npm install
npm run dev
# Abrir http://localhost:5173
```

**Producao:**
- Provider: Vercel (free tier)
- Rollback: `vercel rollback` ou redeploy do commit anterior
- Deploy: automatico via `git push` para main

**CI/CD (GitHub Actions):**
- [x] TypeScript check (tsc --noEmit)
- [x] Build (vite build)
- [ ] Lint (eslint)
- [ ] Security scan (npm audit)

---

## Metricas de Sucesso

- Tecnica: build limpo (0 erros TS), latencia MIDI→visual < 30ms
- Produto: D7 retencao >= 40%, sessao media >= 8min, conclusao curso >= 25%

---

## Riscos e Incognitas

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| WebMIDI nao funciona no celular Android | Media | Alto | Fallback teclado computador; testar com Chrome Android + OTG |
| Latencia MIDI alta em alguns dispositivos | Baixa | Alto | Usar teclado como fonte de som; app so faz visual |
| Groq API fora do ar | Baixa | Medio | Fallback para feedback pre-escrito baseado no score |
| localStorage cheio | Muito baixa | Baixo | Limpar dados antigos; migrar para IndexedDB se necessario |

---

## Cronograma

- [x] Fase 1 — Scaffold + Engine (git init, Vite, Canvas, WebMIDI, scoring)
- [ ] Fase 2 — Teste + Polish (rodar app, corrigir bugs, polir UX)
- [ ] Fase 3 — Deploy producao (Vercel, GitHub, PWA)
- [ ] Fase 4 — Iteracao baseada em uso real

---

## Checklist Selo Akita — Pre-Codigo

- [x] Git inicializado (`git init`)
- [ ] `.tool-versions` criado com versoes fixadas
- [x] `.env.example` documentado (sem valores reais)
- [x] `.gitignore` configurado
- [x] Stack justificada (nao escolhida por hype)
- [x] Estrategia de rollback definida (Vercel rollback)
- [x] CI/CD planejado (GitHub Actions)
- [x] IDEA.md commitado no repositorio
