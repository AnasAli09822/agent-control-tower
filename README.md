# Agent Control Tower

Live demo: https://agent-control-tower.tadafuqai.chatgpt.site

Sites hosts the operator dashboard and server proxy; Neon hosts PostgreSQL, control execution and SSE. The GitHub branch `sites-migration` contains the deployable Sites frontend in `sites/` and Neon Functions in `functions/`. Existing Vercel sources and services are preserved as a fallback.

The three agents operate simulated CRM, Support and Infrastructure systems. Structured reasoning summaries, tokens and cost are simulated and labelled accordingly. Database mutations, approvals, controls, event streams and audit evidence are real persisted application behavior.

Migration 006 was applied to main with explicit user approval at 2026-09-30T20:44:16.039Z. It locks and validates the authoritative agent and run through the mutation transaction. Exact approval/action/payload/risk binding remains enforced by migration 005.

## Validation

21 named local tests and TypeScript checks pass. The fresh Neon acceptance suite passed 29 checks, including real overlapping worker/kill and approval/kill requests with PostgreSQL lock evidence. See `docs/evidence/2026-10-01-acceptance.json` and `docs/FAILURE_TEST.md`.

In the Sites checkout: `npm run build`. In the GitHub repository: the frontend build runs from `sites/`. Scenario mutations never run during build. The temporary acceptance Function accepts only an expiring private key and creates its own test workspace; it is not a production API.

## Demo state and delivery

Kill is terminal. The canonical public demo has existing runs and previously resolved approvals; starting it again returns those runs without replaying business effects. Fresh full-cycle verification uses isolated fixtures without resetting killed agents.

The application is published and technically verified. The required 90-second Loom remains unrecorded; the walkthrough script is preparation, not a completed recording.
