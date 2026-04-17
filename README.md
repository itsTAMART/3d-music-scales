# 3D Music Scales

Interactive 3D visualization of music scales, chords, and their harmonic relationships. Play notes via the on-screen piano, your computer keyboard, a MIDI controller, or an uploaded audio file — and watch related scales and chords light up across the graph.

**[Live demo](https://itstamart.github.io/3d-music-scales/)** · **[Blog post](https://itstamart.github.io/blog/3d-music-scales)**

## Features

- **3D scale graph** — force-directed layout rendered with Three.js; scales, chords, and notes appear as stars connected by their harmonic relationships.
- **Interactive piano** — on-screen keyboard (click) plus computer-keyboard bindings across two octaves (see the in-app *? Help* overlay).
- **MIDI input** — connect any WebMIDI-compatible controller via the *Connect MIDI* button.
- **Audio analysis** — upload an audio file and the app detects notes from its frequency content in real time.
- **Scale / chord activation** — when all notes of a scale or chord are played within a 2-second rolling window, that node lights up. Sequential arpeggios trigger activation, not just simultaneous chords.
- **Notation toggle** — switch between ABC (`C D E F…`) and Solfège (`Do Re Mi Fa…`) in-place.
- **Layer toggles** — show or hide the *Chords* and *Notes* layers to focus on scale-to-scale relationships.
- **Camera modes** — *Orbit* (auto-rotating), *Follow* (tracks the selected node), *Free* (user-controlled), plus a *Reset* button.
- **Side panels** — click a node to see its notes, chords, and related scales/chords; every entry is clickable to navigate.

## Tech Stack

- **TypeScript** + **Vite 6**
- **Three.js** (r170) + **3d-force-graph** for the 3D graph
- **WebMIDI** for hardware controllers
- **Web Audio API** for file-based note detection
- **Vitest** + **jsdom** for unit tests

## Project Structure

```
src/
  main.ts           Application entry — wires everything together
  audio/            MIDI input, audio-file analysis, note detection
  piano/            On-screen piano SVG, synth, histogram, keyboard bindings
  graph/            3D graph setup, camera motion, node highlighting
  music/            Notation systems (ABC/Solfège), note utilities
  ui/               Layout + scale and chord panels
  data/             Static scale/chord data and graph builders
  styles/           CSS
```

## Getting Started

```bash
npm install
npm run dev          # Vite dev server at http://localhost:5173
```

### Other scripts

```bash
npm run build        # Type-check + build to docs/ (GH Pages source)
npm run preview      # Preview the production build locally
npm test             # Run Vitest once
npm run test:watch   # Watch mode
```

## Deployment

GitHub Pages serves from `master` branch, `/docs` directory. `vite.config.ts` is configured with `outDir: "docs"` and `base: "/3d-music-scales/"`, so `npm run build` produces a ready-to-commit `docs/` folder. Push to `master` and Pages picks it up automatically.

## License

MIT © Daniel Tapia Martinez
