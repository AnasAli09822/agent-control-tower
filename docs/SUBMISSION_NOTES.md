# Submission notes

Repo URL: https://github.com/AnasAli09822/agent-control-tower

Demo URL: https://agent-control-tower.tadafuqai.chatgpt.site

Video: omitted at the user's request; optional under the submission checklist.

## What to look at

A new visitor gets an independent persisted session. Start the three agents, pause one during execution, resume, then approve the exact $350 credit or reject the 15% discount. Run Rogue Infra after its normal task, watch warnings become critical, inspect the blocked actions in Replay, then Kill. New session repeats the experience without undoing prior kills. Usage is broken down by agent and task. Audit exports are scoped to the visitor's session and selected team.

## Key decisions

- Sites hosts the frontend/proxy; Neon hosts control and direct signed SSE, with PostgreSQL as authoritative state.
- Each simulated step commits separately at a five-second checkpoint. Agent/run locks serialize tool execution and operator commands; multiple viewers cannot execute a step twice.
- A signed HttpOnly cookie isolates visitor workspaces. Upstream HMAC binds the exact identity, audience, workspace, method, query, payload and idempotency header. SSE tokens carry exact workspace/team scope.
- Killed agents stay terminal. Repetition creates a new session, preserving historical audit evidence.
- Approval identity binds the exact proposed action. Reasoning replay uses operational summaries and evidence, with explicit simulated usage.

## AI usage

OpenAI Codex in ChatGPT Work assisted implementation, tests and review. Tinyfish assisted browser verification. Details: `AI_USAGE.md`.

## Out of scope

Real CRM/billing/infrastructure integrations, live model inference/provider billing, enterprise user onboarding, unattended scheduling, long-term retention automation and production multi-tenant administration. The demo simulates business domains and agent outputs. Server execution advances while an operator's SSE connection is open; closing the tower leaves the simulation at its last checkpoint.

## Supporting material

`ARCHITECTURE.md`, `FAILURE_TEST.md`, `TWO_YEAR_THESIS.md`, `REQUIREMENTS.md`, and the dated evidence files identify the implementation, scenario results and tested source versions.
