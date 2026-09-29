# Project status — Agent Control Tower

Status date: 2026-09-30 (Asia/Riyadh). **Phase 9 remains open. Phase 10 is not frozen.**

| Phase | Current status | Evidence / remaining gate |
|---|---|---|
| 0 — Plan/context | established | Standalone repository and approved architecture retained |
| 1 — Data/control | retained | Main still has 001, 002, 003, 005; no migration rerun |
| 2 — Execution guard | new hardening gate | Exact approval binding passes fresh DB probes; authoritative-agent epoch fence 006 is validated on an isolated main clone but pending on main |
| 3 — Agents | source retained | Existing three simulated agents; fresh complete scenario acceptance pending |
| 4 — Events/reconnect | backend contract verified | New signed SSE Function; OIDC/token/scope/Last-Event-ID checks pass during Vercel build; browser reconnect verification pending |
| 5 — Operator UI | source/build passes | UI retained; anonymous end-to-end verification pending |
| 6 — Rogue/kill | main regression found | Killed current run rejects stale worker, but an outstanding old run can bypass the main agent epoch; 006 closes the tested case on validation only |
| 7 — Teams/export | source retained | Team queries and scoped audit export; final browser acceptance pending |
| 8 — Adversarial audit | refreshed, not closed | Payload/action/risk/scope substitutions rejected; newly discovered authoritative-epoch case must be closed on main |
| 9 — Public backend/Vercel/acceptance | partial | New Neon slugs work; Vercel OIDC smoke passes; source defaults now target new slugs; runtime overrides/public URL need verification |
| 10 — Submission freeze | pending | Requires applied fence, fresh normal/approval/rogue acceptance, concurrency tests, and UI/public URL verification |

## Verified deployments

- Repository: https://github.com/AnasAli09822/agent-control-tower
- Main control Function: `actctlp3`, deployment 1, completed and invoked successfully.
- Main event Function: `actevtp3`, deployment 1, completed and invoked successfully.
- Control bundle SHA-256: `863da0f05d45f27db44f1f18c312f8931782ea00bbde142cc858a7dca4a3f1d5`.
- Event bundle SHA-256: `1f9459a4a352f8a5998aff1c20be7b317f13cd9e35586f2dab16629b18706b13`.
- Deployed bundle source: `eb8278d3bef08a1a30e8c20773a410edb0594ce1`.
- Packaging run `36642496915`: actual public HTTP tests pass (200 health, 401 anonymous fleet/token/stream).
- Vercel deployment `9ZkQxJ9K5As4DfMS7BFnspxxU2Ef` on `d2aa0eb62fa6ef4a6707c7eb8cfab4d3681f5e64` succeeds with read-only backend assertions for OIDC fleet, signed event scope, tampered token denial, and SSE Last-Event-ID.
- Existing production slugs were preserved. GitHub Actions uses no deployment secrets.

## Current blocking gates

1. Apply reviewed migration 006 to main. Neon's prepared-migration helper cannot parse the dollar-quoted function body; the exact statements were instead tested atomically on isolated branch `epoch-fence-validation-20260929` (`br-square-dew-b57d7tcl`). Main schema has not been changed.
2. Vercel management connection returns 403 for the correct scope `alhajans664-2649s-projects`. GitHub confirms deployment success; the 403 does not imply an unlinked project. Browser fallback requires user approval.
3. Inspect Vercel runtime URL overrides, verify the project-specific public URL, and execute UI controls and fresh isolated scenario acceptance.
4. Prove actual overlapping kill-race/concurrent pause-kill ordering. The initial connector probe completed its worker before the kill; it is not treated as proof of an overlapping race.
5. The current scenario source references canonical demo task/system IDs; a fresh acceptance workspace needs explicit isolated fixtures and scoped scenario selection before it can substitute for full demo acceptance.

Existing architecture, thesis, 90-second script, and failure-test descriptions are preparation material. No recording or final accepted live-demo URL is claimed.
