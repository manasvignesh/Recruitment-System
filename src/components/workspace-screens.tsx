"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  KeyboardSensor,
  useSensors,
  useSensor,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  ArrowUpRight,
  Search,
  LayoutGrid,
  List,
  MapPin,
  Users,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Download,
} from "lucide-react";
import { api, date, days, time, money } from "@/lib/api";
import {
  Button,
  PageTitle,
  SectionTitle,
  Badge,
  Empty,
  Loading,
  ErrorBox,
  Avatar,
  Modal,
  Field,
} from "./ui";
import type { ScreenProps } from "./workspace";
import { PrivacyReview } from "./privacy-review";
import { BulkActions } from "./bulk-actions";
import { PoolCreator } from "./talent-pool-tools";
function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-box">
      <Search size={14} />
      <input
        className="search-input"
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
const jobTone = (s: string) =>
  s === "published"
    ? "green"
    : s === "pending"
      ? "amber"
      : s === "approved"
        ? "blue"
        : "neutral";
export function JobsScreen(p: ScreenProps) {
  const [jobs, setJobs] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("");
  const [selected, setSelected] = useState<any>(null);
  const [list, setList] = useState(false);
  useEffect(() => {
    let active = true;
    api("/api/workspace/jobs", p.org.id)
      .then((d) => {
        if (active) {
          setJobs(d);
          const params = new URLSearchParams(window.location.search);
          if (params.get("status")) setStatus(params.get("status")!);
          setDepartment(params.get("department") || "");
          const id = params.get("job");
          setSelected(
            (old: any) => d.find((j: any) => j.id === (old?.id || id)) || null,
          );
          setError("");
        }
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!jobs) return <Loading />;
  const filtered = jobs.filter(
    (j) =>
      (!department || j.department_id === department) &&
      (status === "all" || j.status === status) &&
      `${j.title} ${j.department || ""} ${j.location}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  const manage = ["admin", "recruiter"].includes(p.org.role);
  async function transition(j: any, next: string) {
    await p.mutate(
      `jobs/${j.id}/status`,
      { status: next, version: j.version },
      `Position ${next}.`,
    );
  }
  return (
    <>
      <PageTitle
        eyebrow="Building the next chapter"
        title="Room for someone great."
        description="Every position is the start of a new possibility."
        action={
          manage && (
            <Button onClick={() => p.openForm("job")}>
              <Plus size={14} />
              Create position
            </Button>
          )
        }
      />
      <div className="tabs">
        {[
          ["all", "All positions"],
          ["published", "Open"],
          ["draft", "Drafts"],
          ["pending", "Awaiting approval"],
          ["closed", "Closed"],
          ["archived", "Archived"],
        ].map(([key, label]) => (
          <button
            className={status === key ? "active" : ""}
            key={key}
            onClick={() => {
              setStatus(key);
              const url = new URL(window.location.href);
              url.searchParams.set("status", key);
              history.replaceState(null, "", url);
            }}
          >
            {label}{" "}
            <span
              style={{ color: "var(--muted)", fontSize: 10, marginLeft: 5 }}
            >
              {key === "all"
                ? jobs.length
                : jobs.filter((j) => j.status === key).length}
            </span>
          </button>
        ))}
      </div>
      <div className="toolbar">
        <div className="toolbar-left">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search positions…"
          />
          <select
            className="control"
            aria-label="Filter positions by department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            <option value="">All departments</option>
            {p.reference.departments.map((d: any) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-right">
          <Link
            className="button ghost"
            href={"/careers/" + p.org.slug}
            target="_blank"
          >
            Careers page <ArrowUpRight size={13} />
          </Link>
          <div className="segmented">
            <button
              className={!list ? "active" : ""}
              onClick={() => setList(false)}
              aria-label="Card view"
            >
              <LayoutGrid size={14} />
            </button>
            <button
              className={list ? "active" : ""}
              onClick={() => setList(true)}
              aria-label="Table view"
            >
              <List size={14} />
            </button>
          </div>
        </div>
      </div>
      {filtered.length ? (
        list ? (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Status</th>
                  <th>Location</th>
                  <th>Candidates</th>
                  <th>Openings filled</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((j) => (
                  <tr key={j.id}>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => setSelected(j)}
                      >
                        {j.title}
                      </button>
                      <br />
                      <small>{j.department || "General"}</small>
                    </td>
                    <td>
                      <Badge tone={jobTone(j.status)}>{j.status}</Badge>
                    </td>
                    <td>
                      {j.location} · {j.workplace}
                    </td>
                    <td>{j.application_count}</td>
                    <td>
                      {j.hired_count}/{j.openings}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="jobs-grid">
            {filtered.map((j) => (
              <article className="panel job-card" key={j.id}>
                <div className="job-card-top">
                  <span className="job-dept">{j.department || "General"}</span>
                  <Badge tone={jobTone(j.status)}>
                    {j.status === "published"
                      ? "Open"
                      : j.status === "pending"
                        ? "Awaiting approval"
                        : j.status}
                  </Badge>
                </div>
                <button
                  className="text-button"
                  style={{ color: "var(--text)" }}
                  onClick={() => setSelected(j)}
                >
                  <h3>{j.title}</h3>
                </button>
                <p>
                  <MapPin
                    size={12}
                    style={{ verticalAlign: "middle", marginRight: 5 }}
                  />
                  {j.location} · {j.workplace}
                </p>
                <div className="job-card-bottom">
                  <span>
                    <Users
                      size={12}
                      style={{ verticalAlign: "middle", marginRight: 5 }}
                    />
                    {j.application_count} candidates
                  </span>
                  <span>
                    {j.hired_count} of {j.openings} hired
                  </span>
                  <button
                    className="icon-button"
                    onClick={() => setSelected(j)}
                    aria-label={"Open " + j.title}
                  >
                    <ArrowUpRight size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : (
        <Empty
          title="Nothing here just yet."
          body="Try another filter or create a position to begin."
          action={
            manage && (
              <Button onClick={() => p.openForm("job")}>Create position</Button>
            )
          }
        />
      )}
      <Modal
        title={selected?.title || "Position"}
        description={
          selected
            ? `${selected.department || "General"} · ${selected.location} · ${selected.workplace}`
            : undefined
        }
        wide
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            {p.mutationError && <ErrorBox message={p.mutationError} />}
            <Badge tone={jobTone(selected.status)}>{selected.status}</Badge>
            <div className="detail-section" style={{ marginTop: 22 }}>
              <h3>About the role</h3>
              <p>{selected.description}</p>
            </div>
            <div className="detail-section">
              <h3>Requirements</h3>
              <p>
                {selected.requirements ||
                  "No additional requirements supplied."}
              </p>
            </div>
            <div className="skill-list">
              {selected.skills.map((s: string) => (
                <span className="skill" key={s}>
                  {s}
                </span>
              ))}
            </div>
            <p style={{ fontSize: 12, marginTop: 20 }}>
              {selected.employment} · {selected.openings} openings
              {selected.salary_min !== null
                ? ` · ${money(selected.salary_min, selected.currency)}–${selected.salary_max ? money(selected.salary_max, selected.currency) : "unspecified"}`
                : ""}
            </p>
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setSelected(null);
                  p.navigate("candidates", "job=" + selected.id);
                }}
              >
                Review candidates
              </Button>
              {manage && ["draft", "approved"].includes(selected.status) && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setSelected(null);
                    p.openForm("job", { job: selected });
                  }}
                >
                  Edit position
                </Button>
              )}
              {manage && selected.status === "draft" && (
                <Button onClick={() => transition(selected, "pending")}>
                  Request approval
                </Button>
              )}
              {selected.status === "pending" &&
                ["admin", "manager"].includes(p.org.role) && (
                  <Button onClick={() => transition(selected, "approved")}>
                    Approve requisition
                  </Button>
                )}
              {manage && selected.status === "pending" && (
                <Button
                  variant="secondary"
                  onClick={() => transition(selected, "draft")}
                >
                  Return to draft
                </Button>
              )}
              {manage && selected.status === "approved" && (
                <Button onClick={() => transition(selected, "published")}>
                  Publish position
                </Button>
              )}
              {manage && selected.status === "published" && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => transition(selected, "approved")}
                  >
                    Unpublish
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => transition(selected, "closed")}
                  >
                    Close position
                  </Button>
                </>
              )}
              {manage && selected.status === "closed" && (
                <>
                  <Button onClick={() => transition(selected, "approved")}>
                    Reopen for publication
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => transition(selected, "archived")}
                  >
                    Archive
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
export function CandidatesScreen(p: ScreenProps) {
  const [data, setData] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [job, setJob] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");
  const [stalled, setStalled] = useState(false);
  const [page, setPage] = useState(1);
  const [board, setBoard] = useState(false);
  const [sort, setSort] = useState("recent");
  const [selected, setSelected] = useState<string[]>([]);
  const [comparison, setComparison] = useState<any[] | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor),
  );
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setQ(params.get("q") || "");
    setJob(params.get("job") || "");
    setStage(params.get("stage") || "");
    setStatus(params.get("status") || "");
    setStalled(params.get("stalled") === "true");
    api("/api/workspace/jobs", p.org.id)
      .then(setJobs)
      .catch((e) => setError(e.message));
  }, [p.org.id]);
  useEffect(() => {
    let active = true;
    const t = setTimeout(() => {
      const params = new URLSearchParams({
        q,
        job,
        stage,
        status,
        stalled: String(stalled),
        page: String(page),
      });
      api("/api/workspace/applications?" + params, p.org.id)
        .then((d) => {
          if (active) {
            setData(d);
            setError("");
            const url = new URL(window.location.href);
            for (const [key, value] of params) {
              if (value) url.searchParams.set(key, value);
              else url.searchParams.delete(key);
            }
            history.replaceState(null, "", url);
          }
        })
        .catch((e) => active && setError(e.message));
    }, 180);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, job, stage, status, stalled, page, p.org.id, p.reload]);
  const manage = ["admin", "recruiter"].includes(p.org.role);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  const items = [...data.items];
  if (sort === "name") items.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "waiting")
    items.sort(
      (a, b) =>
        new Date(a.stage_entered_at).getTime() -
        new Date(b.stage_entered_at).getTime(),
    );
  async function drop(e: DragEndEvent) {
    if (!e.over) return;
    const a = items.find((a) => a.id === e.active.id);
    const next = String(e.over.id);
    if (a && a.stage !== next)
      await p.mutate(
        `applications/${a.id}/stage`,
        { stage: next, version: a.version },
        "Candidate moved to " + next + ".",
      );
  }
  return (
    <>
      <PageTitle
        eyebrow="People, not just applications"
        title="Your next great connection."
        description={`${data.total} ${data.total === 1 ? "application" : "applications"} in view. Every one has a story.`}
        action={
          <div className="segmented">
            <button
              className={!board ? "active" : ""}
              onClick={() => setBoard(false)}
            >
              <List size={14} />
              Table
            </button>
            <button
              className={board ? "active" : ""}
              onClick={() => setBoard(true)}
            >
              <LayoutGrid size={14} />
              Pipeline
            </button>
          </div>
        }
      />
      <div className="toolbar">
        <div className="toolbar-left">
          <SearchBox
            value={q}
            onChange={(s) => {
              setQ(s);
              setPage(1);
            }}
            placeholder="Search candidates…"
          />
          <select
            className="control"
            aria-label="Filter by position"
            value={job}
            onChange={(e) => {
              setJob(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All positions</option>
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title}
              </option>
            ))}
          </select>
          <select
            className="control"
            aria-label="Filter by stage"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All stages</option>
            {p.reference.stages.map((s: any) => (
              <option key={s.name}>{s.name}</option>
            ))}
          </select>
          <select
            className="control"
            aria-label="Filter by status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All statuses</option>
            {["active", "hold", "hired", "rejected", "withdrawn"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="toolbar">
        <small>
          {board
            ? "Drag a card to an adjacent stage, or use the stage selector in a candidate’s profile."
            : "Showing up to 50 applications per page."}
        </small>
        <div className="toolbar-right">
          {selected.length > 0 && manage && (
            <BulkActions
              {...p}
              selected={selected}
              items={items}
              onDone={() => setSelected([])}
            />
          )}
          {selected.length > 1 && selected.length <= 3 && (
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  const records = await Promise.all(
                    selected.map((id) =>
                      api("/api/workspace/applications/" + id, p.org.id),
                    ),
                  );
                  if (
                    new Set(records.map((r) => r.application.job_id)).size > 1
                  ) {
                    setError(
                      "Compare candidates applying for the same position.",
                    );
                    return;
                  }
                  setComparison(records);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Compare {selected.length}
            </Button>
          )}
          <select
            className="control"
            aria-label="Sort current page"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
          >
            <option value="recent">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="waiting">Longest wait</option>
          </select>
          <label
            className="checkbox-field"
            style={{ margin: 0, whiteSpace: "nowrap" }}
          >
            <input
              type="checkbox"
              checked={stalled}
              onChange={(e) => {
                setStalled(e.target.checked);
                setPage(1);
              }}
            />
            Waiting 5+ days
          </label>
        </div>
      </div>
      {items.length ? (
        board ? (
          <DndContext sensors={sensors} onDragEnd={drop}>
            <div className="board">
              {p.reference.stages.map((s: any) => (
                <PipelineColumn
                  key={s.name}
                  name={s.name}
                  items={items.filter((a) => a.stage === s.name)}
                  open={p.openCandidate}
                  manage={manage}
                />
              ))}
            </div>
          </DndContext>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Candidate</th>
                  <th>Position</th>
                  <th>Stage</th>
                  <th>Waiting</th>
                  <th>Owner</th>
                  <th>Source</th>
                  <th>Select</th>
                </tr>
              </thead>
              <tbody>
                {items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <button
                        className="person-cell"
                        onClick={() => p.openCandidate(a.id)}
                      >
                        <Avatar name={a.name} />
                        <div>
                          <strong>{a.name}</strong>
                          <small>{a.email}</small>
                        </div>
                      </button>
                    </td>
                    <td>
                      {a.title}
                      <br />
                      <small>{a.department || "General"}</small>
                    </td>
                    <td>
                      <Badge
                        tone={
                          a.status === "hired"
                            ? "green"
                            : a.status === "rejected"
                              ? "terra"
                              : a.stage === "Offer"
                                ? "green"
                                : "neutral"
                        }
                      >
                        {a.status === "active" ? a.stage : a.status}
                      </Badge>
                    </td>
                    <td>
                      <span
                        style={{
                          color:
                            days(a.stage_entered_at) >= 5
                              ? "var(--terra)"
                              : undefined,
                        }}
                      >
                        {days(a.stage_entered_at)} days
                      </span>
                    </td>
                    <td>{a.owner || "Unassigned"}</td>
                    <td>{a.source}</td>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={"Select " + a.name}
                        checked={selected.includes(a.id)}
                        disabled={
                          !selected.includes(a.id) && selected.length >= 50
                        }
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, a.id]
                              : s.filter((id) => id !== a.id),
                          )
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <Empty
          title="No matches in this view."
          body="Try changing your search or filters. New applications arrive through your careers page."
        />
      )}
      <div className="pagination">
        <span>
          {data.total
            ? `${(page - 1) * 50 + 1}–${Math.min(page * 50, data.total)} of ${data.total} applications`
            : "0 applications"}
        </span>
        <div>
          <Button
            variant="ghost"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            <ChevronLeft size={14} />
            Previous
          </Button>
          <Button
            variant="ghost"
            disabled={page * 50 >= data.total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
      <Modal
        title="Compare the evidence"
        description="Job-relevant information. Your team owns the decision."
        wide
        open={!!comparison}
        onClose={() => setComparison(null)}
      >
        <div className="compare-grid">
          {comparison?.map((c) => (
            <div className="panel" key={c.application.id}>
              <Avatar name={c.application.name} />
              <h3 style={{ marginTop: 12 }}>{c.application.name}</h3>
              <p>
                {c.application.experience ||
                  "No experience information supplied."}
              </p>
              <div className="skill-list">
                {c.application.skills.map((s: string) => (
                  <span className="skill" key={s}>
                    {s}
                  </span>
                ))}
              </div>
              <p>
                {c.scorecards.filter((s: any) => s.submitted).length} completed
                scorecards
              </p>
              {c.scorecards
                .filter((s: any) => s.submitted)
                .map((s: any) => (
                  <div className="note" key={s.id}>
                    <strong>{s.recommendation}</strong>
                    <p>{s.body}</p>
                    <small>{s.author}</small>
                  </div>
                ))}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
function PipelineColumn({
  name,
  items,
  open,
  manage,
}: {
  name: string;
  items: any[];
  open: (id: string) => void;
  manage: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: name });
  return (
    <section
      ref={setNodeRef}
      className={`board-column ${isOver ? "over" : ""}`}
    >
      <div className="board-heading">
        {name}
        <span>{items.length}</span>
      </div>
      {items.map((a) => (
        <PipelineCard key={a.id} a={a} open={open} manage={manage} />
      ))}
      {!items.length && (
        <small
          style={{
            display: "block",
            textAlign: "center",
            padding: "20px 0",
            fontSize: 10,
          }}
        >
          No candidates
        </small>
      )}
    </section>
  );
}
function PipelineCard({
  a,
  open,
  manage,
}: {
  a: any;
  open: (id: string) => void;
  manage: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: a.id, disabled: !manage || a.status !== "active" });
  return (
    <article
      ref={setNodeRef}
      style={
        transform
          ? {
              transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
              zIndex: 2,
              position: "relative",
            }
          : undefined
      }
      className={`pipeline-card ${isDragging ? "dragging" : ""}`}
    >
      <div className="pipeline-card-top">
        <button className="person-cell" onClick={() => open(a.id)}>
          <Avatar name={a.name} />
          <strong>{a.name}</strong>
        </button>
        {manage && a.status === "active" && (
          <button
            className="drag-handle"
            {...attributes}
            {...listeners}
            aria-label={"Move " + a.name}
          >
            <GripVertical size={14} />
          </button>
        )}
      </div>
      <p>{a.title}</p>
      <div className="skill-list" style={{ marginTop: 10 }}>
        {a.skills.slice(0, 2).map((s: string) => (
          <span className="skill" key={s}>
            {s}
          </span>
        ))}
      </div>
      <div className="pipeline-card-bottom">
        <span>{days(a.stage_entered_at)}d in stage</span>
        <span>{a.status === "active" ? a.source : a.status}</span>
      </div>
    </article>
  );
}
export function InterviewsScreen(p: ScreenProps) {
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [month, setMonth] = useState(() => new Date());
  const [status, setStatus] = useState("all");
  useEffect(() => {
    let active = true;
    api("/api/workspace/interviews", p.org.id)
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;
  const manage = ["admin", "recruiter"].includes(p.org.role);
  const filtered = items.filter((i) => status === "all" || i.status === status);
  const count = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const offset = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  return (
    <>
      <PageTitle
        eyebrow="Make a little time to connect"
        title="Better conversations ahead."
        description="A considered interview starts before the first question."
        action={
          manage && (
            <Button onClick={() => p.openForm("interview")}>
              <Plus size={14} />
              Schedule interview
            </Button>
          )
        }
      />
      <div className="toolbar">
        <div className="tabs" style={{ marginBottom: 0, border: 0 }}>
          {["all", "scheduled", "completed", "cancelled"].map((s) => (
            <button
              className={status === s ? "active" : ""}
              key={s}
              onClick={() => setStatus(s)}
              style={{ textTransform: "capitalize" }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="segmented">
          <button
            className={!calendar ? "active" : ""}
            onClick={() => setCalendar(false)}
          >
            <List size={14} />
            List
          </button>
          <button
            className={calendar ? "active" : ""}
            onClick={() => setCalendar(true)}
          >
            <CalendarDays size={14} />
            Calendar
          </button>
        </div>
      </div>
      {calendar ? (
        <>
          <div className="section-heading">
            <h2>
              {month.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div>
              <Button
                variant="ghost"
                aria-label="Previous month"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() - 1, 1),
                  )
                }
              >
                <ChevronLeft size={17} />
              </Button>
              <Button
                variant="ghost"
                aria-label="Next month"
                onClick={() =>
                  setMonth(
                    new Date(month.getFullYear(), month.getMonth() + 1, 1),
                  )
                }
              >
                <ChevronRight size={17} />
              </Button>
            </div>
          </div>
          <div className="month-grid">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((s) => (
              <div
                style={{
                  padding: 10,
                  borderRight: "1px solid var(--line)",
                  fontSize: 10,
                }}
                key={s}
              >
                {s}
              </div>
            ))}
            {Array.from({ length: offset + count }, (_, index) => {
              const day = index - offset + 1;
              return (
                <div className="month-day" key={index}>
                  <header>{day > 0 ? day : ""}</header>
                  {day > 0 &&
                    filtered
                      .filter((i) => {
                        const d = new Date(i.starts_at);
                        return (
                          d.getDate() === day &&
                          d.getMonth() === month.getMonth() &&
                          d.getFullYear() === month.getFullYear()
                        );
                      })
                      .map((i) => (
                        <button
                          key={i.id}
                          className="calendar-event"
                          onClick={() => p.openCandidate(i.application_id)}
                        >
                          {time(i.starts_at)} · {i.candidate}
                        </button>
                      ))}
                </div>
              );
            })}
          </div>
        </>
      ) : filtered.length ? (
        <div className="panel panel-pad">
          {filtered.map((i) => (
            <div className="list-row" key={i.id}>
              <div style={{ width: 60, textAlign: "center", flexShrink: 0 }}>
                <strong style={{ fontSize: 21, fontWeight: 450 }}>
                  {new Date(i.starts_at).getDate()}
                </strong>
                <br />
                <small>
                  {new Date(i.starts_at).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </small>
              </div>
              <div style={{ flex: 1 }}>
                <button
                  className="text-button"
                  onClick={() => p.openCandidate(i.application_id)}
                >
                  {i.candidate} · {i.title}
                </button>
                <p>
                  {i.job_title} · {i.interviewer}
                </p>
                <small>
                  {time(i.starts_at, i.timezone)} · {i.timezone} · {i.duration}{" "}
                  min · {i.type}
                </small>
              </div>
              <Badge
                tone={
                  i.status === "completed"
                    ? "green"
                    : i.status === "cancelled"
                      ? "terra"
                      : "neutral"
                }
              >
                {i.status}
              </Badge>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {i.interviewer_id === p.reference.user.id &&
                  !i.feedback_count &&
                  i.status !== "cancelled" && (
                    <Button
                      variant="secondary"
                      onClick={() => p.openForm("feedback", { interview: i })}
                    >
                      Scorecard
                    </Button>
                  )}
                {manage && i.status === "scheduled" && (
                  <Button
                    variant="ghost"
                    onClick={() => p.openForm("interview", { interview: i })}
                  >
                    Reschedule
                  </Button>
                )}
                <a
                  className="icon-button"
                  href={`/api/workspace/interviews/${i.id}/ics?org=${p.org.id}`}
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const r = await fetch(
                        `/api/workspace/interviews/${i.id}/ics`,
                        { headers: { "x-organization-id": p.org.id } },
                      );
                      if (!r.ok)
                        throw new Error(
                          "Unable to download the calendar invitation.",
                        );
                      const url = URL.createObjectURL(await r.blob());
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "interview.ics";
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                  aria-label="Download calendar invitation"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="A little space on the calendar."
          body="Schedule a conversation with a candidate to begin."
        />
      )}
    </>
  );
}
export function AnalyticsScreen(p: ScreenProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [department, setDepartment] = useState("");
  const [job, setJob] = useState("");
  const [recruiter, setRecruiter] = useState("");
  const [jobs, setJobs] = useState<any[]>([]);
  useEffect(() => {
    api("/api/workspace/jobs", p.org.id)
      .then(setJobs)
      .catch((e) => setError(e.message));
  }, [p.org.id]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (job) params.set("job", job);
    if (department) params.set("department", department);
    if (recruiter) params.set("recruiter", recruiter);
    api("/api/workspace/analytics?" + params, p.org.id)
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
  }, [from, to, department, job, recruiter, p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle
        eyebrow="A clearer view of your hiring"
        title="Progress, with perspective."
        description="Real activity from your workspace. No guesswork, no hidden scores."
      />
      <div className="toolbar">
        <div className="toolbar-left">
          <Field label="Submitted from">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="Assigned recruiter">
            <select
              value={recruiter}
              onChange={(e) => setRecruiter(e.target.value)}
            >
              <option value="">All recruiters</option>
              {p.reference.members
                .filter((m: any) => ["admin", "recruiter"].includes(m.role))
                .map((m: any) => (
                  <option value={m.id} key={m.id}>
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Submitted through">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Field label="Department">
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
            >
              <option value="">All departments</option>
              {p.reference.departments.map((d: any) => (
                <option value={d.id} key={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Position">
            <select value={job} onChange={(e) => setJob(e.target.value)}>
              <option value="">All positions</option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>
      <div className="metric-strip">
        <div>
          <span>Applications</span>
          <strong>{data.metrics.applications}</strong>
          <small>submitted in this window</small>
        </div>
        <div>
          <span>Hires completed</span>
          <strong>{data.metrics.hires}</strong>
          <small>from this application cohort</small>
        </div>
        <div>
          <span>Time to hire</span>
          <strong>
            {data.metrics.time_to_hire ?? "—"}
            <small>{data.metrics.time_to_hire !== null ? " days" : ""}</small>
          </strong>
          <small>mean submission → hire</small>
        </div>
        <div>
          <span>Offer acceptance</span>
          <strong>
            {data.offers.resolved
              ? Math.round(
                  (data.offers.accepted / data.offers.resolved) * 100,
                ) + "%"
              : "—"}
          </strong>
          <small>
            {data.offers.accepted} accepted / {data.offers.resolved} resolved
          </small>
        </div>
      </div>
      <div className="analytics-layout">
        <section className="panel panel-pad">
          <SectionTitle title="Where candidates stand" meta="Current stage" />
          {data.funnel.length ? (
            data.funnel.map((s: any) => (
              <div className="bar-row" key={s.stage}>
                <span>{s.stage}</span>
                <div className="bar-track">
                  <div
                    style={{
                      width:
                        (s.count /
                          Math.max(...data.funnel.map((s: any) => s.count))) *
                          100 +
                        "%",
                    }}
                  />
                </div>
                <strong>{s.count}</strong>
                <small>{s.days}d avg</small>
              </div>
            ))
          ) : (
            <Empty
              title="A fresh start"
              body="Application data will appear when candidates apply."
            />
          )}
          <small>
            Bars show current stage counts, not historical conversion.
          </small>
        </section>
        <section className="panel panel-pad">
          <SectionTitle
            title="The ways people find you"
            meta="Candidate source"
          />
          {data.sources.map((s: any) => (
            <div className="list-row" key={s.source}>
              <h3>{s.source}</h3>
              <strong style={{ fontWeight: 500 }}>{s.count}</strong>
            </div>
          ))}
          <div className="list-row">
            <h3>Interview completion</h3>
            <span>
              {data.interviews.completed} / {data.interviews.total}
            </span>
          </div>
          <div className="list-row">
            <h3>Withdrawn applications</h3>
            <span>{data.metrics.withdrawals}</span>
          </div>
          <div className="list-row">
            <h3>Active published positions</h3>
            <span>{data.jobs.active}</span>
          </div>
          <div className="list-row">
            <h3>Time to fill</h3>
            <span>{data.timeToFill?.days ?? "—"} days</span>
          </div>
          <div className="list-row">
            <h3>Feedback turnaround</h3>
            <span>{data.turnaround?.hours ?? "—"} hours</span>
          </div>
          <div className="list-row">
            <h3>Current overdue tasks</h3>
            <span>{data.overdue ?? 0}</span>
          </div>
          <div className="list-row">
            <h3>Withdrawal rate</h3>
            <span>
              {data.metrics.applications
                ? Math.round(
                    (data.metrics.withdrawals / data.metrics.applications) *
                      100,
                  ) + "%"
                : "—"}
            </span>
          </div>
        </section>
        <section className="panel panel-pad">
          <SectionTitle title="Applications over time" meta="Weekly" />
          {data.trends.length ? (
            data.trends.map((t: any) => (
              <div className="bar-row" key={t.week}>
                <span>{date(t.week)}</span>
                <div className="bar-track">
                  <div
                    style={{
                      width:
                        Math.max(
                          2,
                          (t.count /
                            Math.max(...data.trends.map((t: any) => t.count))) *
                            100,
                        ) + "%",
                    }}
                  />
                </div>
                <strong>{t.count}</strong>
              </div>
            ))
          ) : (
            <p style={{ fontSize: 12 }}>No applications in this period.</p>
          )}
        </section>
        <section className="panel panel-pad">
          <SectionTitle title="What these numbers mean" />
          {Object.entries(data.definitions).map(([k, v]) => (
            <p
              key={k}
              style={{ fontSize: 11, lineHeight: 1.8, marginBottom: 12 }}
            >
              {String(v)}
            </p>
          ))}
        </section>
        <section className="panel panel-pad">
          <SectionTitle title="Stage progression" meta="Ever reached" />
          {data.conversion?.map((s: any) => (
            <div className="list-row" key={s.stage}>
              <h3>{s.stage}</h3>
              <span>
                {s.reached} / {data.metrics.applications} applications
              </span>
            </div>
          ))}
        </section>
        <section className="panel panel-pad">
          <SectionTitle
            title="Time between stages"
            meta="Completed intervals"
          />
          {data.stageDurations?.map((s: any) => (
            <div className="list-row" key={s.stage}>
              <h3>{s.stage}</h3>
              <span>{s.days} days mean</span>
            </div>
          ))}
          {!data.stageDurations?.length && (
            <p style={{ fontSize: 12 }}>
              No completed stage intervals in this cohort.
            </p>
          )}
        </section>
      </div>
    </>
  );
}
export function TalentScreen(p: ScreenProps) {
  const [items, setItems] = useState<any[] | null>(null);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [pools, setPools] = useState<any[]>([]),
    [poolId, setPoolId] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/workspace/talent", p.org.id)
      .then((d) => active && setItems(d))
      .catch((e) => active && setError(e.message));
    api("/api/workspace/pools", p.org.id)
      .then((d) => active && setPools(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!items) return <Loading />;
  const filtered = items.filter(
    (c) =>
      (!poolId || c.pool_ids?.includes(poolId)) &&
      `${c.name} ${c.email} ${c.skills.join(" ")} ${c.tags.join(" ")}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );
  return (
    <>
      <PageTitle
        eyebrow="Keep the door open"
        title="Good people. Future possibilities."
        description="Candidates who have consented to stay connected with your team."
        action={<PoolCreator {...p} />}
      />
      <div className="toolbar">
        <SearchBox
          value={q}
          onChange={setQ}
          placeholder="Search people, skills, or tags…"
        />
        <small>{filtered.length} people · Consent required</small>
        <select
          className="control"
          aria-label="Filter talent pool"
          value={poolId}
          onChange={(e) => setPoolId(e.target.value)}
        >
          <option value="">All retained candidates</option>
          {pools.map((pool) => (
            <option key={pool.id} value={pool.id}>
              {pool.name} · {pool.people}
            </option>
          ))}
        </select>
      </div>
      {filtered.length ? (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Skills</th>
                <th>Tags</th>
                <th>Applications</th>
                <th>Last applied</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="person-cell">
                      <Avatar name={c.name} />
                      <div>
                        <strong>{c.name}</strong>
                        <small>{c.email}</small>
                        {c.possible_duplicates > 0 && (
                          <>
                            <br />
                            <button
                              className="text-button"
                              style={{ fontSize: 10 }}
                              onClick={() =>
                                p.navigate(
                                  "candidates",
                                  "q=" + encodeURIComponent(c.name),
                                )
                              }
                            >
                              Review {c.possible_duplicates} possible name match
                              {c.possible_duplicates === 1 ? "" : "es"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="skill-list">
                      {c.skills.slice(0, 4).map((s: string) => (
                        <span className="skill" key={s}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{c.tags.join(", ") || "—"}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() =>
                        p.navigate(
                          "candidates",
                          "q=" + encodeURIComponent(c.name),
                        )
                      }
                    >
                      {c.applications} applications
                    </button>
                  </td>
                  <td>{date(c.last_applied)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <Empty
          title="Connections worth keeping."
          body="Candidates who opt into future opportunities appear here. Add tags from a candidate profile."
        />
      )}
    </>
  );
}
export function SettingsScreen(p: ScreenProps) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    api("/api/workspace/settings", p.org.id)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle
        eyebrow="Your workspace, thoughtfully set up"
        title="A place for your team."
        description="The people, preferences, and practices behind your hiring."
      />
      <div className="settings-grid">
        <section className="panel">
          <h2>Company profile</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              await p.mutate(
                "settings",
                {
                  name: f.get("name"),
                  description: f.get("description"),
                  retention_days: Number(f.get("retention_days")),
                },
                "Organization settings saved.",
              );
              setBusy(false);
            }}
          >
            <Field label="Organization name">
              <input
                name="name"
                defaultValue={data.organization.name}
                required
                minLength={2}
              />
            </Field>
            <Field label="About your company">
              <textarea
                name="description"
                defaultValue={data.organization.description}
                rows={4}
              />
            </Field>
            <Field
              label="Retention review interval (days)"
              hint="A review policy setting. Automatic deletion is not enabled."
            >
              <input
                name="retention_days"
                type="number"
                defaultValue={data.organization.retention_days}
                min={30}
                max={3650}
                required
              />
            </Field>
            <Button disabled={busy}>Save profile</Button>
          </form>
        </section>
        <section className="panel">
          <h2>Invite a teammate</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                const result = await api(
                  "/api/workspace/settings/invite",
                  p.org.id,
                  { email: f.get("email"), role: f.get("role") },
                );
                setInvite(result.url);
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Email address">
              <input name="email" type="email" required />
            </Field>
            <Field label="Role">
              <select name="role">
                <option value="recruiter">Recruiter — hiring operations</option>
                <option value="manager">
                  Hiring manager — assigned jobs and approvals
                </option>
                <option value="interviewer">
                  Interviewer — assigned interviews and feedback
                </option>
                <option value="admin">
                  Administrator — organization control
                </option>
              </select>
            </Field>
            <Button disabled={busy}>Create invitation link</Button>
          </form>
          {invite && (
            <div className="note">
              <p>
                Share this private invitation link with your teammate. No email
                has been sent.
              </p>
              <input
                aria-label="Invitation link"
                readOnly
                value={invite}
                className="search-input"
                onFocus={(e) => e.currentTarget.select()}
              />
              <Button
                variant="ghost"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(invite);
                  } catch {
                    setError("Copy the invitation link manually.");
                  }
                }}
              >
                Copy link
              </Button>
            </div>
          )}
        </section>
        <section className="panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Your people</h2>
          {data.members.map((m: any) => (
            <div className="list-row" key={m.id}>
              <div className="person-cell">
                <Avatar name={m.name} />
                <div>
                  <strong>{m.name}</strong>
                  <small>{m.email}</small>
                </div>
              </div>
              <select
                className="control"
                aria-label={"Role for " + m.name}
                value={m.role}
                disabled={m.user_id === p.reference.user.id}
                onChange={(e) =>
                  p.mutate(
                    "settings/role",
                    { userId: m.user_id, role: e.target.value },
                    "Member role updated.",
                  )
                }
              >
                {["admin", "recruiter", "manager", "interviewer"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Departments</h2>
          {p.reference.departments.map((d: any) => (
            <div className="list-row" key={d.id}>
              <h3>{d.name}</h3>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              if (
                await p.mutate(
                  "settings/department",
                  { name: f.get("name") },
                  "Department added.",
                )
              )
                p.navigate("settings");
            }}
            style={{ marginTop: 20 }}
          >
            <Field label="New department">
              <input name="name" required minLength={2} />
            </Field>
            <Button variant="secondary">Add department</Button>
          </form>
        </section>
        <section className="panel">
          <h2>Hiring pipeline</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await p.mutate(
                "settings/pipeline",
                {
                  stages: String(f.get("stages"))
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                "Pipeline saved. Refresh to load the latest stages.",
              );
            }}
          >
            <Field
              label="Stages, in order"
              hint="One per line. Applied first, Hired last; retain Offer. Stages with active or on-hold applications cannot be removed."
            >
              <textarea
                name="stages"
                rows={8}
                defaultValue={p.reference.stages
                  .map((s: any) => s.name)
                  .join("\n")}
              />
            </Field>
            <Button variant="secondary">Save pipeline</Button>
          </form>
        </section>
        <section className="panel">
          <h2>Evaluation templates</h2>
          {p.reference.templates?.map((t: any) => (
            <div className="note" key={t.id}>
              <h3>{t.name}</h3>
              <p>{t.criteria.join(" · ")}</p>
            </div>
          ))}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              await p.mutate(
                "templates",
                {
                  name: f.get("name"),
                  criteria: String(f.get("criteria"))
                    .split("\n")
                    .map((s) => s.trim())
                    .filter(Boolean),
                },
                "Evaluation template saved.",
              );
            }}
          >
            <Field label="Template name">
              <input name="name" minLength={3} required />
            </Field>
            <Field
              label="Job-relevant competencies"
              hint="One per line. Between 2 and 10 criteria."
            >
              <textarea name="criteria" rows={4} required />
            </Field>
            <Button variant="secondary">Save evaluation template</Button>
          </form>
        </section>
        <section className="panel" style={{ gridColumn: "1 / -1" }}>
          <h2>Integrations & privacy</h2>
          {[
            ["Neon PostgreSQL", "Connected · Server-side persistence", "green"],
            [
              "Candidate portal",
              "Connected · Messages and offers available in the portal",
              "green",
            ],
            [
              "Email delivery",
              "Not configured · Email remains unsent",
              "amber",
            ],
            [
              "External calendars",
              "Not configured · Download calendar invitations instead",
              "neutral",
            ],
            [
              "Private document storage",
              "PostgreSQL adapter · 2 MB per PDF or DOCX",
              "neutral",
            ],
            [
              "AI processing",
              "Not configured · No candidate data is sent to an AI provider",
              "neutral",
            ],
          ].map(([name, detail, tone]) => (
            <div className="integration-row" key={name}>
              <div>
                <h3>{name}</h3>
                <p>{detail}</p>
              </div>
              <Badge tone={tone}>
                {tone === "green"
                  ? "Connected"
                  : tone === "amber"
                    ? "Unconfigured"
                    : "Local workflow"}
              </Badge>
            </div>
          ))}
          <small>
            Resume text extraction is available. Malware scanning and electronic
            signatures are not integrated.
          </small>
        </section>
        <PrivacyReview {...p} />
      </div>
    </>
  );
}
