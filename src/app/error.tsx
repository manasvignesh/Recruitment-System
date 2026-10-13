"use client";
export default function ErrorPage({ retry }: { retry: () => void }) {
  return (
    <main className="portal-container">
      <h1>Let’s try that again.</h1>
      <p style={{ margin: "20px 0" }}>
        Something interrupted this page. Your saved work is still in your
        workspace.
      </p>
      <button className="button primary" onClick={retry}>
        Try again
      </button>
    </main>
  );
}
