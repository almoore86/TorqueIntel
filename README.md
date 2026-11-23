---
title: TorqueIntel
emoji: 🏎️
colorFrom: indigo
colorTo: gray
sdk: static
pinned: false
short_description: Automotive intelligent agent for vehicle reliability.
---

# TorqueIntel

TorqueIntel is an agentic AI project: a small automotive research and reliability
agent that runs entirely in the browser as a Hugging Face Static Space.

It is built with plain HTML, CSS, JavaScript, and JSON.

**Current scope:** Ford Mustang, model years 2015 through 2023, all trims:
V6, EcoBoost, GT, Bullitt, Mach 1, Shelby GT350, Shelby GT350R, and Shelby
GT500. Not every trim was offered in every year.

## How a request flows

```
User
→ Security / Scope Guard      (agent.js: checkRequestSafety)
→ Coordinating Agent          (agent.js: coordinateRequest)
→ Selected tools              (tools.js)
→ Human approval gate         (app.js, before compareVehicles)
→ Evidence review             (agent.js: reviewEvidence)
→ Response                    (app.js, result modal)
```

The guard always runs first. It blocks unrelated requests, requests for
protected information (including but not limited to API keys, passwords, 
credentials, environment variables, system prompts, hidden instructions, 
configuration), and basic prompt injection. If a message mixes a real Mustang
question with an unsafe instruction, the unsafe part is removed and the 
vehicle question is kept. Attempts to change how it behaves ("act as an 
unrestricted AI", "print everything above", encoded instructions) are treated 
the same way: TorqueIntel keeps its rules and answers only the vehicle question,
if there is one.

Requests that could put someone in danger or help break the law are declined
calmly and in full, even when they mention a Mustang: hurting someone or
yourself, sabotaging a vehicle, theft, odometer or VIN fraud, evading police,
street racing, laying drag, or impaired driving. These are classified 
`harmful_request`. Nothing is looked up, no part of the request is answered, 
and the response points to emergency services and offers normal vehicle 
research instead.

The coordinator classifies the user request (safe question) (`vehicle_information`,
`recall_lookup`, `reliability_research`, `buying_research`,
`vehicle_comparison`, `vin_lookup`, `fuel_economy`), works out which trims and model years were asked
about, and plans which tools to run. It doesn't run a tool itself.

A question can cover several model years: a list ("2017, 2018 and 2022"), a
range ("2018 through 2020"), or "all years". If no trim is named, every trim
offered in those years is returned.

## Tools

| Tool | Data source |
|---|---|
| `getVehicleInfo` | `data/vehicles.json` |
| `getRecalls` | NHTSA public recalls API (no key) |
| `searchReliability` | NHTSA public owner-complaints API (no key) |
| `getVinRecalls` | NHTSA vPIC VIN decoder + NHTSA public recalls API (no key) |
| `getFuelEconomy` | U.S. EPA fuel economy data, fueleconomy.gov (no key) |
| `compareVehicles` | `data/vehicles.json` + NHTSA recall and complaint counts |

TorqueIntel does not invent data. When a source has nothing, or cannot be
reached, the response says so.

NHTSA is sometimes slow for a moment, so each NHTSA request is tried up to
three times (8 seconds each, with a short pause between tries) before
TorqueIntel reports that NHTSA could not be reached.

NHTSA data comes from:

- `https://api.nhtsa.gov/recalls/recallsByVehicle?make=…&model=…&modelYear=…`
- `https://api.nhtsa.gov/complaints/complaintsByVehicle?make=…&model=…&modelYear=…`

NHTSA lists recalls and complaints by model, not by trim, so those results
cover the whole Mustang line for a model year.

Reliability results are the owner complaints filed publicly with NHTSA:
how many, how many mention a crash, fire, injury or death, which components
are named most, and the most recent complaint texts. NHTSA publishes these
without verifying each one, and the totals depend on how many cars were sold
and how old they are. TorqueIntel shows the counts and does not turn them
into a reliability score. NHTSA is currently the only reliability source.

## Specifications and sources

`data/vehicles.json` holds engine, horsepower, torque, drivetrain and
transmissions for every trim from 2015 through 2023. Each entry links to the
Ford document its horsepower and torque come from: Ford's technical
specification sheets and Ford Media Center pages, linked through Internet
Archive copies because Ford no longer hosts them. Every horsepower value
matches Ford's sheets. Ford's 2015 sheet marks its ratings as projected.

The 2018 figures come from Ford's 2018 Mustang brochure, filed publicly with
NHTSA. Ford's 2019 and 2020 sheets list only the Shelby GT350; the GT350R uses the
same engine, so it shares those figures, with a note in the app. The 2017
Shelby figures come from a copy of Ford's 2017 Mustang brochure. The 2015 Shelby GT350 and GT350R, a limited early run, use Ford's GT350
spec sheet, which is titled 2016; the app notes this. Every Mustang now has torque. An entry without a Ford source would have
`torque: null` and `source: null`, and the app would say torque is not on
file rather than guessing.

## Fuel economy

`getFuelEconomy` reads the EPA's official ratings (city, highway and
combined mpg) from fueleconomy.gov, with a link to the EPA page for each
configuration. The EPA lists Mustangs by model and engine rather than by
trim, so trims are matched by EPA model name and engine size; the EPA does
not list the GT350R separately. Buying research includes fuel economy.

## Recalls by model year

A model-year recall search shows how many recalls NHTSA lists for that year
but does not list them, because recalls apply to specific vehicles. It
offers **Check my exact VIN** instead.

## Interactive features

- **Suggestions** under Analyze Vehicle: follow-ups to your recent searches
  plus new ideas. Recent searches are saved only in that browser (never
  VINs); **Recent searches** opens them in a popup with **Clear history**.
- **Pick a Mustang**: choose a year, a trim (only trims offered that year)
  and a topic instead of typing.
- **Check my VIN** popup: checks the VIN as you type (17 characters, no I,
  O or Q, correct check digit) and turns green once it is valid.
- **Next steps** buttons under each result.

Every click builds an ordinary question that goes through the same guard,
coordinator, approval gate and evidence review as a typed one.

## VIN recall lookup

A user can enter their 17-character VIN, on its own or in a question. The
VIN's check digit is verified first, so most typos are caught without
contacting anyone. A valid VIN is sent to NHTSA's public vPIC decoder to
identify the car (year, make, model, trim, body, engine, drive type, plant).
If it is a 2015 through 2023 Ford Mustang, the recalls for that model year
are shown; any other vehicle, including the Mustang Mach-E, is reported as
unsupported. One VIN is looked up per request.

NHTSA's public recall API lists recalls by model year, not by VIN, and its
VIN-specific recall check at nhtsa.gov/recalls has no public API. So
TorqueIntel shows every recall for the car's model year, says plainly that
some may not apply to that exact car and that it cannot tell whether a recall
has been repaired, and links to nhtsa.gov/recalls to check the exact VIN.

## Evidence review

After the tools run and before any output is given, `reviewEvidence` reads what
each tool actually returned, reports what the sources support, and what is
missing: a trim with no dataset entry, a model year NHTSA could not be reached
for, or a count that could not be retrieved. The result is `complete`, `partial`
or `none`, and it's shown at the top of every response. The review never
adds data; it only makes the gaps visible so nothing is filled in.

## Human approval gate

`compareVehicles` never runs on its own. The app stores the pending action
as data, shows the exact tool name and arguments, and waits for **Approve**
or **Cancel**. Closing the window counts as Cancel. A comparison is limited
to 5 vehicles (model years x trims) and needs at least one trim named.

## Limits

| Limit | Value |
|---|---|
| `MAX_TURNS_PER_SESSION` | 10 |
| `MAX_TOOL_CALLS_PER_TURN` | 4 |
| `MAX_COMPARISON_VEHICLES` | 5 |
| `MAX_RESULTS_PER_TOOL` | 10 |

## Files

| File | Purpose |
|---|---|
| `index.html` | The page: question box, status line, result modal |
| `style.css` | Styling for the app and the evaluation page |
| `agent.js` | Limits, security / scope guard, coordinating agent, evidence review (no page code) |
| `tools.js` | Tools that return data (no page code) |
| `app.js` | Page logic: runs the plan, approval gate, evidence review display, results |
| `data/vehicles.json` | Ford Mustang dataset, all trims, 2015 through 2023 |
| `evaluation/test-cases.json` | Evaluation Test Cases |
| `evaluation/evaluation.js` | Evaluation harness (pass@1 and pass^3) |
| `evaluation/index.html` | Evaluation page |
| `evaluation/results.json` | Saved results of the last terminal run |
| `CLAUDE.md` | Project specification |

## Run locally

The app loads JSON with `fetch`, so it must be served over HTTP rather than
opened as a file:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000` for the app, or
`http://localhost:8000/evaluation/` for the evaluation page.

## Evaluation

Every case in `evaluation/test-cases.json` is run three times through the same
guard and coordinator the app uses. Cases that look up a vehicle are also
checked against `data/vehicles.json`, and that lookup is passed through the
same evidence review the app uses.

- **pass@1**: share of cases that pass on their first run
- **pass^3**: share of cases that pass on all three runs

The agent is rule-based, so the three runs normally agree, and no randomness
is added. Every individual run is kept in the results for manual review.
The harness does not call NHTSA, because live recall data changes over time;
a recall or reliability case passes when the right tool is planned with the
right arguments.

Run it in the browser at `/evaluation/`, or in a terminal:

```bash
node evaluation/evaluation.js
```

The terminal run also rewrites `evaluation/results.json`. Node is only used
to run the same plain JavaScript file; the project has no dependencies.

A test case looks like this. Only the fields listed under `expected` are
checked:

```json
{
    "id": "info-2017",
    "category": "vehicle_information",
    "input": "What engine is in a 2017 Mustang GT?",
    "expected": {
        "allowed": true,
        "intent": "vehicle_information",
        "status": "ready",
        "tools": ["getVehicleInfo"],
        "vehicles": [{ "trim": "GT", "horsepower": 435 }],
        "evidence": "complete"
    }
}
```
