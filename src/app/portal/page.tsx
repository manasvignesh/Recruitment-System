"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Download,
  LogOut,
  MessageSquare,
} from "lucide-react";
import { api, date, time, money } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { brand } from "@/lib/brand";
import {
  Logo,
  Button,
  Loading,
  ErrorBox,
  Empty,
  Badge,
  Modal,
  Field,
  Toast,
} from "@/components/ui";
const labels: Record<string, string> = {
  Applied: "Application received",
  Screening: "In review",
  Assessment: "In review",
  Interview: "Conversations",
  "Final Review": "In review",
  Offer: "Offer",
  Hired: "Welcome to the team",
};
export default function Portal() {
  const router = useRouter();
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0),
    [selected, setSelected] = useState<any>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [withdraw, setWithdraw] = useState<any>(null),
    [uploadFor, setUploadFor] = useState<any>(null),
    [uploadError, setUploadError] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/public/portal")
      .then((d) => {
        if (active) {
          setData(d);
          setError("");
        }
      })
      .catch((e) => {
        if (e.message.includes("sign in"))
          router.replace("/login?next=/portal");
        else if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [reload, router]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function act(id: string, path: string, body: unknown, label: string) {
    setBusy(true);
    try {
      await api("/api/public/portal/" + id + "/" + path, undefined, body);
      setReload((v) => v + 1);
      setToast(label);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  if (error && !data)
    return (
      <main className="portal-container">
        <ErrorBox message={error} />
      </main>
    );
  if (!data) return <Loading />;
  return (
    <>
      <nav className="public-nav">
        <Link href="/">
          <Logo />
        </Link>
        <div className="public-nav-links">
          <Link href="/portal/profile">My profile</Link>
          <Link href="/workspace">
            Hiring workspace <ArrowUpRight size={13} />
          </Link>
          <Button
            variant="ghost"
            onClick={async () => {
              await authClient.signOut();
              router.push("/login");
            }}
          >
            <LogOut size={14} />
            Sign out
          </Button>
        </div>
      </nav>
      <main className="portal-container">
        <header className="portal-heading">
          <div>
            <span className="eyebrow">Your candidate space</span>
            <h1>Your next chapter, {data.user.name.split(" ")[0]}.</h1>
            <p style={{ marginTop: 12, fontSize: 13 }}>
              A clear view of where you stand and what comes next.
            </p>
          </div>
        </header>
        {error && <ErrorBox message={error} />}
        <div className="portal-layout">
          <div>
            {data.applications.length ? (
              data.applications.map((a: any) => {
                const offers = data.offers.filter(
                    (o: any) => o.application_id === a.id,
                  ),
                  history = data.history.filter(
                    (h: any) => h.entity_id === a.id,
                  );
                return (
                  <section className="panel portal-application" key={a.id}>
                    <div className="section-heading">
                      <h2>{a.title}</h2>
                      <Badge
                        tone={
                          a.status === "hired"
                            ? "green"
                            : a.status === "withdrawn" ||
                                a.status === "rejected"
                              ? "terra"
                              : "neutral"
                        }
                      >
                        {a.status === "active"
                          ? labels[a.stage] || "In review"
                          : a.status === "hired"
                            ? "Hired"
                            : a.status}
                      </Badge>
                    </div>
                    <p>
                      {a.organization} · {a.location} · Applied{" "}
                      {date(a.created_at)}
                    </p>
                    <div
                      className="journey-steps"
                      aria-label="Application progress"
                    >
                      {[0, 1, 2, 3].map((n) => (
                        <span
                          className={
                            n <=
                            (["Applied", "Screening", "Assessment"].includes(
                              a.stage,
                            )
                              ? 0
                              : ["Interview", "Final Review"].includes(a.stage)
                                ? 1
                                : a.stage === "Offer"
                                  ? 2
                                  : 3)
                              ? "filled"
                              : ""
                          }
                          key={n}
                        />
                      ))}
                    </div>
                    <details>
                      <summary
                        style={{
                          fontSize: 12,
                          color: "var(--green)",
                          cursor: "pointer",
                        }}
                      >
                        Your application journey
                      </summary>
                      <div style={{ marginTop: 22 }}>
                        {history.map((h: any, i: number) => (
                          <div className="timeline-item" key={i}>
                            <strong>
                              {h.action === "Stage changed"
                                ? "Application progress updated"
                                : h.action}
                            </strong>
                            <small>{date(h.created_at)}</small>
                          </div>
                        ))}
                      </div>
                    </details>
                    {offers.map((o: any) => (
                      <div className="offer-box" key={o.id}>
                        <div className="section-heading">
                          <h3>{money(o.compensation, o.currency)} / year</h3>
                          <Badge
                            tone={o.status === "accepted" ? "green" : "neutral"}
                          >
                            {o.status}
                          </Badge>
                        </div>
                        <p>
                          Proposed start: {date(o.start_date)}
                          <br />
                          Respond by: {date(o.expires_at)}
                        </p>
                        <p>{o.terms}</p>
                        <small>
                          Acceptance is recorded in {brand.name}. It does not
                          constitute an electronic signature.
                        </small>
                        <a
                          className="button ghost"
                          href={"/api/self/offer/" + o.id}
                        >
                          <Download size={12} />
                          Download offer document
                        </a>
                        {o.status === "available" && (
                          <div className="offer-actions">
                            <Button
                              disabled={busy}
                              onClick={() =>
                                act(
                                  a.id,
                                  "offer",
                                  { response: "accepted", version: o.version },
                                  "Your acceptance has been recorded.",
                                )
                              }
                            >
                              Accept offer
                            </Button>
                            <Button
                              disabled={busy}
                              variant="secondary"
                              onClick={() =>
                                act(
                                  a.id,
                                  "offer",
                                  { response: "declined", version: o.version },
                                  "Your response has been recorded.",
                                )
                              }
                            >
                              Decline offer
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        marginTop: 22,
                        flexWrap: "wrap",
                      }}
                    >
                      <Button
                        variant="secondary"
                        onClick={() => setSelected(a)}
                      >
                        <MessageSquare size={13} />
                        Message the team
                      </Button>
                      <Button variant="ghost" onClick={() => setUploadFor(a)}>
                        Add document
                      </Button>
                      {["active", "hold"].includes(a.status) && (
                        <Button variant="ghost" onClick={() => setWithdraw(a)}>
                          Withdraw application
                        </Button>
                      )}
                      <Link
                        className="button ghost"
                        href={"/careers/" + a.slug}
                      >
                        Company careers <ArrowUpRight size={12} />
                      </Link>
                    </div>
                  </section>
                );
              })
            ) : (
              <Empty
                title="Your story starts with an application."
                body="Apply to a published role on an organization’s careers page. Your progress will appear here."
              />
            )}
          </div>
          <aside>
            <section className="panel panel-pad">
              <h2>Upcoming conversations</h2>
              {data.interviews.filter((i: any) => i.status === "scheduled")
                .length ? (
                data.interviews
                  .filter((i: any) => i.status === "scheduled")
                  .map((i: any) => (
                    <div className="note" key={i.id}>
                      <h3>
                        <CalendarDays size={13} style={{ marginRight: 6 }} />
                        {i.title}
                      </h3>
                      <p>
                        {date(i.starts_at)} · {time(i.starts_at, i.timezone)}
                        <br />
                        {i.timezone} · {i.duration} min
                      </p>
                      {i.location && <p>{i.location}</p>}
                      {i.instructions && <p>{i.instructions}</p>}
                      <a
                        className="button ghost"
                        href={"/api/self/calendar/" + i.id}
                      >
                        <Download size={12} />
                        Calendar invitation
                      </a>
                    </div>
                  ))
              ) : (
                <p style={{ fontSize: 12, marginTop: 15 }}>
                  No conversations scheduled yet. The hiring team will share the
                  next step here.
                </p>
              )}
            </section>
            <section className="panel panel-pad" style={{ marginTop: 20 }}>
              <h2>Your documents</h2>
              {data.documents.length ? (
                data.documents.map((d: any) => (
                  <div className="list-row" key={d.id}>
                    <small>{d.name}</small>
                    <a
                      className="icon-button"
                      href={"/api/public/files/" + d.id}
                      aria-label={"Download " + d.name}
                    >
                      <Download size={15} />
                    </a>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 12, marginTop: 15 }}>
                  Your submitted resumes appear here.
                </p>
              )}
            </section>
            <div className="side-note">
              <h3>A little reassurance.</h3>
              <p>
                Your internal interview feedback stays with the hiring team. You
                can message them whenever you have questions about your
                application.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Modal
        title={"Conversation with " + selected?.organization}
        description={selected?.title}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            {data.messages
              .filter((m: any) => m.application_id === selected.id)
              .map((m: any) => (
                <div className="note" key={m.id}>
                  <small>
                    {m.author} · {date(m.created_at)}
                  </small>
                  <p>{m.body}</p>
                </div>
              ))}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (
                  await act(
                    selected.id,
                    "message",
                    { body: message },
                    "Message sent to the hiring team.",
                  )
                )
                  setMessage("");
              }}
            >
              <Field label="Message to the hiring team">
                <textarea
                  required
                  minLength={2}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                />
              </Field>
              <Button disabled={busy}>Send message</Button>
            </form>
          </>
        )}
      </Modal>
      <Modal
        title="Withdraw your application?"
        description="The hiring team will see your withdrawal. Scheduled interviews will be cancelled."
        open={!!withdraw}
        onClose={() => setWithdraw(null)}
      >
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setWithdraw(null)}>
            Keep application
          </Button>
          <Button
            disabled={busy}
            variant="danger"
            onClick={async () => {
              if (
                await act(withdraw.id, "withdraw", {}, "Application withdrawn.")
              )
                setWithdraw(null);
            }}
          >
            Withdraw application
          </Button>
        </div>
      </Modal>
      {toast && <Toast message={toast} />}
      <Modal
        title="Add a document"
        description={uploadFor?.title}
        open={!!uploadFor}
        onClose={() => !busy && setUploadFor(null)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setUploadError("");
            const f = new FormData(e.currentTarget);
            try {
              await api("/api/self/document/" + uploadFor.id, undefined, f);
              setUploadFor(null);
              setReload((v) => v + 1);
              setToast("Your document has been saved.");
            } catch (e) {
              setUploadError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field
            label="Additional resume or document"
            hint="PDF or DOCX, up to 2 MB. Maximum five retained documents."
          >
            <input name="resume" type="file" accept=".pdf,.docx" required />
          </Field>
          {uploadError && <ErrorBox message={uploadError} />}
          <Button disabled={busy}>Upload document</Button>
        </form>
      </Modal>
    </>
  );
}
