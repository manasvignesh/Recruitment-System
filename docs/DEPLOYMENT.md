# Deployment

The application has not been deployed to a public host. Deploy the Next.js Node server to a host supporting Node.js 22, private environment variables, PostgreSQL connectivity, and the document parser packages. Vercel or a container-based Node deployment is possible; no hosting account or DNS action has been performed.

1. Provision a production database/branch separately from the demonstration and QA data. Take a backup and inspect before migration.
2. Configure `DATABASE_URL`, a strong independent `BETTER_AUTH_SECRET`, and the same public HTTPS origin for `BETTER_AUTH_URL` and `APP_BASE_URL`. Secrets must remain server-side; never add `NEXT_PUBLIC_` to them. Use a least-privilege runtime database role.
3. Run `npm ci` and `npm run db:migrate` as a release operation. The schema must exist before requests are served.
4. Run `npm run build`, then `npm start` (or the host's Next.js deployment equivalent). Behind a container proxy, bind Next.js to an appropriate interface rather than the local loopback-only npm script. Configure TLS, request size limits, trusted forwarding headers, health checks, and database connection budgets.
5. Configure a verified Resend sender with `EMAIL_PROVIDER_API_KEY` and `EMAIL_FROM` to enable account verification/reset. Validate real delivery and failure handling before advertising availability. Invitation links currently use direct private sharing; candidate messaging uses the portal.
6. Replace the private PostgreSQL attachment adapter with authenticated private object storage for higher volume. Add an actual malware scanner and resource-isolated document parsing workers before processing untrusted files at production scale.
7. Validate security headers/CSP, cross-tenant authorization, session expiry, backup restoration, retention obligations, observability, failure recovery, accessibility with assistive technology, and representative load. Automated axe checks do not certify WCAG conformance.
8. Keep `demo-credentials.json`, `.env`, test traces, and QA/demo users out of a public release. There is no public test credential endpoint. Do not run `db:demo` against a production organization.

## Remaining integration requirements

External calendar providers, AI services, external email delivery for candidate messages, object storage, malware scanning, e-signatures, and provider delivery webhooks require implementation/configuration and validation. Offer downloads are HTML documents. No legal-signature claim is made. PDF/DOCX resume extraction can fail visibly while the original is preserved.

## Verification budgets

Marketing pages prerender; authenticated lists are bounded to 50/100 rows, document size is 2 MB, form-body size is 3 MB, connection count is 8, and database statements have a 15-second bound. A local production-server smoke run on 13 October 2026 used an isolated organization containing 24 positions and 240 applications. Seven authenticated API reads completed in 867–3,857 ms, including remote Neon latency, and two pages of 50 applications had no overlap. See the test report for individual measurements. These measurements do not establish concurrent-load capacity or Web Vitals. Larger deployment-scale tests, backup restoration, and independent security review remain required.

## Dependency audit

`npm audit --omit=dev` reported zero runtime dependency vulnerabilities on 13 October 2026. The full audit reported five high-severity entries in the development-only `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` chain, originating from [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). These are five affected packages in one dependency chain, not five independent application exploits. The suggested automatic fix downgrades the Next lint configuration to major version 14; it was not applied to this Next 16 project. Update the lint toolchain when a compatible corrected dependency is available. Do not describe the full development dependency audit as clean.
