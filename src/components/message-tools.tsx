"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Field, Modal, ErrorBox } from "./ui";
import type { ScreenProps } from "./workspace";
export function MessageLibrary(
  p: ScreenProps & { onChoose: (body: string) => void },
) {
  const [templates, setTemplates] = useState<any[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/workspace/message-templates", p.org.id)
      .then(setTemplates)
      .catch((e) => setError(e.message));
  }, [p.org.id, p.reload]);
  return (
    <details className="panel panel-pad" style={{ marginBottom: 22 }}>
      <summary style={{ cursor: "pointer", fontWeight: 550 }}>
        Message templates · {templates.length}
      </summary>
      <p style={{ fontSize: 12, marginTop: 12 }}>
        Reusable starting points. Review each message before sending.
      </p>
      {templates.map((t) => (
        <div className="list-row" key={t.id}>
          <div style={{ flex: 1 }}>
            <h3>{t.name}</h3>
            <p>{t.body}</p>
          </div>
          <Button variant="secondary" onClick={() => p.onChoose(t.body)}>
            Use template
          </Button>
        </div>
      ))}
      <form
        style={{ maxWidth: 600, marginTop: 22 }}
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const f = new FormData(e.currentTarget);
          try {
            await api("/api/workspace/message-templates", p.org.id, {
              name: f.get("name"),
              body: f.get("body"),
            });
            setTemplates(
              await api("/api/workspace/message-templates", p.org.id),
            );
            setError("");
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Template name">
          <input name="name" required minLength={3} />
        </Field>
        <Field label="Template text">
          <textarea name="body" minLength={10} required rows={3} />
        </Field>
        {error && <ErrorBox message={error} />}
        <Button variant="secondary" disabled={busy}>
          Save template
        </Button>
      </form>
    </details>
  );
}
export function DraftEditor(p: ScreenProps & { message: any }) {
  const [open, setOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Edit draft
      </Button>
      <Modal
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Finish your message"
        description={p.message.candidate}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            try {
              if (
                await p.mutate(
                  "messages/" + p.message.id,
                  { body: f.get("body"), state: f.get("state") },
                  "Message saved.",
                )
              )
                setOpen(false);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <Field label="Message">
            <textarea
              name="body"
              defaultValue={p.message.body}
              minLength={2}
              rows={5}
              required
            />
          </Field>
          <Field label="Delivery">
            <select name="state">
              <option value="draft">Keep as draft</option>
              <option value="portal">Send to candidate portal</option>
              <option value="pending_email">Queue email (unsent)</option>
            </select>
          </Field>
          {(error || p.mutationError) && (
            <ErrorBox message={error || p.mutationError!} />
          )}
          <Button disabled={busy}>Save message</Button>
        </form>
      </Modal>
    </>
  );
}
