"use client";
import { useEffect, useState } from "react";
import { api, date } from "@/lib/api";
import { PageTitle, Button, Loading, ErrorBox, Badge, Empty } from "./ui";
import type { ScreenProps } from "./workspace";
export function NotificationsScreen(p: ScreenProps) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/workspace/notifications", p.org.id)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [p.org.id, p.reload]);
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <PageTitle
        eyebrow="The next step belongs to you"
        title="A little nudge forward."
        description="Your tasks, overdue feedback, and approvals in one place."
      />
      <div className="panel panel-pad">
        <h2>In-workspace reminders</h2>
        <div
          style={{ display: "flex", gap: 25, flexWrap: "wrap", marginTop: 16 }}
        >
          {[
            ["show_tasks", "Assigned tasks"],
            ["show_feedback", "Outstanding feedback"],
          ].map(([key, label]) => (
            <label key={key} className="checkbox-field">
              <input
                type="checkbox"
                checked={data.preferences[key]}
                onChange={async (e) => {
                  const preferences = {
                    ...data.preferences,
                    [key]: e.target.checked,
                  };
                  if (
                    await p.mutate(
                      "notifications",
                      preferences,
                      "Reminder preferences saved.",
                    )
                  )
                    setData({ ...data, preferences });
                }}
              />
              {label}
            </label>
          ))}
        </div>
        <small>No external reminder emails are sent.</small>
      </div>
      {data.items.length ? (
        <div className="panel panel-pad" style={{ marginTop: 22 }}>
          {data.items.map((item: any) => (
            <div className="list-row" key={item.type + item.id}>
              <div style={{ flex: 1 }}>
                <h3>{item.title}</h3>
                <p>{date(item.created_at)}</p>
              </div>
              <Badge tone={item.type === "approval" ? "amber" : "neutral"}>
                {item.type}
              </Badge>
              <Button
                variant="ghost"
                onClick={() =>
                  item.application_id
                    ? p.openCandidate(item.application_id)
                    : p.navigate("jobs", "job=" + item.id)
                }
              >
                Review
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <Empty
          title="A little breathing room."
          body="No assigned actions match your reminder preferences."
        />
      )}
    </>
  );
}
