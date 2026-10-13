"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Badge, Modal, ErrorBox } from "./ui";
import type { ScreenProps } from "./workspace";
export function PrivacyReview(p: ScreenProps) {
  const [requests, setRequests] = useState<any[]>([]),
    [selected, setSelected] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/workspace/privacy", p.org.id)
      .then(setRequests)
      .catch((e) => setError(e.message));
  }, [p.org.id, p.reload]);
  return (
    <section className="panel">
      <h2>Privacy requests</h2>
      {error && <ErrorBox message={error} />}
      <p style={{ fontSize: 12, marginBottom: 15 }}>
        Review candidate correction and erasure requests. Retention decisions
        remain with your organization.
      </p>
      {requests.length ? (
        requests.map((r) => (
          <div className="list-row" key={r.id}>
            <div>
              <h3>
                {r.name} · {r.kind}
              </h3>
              <p>{r.body}</p>
            </div>
            {r.status === "open" ? (
              <Button variant="secondary" onClick={() => setSelected(r)}>
                Review
              </Button>
            ) : (
              <Badge tone="green">Resolved</Badge>
            )}
          </div>
        ))
      ) : (
        <small>No requests awaiting review.</small>
      )}
      <Modal
        title="Review privacy request"
        description={selected?.name}
        open={!!selected}
        onClose={() => setSelected(null)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              await api("/api/workspace/privacy/" + selected.id, p.org.id, {
                erase: !!f.get("erase"),
                resolution: f.get("resolution"),
              });
              setSelected(null);
              setRequests(await api("/api/workspace/privacy", p.org.id));
              setError("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <p style={{ fontSize: 12, marginBottom: 20 }}>{selected?.body}</p>
          <Field label="Resolution and retention rationale">
            <textarea
              name="resolution"
              minLength={10}
              maxLength={2000}
              required
            />
          </Field>
          {selected?.kind === "erasure" && (
            <label className="checkbox-field">
              <input type="checkbox" name="erase" />
              <span>
                Redact this organization’s candidate profile, application
                answers, private notes, messages, and scorecard text, and delete
                the uploaded documents. This cannot be undone. Completed hires
                require a separate retention review.
              </span>
            </label>
          )}
          {error && <ErrorBox message={error} />}
          <Button disabled={busy}>Record resolution</Button>
        </form>
      </Modal>
    </section>
  );
}
