import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import type { SKFocusTask, SpecificKnowledge } from "../types";
import { MeCard, MeSectionTitle } from "../components/me/Card";
import { PrimaryButton, GhostButton } from "../components/me/PrimaryButton";
import { ProgressRing } from "../components/me/ProgressRing";
import { ME_ACCENT, ME_INK, ME_INK_SOFT, pastelFor } from "../components/me/tokens";
import { ratingColor, ratingLabel } from "../components/Thermometer";

const DURATIONS = [15, 25, 45, 60];

type Step = "pick-sk" | "pick-task" | "running" | "done";

/** A short, self-contained beep — no external audio asset needed. */
function playChime() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();
    const notes = [880, 1108, 1318]; // a quick little ascending chime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
      osc.start(start);
      osc.stop(start + 0.5);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // Web Audio unsupported/blocked — silently skip, the on-screen state and
    // notification (if permitted) still communicate completion.
  }
}

function formatMMSS(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function FocusTimer() {
  const [step, setStep] = useState<Step>("pick-sk");
  const [sks, setSks] = useState<SpecificKnowledge[]>([]);
  const [selectedSK, setSelectedSK] = useState<SpecificKnowledge | null>(null);
  const [focusTasks, setFocusTasks] = useState<SKFocusTask[] | null>(null);
  const [selectedTask, setSelectedTask] = useState<SKFocusTask | null>(null);
  const [durationMin, setDurationMin] = useState(25);
  const [remainingMs, setRemainingMs] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const startedAtRef = useRef<number>(0);
  const targetMsRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    api.listSKs().then(setSks);
  }, []);

  const pickSK = async (sk: SpecificKnowledge) => {
    setSelectedSK(sk);
    setSelectedTask(null);
    setFocusTasks(null);
    setStep("pick-task");
    const tasks = await api.getSKFocusTasks(sk.id);
    setFocusTasks(tasks);
  };

  const startTimer = () => {
    if (!selectedTask) return;
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
    completedRef.current = false;
    startedAtRef.current = Date.now();
    targetMsRef.current = durationMin * 60 * 1000;
    setRemainingMs(targetMsRef.current);
    setStep("running");
  };

  const finishTimer = async () => {
    if (completedRef.current || !selectedTask || !selectedSK) return;
    completedRef.current = true;
    playChime();
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Focus session complete! ⏱️", {
        body: `${durationMin} min on ${selectedSK.name}`,
      });
    }
    try {
      await api.logTime({
        task_id: selectedTask.kind === "task" ? selectedTask.id : undefined,
        subtask_id: selectedTask.kind === "subtask" ? selectedTask.id : undefined,
        sk_id: selectedSK.id,
        hours: Math.round((durationMin / 60) * 100) / 100,
        note: `Focus timer: ${durationMin} min on ${selectedSK.name}`,
      });
    } catch (e) {
      setError(String(e));
    }
    setStep("done");
  };

  // Countdown loop — computed from absolute timestamps (not a decrementing
  // counter) so it stays accurate even if the tab is briefly backgrounded.
  useEffect(() => {
    if (step !== "running") return;
    const tick = () => {
      const remaining = targetMsRef.current - (Date.now() - startedAtRef.current);
      setRemainingMs(Math.max(0, remaining));
      if (remaining <= 0) {
        finishTimer();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const cancelTimer = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    setStep("pick-task");
  };

  const startOver = () => {
    setStep("pick-sk");
    setSelectedSK(null);
    setSelectedTask(null);
    setFocusTasks(null);
    setError(null);
  };

  return (
    <div className="space-y-5 pt-1">
      <MeCard>
        <MeSectionTitle>Focus Timer</MeSectionTitle>
        <p className="text-sm" style={{ color: ME_INK_SOFT }}>
          Pick a knowledge you're building, work on a task tied to it, and log the time automatically.
        </p>
      </MeCard>

      {error && (
        <MeCard>
          <p className="text-sm" style={{ color: "#B4351A" }}>{error}</p>
        </MeCard>
      )}

      {step === "pick-sk" && (
        <MeCard>
          <MeSectionTitle>What are you building?</MeSectionTitle>
          {sks.length === 0 ? (
            <p className="text-sm" style={{ color: ME_INK_SOFT }}>
              No Specific Knowledge defined yet — add one from a task in Systems first.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {sks.map((sk, i) => {
                const tint = pastelFor(i);
                return (
                  <button
                    key={sk.id}
                    onClick={() => pickSK(sk)}
                    className="text-left rounded-2xl p-3 transition-transform active:scale-[0.98]"
                    style={{ background: tint.bg, color: tint.text }}
                  >
                    <p className="text-sm font-bold">{sk.name}</p>
                    <p className="text-[11px] font-semibold opacity-80 mt-0.5">{ratingLabel(sk.rating)}</p>
                  </button>
                );
              })}
            </div>
          )}
        </MeCard>
      )}

      {step === "pick-task" && selectedSK && (
        <MeCard>
          <div className="flex items-center justify-between mb-3">
            <MeSectionTitle>
              <span style={{ color: ratingColor(selectedSK.rating) }}>●</span> {selectedSK.name}
            </MeSectionTitle>
            <GhostButton onClick={startOver}>Change</GhostButton>
          </div>

          {focusTasks === null ? (
            <p className="text-sm" style={{ color: ME_INK_SOFT }}>Loading tasks…</p>
          ) : focusTasks.length === 0 ? (
            <p className="text-sm" style={{ color: ME_INK_SOFT }}>
              No open tasks are linked to this knowledge yet. Attach it to a task in Systems, then come back.
            </p>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: ME_INK_SOFT }}>
                Which task?
              </p>
              <div className="space-y-2 mb-4">
                {focusTasks.map((t) => (
                  <button
                    key={`${t.kind}-${t.id}`}
                    onClick={() => setSelectedTask(t)}
                    className="w-full text-left rounded-2xl p-3 transition-all"
                    style={{
                      background: selectedTask?.id === t.id && selectedTask.kind === t.kind ? "var(--me-accent-tint)" : "var(--me-ghost-bg)",
                      color: ME_INK,
                      border: selectedTask?.id === t.id && selectedTask.kind === t.kind ? `1px solid ${ME_ACCENT}` : "1px solid transparent",
                    }}
                  >
                    <p className="text-sm font-bold">{t.title}</p>
                    <p className="text-[11px] opacity-70 mt-0.5">
                      {t.kind === "subtask" && t.parent_task_title ? `↳ ${t.parent_task_title} · ` : ""}
                      {t.system_name ?? ""}
                    </p>
                  </button>
                ))}
              </div>

              {selectedTask && (
                <>
                  <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: ME_INK_SOFT }}>
                    For how long?
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {DURATIONS.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDurationMin(d)}
                        className="px-4 py-2 rounded-full text-sm font-bold transition-all"
                        style={
                          durationMin === d
                            ? { background: ME_ACCENT, color: "#fff" }
                            : { background: "var(--me-ghost-bg)", color: ME_INK }
                        }
                      >
                        {d} min
                      </button>
                    ))}
                  </div>
                  <PrimaryButton onClick={startTimer}>Start focusing →</PrimaryButton>
                </>
              )}
            </>
          )}
        </MeCard>
      )}

      {step === "running" && selectedSK && selectedTask && (
        <MeCard className="text-center py-8">
          <ProgressRing
            value={100 - (remainingMs / (durationMin * 60 * 1000)) * 100}
            size={180}
            strokeWidth={14}
            label={<span className="text-3xl font-black">{formatMMSS(remainingMs)}</span>}
          />
          <p className="text-sm font-bold mt-5" style={{ color: ME_INK }}>{selectedTask.title}</p>
          <p className="text-xs mt-1" style={{ color: ME_INK_SOFT }}>
            Building <span style={{ color: ratingColor(selectedSK.rating) }}>{selectedSK.name}</span>
          </p>
          <div className="mt-6">
            <GhostButton onClick={cancelTimer}>Cancel</GhostButton>
          </div>
        </MeCard>
      )}

      {step === "done" && selectedSK && (
        <MeCard className="text-center py-8">
          <p className="text-3xl mb-2">🎉</p>
          <p className="text-sm font-bold" style={{ color: ME_INK }}>
            Nice work! Logged {durationMin} min toward
          </p>
          <p className="text-sm font-bold mt-0.5" style={{ color: ratingColor(selectedSK.rating) }}>
            {selectedSK.name}
          </p>
          <div className="flex items-center justify-center gap-2 mt-5">
            <GhostButton onClick={startOver}>Start another</GhostButton>
          </div>
        </MeCard>
      )}
    </div>
  );
}
