# KeyBoard Hero

App web de ensino de teclado estilo Guitar Hero/Synthesia para adolescentes.

## Como usar

```bash
npm install
npm run dev
```

Abrir `http://localhost:5173` no Chrome/Edge.

## Conexao MIDI

Conecte o teclado Yamaha PSR-SX600 via USB. O app detecta automaticamente via WebMIDI.

Sem teclado MIDI? Use o teclado do computador:
- **Q W E R T Y U I** = notas altas (C4-C5)
- **Z X C V B N M** = notas baixas (C3-B3)
- **Teclas pretas:** S D G H J (row inferior), 2 3 5 6 7 (row superior)

## Stack

React + TypeScript + Vite + Canvas 2D + WebMIDI + Tone.js + Tailwind CSS

## Deploy

```bash
npm run build
```

Deploy automatico via Vercel com `git push`.
