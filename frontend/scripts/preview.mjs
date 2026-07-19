// Capture preview screenshots of every page with mocked API data.
import { chromium } from "@playwright/test";

const BASE = "http://localhost:5173";
const OUT = "/tmp/ui-preview";

const systems = [
  { id: 1, name: "SAP Datasphere CLI", status: "active", current_priority: 90 },
  { id: 2, name: "Verbatim Build", status: "active", current_priority: 70 },
];
const tasks = [
  { id: 1, system_id: 1, title: "Ship the export command", status: "in_progress", deadline: "2026-06-13", position: 0 },
  { id: 2, system_id: 1, title: "Write integration tests", status: "todo", deadline: "2026-06-16", position: 1 },
  { id: 3, system_id: 1, title: "Fix auth token refresh", status: "blocked", deadline: null, position: 2 },
];
const today = {
  day: "2026-06-11",
  focus_system: systems[0],
  focus_tasks: tasks,
  upcoming_deadlines: [tasks[0], tasks[1]],
  flagged: [tasks[2]],
};
const proposals = [
  {
    id: 1, system_id: 1, trigger: "manual", status: "pending",
    summary: "Deadline for “Ship the export command” is in 2 days. I suggest pulling it to the front and adding a prep task.",
    actions: [
      { type: "reorder", task_id: 1, position: 0 },
      { type: "add_pretask", title: "Prepare: review export edge cases" },
    ],
    created_at: "2026-06-11T08:00:00", decided_at: null,
  },
];
const report = {
  title: "Weekly report", summary: "2 systems active. 1 task done this week, 3 open.",
  generated_at: "2026-06-11T07:00:00",
  sections: [
    { heading: "Behind", items: ["SAP Datasphere CLI — “Fix auth token refresh” is blocked"] },
    { heading: "Coming up", items: ["Ship the export command (due 2026-06-13)", "Write integration tests (due 2026-06-16)"] },
    { heading: "Completion", items: ["SAP Datasphere CLI: 25% complete", "Verbatim Build: 60% complete"] },
  ],
};
const blocks = [
  { id: 1, day: "2026-06-12", system_id: 1, note: "Deep work — export command", created_at: "", updated_at: "" },
  { id: 2, day: "2026-06-13", system_id: 2, note: "UI polish session", created_at: "", updated_at: "" },
];

async function mock(page) {
  await page.route("**/api/dashboard/today", (r) => r.fulfill({ json: today }));
  await page.route("**/api/systems/*/rebalance", (r) => r.fulfill({ json: proposals[0] }));
  await page.route("**/api/systems*", (r) => r.fulfill({ json: systems }));
  await page.route("**/api/tasks*", (r) => r.fulfill({ json: tasks }));
  await page.route("**/api/rebalance-proposals**", (r) => r.fulfill({ json: proposals }));
  await page.route("**/api/reports/**", (r) => r.fulfill({ json: report }));
  await page.route("**/api/focus-blocks*", (r) => r.fulfill({ json: blocks }));
  await page.route("**/api/intake/next", (r) =>
    r.fulfill({ json: { done: false, question: "What is the name of this new system?", proposal: null } }),
  );
}

const pages = [
  ["dashboard", "/"],
  ["systems", "/systems"],
  ["calendar", "/calendar"],
  ["proposals", "/proposals"],
  ["intake", "/intake"],
  ["reports", "/reports"],
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

// Desktop
for (const [name, path] of pages) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await mock(page);
  await page.goto(BASE + path);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await page.close();
}
// Mobile sample
const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mock(m);
await m.goto(BASE + "/");
await m.waitForTimeout(800);
await m.screenshot({ path: `${OUT}/mobile-dashboard.png`, fullPage: true });
await m.close();

await browser.close();
console.log("done");
