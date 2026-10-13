"use client";
import { useState } from "react";
import { Button, Modal, Field, ErrorBox } from "./ui";
import type { ScreenProps } from "./workspace";
export function BulkActions(
  p: ScreenProps & { selected: string[]; items: any[]; onDone: () => void },
) {
  const [open, setOpen] = useState(false),
    [action, setAction] = useState("assign"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Bulk actions · {p.selected.length}
      </Button>
      <Modal
        title="Apply to selected candidates"
        description={`${p.selected.length} selected applications. Changes are checked and saved together.`}
        open={open}
        onClose={() => !busy && setOpen(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            const records = p.items.filter((a) => p.selected.includes(a.id));
            if (records.length !== p.selected.length) {
              setError("Select the current page’s applications again.");
              setBusy(false);
              return;
            }
            const body: any = {
              applications: records.map((a) => ({
                id: a.id,
                version: a.version,
              })),
              action,
            };
            if (action === "assign") body.owner_id = f.get("owner_id");
            else body.body = f.get("body");
            if (
              await p.mutate(
                "applications/bulk",
                body,
                "Selected applications updated.",
              )
            ) {
              setOpen(false);
              p.onDone();
            }
            setBusy(false);
          }}
        >
          <Field label="Action">
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="assign">Assign recruiter</option>
              <option value="draft_message">Prepare drafts (unsent)</option>
              <option value="reject">Reject applications</option>
            </select>
          </Field>
          {action === "assign" ? (
            <Field label="Recruiter">
              <select name="owner_id" required>
                {p.reference.members
                  .filter((m: any) => ["admin", "recruiter"].includes(m.role))
                  .map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
          ) : (
            <Field
              label={
                action === "reject"
                  ? "Internal rejection reason"
                  : "Draft message"
              }
            >
              <textarea name="body" minLength={5} required rows={5} />
            </Field>
          )}
          {action === "reject" && (
            <p style={{ fontSize: 12 }}>
              Candidates see the rejection status. Your reason stays private.
              Scheduled interviews and pending offers are cancelled.
            </p>
          )}
          {(error || p.mutationError) && (
            <ErrorBox message={error || p.mutationError!} />
          )}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              disabled={busy}
              variant={action === "reject" ? "danger" : "primary"}
            >
              Apply to {p.selected.length} applications
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
