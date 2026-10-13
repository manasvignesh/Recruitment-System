"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { api } from "@/lib/api";
import { Logo, Field, Button, ErrorBox } from "@/components/ui";
export default function ForgotPassword() {
  const [configured, setConfigured] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  useEffect(() => {
    api("/api/public/config")
      .then((d) => setConfigured(d.emailConfigured))
      .catch((e) => setError(e.message));
  }, []);
  return (
    <main className="portal-container">
      <Logo />
      <div
        className="panel panel-pad"
        style={{ maxWidth: 450, margin: "70px auto" }}
      >
        <h1>A fresh password.</h1>
        <p style={{ margin: "20px 0" }}>
          {configured
            ? "We’ll send a secure link if an account exists for your email."
            : "Email delivery is not configured. Password recovery becomes available when your administrator configures a verified email provider."}
        </p>
        {configured && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              const f = new FormData(e.currentTarget);
              const r = await authClient.requestPasswordReset({
                email: String(f.get("email")),
                redirectTo: window.location.origin + "/reset-password",
              });
              if (r.error)
                setError(r.error.message || "Unable to request a reset.");
              else
                setMessage(
                  "If the account exists, a reset email has been requested. Check your inbox.",
                );
              setPending(false);
            }}
          >
            <Field label="Email address">
              <input name="email" type="email" required />
            </Field>
            <Button disabled={pending}>Request password reset</Button>
          </form>
        )}
        {message && (
          <p role="status" style={{ marginTop: 20 }}>
            {message}
          </p>
        )}
        {error && <ErrorBox message={error} />}
        <Link className="button ghost" style={{ marginTop: 20 }} href="/login">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
