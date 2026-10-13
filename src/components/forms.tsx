"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import { brand } from "@/lib/brand";
import { Button, Field, ErrorBox } from "./ui";
type FormProps = {
  orgId: string;
  reference: any;
  onDone: () => void;
  onClose: () => void;
};
export function JobForm({
  orgId,
  reference,
  onDone,
  onClose,
  job,
}: FormProps & { job?: any }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const f = new FormData(e.currentTarget);
    const string = (k: string) => String(f.get(k) || "");
    try {
      await api("/api/workspace/jobs" + (job ? "/" + job.id : ""), orgId, {
        title: string("title"),
        department_id: string("department_id") || null,
        manager_id: string("manager_id"),
        location: string("location"),
        workplace: string("workplace"),
        employment: string("employment"),
        openings: Number(f.get("openings")),
        salary_min: string("salary_min") ? Number(f.get("salary_min")) : null,
        salary_max: string("salary_max") ? Number(f.get("salary_max")) : null,
        currency: string("currency"),
        description: string("description"),
        requirements: string("requirements"),
        skills: string("skills")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        questions: string("questions")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
        closing_date: string("closing_date") || null,
        version: job?.version,
      });
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <Field label="Position title">
        <input
          name="title"
          defaultValue={job?.title}
          placeholder="e.g. Senior Product Designer"
          required
          minLength={3}
          maxLength={150}
        />
      </Field>
      <div className="form-grid">
        <Field label="Department">
          <select name="department_id" defaultValue={job?.department_id || ""}>
            <option value="">No department</option>
            {reference.departments.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Hiring manager">
          <select name="manager_id" defaultValue={job?.manager_id} required>
            {reference.members
              .filter((m: any) => ["admin", "manager"].includes(m.role))
              .map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Location">
          <input
            name="location"
            defaultValue={job?.location}
            placeholder="City or country"
            required
            minLength={2}
          />
        </Field>
        <Field label="Work arrangement">
          <select name="workplace" defaultValue={job?.workplace || "Hybrid"}>
            {["Remote", "Hybrid", "On-site"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Employment">
          <select
            name="employment"
            defaultValue={job?.employment || "Full-time"}
          >
            {["Full-time", "Part-time", "Contract", "Internship"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Openings">
          <input
            name="openings"
            type="number"
            defaultValue={job?.openings || 1}
            required
            min={1}
            max={100}
          />
        </Field>
        <Field label="Salary minimum (optional)">
          <input
            name="salary_min"
            type="number"
            min={0}
            defaultValue={job?.salary_min ?? ""}
          />
        </Field>
        <Field label="Salary maximum (optional)">
          <input
            name="salary_max"
            type="number"
            min={0}
            defaultValue={job?.salary_max ?? ""}
          />
        </Field>
        <Field label="Currency">
          <select name="currency" defaultValue={job?.currency || "USD"}>
            {["USD", "INR", "EUR", "GBP", "CAD", "AUD"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Closing date (optional)">
          <input
            type="date"
            name="closing_date"
            defaultValue={job?.closing_date?.slice(0, 10) || ""}
          />
        </Field>
      </div>
      <Field
        label="About the role"
        hint="Tell candidates what they’ll work on and why it matters."
      >
        <textarea
          name="description"
          defaultValue={job?.description}
          required
          minLength={30}
          rows={5}
        />
      </Field>
      <Field label="Requirements and preferred qualifications">
        <textarea
          name="requirements"
          defaultValue={job?.requirements}
          rows={3}
        />
      </Field>
      <Field label="Skills" hint="Separate skills with commas.">
        <input
          name="skills"
          defaultValue={job?.skills?.join(", ")}
          placeholder="TypeScript, React, PostgreSQL"
        />
      </Field>
      <Field
        label="Application questions"
        hint="One question per line. Each question will be required."
      >
        <textarea
          name="questions"
          defaultValue={job?.questions?.join("\n")}
          rows={2}
        />
      </Field>
      {error && <ErrorBox message={error} />}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={pending}>
          {pending
            ? "Saving…"
            : job
              ? "Save changes as draft"
              : "Create requisition"}
        </Button>
      </div>
    </form>
  );
}
export function OperationForm({
  kind,
  orgId,
  reference,
  onDone,
  onClose,
  application,
  applications = [],
  interview,
  offer,
}: FormProps & {
  kind: string;
  application?: any;
  applications?: any[];
  interview?: any;
  offer?: any;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const competencies: string[] = interview?.scorecard_criteria || [
    "Role expertise",
    "Problem solving",
    "Communication",
    "Collaboration",
  ];
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const s = (k: string) => String(f.get(k) || "");
    try {
      if (kind === "interview") {
        await api(
          "/api/workspace/interviews" + (interview ? "/" + interview.id : ""),
          orgId,
          {
            application_id: application?.id || s("application_id"),
            interviewer_id: s("interviewer_id"),
            title: s("title"),
            type: s("type"),
            starts_at: new Date(s("starts_at")).toISOString(),
            duration: Number(f.get("duration")),
            timezone: s("timezone"),
            location: s("location"),
            instructions: s("instructions"),
            template_id: s("template_id") || null,
          },
        );
      } else if (kind === "task") {
        await api("/api/workspace/tasks", orgId, {
          title: s("title"),
          assignee_id: s("assignee_id"),
          application_id: application?.id || null,
          due_at: new Date(s("due_at")).toISOString(),
        });
      } else if (kind === "offer") {
        await api(
          "/api/workspace/offers" + (offer ? "/" + offer.id + "/edit" : ""),
          orgId,
          {
            application_id: application.id,
            compensation: Number(f.get("compensation")),
            currency: s("currency"),
            start_date: s("start_date"),
            expires_at: new Date(s("expires_at")).toISOString(),
            terms: s("terms"),
            version: offer?.version,
          },
        );
      } else if (kind === "feedback") {
        const ratings = Object.fromEntries(
          competencies.map((k) => [k, Number(f.get(k))]),
        );
        await api(
          `/api/workspace/interviews/${interview.id}/scorecard`,
          orgId,
          {
            ratings,
            body: s("body"),
            recommendation: s("recommendation"),
            submitted: s("submit_mode") === "submit",
          },
        );
      } else if (kind === "reject") {
        await api(
          `/api/workspace/applications/${application.id}/status`,
          orgId,
          {
            status: s("status"),
            reason: s("reason"),
            version: application.version,
          },
        );
      }
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }
  const localDate = (s?: string) =>
    s
      ? new Date(
          new Date(s).getTime() - new Date(s).getTimezoneOffset() * 60000,
        )
          .toISOString()
          .slice(0, 16)
      : "";
  return (
    <form onSubmit={submit}>
      {kind === "interview" && (
        <>
          {!application && (
            <Field label="Candidate application">
              <select
                name="application_id"
                required
                defaultValue={interview?.application_id || ""}
              >
                <option value="" disabled>
                  Select a candidate
                </option>
                {applications
                  .filter((a) => a.status === "active")
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.title}
                    </option>
                  ))}
              </select>
            </Field>
          )}
          <Field label="Interview title">
            <input
              name="title"
              required
              minLength={3}
              defaultValue={interview?.title}
              placeholder="e.g. Portfolio conversation"
            />
          </Field>
          <div className="form-grid">
            <Field label="Interviewer">
              <select
                name="interviewer_id"
                defaultValue={interview?.interviewer_id}
                required
              >
                {reference.members.map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Format">
              <select name="type" defaultValue={interview?.type || "Video"}>
                {["Video", "Phone", "On-site"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Date and time"
              hint="Enter in your device’s local timezone."
            >
              <input
                type="datetime-local"
                name="starts_at"
                required
                defaultValue={localDate(interview?.starts_at)}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                name="duration"
                defaultValue={interview?.duration || 45}
                min={15}
                max={240}
                required
              />
            </Field>
          </div>
          <Field label="Display timezone">
            <input
              name="timezone"
              defaultValue={
                interview?.timezone ||
                Intl.DateTimeFormat().resolvedOptions().timeZone
              }
              required
            />
          </Field>
          {!interview && (
            <Field label="Evaluation template">
              <select name="template_id">
                <option value="">Default competencies</option>
                {reference.templates?.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Meeting URL or location">
            <input
              name="location"
              defaultValue={interview?.location}
              placeholder="Paste a meeting URL or enter a location"
              maxLength={500}
            />
          </Field>
          <Field label="Instructions">
            <textarea
              name="instructions"
              defaultValue={interview?.instructions}
              placeholder="What should the candidate prepare?"
            />
          </Field>
          <small>
            Conflicts are checked against {brand.name} interviews. External
            calendars are not connected.
          </small>
        </>
      )}
      {kind === "task" && (
        <>
          <Field label="Task">
            <input
              name="title"
              required
              minLength={3}
              placeholder="e.g. Review the portfolio before Friday"
            />
          </Field>
          <Field label="Assigned to">
            <select name="assignee_id" required>
              {reference.members.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due date and time">
            <input type="datetime-local" name="due_at" required />
          </Field>
        </>
      )}
      {kind === "offer" && (
        <>
          <div className="form-grid">
            <Field label="Annual compensation">
              <input
                name="compensation"
                type="number"
                min={1}
                required
                defaultValue={offer?.compensation}
              />
            </Field>
            <Field label="Currency">
              <select name="currency" defaultValue={offer?.currency || "USD"}>
                {["USD", "INR", "EUR", "GBP"].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label="Proposed start date">
              <input
                name="start_date"
                type="date"
                required
                defaultValue={offer?.start_date?.slice(0, 10)}
              />
            </Field>
            <Field label="Offer expires">
              <input
                name="expires_at"
                type="datetime-local"
                required
                defaultValue={localDate(offer?.expires_at)}
              />
            </Field>
          </div>
          <Field label="Employment terms">
            <textarea
              name="terms"
              defaultValue={offer?.terms}
              required
              minLength={20}
              rows={6}
              placeholder="Role, employment type, location, benefits, and any conditions."
            />
          </Field>
          <small>
            This creates a draft for approval. Candidate acceptance is recorded
            in {brand.name}; it is not an electronic signature.
          </small>
        </>
      )}
      {kind === "feedback" && (
        <>
          <p style={{ fontSize: 12, marginBottom: 18 }}>
            Use specific interview evidence. A submitted scorecard is locked.
          </p>
          {competencies.map((k) => (
            <Field key={k} label={k}>
              <select name={k} required>
                <option value="">Select a rating</option>
                <option value="1">1 — Needs substantial development</option>
                <option value="2">2 — Developing</option>
                <option value="3">3 — Meets expectations</option>
                <option value="4">4 — Strong evidence</option>
                <option value="5">5 — Exceptional evidence</option>
              </select>
            </Field>
          ))}
          <Field label="Evidence and observations">
            <textarea name="body" required minLength={10} rows={4} />
          </Field>
          <Field label="Recommendation">
            <select name="recommendation">
              {["Discuss", "Strong yes", "Yes", "No"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Save as">
            <select name="submit_mode">
              <option value="submit">Submit final feedback</option>
              <option value="draft">Save draft</option>
            </select>
          </Field>
        </>
      )}
      {kind === "reject" && (
        <>
          <Field label="Outcome">
            <select name="status">
              <option value="rejected">Reject application</option>
              <option value="hold">Put on hold</option>
              {application.status === "hold" && (
                <option value="active">Resume application</option>
              )}
            </select>
          </Field>
          <Field label="Internal reason">
            <textarea name="reason" required minLength={5} rows={4} />
          </Field>
          <small>
            The outcome is visible to the candidate. Your internal reason
            remains private.
          </small>
        </>
      )}
      {error && <ErrorBox message={error} />}
      <div className="form-actions">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={pending}>
          {pending
            ? "Saving…"
            : kind === "feedback"
              ? "Save feedback"
              : kind === "interview"
                ? interview
                  ? "Reschedule interview"
                  : "Schedule interview"
                : kind === "offer"
                  ? "Create draft offer"
                  : "Save"}
        </Button>
      </div>
    </form>
  );
}
