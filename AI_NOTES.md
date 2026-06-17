# AI Usage Notes

## Tools used

Claude (claude.ai) — used throughout this project for architecture discussion, code
generation, debugging, and documentation drafting.

## What I asked AI to help with

- Initial project structure and file layout (client/server split)
- Writing the `ruleEngine.js` pure functions (evaluate, match, validate, cooldown)
- Writing the Vitest test suite covering the spec's example test cases
- Drafting the SSE client wrapper class (`sseClient.js`)
- Generating the full UI layout and CSS (dark theme, panel-based grid layout)
- Writing the store's pub/sub state pattern (`store.js`)
- Debugging a stale form-error message that didn't clear when the user corrected
  invalid input
- Debugging an empty test file caused by an incomplete paste from chat into VS Code
- Drafting README.md, DESIGN.md, and this file
- Planning the deployment split (Render for the server, Vercel for the client) and
  walking through git/GitHub setup

## What AI-generated suggestions I accepted

- The pure-function approach for `ruleEngine.js` — keeping evaluation logic
  completely side-effect-free made testing straightforward without needing to mock
  the DOM or EventSource.
- Discriminated-union-style return values (`{ valid: true, event }` /
  `{ valid: false, error }`) instead of throwing exceptions for invalid events —
  cleaner to handle at the call site.
- Storing `lastTriggeredAt` directly on the rule object rather than a separate
  cooldown-tracking map, since it's simpler to persist to localStorage as one blob.
- Client-side rule evaluation over a server-side relay architecture, after
  discussing the tradeoff explicitly — see DESIGN.md "Rule evaluation design" for
  the reasoning. AI's original recommendation leaned toward a server-evaluation
  design for a "cleaner narratable story," but I chose the simpler client-side
  approach since the pure-function structure already gives the same testability
  guarantees without the added relay-stream complexity.

## What AI-generated suggestions I rejected or changed

- AI suggested using React for the UI. Rejected — the spec doesn't require a
  framework, and vanilla JS with a small pub/sub store keeps the dependency list
  and deploy surface smaller.
- AI's first draft of the cooldown check used `>=` (elapsed >= window), which would
  mean a rule could NOT fire again at the exact moment cooldown expired. Changed to
  strict `<` so a rule becomes eligible again exactly when its cooldown window ends.
- AI generated a full rule-editing modal. Omitted, since the spec explicitly says a
  full CRUD admin UI is not required, and supporting delete + re-add covers the
  same use case with less code.

## Bugs or incorrect assumptions found in AI output

- AI's `SSEClient` assumed `EventSource.onopen` always fires before `onmessage`.
  In practice this isn't guaranteed across all environments, so I added a
  defensive check in `onmessage` to set state to CONNECTED if it hadn't already
  been set by `onopen`.
- An early version of the rule-add form only cleared its error message on
  successful submission, so a stale "X is required" message would linger on screen
  even after the user corrected the field and before resubmitting. Fixed by adding
  `input`/`change` listeners on the form fields to clear the error as soon as the
  user starts correcting it.
- A large code block pasted from chat into VS Code didn't fully land in the test
  file, resulting in an empty `ruleEngine.test.js` that silently passed zero tests
  rather than failing — a good reminder to always verify test output (test count,
  not just "exit code 0") rather than trusting that paste operations completed.