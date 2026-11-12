---
title: TorqueIntel
emoji: 🏎️
colorFrom: indigo
colorTo: gray
sdk: static
pinned: false
short_description: Automotive intelligent agent for vehicle reliability.
---

# Torque Intel

Torque Intel is a student agentic AI project: a small automotive research
agent that runs entirely in the browser as a Hugging Face Static Space.

It is built with plain HTML, CSS, JavaScript, and JSON. There is no
framework, no build step, and no server.

**Current scope:** Ford Mustang GT, model years 2015 through 2023.

## How a request flows

```
User
→ Security / Scope Guard
→ Coordinating Agent
→ Selected tools
→ Human approval gate (before compareVehicles)
→ Response
```

## Files

| File | Purpose |
|---|---|
| `index.html` | The page: question box, status line, result modal |
| `style.css` | Styling for the app and the evaluation page |
| `agent.js` | Limits, security / scope guard, coordinating agent (no page code) |
| `tools.js` | Tools that return data: `getVehicleInfo`, `getRecalls`, `searchReliability`, `compareVehicles` |
| `app.js` | Page logic: reads the question, calls the agent and tools, shows results |
| `data/vehicles.json` | Local vehicle dataset |
| `eval/index.html` | Evaluation page |
| `eval/run-eval.js` | Evaluation runner (pass@1 and pass^3) |
| `eval/test-cases.json` | Evaluation cases |
| `Claude.md` | Project specification |

## Status

This is a work in progress.

- `getVehicleInfo` is implemented, but `data/vehicles.json` still needs its data.
- `getRecalls`, `searchReliability`, and `compareVehicles` are placeholders.
- The human approval gate does not have Approve / Cancel buttons yet.
- `eval/test-cases.json` still needs its cases.

## Run locally

The app loads JSON with `fetch`, so it must be served over HTTP rather than
opened as a file:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` for the app, or
`http://localhost:8000/eval/` for the evaluation runner.

## Data format

`data/vehicles.json` is an array (or object) of vehicles shaped like this.
The values below show the format only:

```json
{
    "year": 0,
    "make": "Ford",
    "model": "Mustang",
    "trim": "GT",
    "engine": "...",
    "horsepower": 0,
    "drivetrain": "...",
    "transmissions": ["...", "..."]
}
```

## Evaluation

`eval/test-cases.json` is an array of cases:

```json
{
    "id": "info-01",
    "category": "vehicle_information",
    "input": "What engine does a 2020 Mustang GT have?",
    "expected": {
        "allowed": true,
        "intent": "vehicle_information"
    }
}
```

Each case runs three times. **pass@1** is the share of cases that pass on
the first run; **pass^3** is the share that pass on all three runs.
