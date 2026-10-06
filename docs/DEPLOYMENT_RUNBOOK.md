# Deployment and verification runbook

Use the Sites delivery described in `DEPLOYMENT_SITES.md`. Vercel is historical fallback source, not the current submission host.

1. Run unit/security checks and TypeScript against the current source.
2. Run clean-database acceptance from the repository with PostgreSQL 16+. Keep fixtures separate from user/demo sessions.
3. Package and deploy matching Neon control/event bundles. Re-run the protected full acceptance suite against new isolated workspaces; do not reset historical agents.
4. Build and publish the matching Sites source/archive with the existing public audience.
5. Test a fresh public session through the UI: start, pause, resume, approve, reject, rogue, replay, kill, exports and New session. Check stream reconnect and team/session scope independently.
6. Record accepted source commits, deployment versions and actual effects in dated evidence. Complete `REQUIREMENTS.md` using those results.

No new production migration is required for the final session/checkpoint implementation. Bootstrap is only for empty local/CI databases. The optional video is omitted.
