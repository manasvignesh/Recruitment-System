"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  MapPin,
  Search,
  Check,
} from "lucide-react";
import { api, money } from "@/lib/api";
import { brand } from "@/lib/brand";
import {
  Logo,
  Button,
  Field,
  Loading,
  Empty,
  ErrorBox,
  Modal,
  Badge,
} from "./ui";
export function Careers({ slug, jobId }: { slug: string; jobId?: string }) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [q, setQ] = useState(""),
    [department, setDepartment] = useState(""),
    [location, setLocation] = useState(""),
    [apply, setApply] = useState(false),
    [success, setSuccess] = useState(false),
    [user, setUser] = useState<any>(null),
    [pending, setPending] = useState(false),
    [formError, setFormError] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/public/careers/" + slug + (jobId ? "/" + jobId : ""))
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    api("/api/workspace/me")
      .then((d) => active && setUser(d.user))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [slug, jobId]);
  if (error)
    return (
      <main className="careers-body">
        <ErrorBox message={error} />
        <Link className="button secondary" href="/">
          Back to {brand.name}
        </Link>
      </main>
    );
  if (!data) return <Loading />;
  const job = jobId ? data.jobs[0] : null;
  const filtered = data.jobs.filter(
    (j: any) =>
      j.title.toLowerCase().includes(q.toLowerCase()) &&
      (!department || j.department === department) &&
      (!location || j.location === location),
  );
  return (
    <>
      <nav className="public-nav">
        <Link href={"/careers/" + slug}>
          <span style={{ fontSize: 21, fontWeight: 550, letterSpacing: -0.5 }}>
            {data.organization.name}
            <span style={{ color: "var(--green)" }}>.</span>
          </span>
        </Link>
        <div className="public-nav-links">
          <Link href="/portal">
            My applications <ArrowUpRight size={12} />
          </Link>
          <Link href={user ? "/workspace" : "/login"}>
            {user ? "Workspace" : "Sign in"}
          </Link>
        </div>
      </nav>
      {jobId && !job ? (
        <main className="careers-body">
          <Empty
            title="This role is no longer accepting applications."
            body="Explore other opportunities with the team."
            action={
              <Link className="button primary" href={"/careers/" + slug}>
                See open positions
              </Link>
            }
          />
        </main>
      ) : job ? (
        <main className="careers-body">
          <Link
            className="button ghost"
            style={{ paddingLeft: 0, margin: "20px 0" }}
            href={"/careers/" + slug}
          >
            <ArrowLeft size={14} />
            All positions
          </Link>
          <div className="job-public-detail">
            <div className="job-public-copy">
              <span className="eyebrow">
                {job.department || "Join our team"}
              </span>
              <h1>{job.title}</h1>
              <p style={{ margin: "15px 0" }}>
                {job.location} · {job.workplace} · {job.employment}
              </p>
              <h2>The opportunity</h2>
              <p>{job.description}</p>
              <h2>What you’ll bring</h2>
              <p>
                {job.requirements ||
                  "We look forward to learning about your experience."}
              </p>
              {job.skills.length > 0 && (
                <>
                  <h2>Skills for the role</h2>
                  <div className="skill-list">
                    {job.skills.map((s: string) => (
                      <span className="skill" key={s}>
                        {s}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </div>
            <aside className="job-public-side">
              <span className="eyebrow">Your next chapter</span>
              <h3>{data.organization.name}</h3>
              <p style={{ marginTop: 12 }}>
                <MapPin size={13} style={{ verticalAlign: "middle" }} />{" "}
                {job.location}
                <br />
                {job.workplace} · {job.employment}
              </p>
              {job.salary_min !== null && (
                <p>
                  {money(job.salary_min, job.currency)}
                  {job.salary_max !== null
                    ? " – " + money(job.salary_max, job.currency)
                    : "+"}{" "}
                  / year
                </p>
              )}
              {success ? (
                <>
                  <Badge tone="green">Application received</Badge>
                  <p style={{ marginTop: 15 }}>
                    Thank you for your interest. Follow your progress in your
                    candidate portal.
                  </p>
                  <Link className="button primary" href="/portal">
                    View my application
                  </Link>
                </>
              ) : (
                <>
                  <Button onClick={() => setApply(true)}>
                    Apply for this role
                    <ArrowRight size={14} />
                  </Button>
                  <small style={{ display: "block", marginTop: 15 }}>
                    Your information goes directly to the hiring team.
                  </small>
                </>
              )}
            </aside>
          </div>
        </main>
      ) : (
        <>
          <section className="careers-hero">
            <span className="eyebrow">Careers at {data.organization.name}</span>
            <h1>
              Good work.
              <br />
              Great people.
              <br />
              <em style={{ color: "var(--green)" }}>What comes next?</em>
            </h1>
            <p>
              {data.organization.description ||
                "We’re building a team of thoughtful people. Explore your next opportunity with us."}
            </p>
            {data.organization.is_demo && (
              <Badge tone="amber">Fictional demonstration organization</Badge>
            )}
          </section>
          <main className="careers-body">
            <div className="section-heading">
              <h2>
                Find your next chapter
                <span
                  style={{
                    fontSize: 12,
                    marginLeft: 10,
                    color: "var(--muted)",
                  }}
                >
                  {data.jobs.length} open positions
                </span>
              </h2>
            </div>
            <div className="toolbar">
              <div className="toolbar-left">
                <div className="search-box">
                  <Search size={14} />
                  <input
                    className="search-input"
                    aria-label="Search open positions"
                    placeholder="Search positions…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <select
                  className="control"
                  aria-label="Department"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                >
                  <option value="">All departments</option>
                  {Array.from(
                    new Set<string>(
                      data.jobs.map((j: any) => j.department).filter(Boolean),
                    ),
                  ).map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
                <select
                  className="control"
                  aria-label="Location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                >
                  <option value="">All locations</option>
                  {Array.from(
                    new Set<string>(data.jobs.map((j: any) => j.location)),
                  ).map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            {filtered.length ? (
              filtered.map((j: any) => (
                <article className="career-job" key={j.id}>
                  <div>
                    <span className="eyebrow" style={{ marginBottom: 8 }}>
                      {j.department || "General"}
                    </span>
                    <Link href={`/careers/${slug}/${j.id}`}>
                      <h3>{j.title}</h3>
                    </Link>
                    <p>
                      {j.location} · {j.workplace} · {j.employment}
                    </p>
                  </div>
                  <Link
                    className="button secondary"
                    href={`/careers/${slug}/${j.id}`}
                  >
                    View role <ArrowUpRight size={14} />
                  </Link>
                </article>
              ))
            ) : (
              <Empty
                title="No open positions in this view."
                body="Try another filter or check back for future opportunities."
              />
            )}
          </main>
        </>
      )}
      <footer className="marketing-footer">
        <span>
          Hiring thoughtfully with{" "}
          <Link href="/">
            <Logo small /> {brand.name}
          </Link>
        </span>
        <Link href="/portal">Candidate portal</Link>
      </footer>
      <Modal
        title="A thoughtful introduction"
        description={job?.title}
        open={apply}
        onClose={() => !pending && setApply(false)}
        wide
      >
        {!job ? null : !user ? (
          <>
            <p style={{ marginBottom: 22 }}>
              Create an account to securely submit and track your application.
              You can return to this role immediately after signing in.
            </p>
            <div className="hero-actions">
              <Link
                className="button primary"
                href={
                  "/signup?next=" +
                  encodeURIComponent(`/careers/${slug}/${jobId}`)
                }
              >
                Create candidate account
              </Link>
              <Link
                className="button secondary"
                href={
                  "/login?next=" +
                  encodeURIComponent(`/careers/${slug}/${jobId}`)
                }
              >
                Sign in
              </Link>
            </div>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setFormError("");
              const f = new FormData(e.currentTarget);
              f.set(
                "answers",
                JSON.stringify(
                  Object.fromEntries(
                    (job.questions as string[]).map((question, index) => [
                      question,
                      f.get("answer-" + index),
                    ]),
                  ),
                ),
              );
              f.set("consent", f.get("consent") ? "true" : "false");
              f.set(
                "talent_consent",
                f.get("talent_consent") ? "true" : "false",
              );
              try {
                await api(`/api/public/careers/${slug}/${jobId}`, undefined, f);
                setSuccess(true);
                setApply(false);
              } catch (e) {
                setFormError((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            <div className="form-grid">
              <Field label="Full name">
                <input
                  name="name"
                  defaultValue={user.name}
                  required
                  minLength={2}
                />
              </Field>
              <Field label="Contact email">
                <input value={user.email} readOnly aria-readonly="true" />
              </Field>
            </div>
            <Field label="Phone (optional)">
              <input name="phone" type="tel" maxLength={50} />
            </Field>
            <Field label="A little about your experience">
              <textarea name="experience" maxLength={10000} rows={3} />
            </Field>
            <Field label="Skills" hint="Separate skills with commas.">
              <input
                name="skills"
                placeholder="e.g. Product design, Research, Figma"
              />
            </Field>
            {job.questions.map((question: string, index: number) => (
              <Field key={question} label={question}>
                <textarea
                  name={"answer-" + index}
                  required
                  maxLength={4000}
                  rows={2}
                />
              </Field>
            ))}
            <Field
              label="Resume"
              hint="PDF or DOCX. Maximum 2 MB. Original and extracted text are retained privately."
            >
              <input
                name="resume"
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                required
              />
            </Field>
            <label className="checkbox-field">
              <input type="checkbox" name="consent" required />
              <span>
                I consent to {data.organization.name} storing and processing my
                application and resume for this recruitment process.
              </span>
            </label>
            <label className="checkbox-field">
              <input type="checkbox" name="talent_consent" />
              <span>
                Keep me in mind for future opportunities. I consent to talent
                pool retention.
              </span>
            </label>
            {formError && <ErrorBox message={formError} />}
            <div className="form-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setApply(false)}
              >
                Cancel
              </Button>
              <Button disabled={pending}>
                {pending ? "Submitting…" : "Submit application"}
                <Check size={14} />
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  );
}
