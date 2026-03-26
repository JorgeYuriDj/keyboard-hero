# CLAUDE.md — KeyBoard Hero

## O que e este projeto
App web (React + TypeScript + Canvas 2D) que ensina teclado a adolescentes estilo Guitar Hero/Synthesia. Conecta via WebMIDI ao Yamaha PSR-SX600. Feedback IA via Groq API.

## Comandos essenciais
```bash
npm run dev      # Dev server (http://localhost:5173)
npm run build    # Build producao (tsc + vite build)
npm run preview  # Preview do build
```

## Estrutura do projeto
```
src/
  engine/         # Motor do jogo (sem React)
    renderer.ts   # Canvas 2D falling notes
    midiInput.ts  # WebMIDI + fallback teclado
    midiParser.ts # Parser de arquivos MIDI
    audioPlayer.ts # Tone.js playback
    scoring.ts    # Hit detection + scoring
    storage.ts    # localStorage persistence
  components/     # React components
    GameCanvas.tsx    # Tela de jogo (orquestra o engine)
    HomeScreen.tsx    # Tela inicial
    LessonMap.tsx     # Mapa de licoes
    ResultScreen.tsx  # Resultados + feedback IA
  lessons/
    lessonData.ts # 10 licoes progressivas (notas geradas em codigo)
  hooks/
    useLLMFeedback.ts # Hook para Groq API
  types/
    index.ts      # Tipos centrais (MidiNote, GameState, etc)
  App.tsx         # State machine de navegacao entre telas
```

## Decisoes tecnicas (ORDEM SUPREMA: Manual Tecnico)
- **Arquitetura hibrida** conforme Manual: React para UI, Canvas nativo para rendering
- **TarsosDSP substituido por WebMIDI** para o MVP web (TarsosDSP e Java-only)
- **Groq API** como provedor LLM (Manual recomenda Groq ou Together.ai)
- **Filtro de confianca** simplificado no MVP: fallback pre-escrito se API falhar
- **UX prioridades** do Manual: Eficiencia (36.9%) > Compreensibilidade (32.6%)
- **localStorage** no lugar de Room database (web app, nao nativo Android)

## Convencoes
- TypeScript strict mode (noUnusedLocals, noUnusedParameters)
- Tailwind CSS para estilizacao (sem CSS custom exceto index.css)
- Engine files nao importam React (puro TypeScript para performance)
- Tipos centrais em src/types/index.ts
- Licoes definidas em codigo (nao em MIDI files) para simplicidade

## Variaveis de ambiente
- `VITE_GROQ_API_KEY` — chave da Groq API (obrigatorio para feedback IA)
- `VITE_GROQ_API_URL` — URL da API (default: https://api.groq.com/openai/v1/chat/completions)

## O que NAO fazer
- NAO instalar dependencias nativas (este e um web app)
- NAO commitar .env com API keys
- NAO usar CSS modules ou styled-components (Tailwind only)
- NAO adicionar features fora do plano sem consultar PLANO_3_DIAS_MVP.md
- NAO ignorar o Manual Tecnico para decisoes de arquitetura
