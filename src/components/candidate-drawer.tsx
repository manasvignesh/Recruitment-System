"use client";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Plus,
  CalendarDays,
  Mail,
  Download,
  Clock,
  MessageSquare,
  CheckSquare,
  Check,
} from "lucide-react";
import { api, date, time, days, money } from "@/lib/api";
import {
  Drawer,
  Loading,
  ErrorBox,
  Avatar,
  Badge,
  Button,
  Field,
  SectionTitle,
  Empty,
} from "./ui";
import type { ScreenProps } from "./workspace";
import { CandidatePools } from "./talent-pool-tools";
export function CandidateDrawer(
  p: ScreenProps & { id: string | null; onClose: () => void },
) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [tab, setTab] = useState("Overview"),
    [busy, setBusy] = useState(false),
    [note, setNote] = useState(""),
    [message, setMessage] = useState(""),
    [extracted, setExtracted] = useState<{ id: string; text: string } | null>(
      null,
    );
  useEffect(() => {
    if (!p.id) return;
    let active = true;
    api("/api/workspace/applications/" + p.id, p.org.id)
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.id, p.org.id, p.reload]);
  const manage = ["admin", "recruiter"].includes(p.org.role),
    a = data?.application,
    stages = p.reference.stages.map((s: any) => s.name),
    index = a ? stages.indexOf(a.stage) : -1;
  async function save(path: string, body: unknown, label: string) {
    setBusy(true);
    const ok = await p.mutate(path, body, label);
    setBusy(false);
    return ok;
  }
  return (
    <Drawer
      title={a?.name || "Candidate profile"}
      open={!!p.id}
      onClose={p.onClose}
    >
      {error ? (
        <div className="detail-body">
          {p.mutationError && <ErrorBox message={p.mutationError} />}
          <ErrorBox message={error} />
        </div>
      ) : !data ? (
        <Loading />
      ) : (
        <>
          <header className="detail-header">
            <span className="eyebrow">Candidate workspace · {a.title}</span>
            <div className="detail-heading">
              <Avatar name={a.name} large />
              <div>
                <h1>{a.name}</h1>
                <p>
                  {a.title} · Applied {date(a.created_at)}
                </p>
              </div>
            </div>
            <div className="detail-actions">
              <Badge
                tone={
                  a.status === "hired"
                    ? "green"
                    : a.status === "rejected"
                      ? "terra"
                      : "neutral"
                }
              >
                {a.status === "active" ? a.stage : a.status}
              </Badge>
              {manage &&
                a.status === "active" &&
                index >= 0 &&
                index < stages.length - 2 && (
                  <Button
                    disabled={busy}
                    onClick={() =>
                      save(
                        `applications/${a.id}/stage`,
                        { stage: stages[index + 1], version: a.version },
                        "Candidate advanced.",
                      )
                    }
                  >
                    Move to {stages[index + 1]}
                    <ArrowRight size={13} />
                  </Button>
                )}
              {manage && a.status === "active" && (
                <Button
                  variant="secondary"
                  onClick={() => p.openForm("interview", { application: a })}
                >
                  <CalendarDays size={13} />
                  Schedule interview
                </Button>
              )}
              {manage && ["active", "hold"].includes(a.status) && (
                <Button
                  variant="ghost"
                  onClick={() => p.openForm("reject", { application: a })}
                >
                  Update outcome
                </Button>
              )}
            </div>
          </header>
          <div className="detail-body">
            <div className="detail-split">
              <div className="detail-main">
                <div className="tabs">
                  {[
                    "Overview",
                    "Resume",
                    "Interviews",
                    "Feedback",
                    "Journey",
                    "Messages",
                    "Decision",
                  ].map((t) => (
                    <button
                      key={t}
                      className={tab === t ? "active" : ""}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                {tab === "Overview" && (
                  <>
                    <section className="detail-section">
                      <h3>A little about {a.name.split(" ")[0]}</h3>
                      <p>
                        {a.experience ||
                          "No additional experience information supplied. Refer to the submitted resume."}
                      </p>
                    </section>
                    <section className="detail-section">
                      <h3>Candidate-supplied skills</h3>
                      <div className="skill-list">
                        {a.skills.map((s: string) => (
                          <span className="skill" key={s}>
                            {s}
                          </span>
                        ))}
                      </div>
                      <small style={{ display: "block", marginTop: 10 }}>
                        Self-reported information; no independent verification
                        is implied.
                      </small>
                    </section>
                    <section className="detail-section">
                      <h3>Application answers</h3>
                      {Object.entries(a.answers).map(([q, answer]) => (
                        <div className="note" key={q}>
                          <strong style={{ fontSize: 12 }}>{q}</strong>
                          <p>{String(answer)}</p>
                        </div>
                      ))}
                    </section>
                    <section className="detail-section">
                      <SectionTitle title="Team notes" meta="Private" />
                      {data.notes.map((n: any) => (
                        <div className="note" key={n.id}>
                          <small>
                            {n.author} · {date(n.created_at)}
                          </small>
                          <p>{n.body}</p>
                        </div>
                      ))}
                      {manage && (
                        <form
                          className="inline-form"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            if (
                              await save(
                                `applications/${a.id}/note`,
                                { body: note },
                                "Private note added.",
                              )
                            )
                              setNote("");
                          }}
                        >
                          <textarea
                            aria-label="Private candidate note"
                            placeholder="Add context for your team…"
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            required
                            minLength={2}
                          />
                          <Button disabled={busy} variant="secondary">
                            <Plus size={13} />
                            Add private note
                          </Button>
                        </form>
                      )}
                    </section>
                  </>
                )}
                {tab === "Resume" && (
                  <>
                    <SectionTitle title="Submitted documents" />
                    {data.documents.length ? (
                      data.documents.map((d: any) => (
                        <div className="note" key={d.id}>
                          <h3>{d.name}</h3>
                          <p>
                            {Math.round(d.size / 1024)} KB · Text extraction:{" "}
                            {d.parsing_status}
                          </p>
                          <a
                            className="button secondary"
                            href={`/api/public/files/${d.id}?org=${p.org.id}`}
                          >
                            <Download size={13} />
                            Download original
                          </a>
                          <Button
                            variant="ghost"
                            onClick={async () => {
                              try {
                                const r = await api(
                                  `/api/public/files/${d.id}?org=${p.org.id}&text=true`,
                                );
                                setExtracted({ id: d.id, text: r.text || "" });
                              } catch (e) {
                                setError((e as Error).message);
                              }
                            }}
                          >
                            Read extracted text
                          </Button>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="No submitted documents"
                        body="The candidate’s original resume appears here after application."
                      />
                    )}
                    <small>
                      Use the original document as the source of truth. Malware
                      scanning is not configured.
                    </small>
                    {extracted && (
                      <form
                        className="inline-form"
                        style={{ marginTop: 20 }}
                        onSubmit={async (e) => {
                          e.preventDefault();
                          await save(
                            "documents/" + extracted.id,
                            { text: extracted.text },
                            "Document text corrected.",
                          );
                        }}
                      >
                        <Field
                          label="Extracted text"
                          hint="Check against the original before making corrections."
                        >
                          <textarea
                            value={extracted.text}
                            readOnly={!manage}
                            onChange={(e) =>
                              setExtracted({
                                ...extracted,
                                text: e.target.value,
                              })
                            }
                            rows={12}
                          />
                        </Field>
                        {manage && (
                          <Button disabled={busy} variant="secondary">
                            Save text correction
                          </Button>
                        )}
                      </form>
                    )}
                  </>
                )}
                {tab === "Interviews" && (
                  <>
                    <SectionTitle
                      title="Conversations"
                      action={
                        manage && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              p.openForm("interview", { application: a })
                            }
                          >
                            <Plus size={13} />
                            Schedule
                          </Button>
                        )
                      }
                    />
                    {data.interviews.length ? (
                      data.interviews.map((i: any) => (
                        <div className="note" key={i.id}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <h3>{i.title}</h3>
                            <Badge
                              tone={
                                i.status === "completed" ? "green" : "neutral"
                              }
                            >
                              {i.status}
                            </Badge>
                          </div>
                          <p>
                            {date(i.starts_at)} at{" "}
                            {time(i.starts_at, i.timezone)} · {i.timezone}
                            <br />
                            {i.duration} minutes · {i.type} · {i.interviewer}
                          </p>
                          <p>
                            {i.location}
                            <br />
                            {i.instructions}
                          </p>
                          <div
                            style={{
                              display: "flex",
                              gap: 7,
                              flexWrap: "wrap",
                            }}
                          >
                            {i.interviewer_id === p.reference.user.id &&
                              !data.scorecards.some(
                                (s: any) =>
                                  s.interview_id === i.id && s.submitted,
                              ) &&
                              i.status !== "cancelled" && (
                                <Button
                                  variant="secondary"
                                  onClick={() =>
                                    p.openForm("feedback", {
                                      application: a,
                                      interview: i,
                                    })
                                  }
                                >
                                  Submit scorecard
                                </Button>
                              )}
                            {manage && i.status === "scheduled" && (
                              <>
                                <Button
                                  variant="ghost"
                                  onClick={() =>
                                    p.openForm("interview", {
                                      application: a,
                                      interview: i,
                                    })
                                  }
                                >
                                  Reschedule
                                </Button>
                                <Button
                                  variant="ghost"
                                  disabled={busy}
                                  onClick={() =>
                                    save(
                                      "interviews/" + i.id + "/cancel",
                                      {},
                                      "Interview cancelled.",
                                    )
                                  }
                                >
                                  Cancel interview
                                </Button>
                              </>
                            )}
                          </div>
                          <details style={{ fontSize: 12, marginTop: 16 }}>
                            <summary>Interview preparation kit</summary>
                            <p>
                              Review the candidate’s supplied experience:{" "}
                              {a.experience || "Refer to their resume."}
                            </p>
                            <ol style={{ paddingLeft: 20, lineHeight: 1.9 }}>
                              {(i.scorecard_criteria || []).map(
                                (criterion: string) => (
                                  <li key={criterion}>
                                    For {criterion.toLowerCase()}, ask for a
                                    concrete project example, the candidate’s
                                    contribution, and the result.
                                  </li>
                                ),
                              )}
                              <li>
                                Ask for an example of their work in{" "}
                                {a.skills[0] || "the role’s core skills"}.
                              </li>
                              <li>
                                Explore a difficult problem, alternatives, and
                                outcomes.
                              </li>
                              <li>
                                Discuss collaboration and lessons learned.
                              </li>
                              <li>Leave time for questions about {a.title}.</li>
                            </ol>
                            <p>
                              Role requirements:{" "}
                              {a.requirements ||
                                "Review the published position."}
                            </p>
                            <small>
                              Deterministic template. Record specific evidence
                              in the scorecard.
                            </small>
                          </details>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="The conversation hasn’t started yet."
                        body="Schedule an interview when you’re ready to learn more."
                      />
                    )}
                  </>
                )}
                {tab === "Decision" && (
                  <>
                    <SectionTitle
                      title="A considered hiring decision"
                      meta="Private"
                    />
                    <p style={{ fontSize: 12, marginBottom: 20 }}>
                      Review job-relevant evidence, missing feedback, and the
                      team’s observations. The assigned hiring manager owns the
                      decision.
                    </p>
                    <div className="note">
                      <h3>Evidence available</h3>
                      <p>
                        {data.scorecards.filter((s: any) => s.submitted).length}{" "}
                        submitted scorecards ·{" "}
                        {
                          data.interviews.filter(
                            (i: any) =>
                              i.status !== "cancelled" &&
                              !data.scorecards.some(
                                (s: any) =>
                                  s.interview_id === i.id && s.submitted,
                              ),
                          ).length
                        }{" "}
                        outstanding
                      </p>
                      {data.scorecards
                        .filter((s: any) => s.submitted)
                        .map((s: any) => (
                          <p key={s.id}>
                            <strong>
                              {s.author}: {s.recommendation}
                            </strong>
                            <br />
                            {s.body}
                          </p>
                        ))}
                    </div>
                    {data.decisions?.map((d: any) => (
                      <div className="note" key={d.id}>
                        <Badge tone="neutral">{d.outcome}</Badge>
                        <p>{d.evidence}</p>
                        <small>
                          {d.actor} · {date(d.created_at)}
                        </small>
                      </div>
                    ))}
                    {["admin", "manager"].includes(p.org.role) &&
                      a.stage === "Final Review" &&
                      a.status === "active" && (
                        <form
                          className="inline-form"
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const f = new FormData(e.currentTarget);
                            await save(
                              `applications/${a.id}/decision`,
                              {
                                outcome: f.get("outcome"),
                                evidence: f.get("evidence"),
                              },
                              "Hiring decision recorded.",
                            );
                          }}
                        >
                          <Field label="Decision outcome">
                            <select name="outcome">
                              <option value="discuss">Discuss further</option>
                              <option value="advance">
                                Recommend advancing
                              </option>
                              <option value="decline">
                                Recommend declining
                              </option>
                            </select>
                          </Field>
                          <Field label="Job-relevant evidence and rationale">
                            <textarea
                              name="evidence"
                              minLength={20}
                              maxLength={10000}
                              required
                              rows={4}
                            />
                          </Field>
                          <Button disabled={busy}>Record decision</Button>
                        </form>
                      )}
                    <small>
                      A decision record does not automatically move or reject
                      the candidate.
                    </small>
                  </>
                )}
                {tab === "Feedback" && (
                  <>
                    <SectionTitle
                      title="Evidence for the decision"
                      meta="Private to the team"
                    />
                    {data.scorecards.length ? (
                      data.scorecards.map((s: any) => (
                        <div className="note" key={s.id}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                            }}
                          >
                            <strong>{s.author}</strong>
                            <Badge tone={s.submitted ? "green" : "amber"}>
                              {s.submitted ? "Submitted · Locked" : "Draft"}
                            </Badge>
                          </div>
                          <p>
                            <strong>{s.recommendation}</strong>
                          </p>
                          {Object.entries(s.ratings).map(([k, v]) => (
                            <div
                              key={k}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: 11,
                                margin: "8px 0",
                              }}
                            >
                              <span>{k}</span>
                              <span>{String(v)} / 5</span>
                            </div>
                          ))}
                          <p>{s.body}</p>
                          <small>{date(s.updated_at)}</small>
                        </div>
                      ))
                    ) : (
                      <Empty
                        title="Room for a considered decision."
                        body="Structured feedback appears after an interviewer saves a scorecard."
                      />
                    )}
                    <small>
                      Feedback supports human decisions. No automatic candidate
                      ranking is calculated.
                    </small>
                  </>
                )}
                {tab === "Journey" && (
                  <>
                    <SectionTitle title="A journey taking shape" />
                    {[
                      ...(data.events || []).map((e: any) => ({
                        id: e.id,
                        title: e.action,
                        detail: e.actor,
                        created_at: e.created_at,
                      })),
                      ...data.history.map((h: any) => ({
                        id: h.id,
                        title: h.from_stage
                          ? `${h.from_stage} → ${h.to_stage}`
                          : "Application received",
                        detail: h.actor,
                        created_at: h.created_at,
                      })),
                      ...data.interviews.map((i: any) => ({
                        id: i.id,
                        title: `${i.title} · ${i.status}`,
                        detail: `${i.interviewer} · ${i.duration} min`,
                        created_at: i.starts_at,
                      })),
                      ...data.scorecards
                        .filter((s: any) => s.submitted)
                        .map((s: any) => ({
                          id: s.id,
                          title: "Feedback submitted",
                          detail: s.author,
                          created_at: s.updated_at,
                        })),
                    ]
                      .sort(
                        (a, b) =>
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime(),
                      )
                      .map((event) => (
                        <div className="timeline-item" key={event.id}>
                          <strong>{event.title}</strong>
                          {new Date(event.created_at) > new Date() && (
                            <Badge tone="blue">Scheduled</Badge>
                          )}
                          <p>{event.detail}</p>
                          <small>
                            {date(event.created_at)} · {time(event.created_at)}
                          </small>
                        </div>
                      ))}
                  </>
                )}
                {tab === "Messages" && (
                  <>
                    <SectionTitle title="Candidate conversation" />
                    {data.messages.map((m: any) => (
                      <div className="note" key={m.id}>
                        <small>
                          {m.author} · {date(m.created_at)} ·{" "}
                          {m.state === "portal"
                            ? "Available in portal"
                            : m.state === "draft"
                              ? "Draft"
                              : "Email unsent"}
                        </small>
                        <p>{m.body}</p>
                      </div>
                    ))}
                    {manage && (
                      <form
                        className="inline-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          if (
                            await save(
                              "messages",
                              {
                                application_id: a.id,
                                body: message,
                                state: "portal",
                              },
                              "Message available in candidate portal.",
                            )
                          )
                            setMessage("");
                        }}
                      >
                        <textarea
                          aria-label="Message to candidate"
                          placeholder="Write a clear next step…"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          required
                          minLength={2}
                        />
                        <Button disabled={busy}>
                          <MessageSquare size={13} />
                          Send to portal
                        </Button>
                      </form>
                    )}
                    <small style={{ display: "block", marginTop: 12 }}>
                      Portal messages work without email. No external email is
                      sent.
                    </small>
                  </>
                )}
              </div>
              <aside className="detail-context">
                <section className="context-group">
                  <h3>Application at a glance</h3>
                  <small>
                    <Mail
                      size={12}
                      style={{ verticalAlign: "middle", marginRight: 7 }}
                    />
                    {a.email}
                  </small>
                  {a.phone && <small>{a.phone}</small>}
                  <small style={{ marginTop: 13 }}>
                    <Clock
                      size={12}
                      style={{ verticalAlign: "middle", marginRight: 7 }}
                    />
                    {days(a.stage_entered_at)} days in {a.stage}
                  </small>
                  <small>Source: {a.source}</small>
                  {manage && a.status === "active" && (
                    <Field label="Current stage">
                      <select
                        value={a.stage}
                        disabled={busy}
                        onChange={(e) =>
                          save(
                            `applications/${a.id}/stage`,
                            { stage: e.target.value, version: a.version },
                            "Stage updated.",
                          )
                        }
                      >
                        <option>{a.stage}</option>
                        {stages
                          .filter(
                            (s: string, i: number) =>
                              Math.abs(i - index) === 1 && s !== "Hired",
                          )
                          .map((s: string) => (
                            <option key={s}>{s}</option>
                          ))}
                      </select>
                    </Field>
                  )}
                  {manage && (
                    <Field label="Assigned recruiter">
                      <select
                        value={a.owner_id || ""}
                        disabled={busy}
                        onChange={(e) =>
                          save(
                            `applications/${a.id}/owner`,
                            { userId: e.target.value },
                            "Recruiter assigned.",
                          )
                        }
                      >
                        <option value="" disabled>
                          Unassigned
                        </option>
                        {p.reference.members
                          .filter((m: any) =>
                            ["admin", "recruiter"].includes(m.role),
                          )
                          .map((m: any) => (
                            <option key={m.id} value={m.id}>
                              {m.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                  )}
                </section>
                <section className="context-group">
                  <h3>The next step</h3>
                  {data.interviews.find(
                    (i: any) => i.status === "scheduled",
                  ) ? (
                    <small>
                      {
                        data.interviews.find(
                          (i: any) => i.status === "scheduled",
                        ).title
                      }
                      <br />
                      {date(
                        data.interviews.find(
                          (i: any) => i.status === "scheduled",
                        ).starts_at,
                      )}
                    </small>
                  ) : (
                    <small>No interview scheduled.</small>
                  )}
                  <small style={{ marginTop: 12 }}>
                    {
                      data.interviews.filter(
                        (i: any) =>
                          i.status !== "cancelled" &&
                          !data.scorecards.some(
                            (s: any) => s.interview_id === i.id && s.submitted,
                          ),
                      ).length
                    }{" "}
                    outstanding scorecards
                  </small>
                </section>
                <section className="context-group">
                  <h3>Hiring decision & offer</h3>
                  {a.stage === "Final Review" && (
                    <>
                      <small>
                        Review the evidence with the hiring manager. Record your
                        decision in a private note.
                      </small>
                      <Button
                        variant="secondary"
                        onClick={() => setTab("Feedback")}
                      >
                        Review feedback
                      </Button>
                    </>
                  )}
                  {data.offers.map((o: any) => (
                    <div
                      className="offer-box"
                      key={o.id}
                      style={{ padding: 12 }}
                    >
                      <Badge
                        tone={o.status === "accepted" ? "green" : "neutral"}
                      >
                        {o.status === "pending"
                          ? "Awaiting approval"
                          : o.status}
                      </Badge>
                      <p>
                        {money(o.compensation, o.currency)} / year
                        <br />
                        Start {date(o.start_date)}
                        <br />
                        Expires {date(o.expires_at)}
                      </p>
                      <details style={{ fontSize: 11 }}>
                        <summary>Employment terms</summary>
                        <p>{o.terms}</p>
                      </details>
                      <details style={{ fontSize: 11, marginTop: 10 }}>
                        <summary>Version history</summary>
                        {data.offerVersions?.map((v: any) => (
                          <p key={v.version}>
                            Version {v.version} · {v.snapshot.status}
                            <br />
                            {money(
                              v.snapshot.compensation,
                              v.snapshot.currency,
                            )}{" "}
                            · {date(v.created_at)}
                          </p>
                        ))}
                      </details>
                      <div className="offer-actions">
                        {manage && o.status === "draft" && (
                          <Button
                            variant="secondary"
                            onClick={() =>
                              p.openForm("offer", { application: a, offer: o })
                            }
                          >
                            Revise draft
                          </Button>
                        )}
                        {manage && o.status === "pending" && (
                          <Button
                            disabled={busy}
                            variant="secondary"
                            onClick={() =>
                              save(
                                "offers/" + o.id,
                                { status: "draft", version: o.version },
                                "Offer returned to draft.",
                              )
                            }
                          >
                            Return to draft
                          </Button>
                        )}
                        <a
                          className="button ghost"
                          href={`/api/self/offer/${o.id}?org=${p.org.id}`}
                        >
                          <Download size={12} />
                          Download offer
                        </a>
                        {manage && o.status === "draft" && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              save(
                                "offers/" + o.id,
                                { status: "pending", version: o.version },
                                "Offer submitted for approval.",
                              )
                            }
                          >
                            Request approval
                          </Button>
                        )}
                        {["admin", "manager"].includes(p.org.role) &&
                          o.status === "pending" && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                save(
                                  "offers/" + o.id,
                                  { status: "approved", version: o.version },
                                  "Offer approved.",
                                )
                              }
                            >
                              Approve offer
                            </Button>
                          )}
                        {manage && o.status === "approved" && (
                          <Button
                            disabled={busy}
                            onClick={() =>
                              save(
                                "offers/" + o.id,
                                { status: "available", version: o.version },
                                "Offer available in candidate portal.",
                              )
                            }
                          >
                            Share in portal
                          </Button>
                        )}
                        {manage &&
                          o.status === "accepted" &&
                          a.status !== "hired" && (
                            <Button
                              disabled={busy}
                              onClick={() =>
                                save(
                                  "offers/" + o.id + "/hire",
                                  {},
                                  "Hire completed. Congratulations.",
                                )
                              }
                            >
                              Complete hire
                              <Check size={12} />
                            </Button>
                          )}
                      </div>
                    </div>
                  ))}
                  {manage && a.stage === "Offer" && !data.offers.length && (
                    <Button
                      variant="secondary"
                      onClick={() => p.openForm("offer", { application: a })}
                    >
                      Prepare offer
                    </Button>
                  )}
                  {!data.offers.length && a.stage !== "Offer" && (
                    <small>
                      Offers are available after the candidate reaches the Offer
                      stage.
                    </small>
                  )}
                </section>
                <section className="context-group">
                  <h3>Tasks & follow-ups</h3>
                  {data.tasks.map((t: any) => (
                    <small key={t.id} style={{ marginBottom: 8 }}>
                      {t.status === "done" ? "✓ " : ""}
                      {t.title}
                      <br />
                      {t.assignee} · {date(t.due_at)}
                    </small>
                  ))}
                  {manage && (
                    <Button
                      variant="secondary"
                      onClick={() => p.openForm("task", { application: a })}
                    >
                      <CheckSquare size={12} />
                      Add task
                    </Button>
                  )}
                </section>
                {manage && a.talent_consent && (
                  <section className="context-group">
                    <CandidatePools
                      {...p}
                      candidate={a}
                      memberships={data.pools || []}
                    />
                    <small>Consented to future opportunities.</small>
                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await save(
                          `applications/${a.id}/talent`,
                          {
                            tags: String(f.get("tags"))
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          },
                          "Talent tags updated.",
                        );
                      }}
                    >
                      <Field label="Tags, separated by commas">
                        <input name="tags" placeholder="Design, future role" />
                      </Field>
                      <Button variant="secondary" disabled={busy}>
                        Save tags
                      </Button>
                    </form>
                  </section>
                )}
              </aside>
            </div>
          </div>
        </>
      )}
    </Drawer>
  );
}
