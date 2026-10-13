import Link from "next/link";
export default function NotFound() {
  return (
    <main className="portal-container">
      <h1>This page has moved on.</h1>
      <p style={{ margin: "20px 0" }}>
        Return to your workspace to find the next step.
      </p>
      <Link href="/workspace" className="button primary">
        Open workspace
      </Link>
    </main>
  );
}
