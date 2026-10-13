"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Home,
  BriefcaseBusiness,
  Users,
  CalendarDays,
  Library,
  ChartNoAxesCombined,
  MessageSquare,
  CheckSquare,
  Settings,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  LogOut,
  Sun,
  Moon,
  Menu,
  Leaf,
  Check,
  Bell,
} from "lucide-react";
import { api, date, days, time } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { brand } from "@/lib/brand";
import {
  Button,
  Logo,
  Avatar,
  PageTitle,
  SectionTitle,
  Empty,
  Loading,
  ErrorBox,
  Modal,
  Field,
  Toast,
  Badge,
} from "./ui";
import { JobForm, OperationForm } from "./forms";
import {
  JobsScreen,
  CandidatesScreen,
  InterviewsScreen,
  AnalyticsScreen,
  SettingsScreen,
  TalentScreen,
} from "./workspace-screens";
import { CandidateDrawer } from "./candidate-drawer";
import { NotificationsScreen } from "./notifications-screen";
import { MessageLibrary, DraftEditor } from "./message-tools";
const navigation = [
  { key: "home", label: "Workbench", icon: Home },
  { key: "jobs", label: "Jobs", icon: BriefcaseBusiness },
  { key: "candidates", label: "Candidates", icon: Users },
  { key: "interviews", label: "Interviews", icon: CalendarDays },
  { key: "talent", label: "Talent pool", icon: Library },
  { key: "analytics", label: "Analytics", icon: ChartNoAxesCombined },
];
const secondary = [
  { key: "messages", label: "Messages", icon: MessageSquare },
  { key: "tasks", label: "Tasks", icon: CheckSquare },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "audit", label: "Audit history", icon: CheckSquare },
  { key: "settings", label: "Settings", icon: Settings },
];
export type ScreenProps = {
  mutationError?: string;
  org: any;
  reference: any;
  reload: number;
  openCandidate: (id: string) => void;
  openForm: (kind: string, data?: any) => void;
  mutate: (path: string, body: unknown, message?: string) => Promise<boolean>;
  navigate: (view: string, query?: string) => void;
};
export function Workspace({ view }: { view: string }) {
  const router = useRouter();
  const [orgs, setOrgs] = useState<any[]>([]);
  const [org, setOrg] = useState<any>(null);
  const [reference, setReference] = useState<any>(null);
  const [boot, setBoot] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [candidate, setCandidate] = useState<string | null>(null);
  const [form, setForm] = useState<{ kind: string; data?: any } | null>(null);
  const [formDirty, setFormDirty] = useState(false),
    [discardForm, setDiscardForm] = useState(false);
  useEffect(() => {
    if (!form || !formDirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [form, formDirty]);
  function closeForm() {
    if (formDirty) setDiscardForm(true);
    else setForm(null);
  }
  const [toast, setToast] = useState("");
  const [mobile, setMobile] = useState(false);
  const [dark, setDark] = useState(false);
  const [command, setCommand] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState("");
  const [allApplications, setAllApplications] = useState<any[]>([]);
  const [pending, setPending] = useState(false);
  const load = useCallback(async () => {
    try {
      const list = await api<any[]>("/api/workspace/organizations");
      setOrgs(list);
      const orgParam = new URLSearchParams(window.location.search).get("org");
      const chosen = list.find((o) => o.id === orgParam) || list[0];
      if (chosen) {
        setOrg(chosen);
        const ref = await api("/api/workspace/reference", chosen.id);
        setReference(ref);
      }
      setError("");
    } catch (e) {
      const message = (e as Error).message;
      if (message.includes("sign in")) router.replace("/login");
      else setError(message);
    } finally {
      setBoot(false);
    }
  }, [router]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("application");
    if (id) setCandidate(id);
  }, [view]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommand((v) => !v);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!command || !org) return;
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const r = await api(
          "/api/workspace/search?q=" + encodeURIComponent(query),
          org.id,
        );
        if (!cancelled) {
          setResults(r);
          setSearchError("");
        }
      } catch (e) {
        if (!cancelled) setSearchError((e as Error).message);
      }
    }, 180);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [command, query, org]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3800);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(next: string, q = "") {
    setMobile(false);
    router.push(
      "/workspace" +
        (next === "home" ? "" : "/" + next) +
        "?org=" +
        org.id +
        (q ? "&" + q : ""),
    );
  }
  async function mutate(
    path: string,
    body: unknown,
    message = "Saved to your workspace.",
  ) {
    if (pending) return false;
    setPending(true);
    try {
      await api("/api/workspace/" + path, org.id, body);
      if (path.startsWith("settings") || path === "templates")
        setReference(await api("/api/workspace/reference", org.id));
      setReload((v) => v + 1);
      setToast(message);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setPending(false);
    }
  }
  async function openForm(kind: string, data?: any) {
    if (kind === "interview" && !data?.application) {
      try {
        setAllApplications(
          (await api("/api/workspace/applications?status=active", org.id))
            .items,
        );
      } catch (e) {
        setError((e as Error).message);
        return;
      }
    }
    setFormDirty(false);
    setDiscardForm(false);
    setForm({ kind, data });
  }
  function done() {
    setFormDirty(false);
    setDiscardForm(false);
    setReload((v) => v + 1);
    setForm(null);
    setToast("Saved to your workspace.");
    void load();
  }
  const canManage = org && ["admin", "recruiter"].includes(org.role);
  if (boot) return <Loading />;
  if (!org || view === "new")
    return (
      <Onboarding
        error={error}
        onDone={async (id) => {
          router.push("/workspace?org=" + id);
          const list = await api("/api/workspace/organizations");
          setOrgs(list);
          const created = list.find((o: any) => o.id === id);
          setOrg(created);
          setReference(await api("/api/workspace/reference", id));
        }}
      />
    );
  if (!reference)
    return (
      <main className="portal-container">
        <ErrorBox message={error || "Unable to load organization."} />
        <Button onClick={load}>Try again</Button>
      </main>
    );
  const screenProps: ScreenProps = {
    mutationError: error,
    org,
    reference,
    reload,
    openCandidate: setCandidate,
    openForm,
    mutate,
    navigate,
  };
  const allowedNavigation = navigation
    .filter(
      (n) =>
        org.role !== "interviewer" || !["talent", "analytics"].includes(n.key),
    )
    .filter((n) => org.role !== "manager" || n.key !== "talent");
  const allowedSecondary = secondary.filter(
    (n) =>
      n.key === "tasks" ||
      n.key === "notifications" ||
      (n.key === "settings"
        ? org.role === "admin"
        : n.key === "audit"
          ? org.role === "admin"
          : canManage),
  );
  return (
    <div className={dark ? "theme-dark" : ""}>
      <a className="skip-link" href="#main">
        Skip to workspace
      </a>
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
          <Link href="/">
            <Logo />
          </Link>
          <div className="org-switch">
            <span className="org-monogram">{org.name[0]}</span>
            <select
              aria-label="Organization"
              value={org.id}
              onChange={async (e) => {
                const o = orgs.find((o) => o.id === e.target.value);
                setOrg(o);
                setReference(await api("/api/workspace/reference", o.id));
                router.push("/workspace?org=" + o.id);
                setReload((v) => v + 1);
                setCandidate(null);
              }}
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <Link
            className="nav-item"
            style={{
              fontSize: 10,
              paddingTop: 0,
              marginTop: -18,
              marginBottom: 20,
            }}
            href="/workspace/new"
          >
            <Plus size={12} />
            New organization
          </Link>
          <span className="nav-label">Hiring workspace</span>
          <nav aria-label="Main navigation">
            {allowedNavigation.map((n) => (
              <Link
                key={n.key}
                href={
                  "/workspace" +
                  (n.key === "home" ? "" : "/" + n.key) +
                  "?org=" +
                  org.id
                }
                onClick={() => setMobile(false)}
                className={`nav-item ${n.key === view ? "active" : ""}`}
                aria-current={n.key === view ? "page" : undefined}
              >
                <n.icon size={17} />
                {n.label}
              </Link>
            ))}
            <div className="nav-separator" />
            {allowedSecondary.map((n) => (
              <Link
                key={n.key}
                href={"/workspace/" + n.key + "?org=" + org.id}
                onClick={() => setMobile(false)}
                className={`nav-item ${n.key === view ? "active" : ""}`}
                aria-current={n.key === view ? "page" : undefined}
              >
                <n.icon size={17} />
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            {org.is_demo && (
              <div className="demo-label">
                Demo workspace · Fictional records
              </div>
            )}
            <Link className="nav-item" href="/portal">
              <ArrowUpRight size={16} />
              Candidate portal
            </Link>
            <div className="sidebar-user">
              <Avatar name={reference.user.name} />
              <div>
                <strong>{reference.user.name}</strong>
                <small>{org.role}</small>
              </div>
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={async () => {
                  await authClient.signOut();
                  router.push("/login");
                }}
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>
        </aside>
        <div className="app-main">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobile((v) => !v)}
                aria-label="Toggle navigation"
                aria-expanded={mobile}
              >
                <Menu size={18} />
              </button>
              <span>Workspace</span>
              <ChevronRight size={12} />
              <span>
                {view === "home"
                  ? "Workbench"
                  : view === "talent"
                    ? "Talent pool"
                    : view}
              </span>
            </div>
            <div className="topbar-actions">
              <button
                className="command-trigger"
                onClick={() => setCommand(true)}
              >
                <Search size={14} />
                <span>Search anything</span>
                <kbd>Ctrl K</kbd>
              </button>
              <button
                className="icon-button"
                onClick={() => setDark((v) => !v)}
                aria-label={dark ? "Use light theme" : "Use dark theme"}
              >
                {dark ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                className="icon-button"
                onClick={() => navigate("notifications")}
                aria-label="Open activity and tasks"
              >
                <Bell size={17} />
              </button>
            </div>
          </header>
          <main id="main" className="content">
            {error && <ErrorBox message={error} />}
            <div aria-busy={pending}>
              {view === "home" ? (
                <Workbench {...screenProps} />
              ) : view === "jobs" ? (
                <JobsScreen {...screenProps} />
              ) : view === "candidates" ? (
                <CandidatesScreen {...screenProps} />
              ) : view === "interviews" ? (
                <InterviewsScreen {...screenProps} />
              ) : view === "analytics" ? (
                <AnalyticsScreen {...screenProps} />
              ) : view === "talent" ? (
                <TalentScreen {...screenProps} />
              ) : view === "settings" ? (
                <SettingsScreen {...screenProps} />
              ) : view === "notifications" ? (
                <NotificationsScreen {...screenProps} />
              ) : ["tasks", "messages", "audit"].includes(view) ? (
                <OperationsScreen {...screenProps} view={view} />
              ) : (
                <Empty
                  title="This page isn’t available"
                  body="Choose a page from your workspace navigation."
                  action={
                    <Button onClick={() => navigate("home")}>
                      Return to workbench
                    </Button>
                  }
                />
              )}
            </div>
            <footer className="page-footer">
              <span>{brand.name} · A little more clarity, every day.</span>
              <span>
                <span className="live-dot" />
                Connected to your workspace
              </span>
            </footer>
          </main>
        </div>
      </div>
      <CandidateDrawer
        key={(org?.id || "") + candidate}
        id={candidate}
        {...screenProps}
        onClose={() => setCandidate(null)}
      />
      <Modal
        open={!!form}
        title={
          form?.kind === "job"
            ? form.data?.job
              ? "Edit position"
              : "Create a position"
            : (
                {
                  interview: form?.data?.interview
                    ? "Reschedule interview"
                    : "Schedule an interview",
                  task: "Create a task",
                  offer: "Prepare an offer",
                  feedback: "Interview scorecard",
                  reject: "Update application outcome",
                } as Record<string, string>
              )[form?.kind || ""] || "Workspace action"
        }
        description={
          form?.kind === "job"
            ? "Make the next opportunity clear. Start with a draft."
            : form?.data?.application
              ? `${form.data.application.name} · ${form.data.application.title}`
              : undefined
        }
        onClose={() => {
          if (!pending) closeForm();
        }}
        wide={form?.kind === "job"}
      >
        <div onChangeCapture={() => setFormDirty(true)}>
          {form?.kind === "job" ? (
            <JobForm
              orgId={org.id}
              reference={reference}
              job={form.data?.job}
              onDone={done}
              onClose={closeForm}
            />
          ) : (
            form && (
              <OperationForm
                kind={form.kind}
                orgId={org.id}
                reference={reference}
                application={form.data?.application}
                interview={form.data?.interview}
                offer={form.data?.offer}
                applications={allApplications}
                onDone={done}
                onClose={closeForm}
              />
            )
          )}
        </div>
      </Modal>
      <Modal
        title="Keep your changes?"
        description="This form has unsaved changes. Keep editing or discard them."
        open={discardForm}
        onClose={() => setDiscardForm(false)}
      >
        <div className="form-actions">
          <Button variant="secondary" onClick={() => setDiscardForm(false)}>
            Keep editing
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setFormDirty(false);
              setDiscardForm(false);
              setForm(null);
            }}
          >
            Discard changes
          </Button>
        </div>
      </Modal>
      <Modal
        open={command}
        onClose={() => setCommand(false)}
        title="Command center"
        description="Find your next action. Press Ctrl K from anywhere."
      >
        <div className="command-input">
          <Search size={19} />
          <input
            aria-label="Search your workspace"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a candidate or position…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                document
                  .querySelector<HTMLButtonElement>(".command-list button")
                  ?.focus();
              }
            }}
          />
        </div>
        {searchError && <ErrorBox message={searchError} />}
        <div
          className="command-list"
          onKeyDown={(e) => {
            if (["ArrowDown", "ArrowUp"].includes(e.key)) {
              e.preventDefault();
              const buttons = Array.from(
                e.currentTarget.querySelectorAll("button"),
              );
              const i = buttons.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              buttons[
                (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
                  buttons.length
              ]?.focus();
            }
          }}
        >
          {query.trim().length > 1 ? (
            results.length ? (
              results.map((r) => (
                <button
                  key={r.type + ":" + r.id + ":" + r.detail}
                  onClick={() => {
                    setCommand(false);
                    if (r.type === "application" || r.type === "note") {
                      setCandidate(r.id);
                    } else if (r.type === "department") {
                      navigate("jobs", "department=" + r.id);
                    } else {
                      navigate("jobs", "job=" + r.id);
                    }
                  }}
                >
                  <span>
                    {r.label}
                    <small>{r.detail}</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))
            ) : (
              <p style={{ padding: 12, fontSize: 12 }}>No matching records.</p>
            )
          ) : (
            <>
              {allowedNavigation.map((n) => (
                <button
                  key={n.key}
                  onClick={() => {
                    navigate(n.key);
                    setCommand(false);
                  }}
                >
                  <span>
                    <n.icon size={14} style={{ marginRight: 10 }} />
                    {n.label}
                  </span>
                  <ArrowRight size={14} />
                </button>
              ))}
              {canManage && (
                <>
                  <button
                    onClick={() => {
                      void openForm("job");
                      setCommand(false);
                    }}
                  >
                    Create position <Plus size={15} />
                  </button>
                  <button
                    onClick={() => {
                      void openForm("interview");
                      setCommand(false);
                    }}
                  >
                    Schedule interview <CalendarDays size={15} />
                  </button>
                  <button
                    onClick={() => {
                      void openForm("task");
                      setCommand(false);
                    }}
                  >
                    Add task <CheckSquare size={15} />
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </Modal>
      {toast && <Toast message={toast} />}
    </div>
  );
}
function Onboarding({
  onDone,
  error,
}: {
  onDone: (id: string) => void;
  error: string;
}) {
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState("");
  return (
    <main className="portal-container">
      <Logo />
      <div
        className="panel panel-pad"
        style={{ maxWidth: 550, margin: "60px auto" }}
      >
        <span className="eyebrow">A workspace of your own</span>
        <h1>Let’s build your team.</h1>
        <p style={{ margin: "15px 0 25px" }}>
          Create an organization to start hiring. Applying for a role? Your
          candidate portal is already ready.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            const f = new FormData(e.currentTarget);
            try {
              const created = await api(
                "/api/workspace/organizations",
                undefined,
                {
                  name: f.get("name"),
                  slug: f.get("slug"),
                  description: f.get("description"),
                },
              );
              onDone(created.id);
            } catch (e) {
              setFailure((e as Error).message);
            } finally {
              setPending(false);
            }
          }}
        >
          <Field label="Organization name">
            <input
              name="name"
              required
              minLength={2}
              placeholder="e.g. Northstar Studio"
            />
          </Field>
          <Field
            label="Careers page address"
            hint="Lowercase letters, numbers, and hyphens. 3–60 characters."
          >
            <input
              name="slug"
              required
              pattern="[a-z0-9-]{3,60}"
              placeholder="northstar-studio"
            />
          </Field>
          <Field label="About your organization">
            <textarea name="description" maxLength={4000} />
          </Field>
          {(failure || error) && <ErrorBox message={failure || error} />}
          <Button disabled={pending} className="full-width">
            {pending ? "Creating…" : "Create workspace"}
            <ArrowRight size={14} />
          </Button>
        </form>
        <div className="auth-footer">
          <Link href="/portal">Go to candidate portal</Link> ·{" "}
          <Link href="/join">Accept an invitation</Link>
        </div>
      </div>
    </main>
  );
}
function Workbench(p: ScreenProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    Promise.all([
      api("/api/workspace/jobs", p.org.id),
      api("/api/workspace/applications?status=active", p.org.id),
      api("/api/workspace/interviews", p.org.id),
      api("/api/workspace/tasks", p.org.id),
      api("/api/workspace/pulse", p.org.id),
    ])
      .then(([jobs, applications, interviews, tasks, pulse]) => {
        if (active) {
          setData({
            jobs,
            applications: applications.items,
            total: applications.total,
            interviews,
            tasks,
            pulse,
          });
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const today = new Date().toDateString();
  const scheduled = data.interviews
    .filter(
      (i: any) =>
        i.status === "scheduled" && new Date(i.starts_at) > new Date(),
    )
    .sort(
      (a: any, b: any) =>
        new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime(),
    );
  const waiting = data.applications
    .filter((a: any) => days(a.stage_entered_at) >= 5)
    .sort(
      (a: any, b: any) =>
        new Date(a.stage_entered_at).getTime() -
        new Date(b.stage_entered_at).getTime(),
    );
  const pendingJobs = data.jobs.filter((j: any) => j.status === "pending");
  const missing = data.interviews.filter(
    (i: any) =>
      i.status !== "cancelled" &&
      new Date(i.starts_at) < new Date() &&
      !i.feedback_count,
  );
  const tasks = data.tasks.filter((t: any) => t.status === "open");
  const activeJobs = data.jobs.filter((j: any) => j.status === "published");
  const hires = data.jobs.reduce((n: number, j: any) => n + j.hired_count, 0);
  return (
    <>
      <div className="workbench-heading">
        <div className="welcome-line">
          <span className="eyebrow">Your day, with a little perspective</span>
          <h1>
            Good{" "}
            {new Date().getHours() < 12
              ? "morning"
              : new Date().getHours() < 17
                ? "afternoon"
                : "evening"}
            , {p.reference.user.name.split(" ")[0]}
            <span style={{ color: "var(--green)" }}>.</span>
          </h1>
          <p>
            Here’s where things stand. Let’s make the next move a thoughtful
            one.
          </p>
        </div>
        {["admin", "recruiter"].includes(p.org.role) && (
          <Button variant="secondary" onClick={() => p.openForm("job")}>
            <Plus size={14} />
            Create position
          </Button>
        )}
      </div>
      <div
        className="workbench-meta"
        style={{ marginTop: -15, marginBottom: 30 }}
      >
        <CalendarDays size={13} />
        {new Date().toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}
        <span>·</span>
        <span>
          {activeJobs.length} active{" "}
          {activeJobs.length === 1 ? "position" : "positions"}
        </span>
      </div>
      <div className="home-layout">
        <div>
          <section className="attention-panel">
            <div className="attention-heading">
              <h2>
                <Leaf size={18} />
                Needs a little attention
              </h2>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                YOUR PRIORITIES
              </span>
            </div>
            {waiting.length > 0 && (
              <div className="priority-row">
                <span className="priority-number">{waiting.length}</span>
                <div>
                  <strong>Candidates are waiting for their next step</strong>
                  <p>
                    At least 5 days in their current stage · {waiting[0]?.title}
                  </p>
                </div>
                <button
                  aria-label="Review waiting candidates"
                  onClick={() =>
                    p.navigate("candidates", "status=active&stalled=true")
                  }
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            )}
            {missing.length > 0 && (
              <div className="priority-row">
                <span className="priority-number">{missing.length}</span>
                <div>
                  <strong>Interview scorecards need a follow-up</strong>
                  <p>
                    Keep the conversation moving while the details are fresh.
                  </p>
                </div>
                <button
                  aria-label="Review pending feedback"
                  onClick={() => p.navigate("interviews")}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            )}
            {pendingJobs.length > 0 && (
              <div className="priority-row">
                <span className="priority-number">{pendingJobs.length}</span>
                <div>
                  <strong>Positions are waiting for approval</strong>
                  <p>A hiring manager’s review is the next step.</p>
                </div>
                <button
                  aria-label="Review requisitions"
                  onClick={() => p.navigate("jobs", "status=pending")}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            )}
            {tasks.length > 0 && (
              <div className="priority-row">
                <span className="priority-number">{tasks.length}</span>
                <div>
                  <strong>Open tasks on your hiring list</strong>
                  <p>
                    {
                      tasks.filter((t: any) => new Date(t.due_at) < new Date())
                        .length
                    }{" "}
                    overdue · Every small step makes a difference.
                  </p>
                </div>
                <button
                  aria-label="View open tasks"
                  onClick={() => p.navigate("tasks")}
                >
                  <ArrowUpRight size={18} />
                </button>
              </div>
            )}
            {!waiting.length &&
              !missing.length &&
              !pendingJobs.length &&
              !tasks.length && (
                <div className="priority-row">
                  <span className="priority-number">
                    <Check size={22} />
                  </span>
                  <div>
                    <strong>A little breathing room.</strong>
                    <p>No pending actions in your current workspace.</p>
                  </div>
                </div>
              )}
            <small style={{ fontSize: 9 }}>
              Candidate priorities cover your 50 most recently updated active
              applications.
            </small>
          </section>
          <section style={{ marginBottom: 29 }}>
            <SectionTitle
              title="The roles taking shape"
              meta={`${activeJobs.length} open`}
              action={
                <Button variant="ghost" onClick={() => p.navigate("jobs")}>
                  All positions <ArrowRight size={13} />
                </Button>
              }
            />
            <div className="panel panel-pad">
              {activeJobs.length ? (
                activeJobs.slice(0, 5).map((j: any) => (
                  <button
                    className="job-row"
                    key={j.id}
                    onClick={() => p.navigate("jobs", "job=" + j.id)}
                  >
                    <div>
                      <strong>{j.title}</strong>
                      <small>
                        {j.department || "General"}{" "}
                        <span style={{ margin: "0 5px" }}>·</span> {j.location}{" "}
                        <span style={{ margin: "0 5px" }}>·</span> {j.workplace}
                      </small>
                    </div>
                    <div className="job-count">
                      {j.application_count}
                      <small>candidates</small>
                    </div>
                    <div className="job-count">
                      {j.hired_count}/{j.openings}
                      <small>hired</small>
                    </div>
                    <ArrowUpRight size={14} className="muted" />
                  </button>
                ))
              ) : (
                <Empty
                  title="Make space for your next hire"
                  body="Create a position, request approval, then publish it to your careers page."
                  action={
                    ["admin", "recruiter"].includes(p.org.role) && (
                      <Button onClick={() => p.openForm("job")}>
                        Create position
                      </Button>
                    )
                  }
                />
              )}
            </div>
          </section>
          <section>
            <SectionTitle
              title="People worth a closer look"
              meta="Awaiting a decision"
              action={
                <Button
                  variant="ghost"
                  onClick={() => p.navigate("candidates")}
                >
                  All candidates <ArrowRight size={13} />
                </Button>
              }
            />
            {data.applications.length ? (
              <div className="panel panel-pad">
                {data.applications.slice(0, 4).map((a: any) => (
                  <button
                    className="candidate-row"
                    key={a.id}
                    onClick={() => p.openCandidate(a.id)}
                  >
                    <Avatar name={a.name} />
                    <div>
                      <strong>{a.name}</strong>
                      <small>{a.title}</small>
                    </div>
                    <Badge
                      tone={a.stage === "Final Review" ? "terra" : "neutral"}
                    >
                      {a.stage}
                    </Badge>
                    <span className="waiting">
                      {days(a.stage_entered_at)}d waiting
                    </span>
                    <ChevronRight size={13} />
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                title="Your next teammate is out there"
                body="Applications will appear here when candidates apply to a published role."
              />
            )}
          </section>
        </div>
        <aside className="home-agenda">
          <div>
            <div className="home-summary">
              <div>
                <strong>{data.total}</strong>
                <span>active candidates</span>
              </div>
              <div>
                <strong>{hires}</strong>
                <span>hires to date</span>
              </div>
            </div>
            <SectionTitle
              title="On the horizon"
              action={
                <Button
                  variant="ghost"
                  aria-label="View interviews"
                  onClick={() => p.navigate("interviews")}
                >
                  <ArrowUpRight size={15} />
                </Button>
              }
            />
            <div className="agenda-date">
              <span>
                {scheduled.some(
                  (i: any) => new Date(i.starts_at).toDateString() === today,
                )
                  ? "TODAY"
                  : "UPCOMING INTERVIEWS"}
              </span>
              <CalendarDays size={13} />
            </div>
            {scheduled.length ? (
              scheduled.slice(0, 4).map((i: any) => (
                <div className="agenda-item" key={i.id}>
                  <div className="agenda-time">
                    {time(i.starts_at)}
                    <br />
                    <small style={{ fontSize: 9 }}>{date(i.starts_at)}</small>
                  </div>
                  <div className="agenda-detail">
                    <button
                      className="text-button"
                      onClick={() => p.openCandidate(i.application_id)}
                    >
                      {i.candidate}
                    </button>
                    <p>{i.title}</p>
                    <small style={{ fontSize: 9 }}>{i.job_title}</small>
                    <br />
                    <Badge>
                      {i.duration} min · {i.type}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p style={{ fontSize: 12, padding: "20px 0" }}>
                No interviews on the calendar yet.
              </p>
            )}
            {["admin", "recruiter"].includes(p.org.role) && (
              <Button
                variant="secondary"
                className="full-width"
                onClick={() => p.openForm("interview")}
              >
                <Plus size={13} />
                Schedule interview
              </Button>
            )}
          </div>
          <div>
            <div className="side-note">
              <span className="eyebrow">Hiring pulse</span>
              <h3>Momentum matters.</h3>
              {data.pulse?.length > 0 && (
                <div>
                  {data.pulse.map((signal: any) => (
                    <div
                      key={signal.kind + signal.job_id}
                      style={{
                        padding: "12px 0",
                        borderBottom: "1px solid var(--line)",
                      }}
                    >
                      <button
                        className="text-button"
                        style={{ fontSize: 11 }}
                        onClick={() =>
                          signal.kind === "stalled"
                            ? p.navigate(
                                "candidates",
                                "job=" +
                                  signal.job_id +
                                  "&status=active&stalled=true",
                              )
                            : signal.application_id
                              ? p.openCandidate(signal.application_id)
                              : p.navigate("jobs", "job=" + signal.job_id)
                        }
                      >
                        {signal.title}
                        <ArrowUpRight size={11} style={{ marginLeft: 5 }} />
                      </button>
                      <p>
                        {signal.kind === "stalled"
                          ? `${signal.count} candidates waiting over 5 days.`
                          : signal.kind === "quiet"
                            ? "No applications received in the past 7 days."
                            : signal.kind === "deadline"
                              ? `Applications close ${date(signal.since)}.`
                              : signal.kind === "feedback"
                                ? `${signal.count} interview scorecards outstanding.`
                                : `${signal.count} offers awaiting approval.`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              <p>
                {waiting.length
                  ? `${waiting.length} candidates in your recent active applications have waited at least 5 days. A clear next step makes all the difference.`
                  : "Your current applications are moving. Check back as new candidates join your pipeline."}
              </p>
              {waiting.length > 0 && (
                <Button
                  variant="ghost"
                  style={{ paddingLeft: 0, marginTop: 10 }}
                  onClick={() => p.openCandidate(waiting[0].id)}
                >
                  Review the oldest wait <ArrowRight size={12} />
                </Button>
              )}
            </div>
            <div className="side-note">
              <span className="eyebrow">Your public careers page</span>
              <p>Give your next teammate a place to find you.</p>
              <Link
                className="button ghost"
                style={{ paddingLeft: 0, marginTop: 8 }}
                href={"/careers/" + p.org.slug}
                target="_blank"
              >
                Open careers page <ArrowUpRight size={13} />
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
function OperationsScreen(p: ScreenProps & { view: string }) {
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [compose, setCompose] = useState(false);
  const [apps, setApps] = useState<any[]>([]);
  const [sending, setSending] = useState(false);
  const [composeBody, setComposeBody] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/workspace/" + (p.view === "audit" ? "audit" : p.view), p.org.id)
      .then((d) => {
        if (active) {
          setItems(d);
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload, p.view]);
  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;
  return (
    <>
      <PageTitle
        eyebrow={
          p.view === "audit" ? "The complete record" : "Keep things connected"
        }
        title={
          p.view === "tasks"
            ? "Small steps. Real progress."
            : p.view === "messages"
              ? "A good conversation."
              : "Every move, accounted for."
        }
        description={
          p.view === "tasks"
            ? "The work that moves your next hire forward."
            : p.view === "messages"
              ? "Candidate conversations, saved drafts, and honest delivery states."
              : "Your organization’s hiring audit trail."
        }
        action={
          p.view === "tasks" && ["admin", "recruiter"].includes(p.org.role) ? (
            <Button onClick={() => p.openForm("task")}>
              <Plus size={14} />
              Add task
            </Button>
          ) : p.view === "messages" ? (
            <Button
              onClick={async () => {
                try {
                  setApps(
                    (await api("/api/workspace/applications", p.org.id)).items,
                  );
                  setCompose(true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Plus size={14} />
              Write message
            </Button>
          ) : undefined
        }
      />
      {p.view === "messages" && (
        <MessageLibrary
          {...p}
          onChoose={async (body) => {
            setComposeBody(body);
            setApps((await api("/api/workspace/applications", p.org.id)).items);
            setCompose(true);
          }}
        />
      )}
      {items.length ? (
        <div className="panel panel-pad">
          {items.map((item) => (
            <div className="list-row" key={item.id}>
              {p.view === "tasks" && (
                <button
                  aria-label={
                    item.status === "done" ? "Reopen task" : "Complete task"
                  }
                  className={`task-check ${item.status === "done" ? "done" : ""}`}
                  onClick={() =>
                    p.mutate(
                      "tasks/" + item.id,
                      { status: item.status === "done" ? "open" : "done" },
                      "Task updated.",
                    )
                  }
                >
                  {item.status === "done" && <Check size={13} />}
                </button>
              )}
              <div style={{ flex: 1 }}>
                <h3>
                  {p.view === "audit"
                    ? item.action
                    : p.view === "tasks"
                      ? item.title
                      : item.candidate + " · " + item.job_title}
                </h3>
                <p>
                  {p.view === "audit"
                    ? item.actor + " · " + item.entity_type
                    : p.view === "tasks"
                      ? `${item.assignee}${item.candidate ? " · " + item.candidate : ""}`
                      : item.body}
                </p>
                {p.view === "audit" && Object.keys(item.detail).length > 0 && (
                  <small className="pre-wrap">
                    {JSON.stringify(item.detail)}
                  </small>
                )}
              </div>
              {p.view === "messages" ? (
                <Badge
                  tone={
                    item.state === "portal"
                      ? "green"
                      : item.state === "draft"
                        ? "neutral"
                        : "amber"
                  }
                >
                  {item.state === "portal"
                    ? "Available in portal"
                    : item.state === "draft"
                      ? "Draft"
                      : "Email unsent"}
                </Badge>
              ) : (
                <small>
                  {date(p.view === "tasks" ? item.due_at : item.created_at)}
                  {p.view === "tasks" &&
                    item.status === "open" &&
                    new Date(item.due_at) < new Date() && (
                      <Badge tone="terra">Overdue</Badge>
                    )}
                </small>
              )}
              {p.view === "messages" &&
                item.state === "draft" &&
                item.author_id === p.reference.user.id && (
                  <DraftEditor {...p} message={item} />
                )}
              {item.application_id && (
                <button
                  className="icon-button"
                  aria-label="Open candidate"
                  onClick={() => p.openCandidate(item.application_id)}
                >
                  <ArrowUpRight size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title={
            p.view === "tasks"
              ? "A clear list."
              : p.view === "messages"
                ? "Start a thoughtful conversation."
                : "Your story starts here."
          }
          body={
            p.view === "tasks"
              ? "Add a task to assign the next step."
              : p.view === "messages"
                ? "Messages sent to the portal are visible to candidates immediately."
                : "Important actions will appear in this audit trail."
          }
        />
      )}
      <Modal
        title="Write to a candidate"
        description="Portal messages are available immediately. Email delivery is not configured."
        open={compose}
        onClose={() => setCompose(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setSending(true);
            const f = new FormData(e.currentTarget);
            if (
              await p.mutate(
                "messages",
                {
                  application_id: f.get("application_id"),
                  body: f.get("body"),
                  state: f.get("state"),
                },
                "Message saved.",
              )
            )
              setCompose(false);
            setSending(false);
          }}
        >
          <Field label="Candidate">
            <select name="application_id" required>
              {apps.map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name} — {a.title}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Message">
            <textarea
              name="body"
              required
              minLength={2}
              rows={5}
              value={composeBody}
              onChange={(e) => setComposeBody(e.target.value)}
            />
          </Field>
          <Field label="Delivery">
            <select name="state">
              <option value="portal">Send to candidate portal</option>
              <option value="draft">Save draft</option>
              <option value="pending_email">Queue email (unsent)</option>
            </select>
          </Field>
          <Button disabled={sending}>Save message</Button>
        </form>
      </Modal>
    </>
  );
}
