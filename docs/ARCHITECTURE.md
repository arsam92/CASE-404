# CASE 404 — Architecture

## Design goals

1. **Data-driven content** — cases, characters, evidence and the story plan are JSON. Adding a case requires no engine changes.
2. **Separation of concerns** — engine (state & flow) / systems (gameplay features) / UI (rendering) never reach into each other's internals; they communicate through a tiny event bus.
3. **Mobile-first** — DOM rendering (no canvas/3D), tap interactions, safe-area aware CSS, offline localStorage saves, procedural audio (no asset downloads).

## Module map

```
index.html
└── src/main.js ...................... boot, audio unlock, tap-through guard
    ├── engine/
    │   ├── bus.js ................... event bus (decoupling)
    │   ├── state.js ................. profile (state), NPC relationships,
    │   │                             condition engine (req), effects engine,
    │   │                             evidence store, case lifecycle
    │   ├── save.js .................. localStorage: 3 slots + autosave + meta
    │   ├── data.js .................. fetch + cache for /data JSON
    │   ├── audio.js ................. Web Audio: SFX synth + ambient music modes
    │   └── engine.js ................ phase runner: goto(phase) → renderer,
    │                                 case lifecycle, completion, unlock chain
    ├── systems/
    │   ├── evidence.js .............. archive browser, detail view,
    │   │                             "present evidence" bottom sheet (Promise)
    │   ├── dialogue.js .............. node-graph conversations, gated options,
    │   │                             present-confrontations inside dialogue
    │   ├── courtroom.js ............. script walker: lines, testimonies
    │   │                             (PRESS/PRESENT/NEXT), breaks, choices
    │   ├── phone.js ................. phone overlay + 8 apps
    │   ├── board.js ................. SVG connection graph (drag, pan, zoom)
    │   ├── threat.js ................ threat ladder 0–7 + escalation UI
    │   └── endings.js ............... endings A–E computation (final case)
    └── ui/
        ├── screens.js ............... boot, menu, brief, case select, archives,
        │                             pause, settings, save/load, case complete
        ├── locations.js ............. hub + location hotspot renderer
        ├── hud.js ................... top bar, toasts, stamps, typewriter
        └── styles/main.css .......... the entire visual system
```

## Data flow

```
data/cases/case0NN.json ─┐
data/characters.json ────┤ fetch+cache → G (state)
data/evidence.json ──────┘
        │
        ▼
Engine.goto(phaseId) ───► phase renderer ───► user input
        ▲                                        │
        │            effects (ev:, flag:, rel:, msg:, board:, threat:…)
        └──────────── state.js (applyEffects) ◄──┘
                        │
                        ├── bus events → HUD toasts, audio, threat banner
                        └── Store.auto() → localStorage
```

### The phase runner

`Engine.goto(phaseId)` is the single flow primitive:

1. find the phase in `G.caseData.phases`
2. emit `transition` (arms the tap-through guard)
3. clear the stage (every phase owns the whole screen)
4. apply `enterEffects` / conditional `enterEffectsReq`
5. dispatch to the type renderer (narrative, hub, location, dialogue, present, decision, courtroom, action, phone, epilogue)
6. renderers call `goto(next)` / return-to-hub when finished

### Conditions & effects (the story DSL)

Story logic is expressed in data via two tiny DSLs (see `docs/ADDING_CASES.md`):

- `req` — `ev:e103`, `flag:x`, `rel:sarah.trust>=20`, `done:1`, `outcome:1:strong`, `threat>=3`, combinable with `&`
- effects — `ev:`, `flag:`, `cflag:`, `rel:`, `remember:`, `threat:`, `msg:`, `note:`, `call:`, `board:`, `obj:`, `objdone:`, `unlock:`, `choice:`, `sfx:`, `music:`, `verdict:`, `penalty:`, `endcase:`

Both are implemented in `engine/state.js` (`reqOk`, `applyEffects`) and are
pure data — which is what makes cases fully declarative.

### State shape (what gets saved)

```jsonc
{
  "progress": { "unlocked": 1, "currentCase": 1, "completed": {"0":"pass_a"}, "choices": [], "seenEndings": [] },
  "evidence": [{ "id": "e_sheet", "caseId": 0 }],
  "caseState": { "caseId": 1, "phase": "p_hub", "flags": {}, "objectives": [], "penalty": 0, "verdict": null },
  "npc": { "sarah": { "trust": 22, "fear": 0, "loyalty": 50, "suspicion": 0, "respect": 4, "met": true, "memory": ["..."] } },
  "flags": {}, "threat": { "level": 1, "events": [] },
  "phone": { "messages": [], "calls": [], "notes": [], "photos": [] },
  "board": { "nodes": [], "links": [] },
  "settings": { "music": 0.6, "sfx": 0.8, "textSpeed": "normal" }
}
```

Saves are forward-merged onto `freshProfile()` on load, so adding fields never
breaks old saves.

### Tap-through guard

Mobile taps produce `pointerup` → screen transition → trailing `click` on
whatever appeared underneath. The guard in `main.js` records the last
`pointerdown` time and the last transition time; a `click` whose gesture began
**before** the most recent transition is discarded once. Fresh gestures always
pass — no input lag.

### Audio

`engine/audio.js` synthesizes everything at runtime: filtered-noise impacts
(doors, gavel, stamps), two-tone notifications, detuned-saw drones + sparse
generative notes per mode (`menu`, `investigate`, `court`, `danger`, `calm`).
The AudioContext starts on the first user gesture (mobile autoplay policy).

## Extending the engine

- **New phase type** → add a renderer branch in `Engine.goto` + a `case` block in the switch.
- **New phone app** → add an entry to `APPS` and a `renderX(body)` in `phone.js`.
- **New effect verb** → one `case` in `applyEffects` (+ optional `bus` event).
- **Endings** → requirements live in `endings.js` + `data/story-plan.json`; CASE 023 calls `Endings.compute(G.s)`.
