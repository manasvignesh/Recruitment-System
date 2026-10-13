# Architecture and product decisions

The empty starting workspace had no code or working functionality to preserve. Morrow uses Next.js App Router with strictly checked TypeScript, React, customized Radix dialogs/drawers, dnd-kit, Lucide icons, and an authored CSS design system. CSS variables implement warm light and dark workspace themes; public and candidate pages prioritize legibility and mobile use. Product name, descriptor, and metadata are configured in `src/lib/brand.ts`.

Frontend screens live in `src/components`; public routes, careers, and the separate candidate portal live under `src/app`. Server handlers delegate to organization, job, application, interview, offer, analytics, collaboration, self-service, privacy, and file domains. Better Auth owns the application identity/session/account tables via its Drizzle PostgreSQL adapter. Domain SQL uses parameterized node-postgres queries and transactions. No persisted hiring record depends on localStorage, a mock API, or an in-memory array.

The database contained a `neon_auth` schema. Morrow migrations intentionally create a separate `morrow` schema and leave existing Neon-managed identity tables untouched. Morrow does not pretend those identities are connected to its authentication system. Organization membership and invitation handling are application-owned so the authorization model applies consistently to all domain operations.

## Authorization matrix

| Action                                                       | Admin               | Recruiter           | Manager            | Interviewer         | Candidate                   |
| ------------------------------------------------------------ | ------------------- | ------------------- | ------------------ | ------------------- | --------------------------- |
| Organization configuration, roles, privacy resolution, audit | Yes                 | No                  | No                 | No                  | No                          |
| Jobs/applications                                            | All in organization | All in organization | Assigned positions | Assigned interviews | Own public application data |
| Create/edit/publish requisitions                             | Yes                 | Yes                 | No                 | No                  | No                          |
| Approve requisition/offer                                    | Yes                 | No                  | Assigned position  | No                  | No                          |
| Move stages, assign, reject, schedule, prepare offers        | Yes                 | Yes                 | No                 | No                  | No                          |
| Submit scorecard                                             | Only when assigned  | Only when assigned  | Only when assigned | Only when assigned  | No                          |
| Read scorecards                                              | All authorized      | All authorized      | Assigned positions | Own feedback only   | No                          |
| Portal messages, interview invitations, offers               | Team scope          | Team scope          | Authorized profile | Authorized profile  | Own records only            |
| Accept/decline offer, withdraw, self-service profile/export  | No impersonation    | No impersonation    | No impersonation   | No impersonation    | Own records only            |

`security.ts` resolves the real session, validates organization membership, checks role permission, and scopes job/application ownership. Composite tenant foreign keys stop linking an application to a job or candidate in another organization. Candidate endpoints derive identity from the session rather than accepting a caller-supplied user ID. Document downloads and offer documents enforce the same relationships. GET data is private/no-store where appropriate.

## Business integrity

- Jobs: draft → pending → approved → published; controlled unpublish, close, reopen, archive.
- Applications: adjacent organization-configured stages; Hired requires an accepted offer and an available opening. Stage changes append history and audit events in the same transaction. Stale versions produce 409 conflicts. Admins edit pipeline stages in Settings; Applied/Offer/Hired remain required and stages occupied by active or on-hold applications cannot be removed. A shared organization lock serializes stage transitions against pipeline edits.
- Offers: draft → pending → approved → available → accepted/declined/expired. Candidates alone respond; assigned managers/admins approve. Hire completion locks the job to serialize opening allocation.
- Interviews: timezone-aware timestamps; transaction-scoped advisory locks protect conflict checks. Evaluation criteria are snapshotted from reusable templates. Final scorecards are immutable.
- Communications: draft, portal, or pending_email states; queued email is never reported as delivered.
- Privacy: candidate request → admin review. Optional redaction deletes the scoped uploaded documents and removes recruitment profile text; hired candidates are held for separate retention review. The shared login account and relational audit history are retained.

## Limits and performance

Applications paginate at 50; other operational lists cap at 100 and disclose this in the verification matrix. PostgreSQL indexes cover organization/status, dates, candidate/job full-text search, sessions, and tasks. Document binary content is never loaded into general application lists. Connection pool: eight connections, 15-second connect/statement bounds. Public marketing pages are prerendered. Reference lookups run concurrently; some detail/analytics queries are still sequential and should be profiled under production load. Browser loading and error states are explicit.

No external AI processing, demographic inference, automatic ranking, or automated hiring decision exists. Supplied skills/experience are labeled as candidate-provided rather than verified. Internal notes and scorecards are excluded from candidate portal responses.

Hiring decisions are explicit evidence records, with assigned manager ownership. Named talent pools require candidate consent; withdrawing that consent removes pool memberships. Name-match suggestions are review prompts and never automatic merges. Offer edits are limited to drafts, create new snapshots, and require a fresh approval cycle before candidate availability. Hiring Pulse queries quiet jobs, stalled applications, deadlines, outstanding feedback, and pending offer approvals from actual records.
