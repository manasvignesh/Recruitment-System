# Database schema

All new tables reside in `morrow`. Migrations are append-only SQL files with SHA-256 checksums recorded in `morrow.migrations`. The runner inspects existing table names before changes, uses a transaction and advisory lock, and refuses to silently change an applied migration. No schema reset command is provided. Existing `neon_auth` tables are not altered.

| Domain | Tables | Relationships and integrity |
|---|---|---|
| Identity | users, sessions, accounts, verifications, rate_limits | Better Auth adapter fields; UUIDs, unique emails/session tokens/provider-account pairs; session/account ownership |
| Tenancy | organizations, memberships, invitations, departments, pipeline_stages | Unique organization slug, unique membership, role constraints, hashed expiring single-use invitations; ordered configurable pipeline |
| Hiring | jobs, candidates, applications, application_stage_history | Composite organization-record foreign keys; candidate separate from applications; one application per candidate/job; lifecycle checks and optimistic version fields |
| Files | documents | Generated UUID, candidate/organization ownership, size constraint, MIME, bounded bytea, extracted text and parse status |
| Collaboration | notes, tasks, messages, audit_events | Authenticated authors/assignees; application scope; message delivery states; chronological immutable audit writes |
| Interviews | interviews, scorecards, scorecard_templates | Assigned interviewer, UTC instant plus IANA timezone, duration/status constraints, criteria snapshot, unique author/interview scorecard |
| Offers | offers | One per application; approval identity, expiry, terms, compensation, optimistic version; history through audited events |
| Privacy | privacy_requests | Candidate ownership, organization scope, correction/erasure kind, review status; admin task on submission |
| Decisions/history | hiring_decisions, offer_versions | Human-owned evidence records; offer snapshots captured transactionally by a PostgreSQL trigger |
| Talent | talent_pools, talent_pool_memberships | Named pools, composite tenant foreign keys, consent-checked membership, reviewable name-match suggestions |
| Messaging/reminders | message_templates, notification_preferences | Organization templates, author-owned editable drafts, per-user workspace reminder preferences |
| Protection | submission_limits | Persisted hourly application submission limits |

Timestamps use `timestamptz`; date-only fields use `date`. Domain records are archived/status-transitioned rather than cascade-deleted. Only auth sessions/accounts cascade with their owner. Organization deletion is not exposed. Approval events and offer version/state changes are recorded in the audit trail; offer snapshots are retained in offer_versions. Multi-approver chains are not implemented.

The pooled Neon URL works with node-postgres transactions because each transaction retains one checked-out client. Migrations do not use session-level features outside the transaction. Deployments with a direct migration endpoint may use `DIRECT_DATABASE_URL` by adapting the CLI environment; it is not necessary for this runner's current transaction-scoped operations.

