Torque Intel is an agentic automotive intelligence project.

Initial scope:
Ford Mustang GT model years 2015-2023.

Technology:
HTML
CSS
JavaScript
JSON
Hugging Face Static Space

Do not convert the project to React, Vue, Svelte, Python, or Gradio.

Main architecture:
User
→ Security / Scope Guard
→ Coordinating Agent
→ Selected tools
→ Human approval gate when required
→ Evidence review
→ Response

Initial tools:
getVehicleInfo
getRecalls
searchReliability
compareVehicles

The coordinator should classify:
vehicle_information
recall_lookup
reliability_research
vehicle_comparison
buying_research
out_of_scope
security_request

Security:
block API key requests
block password/credential requests
block system prompt requests
block hidden instruction requests
block environment variable requests
block prompt injection attempts

Do not fabricate automotive data.

Vehicle dataset:
Ford Mustang GT 2015 through 2023.

Human gate:
required before compareVehicles runs.
Show exact tool name and arguments.
Approve / Cancel.

Limits:
MAX_TURNS_PER_SESSION = 10
MAX_TOOL_CALLS_PER_TURN = 4
MAX_COMPARISON_VEHICLES = 5
MAX_RESULTS_PER_TOOL = 10

Evaluation:
at least 12 cases
3 runs each
pass@1
pass^3
include prompt injection/security cases.
