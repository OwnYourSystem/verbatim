import { useEffect, useState } from "react";
import { api } from "../api";
import type { Report } from "../types";
import { Card, PageHeader } from "../components/ui";

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
    <div className="space-y-6">
      <PageHeader title="Reports" subtitle="How each system is moving — behind, on track, or done." />
      {error && <p className="text-amber-400 text-sm">{error}</p>}

      <div className="flex gap-1.5 p-1 rounded-xl bg-slate-900/70 border border-slate-800 w-fit">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setKind(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all duration-200 ${
              kind === t
                ? "bg-slate-700 text-emerald-300 shadow"
                : "text-slate-400 hover:text-slate-200"
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
          <div className="mt-5 space-y-5">
            {report.sections.map((s, i) => (
              <div key={i}>
                <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 mb-2">
                  {s.heading}
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {s.items.map((item, j) => (
                    <li key={j} className="flex gap-2.5">
                      <span aria-hidden className="text-emerald-400/70 mt-0.5">▸</span>
                      {item}
                    </li>
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
        <p className="text-sm text-slate-400 mb-4">
          Enable browser notifications, then preview today's briefing. (Scheduled
          server push is a deploy-time feature — see docs/NOTIFICATIONS.md.)
        </p>
        <div className="flex gap-2">
          <button onClick={enableNotifications} className="btn-secondary">
            Enable notifications
          </button>
          <button onClick={showBriefing} className="btn-primary">
            Show briefing now
          </button>
        </div>
        {notifStatus && <p className="text-sm text-slate-400 mt-3">{notifStatus}</p>}
      </Card>
    </div>
  );
}
