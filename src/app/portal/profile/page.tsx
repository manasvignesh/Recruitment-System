"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { Logo, Field, Button, Loading, ErrorBox, Toast } from "@/components/ui";
export default function Profile() {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(""),
    [toast, setToast] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/api/self/profile")
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function save(path: string, body: unknown) {
    setBusy(true);
    try {
      await api(path, undefined, body);
      setToast("Your changes have been saved.");
      setError("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="portal-container">
      <nav className="section-heading">
        <Logo />
        <Link href="/portal" className="button secondary">
          My applications
        </Link>
      </nav>
      <h1 style={{ margin: "35px 0 20px" }}>
        Your information, in your hands.
      </h1>
      {error && <ErrorBox message={error} />}
      <a href="/api/self/export" download className="button secondary">
        Download my application data
      </a>
      {!data ? (
        <Loading />
      ) : (
        <>
          <div className="settings-grid" style={{ marginTop: 25 }}>
            {data.profiles.map((p: any) => (
              <section className="panel" key={p.id}>
                <h2>Profile at {p.organization}</h2>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    void save("/api/self/profile", {
                      candidate_id: p.id,
                      name: f.get("name"),
                      phone: f.get("phone"),
                      experience: f.get("experience"),
                      skills: String(f.get("skills"))
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                      availability: f.get("availability"),
                      talent_consent: !!f.get("consent"),
                    });
                  }}
                >
                  <Field label="Full name">
                    <input
                      name="name"
                      defaultValue={p.name}
                      minLength={2}
                      required
                    />
                  </Field>
                  <Field label="Phone">
                    <input name="phone" defaultValue={p.phone} />
                  </Field>
                  <Field label="Experience">
                    <textarea name="experience" defaultValue={p.experience} />
                  </Field>
                  <Field label="Skills, separated by commas">
                    <input name="skills" defaultValue={p.skills.join(", ")} />
                  </Field>
                  <Field
                    label="Interview availability"
                    hint="The team will review this information. It does not reserve a calendar slot."
                  >
                    <textarea
                      name="availability"
                      defaultValue={p.availability}
                      placeholder="Share times, timezone, and any scheduling constraints."
                    />
                  </Field>
                  <label className="checkbox-field">
                    <input
                      name="consent"
                      type="checkbox"
                      defaultChecked={p.talent_consent}
                    />
                    <span>Retain my profile for future opportunities.</span>
                  </label>
                  <Button disabled={busy}>Save profile</Button>
                </form>
              </section>
            ))}
          </div>
          <section
            className="panel panel-pad"
            style={{ marginTop: 25, maxWidth: 650 }}
          >
            <h2>Secure password change</h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                setBusy(true);
                try {
                  const result = await authClient.changePassword({
                    currentPassword: String(f.get("current")),
                    newPassword: String(f.get("new")),
                    revokeOtherSessions: true,
                  });
                  if (result.error) throw new Error(result.error.message);
                  setToast(
                    "Password changed. Other sessions have been revoked.",
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <Field label="Current password">
                <input
                  name="current"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </Field>
              <Field label="New password">
                <input
                  name="new"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </Field>
              <Button disabled={busy}>Change password</Button>
            </form>
          </section>
          {data.profiles.length > 0 && (
            <section
              className="panel panel-pad"
              style={{ marginTop: 25, maxWidth: 650 }}
            >
              <h2>Privacy requests</h2>
              <p style={{ margin: "12px 0 20px", fontSize: 12 }}>
                Request erasure or correction. An organization administrator
                will review retention obligations and respond; submitting a
                request does not immediately erase your records.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save("/api/self/privacy", {
                    candidate_id: f.get("candidate_id"),
                    kind: f.get("kind"),
                    body: f.get("body"),
                  });
                }}
              >
                <Field label="Organization">
                  <select name="candidate_id">
                    {data.profiles.map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.organization}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Request">
                  <select name="kind">
                    <option value="erasure">Erase my recruitment data</option>
                    <option value="correction">
                      Correct my recruitment data
                    </option>
                  </select>
                </Field>
                <Field label="Details">
                  <textarea
                    name="body"
                    minLength={10}
                    maxLength={4000}
                    required
                  />
                </Field>
                <Button disabled={busy} variant="secondary">
                  Submit for review
                </Button>
              </form>
            </section>
          )}
        </>
      )}
      {toast && <Toast message={toast} />}
    </main>
  );
}
