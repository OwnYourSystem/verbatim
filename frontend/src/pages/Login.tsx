import { useState } from "react";
import { login } from "../api";

export function Login({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
      onSuccess();
    } catch {
      setError("Incorrect username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "var(--color-void)" }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(99,60,255,0.12) 0%, transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm animate-fade-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl" role="img" aria-label="anchor">⚓</span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-gradient">
            MindAnchor
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-signal-idle)" }}>
            Your external brain
          </p>
        </div>

        {/* Card */}
        <form
          onSubmit={handleSubmit}
          className="glass-panel p-8 space-y-5"
          autoComplete="current-password"
        >
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: "var(--color-signal-idle)" }}>
            Sign in
          </h2>

          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-sm font-medium"
              style={{ color: "rgba(200,210,255,0.8)" }}
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
              placeholder="owner"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{
                background: "rgba(8,12,24,0.8)",
                border: "1px solid rgba(120,140,220,0.2)",
                color: "rgba(220,230,255,0.9)",
                caretColor: "var(--color-signal-ok)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "rgba(99,60,255,0.6)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(120,140,220,0.2)")
              }
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: "rgba(200,210,255,0.8)" }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              className="w-full rounded-xl px-4 py-2.5 text-sm outline-none transition-all"
              style={{
                background: "rgba(8,12,24,0.8)",
                border: "1px solid rgba(120,140,220,0.2)",
                color: "rgba(220,230,255,0.9)",
                caretColor: "var(--color-signal-ok)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "rgba(99,60,255,0.6)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "rgba(120,140,220,0.2)")
              }
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--color-signal-crit)" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="cosmos-btn-primary w-full"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
