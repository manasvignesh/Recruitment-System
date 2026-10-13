"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { brand } from "@/lib/brand";
import { Button, Field, Logo, ErrorBox } from "./ui";
export function AuthPage({ signup = false }: { signup?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const d = {
        email: String(f.get("email")),
        password: String(f.get("password")),
      };
      const response = signup
        ? await authClient.signUp.email({ ...d, name: String(f.get("name")) })
        : await authClient.signIn.email(d);
      if (response.error)
        throw new Error(response.error.message || "Sign in failed.");
      const redirect = new URLSearchParams(window.location.search).get("next");
      router.push(
        redirect?.startsWith("/") && !redirect.startsWith("//")
          ? redirect
          : "/workspace",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link href="/">
          <Logo />
        </Link>
        <div>
          <span className="eyebrow">The Hiring Workspace</span>
          <h1>
            Great teams
            <br />
            don’t happen
            <br />
            <em>by chance.</em>
          </h1>
          <p>
            A little clarity. A lot of care.
            <br />A workspace for every step of your next hire.
          </p>
        </div>
        <small>Thoughtful hiring starts here.</small>
      </aside>
      <main className="auth-content">
        <form onSubmit={submit} className="auth-form">
          <span className="eyebrow">Welcome to {brand.name}</span>
          <h1>{signup ? "A fresh start." : "Welcome back."}</h1>
          <p>
            {signup
              ? "Create an account to hire thoughtfully or follow your applications."
              : "Sign in to pick up where you left off."}
          </p>
          {signup && (
            <Field label="Full name">
              <input
                name="name"
                autoComplete="name"
                required
                minLength={2}
                maxLength={150}
              />
            </Field>
          )}
          <Field label="Email address">
            <input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field
            label="Password"
            hint={signup ? "At least 12 characters." : " "}
          >
            <input
              name="password"
              type="password"
              autoComplete={signup ? "new-password" : "current-password"}
              required
              minLength={signup ? 12 : 1}
            />
          </Field>
          {error && <ErrorBox message={error} />}
          <Button disabled={pending} type="submit">
            {pending ? "Please wait…" : signup ? "Create account" : "Sign in"}
            <ArrowRight size={15} />
          </Button>
          <div className="auth-footer">
            {signup ? "Already have an account?" : `New to ${brand.name}?`}{" "}
            <Link href={signup ? "/login" : "/signup"}>
              {signup ? "Sign in" : "Create account"}
            </Link>
          </div>
          {!signup && (
            <div className="auth-footer">
              <Link href="/forgot-password">Password recovery</Link>
            </div>
          )}
          <div className="auth-footer">
            <Link href="/">Back to {brand.name}</Link>
          </div>
        </form>
      </main>
    </div>
  );
}
