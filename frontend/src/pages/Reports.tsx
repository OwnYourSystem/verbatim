import { useEffect, useState } from "react";
import { api } from "../api";
import type { Report } from "../types";
import { Card } from "../components/ui";

type Kind = "weekly" | "monthly" | "on-demand";

export function Reports() {
  const [kind, setKind] = useState<Kind>("weekly");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notifStatus, setNotifStatus] = useState<string | null>(null);

  useEffect(() => {
    setReport(null);
    api
      .report(kind)
      .then(setReport)
      .catch((e) => setError(String(e)));
  }, [kind]);

  const enableNotifications = async () => {
    if (!("Notification" in window)) {
      setNotifStatus("This browser does not support notifications.");
      return;
    }
    const perm = await Notification.requestPermission();
    setNotifStatus(
      perm === "granted" ? "Notifications enabled." : `Permission: ${perm}.`,
    );
  };

  const showBriefing = async () => {
    try {
      const briefing = await api.report("morning-briefing");
      const body = briefing.summary;
      if ("serviceWorker" in navigator && Notification.permission === "granted") {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(briefing.title, { body });
      } else if (Notification.permission === "granted") {
        new Notification(briefing.title, { body });
      } else {
        setNotifStatus("Enable notifications first.");
      }
    } catch (e) {
      setError(String(e));
    }
  };

  const tabs: Kind[] = ["weekly", "monthly", "on-demand"];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Reports</h1>
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <div className="flex gap-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setKind(t)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium ${
              kind === t ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-300"
            }`}
          >
            {t.replace("-", " ")}
          </button>
        ))}
      </div>

      {report ? (
        <Card title={report.title}>
          <p className="text-sm text-slate-300">{report.summary}</p>
          <p className="text-xs text-slate-500 mt-1">Generated {report.generated_at}</p>
          <div className="mt-4 space-y-4">
            {report.sections.map((s, i) => (
              <div key={i}>
                <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-1">
                  {s.heading}
                </h3>
                <ul className="space-y-1 text-sm list-disc pl-5">
                  {s.items.map((item, j) => (
                    <li key={j}>{item}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <p className="text-slate-400 text-sm">Loading…</p>
      )}

      <Card title="Morning briefing & notifications">
        <p className="text-sm text-slate-400 mb-3">
          Enable browser notifications, then preview today's briefing. (Scheduled
          server push is a deploy-time feature — see docs/NOTIFICATIONS.md.)
        </p>
        <div className="flex gap-2">
          <button
            onClick={enableNotifications}
            className="px-3 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-sm font-medium"
          >
            Enable notifications
          </button>
          <button
            onClick={showBriefing}
            className="px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
          >
            Show briefing now
          </button>
        </div>
        {notifStatus && <p className="text-sm text-slate-400 mt-2">{notifStatus}</p>}
      </Card>
    </div>
  );
}
