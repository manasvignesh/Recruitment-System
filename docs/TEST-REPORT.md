# Verification report — 13 October 2026

Morrow was tested locally against the configured Neon PostgreSQL database, using the production Next.js server at `http://localhost:3000`. Migrations `0001` through `0007` were applied to the separate `morrow` schema; existing `neon_auth` tables were preserved. Operational tests create isolated organizations and fictional `example.invalid` identities. Demo screens use the separately marked Northstar Studio organization. No public deployment was performed.

## Commands and results

| Command                                   | Result                         | Evidence and scope                                                                                                      |
| ----------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `npm run build`                           | Passed                         | Final optimized build, TypeScript, page generation and route collection completed, including the actual demo screenshot |
| `npm run typecheck`                       | Passed                         | Strict TypeScript check; latest production build also checked TypeScript                                                |
| `npm run lint`                            | Passed                         | Final changed-source lint completed with zero warnings/errors                                                           |
| `npm test`                                | 43 passed, 2 files             | Vitest 5.0.4; transition, overlapping-time and document policy rules; preceding run completed in 307 ms                 |
| `npm run test:e2e`                        | 4 passed in 8.1 minutes        | Final Chromium regression, one worker, actual HTTP/database persistence, including pipeline hold protection             |
| Targeted accessibility/interface run      | 2 passed in 1.6 minutes        | Latest dark-theme axe and unsaved-form discard checks passed before pipeline integrity fix                              |
| `npm run test:performance`                | Passed                         | Seven authenticated API reads; 24 jobs, 240 candidates and 240 applications; details below                              |
| `npm audit --omit=dev`                    | 0 vulnerabilities              | Runtime dependency audit completed successfully                                                                         |
| `npm audit --json`                        | 5 high, development-only chain | Next lint configuration / fast-glob / micromatch / braces; see deployment notes                                         |
| Production browser-bundle credential scan | 0 matching files               | Scanned `.next/static` for the supplied database username/host identifiers; no credential-bearing client bundle found   |

The final build used Node.js 22.22.2, Next.js 16.4.0 and React 19.3.0. A separate final homepage check on that build passed at desktop width 1280 and mobile width 390: the actual demo screenshot loaded, no horizontal overflow or browser page errors occurred, and axe reported zero violations using the same WCAG tags. Both screenshots were visually inspected. The machine-readable result is `docs/MARKETING-CHECK.json`. This additional public-page check is separate from the four browser regression suites.

## Browser acceptance coverage

Final individual durations: accessibility 28.9 seconds; interface 55.2 seconds; complete hiring journey 3.4 minutes; operations including custom-stage/hold checks 3.2 minutes. All four passed. The later final rebuild adds only the marketing screenshot/copy; operational code is unchanged from this successful full regression.

`journey.spec.ts` verifies registration, organization creation, role invitations and acceptance, recruiter requisition creation, assigned-manager approval, publication, candidate PDF application, adjacent stage movement and reload persistence, interview conflicts, private structured scorecards and final-submission locking, final-review evidence, revised draft offer, approval and portal availability, candidate acceptance, completed hire, opening closure, six offer snapshots, downloadable offer document, analytics and audit updates. Negative assertions cover invalid/stale transitions, role denial, another organization, another candidate, and unauthorized private-file access.

`operations.spec.ts` verifies DOCX extraction and manual correction, private downloads, notes and department search, bulk assignment, stale batch rejection, unsent message drafts, portal delivery, sent-message immutability, message templates, tasks, notification preferences, evaluation templates and snapshotted criteria, ICS export, rescheduling, draft/final scorecards, decision records, named talent pools, consent withdrawal, profile and availability updates, personal export, privacy requests and scoped erasure. It checks deleted-file denial and redacted decision text. The final regression adds custom pipeline stages, persisted stage order, hold/resume, blocked stage movement while on hold, and rejection of removing an occupied on-hold stage. It also renders notifications, message templates, and the recovery-unconfigured state.

`interface.spec.ts` verifies the demo workbench, all main recruiter screens, Ctrl+K search and Escape, same-job candidate comparison, board/profile opening, light/dark toggles, create-position unsaved-change discard confirmation, mobile navigation at 390 × 844, and no horizontal document overflow on workspace/careers. It asserts no browser page errors and captures desktop/mobile screenshots.

`accessibility.spec.ts` runs axe with WCAG 2 A/AA, 2.1 AA and 2.2 AA tags on the light workbench, jobs, settings, public careers and portal, plus the dark workbench. A zero-violation result applies to these tested page states only. It is not WCAG certification, complete keyboard testing, or a screen-reader review.

## Measured database/API smoke check

The production server served a synthetic organization with 24 published positions and 240 applications. The script checked the exact job/application totals, two non-overlapping application pages of 50, the expected indexed search result, and the analytics application count. All responses were HTTP 200 and below the 15-second smoke budget.

| Authenticated API read   | Wall time |
| ------------------------ | --------: |
| Reference data           |  2,335 ms |
| 24-position list         |  1,178 ms |
| Application page 1       |  1,171 ms |
| Application page 2       |    950 ms |
| Indexed candidate search |    945 ms |
| Cohort analytics         |  3,857 ms |
| Hiring Pulse             |    867 ms |

The preserved machine-readable result is `docs/PERFORMANCE-REPORT.json`. These are single-client measurements including remote Neon latency, not throughput, concurrent-load, query-plan, Web Vitals, or production capacity claims. All five Hiring Pulse signal classes and extended analytics formulas still need controlled representative date fixtures, as distinguished in the feature matrix.

## Product and engineering review

Desktop, dark-workspace and mobile screenshots were visually inspected. The authored serif/sans typography, forest palette, compact operational rows, candidate drawer, and mobile cards are coherent. Browser assertions verified responsive overflow and actual controls. Real tables and server authorization underpin the hiring path; the frontend does not manufacture successful mutations.

The final review found and corrected a pipeline integrity issue: removing a stage previously checked only active applications, allowing a stage occupied by an on-hold application to disappear. The backend now protects both active and on-hold applications. Stage transitions acquire a shared organization lock before the application lock, preventing an admin's pipeline edit from racing against a transition. The final regression exercises the hold-related behavior; a separate concurrent stress test has not been performed.

## Remaining verification and release requirements

- Live account verification/reset delivery, invitation email, external candidate email/webhooks, calendar providers, AI, e-signatures, malware scanning and private object-storage migration are not validated integrations in this installation.
- The parser runs inline with bounded input/expanded DOCX sizes; resource isolation and malware scanning remain production requirements.
- Broader role/session-expiry, CSRF, retention, assistive-technology and penetration reviews remain. Existing negative authorization assertions are valuable but do not establish complete security certification.
- Pointer/keyboard drag gestures, every close/archive/decline/expiry permutation, concurrent final-opening allocation, job-specific pipeline overrides, full multi-organization browser switching, and every nested unsaved form are not covered by the current automated browser suite.
- Additional analytics formulas, all Pulse signal fixtures, name-match suggestions and expanded preparation-kit content are implemented but lack dedicated representative assertions.
- Runtime dependencies audited clean; the five development-only dependency findings remain documented. The suggested incompatible major downgrade was not applied.
- No public hosting, DNS, backup restoration, deployment-scale load, or Web Vitals verification has occurred. QA/demo data must stay out of a production release.

See `FEATURE-MATRIX.md` for feature-by-feature status and `DEPLOYMENT.md` for concrete deployment requirements. Local screenshots and Playwright traces are under ignored `test-results`; development login details are under ignored `demo-credentials.json`.
