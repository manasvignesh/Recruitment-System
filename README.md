# Morrow — The Hiring Workspace

A recruitment workspace built with Next.js App Router, React, TypeScript, Better Auth, Drizzle, and Neon PostgreSQL. The supplied database is configured in the ignored server-only `.env`. No connection credentials belong in this file or the browser.

## Run locally

Requires Node.js 22 and PostgreSQL connectivity.

```sh
npm ci
cp .env.example .env
# Set DATABASE_URL and a random BETTER_AUTH_SECRET (at least 32 characters).
# Set BETTER_AUTH_URL and APP_BASE_URL to the same origin.
npm run db:inspect
npm run db:migrate
npm run dev
```

Open `http://localhost:3000`. For a production server, run `npm run build` then `npm start`. Changing the origin requires updating both URL environment variables and restarting the server.

## Isolated demonstration

```sh
npm run db:demo
```

This explicit CLI operation creates only the organization `northstar-demo`, marked as fictional in the product. It does not populate real organizations or reset a database. Repeating it leaves the existing demo unchanged. The randomly generated development identities are written to ignored `demo-credentials.json`. Use the recruiter identity to explore the workbench; the manager approves requisitions and offers; the interviewer submits assigned feedback; the candidate identity is Maya Chen. Keep this file private. There is no public bypass or demo-login API.

Demo: five positions, twelve related applications, five interview records, private feedback, notes, tasks, and a portal conversation. Named talent pools, message/evaluation templates, and notification preferences can be created in the workspace. Original resume files are not fabricated for seeded candidates. Upload an actual document through a candidate application or portal to exercise document processing.

## A complete hiring journey

1. Register and create an organization. Add a department in Settings.
2. Create invitation links for a recruiter, manager, and interviewer. Share links privately; no invitation email is claimed. Each teammate registers using the invited email and accepts the link.
3. Recruiter creates a requisition, selects its manager, and requests approval.
4. Assigned manager or organization administrator approves. Recruiter publishes.
5. A candidate browses `/careers/<slug>` without authentication, registers to submit an application, answers the questions, consents to processing, and uploads a PDF or DOCX.
6. Recruiter reviews the application and moves through adjacent pipeline stages. History and audit events persist. Table, drag-and-drop board, and keyboard-accessible profile selectors use the same backend rules.
7. Recruiter schedules an interview. Candidate sees it in their portal and downloads an ICS invitation. Conflicts in stored interviews are rejected.
8. Assigned interviewer submits structured feedback. Final feedback is locked. Hiring managers review evidence; candidates never receive private notes or scorecards.
9. At Offer, recruiter prepares terms and requests approval. Assigned manager or admin approves. Recruiter makes the offer available in the portal.
10. Candidate accepts or declines. Recruiter completes a hire only after acceptance. Filled openings and operational analytics update; a filled position closes automatically.

## Validation

```sh
npm run typecheck
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
# In another terminal, with the server running:
npm run test:performance
```

Browser tests create uniquely named `QA Isolated` organizations and accounts at `example.invalid`; they never mutate real organizations. The interface and accessibility tests require the separately seeded demo. Tests use the actual HTTP endpoints and PostgreSQL database, with browser interactions for job creation, resume application, stage movement, candidate acceptance, and refresh persistence. They also test prohibited transitions, stale versions, interviewer locks, scheduling conflicts, and unauthorized organization/file access. Authentication throttling stays enabled; the test waits when registrations are throttled.

The performance smoke script creates a separately marked synthetic QA organization with 24 positions and 240 applications, checks stable two-page pagination, search, analytics, and pulse, and writes `test-results/performance.json`. It is a single-client API check, not a concurrent load test. QA organizations remain isolated in the development database; the scripts do not automatically delete them.

See [architecture](docs/ARCHITECTURE.md), [schema](docs/SCHEMA.md), [verification matrix](docs/FEATURE-MATRIX.md), [test report](docs/TEST-REPORT.md), and [deployment notes](docs/DEPLOYMENT.md).

## Integration states

Portal messages work without email; email queues are explicitly unsent. An optional Resend adapter enables account verification and password recovery when `EMAIL_PROVIDER_API_KEY` and a verified `EMAIL_FROM` are configured. It has not been tested with a live provider in this installation. Recovery remains visibly unavailable without configuration.

External calendars, AI services, malware scanning, and electronic signatures are not connected. Documents are retained privately in a bounded PostgreSQL store (2 MB per file); replace the storage adapter with private object storage for production scale. Offer documents are downloadable HTML suitable for printing, and portal acceptance is an acknowledgement rather than a signature.

This is a functional application with a verified core acceptance workflow when the tests pass, not a claim that every enterprise requirement or production deployment is complete. The verification matrix identifies remaining scope precisely.

