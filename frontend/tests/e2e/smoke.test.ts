/**
 * Smoke + look-and-feel tests for MindAnchor UI.
 *
 * Verifies:
 *   1. Every route renders without a crash
 *   2. Key structural elements are present (nav, headings, cards)
 *   3. Dark-theme colours are applied correctly
 *   4. Interactive elements are visible and clickable
 *
 * API calls are intercepted via page.route() — no live backend needed.
 */

import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Shared mock data
// ---------------------------------------------------------------------------

const MOCK_SYSTEM = {
  id: 1,
  name: "Product Launch",
  description: "Q3 product launch campaign",
  status: "active",
  purpose: "Ship v2",
  goals: "Revenue growth",
  constraints: "Budget cap",
  dependencies: "Design team",
  delivery_expectations: "Q3 2026",
  created_at: "2026-06-01T00:00:00",
  updated_at: "2026-06-01T00:00:00",
  current_priority: 80,
};

const MOCK_TASK = {
  id: 1,
  system_id: 1,
  title: "Write launch copy",
  description: "",
  status: "todo",
  deadline: "2026-06-20",
  position: 0,
};

const MOCK_TODAY = {
  day: "2026-06-11",
  focus_system: MOCK_SYSTEM,
  focus_tasks: [MOCK_TASK],
  upcoming_deadlines: [{ ...MOCK_TASK, id: 2, title: "Design assets", deadline: "2026-06-15" }],
  flagged: [],
};

const MOCK_PROPOSAL = {
  id: 1,
  system_id: 1,
  trigger: "manual",
  summary: "Reorder tasks by deadline",
  actions: [{ type: "reorder", task_ids: [1, 2] }],
  status: "pending",
  created_at: "2026-06-11T08:00:00",
  decided_at: null,
};

const MOCK_REPORT = {
  type: "weekly",
  title: "Weekly Report",
  generated_at: "2026-06-11T08:00:00",
  summary: "One system active, 2 tasks open.",
  sections: [
    { heading: "Product Launch", items: ["2 tasks open", "0 done this week"] },
  ],
};

// ---------------------------------------------------------------------------
// API mock — intercepts all /api/* calls so no backend is needed
// ---------------------------------------------------------------------------

async function mockApi(page: Page) {
  // Dashboard
  await page.route("**/api/dashboard/today", (r) => r.fulfill({ json: MOCK_TODAY }));

  // Systems — order matters: more specific routes first
  await page.route("**/api/systems/*/rebalance", (r) => r.fulfill({ json: MOCK_PROPOSAL }));
  await page.route("**/api/systems/*/priorities", (r) => r.fulfill({ json: {} }));
  await page.route("**/api/systems/*", (r) => r.fulfill({ json: MOCK_SYSTEM }));
  await page.route("**/api/systems", (r) => r.fulfill({ json: [MOCK_SYSTEM] }));

  // Tasks  — real URL is /api/tasks?system_id=1
  await page.route("**/api/tasks*", (r) => r.fulfill({ json: [MOCK_TASK] }));
  await page.route("**/api/tasks/**", (r) => r.fulfill({ json: MOCK_TASK }));

  // Subtasks — /api/subtasks?task_id=1
  await page.route("**/api/subtasks*", (r) => r.fulfill({ json: [] }));

  // Proposals — **/api/rebalance-proposals** catches the ?status=pending query string
  await page.route("**/api/rebalance-proposals/*/approve", (r) => r.fulfill({ json: { ...MOCK_PROPOSAL, status: "approved" } }));
  await page.route("**/api/rebalance-proposals/*/reject", (r) => r.fulfill({ json: { ...MOCK_PROPOSAL, status: "rejected" } }));
  await page.route("**/api/rebalance-proposals**", (r) => r.fulfill({ json: [MOCK_PROPOSAL] }));

  // Calendar
  await page.route("**/api/focus-blocks*", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/focus-blocks/**", (r) => r.fulfill({ status: 204, body: "" }));

  // Check-ins
  await page.route("**/api/check-ins", (r) => r.fulfill({ status: 204, body: "" }));

  // Intake
  await page.route("**/api/intake/**", (r) =>
    r.fulfill({
      json: {
        done: false,
        question: "What is the name of your new system?",
        proposal: null,
      },
    })
  );

  // Reports — covers /api/reports/weekly, /monthly, /on-demand, /morning-briefing
  await page.route("**/api/reports/**", (r) => r.fulfill({ json: MOCK_REPORT }));
}

// ---------------------------------------------------------------------------
// 1. Navigation shell
// ---------------------------------------------------------------------------

test.describe("Navigation shell", () => {
  test("renders app title and all nav links", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");

    await expect(page.locator("header")).toBeVisible();
    await expect(page.locator("header")).toContainText("MindAnchor");

    for (const label of ["Today", "Systems", "Calendar", "Proposals", "New system", "Reports"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("every route renders without a crash", async ({ page }) => {
    await mockApi(page);
    const paths = ["/", "/systems", "/calendar", "/proposals", "/intake", "/reports"];

    for (const path of paths) {
      await page.goto(path);
      await expect(page.locator("body")).not.toContainText("Unexpected Application Error");
      await expect(page.locator("body")).not.toContainText("TypeError");
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Dark theme / look-and-feel
// ---------------------------------------------------------------------------

test.describe("Dark theme look-and-feel", () => {
  test("app wrapper has slate-900 dark background", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    // bg-slate-900 is on the outermost div, not body
    const bg = await page.evaluate(() => {
      const wrapper = document.querySelector("div.min-h-screen");
      return wrapper ? getComputedStyle(wrapper).backgroundColor : "";
    });
    // slate-900 = rgb(15, 23, 42)
    expect(bg).toBe("rgb(15, 23, 42)");
  });

  test("header has a visible bottom border separating it from content", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    const borderWidth = await page.evaluate(() => {
      const h = document.querySelector("header");
      return h ? getComputedStyle(h).borderBottomWidth : "";
    });
    expect(parseInt(borderWidth)).toBeGreaterThan(0);
  });

  test("active nav link gets highlighted background (slate-700)", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    await page.waitForSelector("nav");
    const cls = await page.getByRole("link", { name: "Systems" }).getAttribute("class");
    expect(cls).not.toBeNull();
    // Active link gets bg-slate-700
    expect(cls).toContain("bg-slate-700");
  });

  test("inactive nav links do not have the active bg class", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    await page.waitForSelector("nav");
    const cls = await page.getByRole("link", { name: "Today" }).getAttribute("class");
    expect(cls).not.toContain("bg-slate-700");
  });

  test("text is light-coloured (readable on dark bg)", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.waitForSelector("header");
    const color = await page.evaluate(() => {
      const h = document.querySelector("header span");
      return h ? getComputedStyle(h).color : "";
    });
    // text-slate-100 or text-white — both start with rgb(2... or rgb(24...
    // Just ensure it's not black or very dark
    const [r, g, b] = color.match(/\d+/g)!.map(Number);
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
    expect(luminance).toBeGreaterThan(150); // clearly light text
  });
});

// ---------------------------------------------------------------------------
// 3. Dashboard (Today)
// ---------------------------------------------------------------------------

test.describe("Dashboard — Today", () => {
  test("shows focus system name", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.getByText("Product Launch").first()).toBeVisible();
  });

  test("shows focus task with a checkbox", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.getByText("Write launch copy")).toBeVisible();
    await expect(page.getByRole("checkbox").first()).toBeVisible();
  });

  test("shows upcoming deadlines section with task", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.getByText("Design assets")).toBeVisible();
  });

  test("check-in form (textarea + button) is present", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /check.in/i })).toBeVisible();
  });

  test("submitting a check-in does not show an error", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.getByRole("textbox").fill("Finished copy draft.");
    await page.getByRole("button", { name: /check.in/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/error/i)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Systems page
// ---------------------------------------------------------------------------

test.describe("Systems page", () => {
  test("lists system card with name", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    await expect(page.getByText("Product Launch").first()).toBeVisible();
  });

  test("shows StatusBadge on tasks (todo = slate/gray)", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    // Expand the system card to load tasks
    await page.getByText("Product Launch").first().click();
    const badge = page.locator("span", { hasText: /^todo$/ }).first();
    await expect(badge).toBeVisible({ timeout: 5000 });
    const cls = await badge.getAttribute("class");
    expect(cls).toMatch(/slate|gray/);
  });

  test("priority input is visible in the card header", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    const input = page.getByRole("spinbutton");
    await expect(input).toBeVisible();
    await expect(input).toHaveValue("80");
  });

  test("Rebalance button is always visible and clickable without crashing", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    const btn = page.getByRole("button", { name: /rebalance/i });
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(500);
    await expect(page.getByText(/error/i)).toHaveCount(0);
  });

  test("'todo' task badge renders with a gray/slate class after expanding", async ({ page }) => {
    await mockApi(page);
    await page.goto("/systems");
    await page.getByText("Product Launch").first().click();
    const badge = page.locator("span", { hasText: /^todo$/ }).first();
    await expect(badge).toBeVisible({ timeout: 5000 });
    const cls = await badge.getAttribute("class");
    expect(cls).toMatch(/slate|gray/);
  });
});

// ---------------------------------------------------------------------------
// 5. Calendar page
// ---------------------------------------------------------------------------

test.describe("Calendar page", () => {
  test("renders the add focus block form", async ({ page }) => {
    await mockApi(page);
    await page.goto("/calendar");
    await expect(page.getByRole("button", { name: /add/i })).toBeVisible();
  });

  test("shows empty state when no focus blocks exist", async ({ page }) => {
    await mockApi(page);
    await page.goto("/calendar");
    await expect(page.getByText(/no focus blocks/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 6. Proposals page
// ---------------------------------------------------------------------------

test.describe("Proposals page", () => {
  test("lists pending proposal with its summary", async ({ page }) => {
    await mockApi(page);
    await page.goto("/proposals");
    await expect(page.getByText("Reorder tasks by deadline")).toBeVisible();
  });

  test("shows Approve and Reject buttons", async ({ page }) => {
    await mockApi(page);
    await page.goto("/proposals");
    await expect(page.getByRole("button", { name: /approve/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /reject/i })).toBeVisible();
  });

  test("clicking Reject does not crash the page", async ({ page }) => {
    await mockApi(page);
    await page.goto("/proposals");
    await page.getByRole("button", { name: /reject/i }).click();
    await page.waitForTimeout(400);
    await expect(page.getByText(/error/i)).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// 7. Intake (New system) page
// ---------------------------------------------------------------------------

test.describe("Intake page", () => {
  test("renders the first interview question", async ({ page }) => {
    await mockApi(page);
    await page.goto("/intake");
    await expect(page.getByText("What is the name of your new system?")).toBeVisible();
  });

  test("answer input and Send button are present", async ({ page }) => {
    await mockApi(page);
    await page.goto("/intake");
    await expect(page.getByRole("textbox")).toBeVisible();
    await expect(page.getByRole("button", { name: /next/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// 8. Reports page
// ---------------------------------------------------------------------------

test.describe("Reports page", () => {
  test("renders three report type tab buttons", async ({ page }) => {
    await mockApi(page);
    await page.goto("/reports");
    // Labels are lowercase with hyphen replaced by space: "weekly", "monthly", "on demand"
    for (const label of ["weekly", "monthly", "on demand"]) {
      await expect(page.getByRole("button", { name: label })).toBeVisible();
    }
  });

  test("loads and displays weekly report content", async ({ page }) => {
    await mockApi(page);
    await page.goto("/reports");
    await expect(page.getByText("Weekly Report")).toBeVisible();
    await expect(page.getByText("One system active, 2 tasks open.")).toBeVisible();
  });

  test("switching to Monthly tab does not crash", async ({ page }) => {
    await mockApi(page);
    await page.goto("/reports");
    await page.getByRole("button", { name: "monthly" }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/error/i)).toHaveCount(0);
  });

  test("morning briefing card is present with notification button", async ({ page }) => {
    await mockApi(page);
    await page.goto("/reports");
    await expect(page.getByText(/morning briefing/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /enable notifications/i })).toBeVisible();
  });
});
