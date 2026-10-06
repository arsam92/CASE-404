# Adding New Cases (CASE 002–023, or CASE 024+)

The engine is **data-driven**: a case is a JSON file, and adding one requires
**zero code changes**. Every case file follows the same schema.

---

## 1. Case file anatomy

```json
{
  "caseId": 2,
  "code": "CASE 002",
  "title": "The Silent Courier",
  "ambient": "investigate",          // menu | investigate | court | danger | calm
  "brief": "One paragraph shown on the case-brief screen.",
  "objectives": ["Find out who took the delivery"],
  "startPhase": "p_intro",
  "entryEffects": ["board:case:c2|CASE 002"],
  "evidence": [ /* evidence defs, see §3 */ ],
  "dialogues": { /* npc -> dialogue trees, see §4 */ },
  "phases": [ /* the case script, see §2 */ ]
}
```

Register the case in `data/manifest.json` and set `"status": "playable"`
(unfinished cases stay `"development"` and render as sealed files).

---

## 2. Phase types

Every phase has `id`, `type`, and flow control (`next`, `back`, or hub return).
A phase may carry `enterEffects` (always applied) and `enterEffectsReq`
(applied only if `req` passes).

| Type | Purpose | Key fields |
|---|---|---|
| `narrative` | Cinematic text beats | `lines: [{sp?, sys?, t, sfx?, fx?, req?}]` |
| `hub` | "Where to?" travel menu | `options: [{label, sub, glyph, goto, flag, once, req, lockedMsg}]`, `proceedReq`, `proceedLabel`, `proceedGoto`, `proceedHint` |
| `location` | Inspectable object grid | `loc`, `title`, `hotspots: [{id, name, glyph, inspects: [{req?, lines, effects}]}]`, `back` |
| `dialogue` | Branching NPC talk | `npc`, `next` (or returns to last hub) |
| `present` | Standalone contradiction | `sp`, `statement`, `prompt`, `correct`, `wrong`, `break`, `effects`, `next` |
| `decision` | Major choice card | `prompt`, `options: [{label, desc, req?, effects?, result?, goto}]` |
| `courtroom` | Trial sequence | `script: [...]`, see §5 |
| `action` | Timed danger gameplay | `title`, `steps: [{t, time, choices: [{label, correct?, lines?, effects?}], failLines?}]`, `successEffects` |
| `phone` | Forced incoming message | `from`, `text`, `actions: [{label, effects?, response?}]`, `next` |
| `epilogue` | Case wrap-up | `lines`, `outcome` **or** `outcomeReq: [{req, outcome}]`, `nextCase`, `completeEffects` |

---

## 3. Evidence definitions

```json
{
  "id": "e201", "label": "EV-201", "name": "Burner Phone #8821",
  "importance": "key",                // key | important | optional | misleading | hidden
  "source": "Courier's satchel", "time": "22:10, Oct 11", "location": "East Docks",
  "related": "Danny Ortiz", "cases": "002, 008",
  "desc": "What the player reads in the archive.",
  "interp": ["First reading.", "Second reading — unlocked by context."],
  "hidden": true                       // optional: hides it from casual listing
}
```

Cross-case evidence lives in `data/evidence.json` (e.g. `e1183`, `e404stub`,
`e_watch`); case-local evidence lives in the case file. The archive resolves
case-local first.

---

## 4. Dialogue trees

```json
"dialogues": {
  "ruth": {
    "start": "start",
    "nodes": {
      "start": {
        "sp": "ruth",
        "t": "I dispatch forty couriers a night. You think I track every one?",
        "opts": [
          { "t": "Where was Danny at 22:00?", "goto": "n_where" },
          { "t": "Phone #8821. Ring a bell?", "req": "ev:e201", "goto": "n_8821" },
          { "t": "Confront her with the dispatch log.", "present": true,
            "correct": "e204",
            "break": [ { "sp": "ruth", "t": "...fine. He carried the phone." } ],
            "wrong": [ { "sp": "ruth", "t": "That log says nothing of the sort." } ],
            "effects": [ "rel:ruth.fear+1" ], "goto": "n_broke" },
          { "t": "That's all.", "goto": "__end" }
        ]
      },
      "n_where": { "sp": "ruth", "t": "On his route. Where else?", "next": "start" }
    }
  }
}
```

- `req` gates options on evidence/flags/relationships (see §6).
- `present: true` turns an option into a confrontation: correct evidence →
  `break` lines + effects; wrong → `wrong` lines + a penalty.

---

## 5. Courtroom scripts

```json
{ "id": "p_court", "type": "courtroom", "next": "p_after",
  "script": [
    { "seg": "line", "sp": "judge", "t": "The court will hear the testimony." },
    { "seg": "testimony", "title": "WITNESS TESTIMONY", "witness": "tomas",
      "statements": [
        { "id": "s1", "t": "I locked the annex at nine.",
          "weak": true, "breakWith": "e103",
          "press": [{ "q": "Which door exactly?", "a": "Front. Then vault." }],
          "break": [ { "fx": "flash", "t": "You present the access log." },
                     { "sp": "tomas", "t": "Twenty-four past nine...?" } ] }
      ],
      "endLines": [ { "sp": "judge", "t": "Step down." } ] },
    { "seg": "choice", "prompt": "How hard do we push?",
      "options": [
        { "label": "Present the full chain", "req": "ev:e107", "choice": "c2_court",
          "result": [ { "sp": "james", "t": "It's one machine, Your Honor." } ],
          "effects": ["flag:c2_confession"] } ] }
  ] }
```

If any `weak` statement is left unbroken, the phase sets `verdict: weak`
(usable in later `req` via `flag:`/outcome design). Broken-all sets
`verdict: strong`.

---

## 6. Conditions (`req`) and Effects

**Conditions** may be combined with `&`:

| Example | Meaning |
|---|---|
| `ev:e103` / `!ev:e103` | has / lacks evidence |
| `flag:c1_confession` / `!flag:...` | global flag |
| `rel:sarah.trust>=20` | relationship threshold |
| `done:1` | case 1 completed (any outcome) |
| `outcome:1:strong` | case 1 closed with a specific outcome |
| `threat>=3` | threat level gate |

**Effects** (arrays of strings):

| Effect | Meaning |
|---|---|
| `ev:e201` | add evidence |
| `flag:x` / `unflag:x` / `cflag:x` | global / case-scoped flags |
| `rel:npc.trust+2` | relationship delta (trust, fear, loyalty, suspicion, respect) |
| `remember:npc|fact` | add a permanent memory note to an NPC |
| `threat:3` | raise threat level |
| `msg:FROM|text` | phone message |
| `note:text` / `call:FROM|text` | phone note / call log |
| `board:person:id|LABEL` | board node (`person|org|case|thing|mystery`) |
| `board:link:idA|idB|label` | board connection |
| `obj:id|Text` / `objdone:id` | objectives |
| `unlock:2` | unlock case 2 |
| `choice:NAME|summary` | record a major decision (feeds endings) |
| `sfx:door` / `music:court` | audio |
| `verdict:strong` / `penalty:+1` | courtroom bookkeeping |

---

## 7. Checklist for a new case

1. Copy the stub for the next case (`data/cases/case0NN.json`) — it already
   contains the story hooks from `data/story-plan.json`.
2. Write phases + evidence + dialogues. Keep dialogue short and natural.
3. Connect at least one prior case (evidence callback, NPC memory, or board link).
4. End with an `epilogue` that maps flags → outcomes via `outcomeReq`, and
   `nextCase`.
5. Set `"status": "playable"` in `data/manifest.json`.
6. Run `python3 scripts/smoke_test.py` (extend it to walk the new case) and
   play through in a browser at 390×844.
7. Update `docs/STORY_PLAN.md` status notes if the canon shifts.
