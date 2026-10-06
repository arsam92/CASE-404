#!/usr/bin/env python3
"""Generates data-driven case stubs for CASE 002-023 from the master story plan.
Each stub is a valid case file with status 'development': the engine's case-select
renders them as sealed files, and their hook data is ready to be expanded into
full playable phases (see docs/ADDING_CASES.md)."""
import json, os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
plan = json.load(open(os.path.join(ROOT, 'story-plan.json')))
manifest = json.load(open(os.path.join(ROOT, 'manifest.json')))

plan_by_id = {c['id']: c for c in plan['casePlan']}
man_by_id = {c['id']: c for c in manifest['cases']}

TEMPLATE = {
    "schema": "case-404/1",
    "howToExpand": [
        "Set startPhase to the first phase id.",
        "Add phases: narrative | hub | location | dialogue | present | decision | courtroom | action | phone | epilogue.",
        "Add evidence defs and dialogues. Effects/conditions DSL is documented in docs/ADDING_CASES.md.",
        "End with an epilogue phase carrying outcomeReq (or outcome) and nextCase."
    ]
}

for cid in range(2, 24):
    man, pl = man_by_id[cid], plan_by_id[cid]
    stub = {
        "caseId": cid,
        "code": man["code"],
        "title": man["title"],
        "status": "development",
        "ambient": "investigate",
        "brief": man["brief"],
        "objectives": [],
        "startPhase": None,
        "hook": {
            "plants": pl.get("plants", []),
            "connections": pl.get("connections", []),
            "crimes": pl.get("crimes", [])
        },
        "threatEvents": [t for t in plan["threatLadder"] if t["case"] == cid],
        "phases": [],
        "evidence": [],
        "dialogues": {},
        "template": TEMPLATE
    }
    path = os.path.join(ROOT, 'cases', f'case{cid:03d}.json')
    with open(path, 'w') as f:
        json.dump(stub, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print('wrote', path)
print('done')
