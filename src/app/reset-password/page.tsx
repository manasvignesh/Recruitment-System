"use client";
import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Logo, Field, Button, ErrorBox } from "@/components/ui";
export default function ResetPassword() {
  const [done, setDone] = useState(false),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <main className="portal-container">
      <Logo />
      <div
        className="panel panel-pad"
        style={{ maxWidth: 450, margin: "70px auto" }}
      >
        <h1>{done ? "A fresh start." : "Set a new password."}</h1>
        {done ? (
          <>
            <p style={{ margin: "20px 0" }}>
              Your password has been updated. Sign in with your new password.
            </p>
            <Link href="/login" className="button primary">
              Sign in
            </Link>
          </>
        ) : (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const f = new FormData(e.currentTarget);
              const token = new URLSearchParams(window.location.search).get(
                "token",
              );
              if (!token) {
                setError("This reset link is incomplete. Request a new one.");
                setPending(false);
                return;
              }
              const r = await authClient.resetPassword({
                newPassword: String(f.get("password")),
                token,
              });
              if (r.error)
                setError(
                  r.error.message || "The reset link is invalid or expired.",
                );
              else setDone(true);
              setPending(false);
            }}
          >
            <Field label="New password" hint="At least 12 characters.">
              <input
                type="password"
                name="password"
                autoComplete="new-password"
                required
                minLength={12}
              />
            </Field>
            {error && <ErrorBox message={error} />}
            <Button disabled={pending}>Update password</Button>
          </form>
        )}
      </div>
    </main>
  );
}
