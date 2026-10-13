"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button, Modal, Field, ErrorBox } from "./ui";
import type { ScreenProps } from "./workspace";
export function PoolCreator(p: ScreenProps) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Create talent pool
      </Button>
      <Modal
        title="Keep a thoughtful connection"
        description="A named pool for candidates who consent to future opportunities."
        open={open}
        onClose={() => !busy && setOpen(false)}
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const f = new FormData(e.currentTarget);
            if (
              await p.mutate(
                "pools",
                { name: f.get("name"), description: f.get("description") },
                "Talent pool created.",
              )
            )
              setOpen(false);
            setBusy(false);
          }}
        >
          <Field label="Pool name">
            <input name="name" minLength={2} maxLength={100} required />
          </Field>
          <Field label="Description">
            <textarea name="description" maxLength={4000} />
          </Field>
          {p.mutationError && <ErrorBox message={p.mutationError} />}
          <Button disabled={busy}>Create pool</Button>
        </form>
      </Modal>
    </>
  );
}
export function CandidatePools(
  p: ScreenProps & { candidate: any; memberships: any[] },
) {
  const [pools, setPools] = useState<any[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    api("/api/workspace/pools", p.org.id)
      .then(setPools)
      .catch((e) => setError(e.message));
  }, [p.org.id, p.reload]);
  return (
    <>
      <h3>Talent pool membership</h3>
      {error && <ErrorBox message={error} />}
      <small>Consent for future opportunities is recorded.</small>
      {p.memberships.map((m) => (
        <div className="list-row" key={m.id}>
          <small>{m.name}</small>
          <Button
            variant="ghost"
            aria-label={"Remove from " + m.name}
            onClick={() =>
              p.mutate(
                "pools/" + m.id,
                { candidate_id: p.candidate.candidate_id, action: "remove" },
                "Pool membership removed.",
              )
            }
          >
            Remove
          </Button>
        </div>
      ))}
      {pools.length > 0 && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await p.mutate(
              "pools/" + f.get("pool_id"),
              { candidate_id: p.candidate.candidate_id, action: "add" },
              "Candidate added to pool.",
            );
          }}
        >
          <Field label="Pool">
            <select name="pool_id" required>
              <option value="">Choose a pool</option>
              {pools
                .filter((pool) => !p.memberships.some((m) => m.id === pool.id))
                .map((pool) => (
                  <option key={pool.id} value={pool.id}>
                    {pool.name}
                  </option>
                ))}
            </select>
          </Field>
          <Button variant="secondary">Add to pool</Button>
        </form>
      )}
    </>
  );
}
