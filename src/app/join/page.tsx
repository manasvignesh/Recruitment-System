"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Logo, ErrorBox } from "@/components/ui";
export default function Join() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(
    () =>
      setToken(new URLSearchParams(window.location.search).get("token") || ""),
    [],
  );
  const next = encodeURIComponent("/join?token=" + token);
  return (
    <main className="portal-container">
      <Logo />
      <div
        className="panel panel-pad"
        style={{ maxWidth: 550, margin: "65px auto" }}
      >
        <h1>You’re invited.</h1>
        <p style={{ margin: "20px 0" }}>
          Sign in or create an account with the invited email address, then
          accept your workspace invitation.
        </p>
        <div className="hero-actions">
          <Link className="button secondary" href={"/login?next=" + next}>
            Sign in
          </Link>
          <Link className="button secondary" href={"/signup?next=" + next}>
            Create account
          </Link>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              try {
                if (!token)
                  throw new Error("Open the original invitation link.");
                await api("/api/workspace/organizations/join", undefined, {
                  token,
                });
                router.push("/workspace");
              } catch (e) {
                setMessage((e as Error).message);
              } finally {
                setPending(false);
              }
            }}
          >
            Accept invitation
          </Button>
        </div>
        {message && <ErrorBox message={message} />}
      </div>
    </main>
  );
}
