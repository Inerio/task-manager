import { test, expect } from "@playwright/test";

// Read shared UID/board name from env (fallbacks kept for local runs)
const E2E_UID = process.env["E2E_UID"] || `e2e-smoke-${Date.now()}`;
const BOARD_NAME = process.env["BOARD_NAME"] || "E2E Smoke Board";
// API base for diagnostics / browser probe (must match CI)
const API_BASE = process.env["API_BASE_URL"] || "http://127.0.0.1:8080/api/v1";

test.describe("@smoke — basic (lang, theme, board, columns, task create/edit)", () => {
  test.beforeEach(async ({ page }) => {
    // Force app to start with our UID and EN locale
    await page.addInitScript(
      ({ uid }) => {
        try {
          localStorage.setItem("anonId", uid);
          localStorage.setItem("translocoLang", "en");
        } catch {}
      },
      { uid: E2E_UID }
    );

    // ---- Network diagnostics (logs will show in CI) ----
    page.on("request", (req) => {
      if (req.url().includes("/api/v1/")) {
        const h = req.headers();
        console.log(
          "[REQ]",
          req.method(),
          req.url(),
          "X-Client-Id=",
          h["x-client-id"] || h["X-Client-Id"]
        );
      }
    });
    page.on("response", async (res) => {
      if (res.url().includes("/api/v1/")) {
        console.log("[RES]", res.status(), res.request().method(), res.url());
      }
    });
  });

  test("lang & theme → create board → 2 cols → create & edit task", async ({
    page,
  }) => {
    // --- OPEN HOME ---
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Verify the app sees the same UID as the backend sanity step
    const uidInApp = await page.evaluate(() => localStorage.getItem("anonId"));
    console.log("[DIAG] anonId in localStorage =", uidInApp);
    expect(uidInApp).toBe(E2E_UID);

    // Browser-side probe to detect CORS / wrong API URL early
    const probe = await page.evaluate<
      { status: number; body: string },
      { api: string; uid: string }
    >(
      async ({ api, uid }) => {
        try {
          const res = await fetch(`${api}/boards`, {
            headers: { "X-Client-Id": uid },
          });
          const txt = await res.text();
          return { status: res.status, body: txt.slice(0, 200) };
        } catch (e) {
          return { status: 0, body: String(e) };
        }
      },
      { api: API_BASE, uid: E2E_UID }
    );
    console.log("[DIAG] browser fetch /boards =>", probe.status, probe.body);
    expect([200, 204]).toContain(probe.status);

    // --- LANG: EN -> FR (verify aria-pressed), then back to EN ---
    const enBtn = page.getByRole("button", { name: /^EN$/ }).first();
    const frBtn = page.getByRole("button", { name: /^FR$/ }).first();

    await frBtn.click();
    await expect(frBtn).toHaveAttribute("aria-pressed", "true");
    await expect(enBtn).toHaveAttribute("aria-pressed", "false");

    // Switch back to EN for the rest of the test
    await enBtn.click();
    await expect(enBtn).toHaveAttribute("aria-pressed", "true");

    // --- THEME: Light -> Dark (verify aria-pressed) ---
    const lightBtn = page.getByRole("button", { name: /^Light$/ }).first();
    const darkBtn = page.getByRole("button", { name: /^Dark$/ }).first();
    await darkBtn.click();
    await expect(darkBtn).toHaveAttribute("aria-pressed", "true");
    await expect(lightBtn).toHaveAttribute("aria-pressed", "false");

    // --- CREATE BOARD (UI) ---
    const boardTile = page.getByText(BOARD_NAME, { exact: true }).first();
    if (!(await boardTile.isVisible().catch(() => false))) {
      const addBoardBtn = page
        .getByRole("button", { name: /\+?\s*Add Board/i })
        .or(page.locator(".add-board-btn"))
        .first();
      await expect(addBoardBtn).toBeVisible();
      await addBoardBtn.click();

      const nameInput = page.locator("input.board-edit-input").first();
      await expect(nameInput).toBeVisible();
      await nameInput.fill(BOARD_NAME);

      // Wait for the POST /boards to resolve (2xx) before asserting UI
      const postOk = page.waitForResponse((r) => {
        try {
          const url = new URL(r.url());
          return (
            r.request().method() === "POST" &&
            url.pathname.endsWith("/api/v1/boards") &&
            r.status() >= 200 &&
            r.status() < 300
          );
        } catch {
          return false;
        }
      });
      await nameInput.press("Enter");
      await postOk;

      await expect(boardTile).toBeVisible({ timeout: 10_000 });
    }

    // --- CLOSE TEMPLATE PICKER IF OPEN ---
    const closeTemplatePickerIfOpen = async () => {
      const tpl = page.getByRole("dialog", {
        name: /Start with a template\??/i,
      });
      if (await tpl.isVisible().catch(() => false)) {
        const skipBtn = tpl.getByRole("button", { name: /Skip|Ignorer/i });
        if (await skipBtn.isVisible().catch(() => false)) {
          await skipBtn.click();
        } else {
          await page.keyboard.press("Escape");
        }
        await expect(tpl).toBeHidden();
      }
    };
    await closeTemplatePickerIfOpen();

    // Open the board
    await boardTile.click();

    // --- ENSURE WE HAVE 2 COLUMNS ---
    const columns = () => page.locator('[data-testid^="col-"]');
    if ((await columns().count()) < 1) {
      await page.getByRole("button", { name: /^\+$/ }).first().click();
      await expect(columns().first()).toBeVisible({ timeout: 10_000 });
    }
    if ((await columns().count()) < 2) {
      await page.getByRole("button", { name: /^\+$/ }).first().click();
      await expect(columns().nth(1)).toBeVisible({ timeout: 10_000 });
    }
    const col1 = columns().nth(0);

    // Close any inline header edit (overlay .column-blocker)
    const blocker = page.locator(".column-blocker");
    const headerInput = col1.getByRole("textbox").first();
    if (await headerInput.isVisible().catch(() => false)) {
      await headerInput.press("Enter").catch(() => {});
    }
    if (await blocker.isVisible().catch(() => false)) {
      const closeBtn = col1
        .getByRole("button", { name: /^x$/i })
        .first()
        .or(col1.getByRole("button", { name: /close|fermer|×/i }).first());
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => {});
      }
      if (await blocker.isVisible().catch(() => false)) {
        await page.mouse.click(5, 5);
      }
      if (await blocker.isVisible().catch(() => false)) {
        await expect(blocker).toBeHidden({ timeout: 5_000 });
      }
    }

    // --- CREATE TASK ---
    await col1.getByTestId("add-task").click();
    const form1 = page
      .locator('.task-form:has([data-testid="task-title-input"])')
      .first();
    await expect(form1).toBeVisible({ timeout: 10_000 });
    await form1.getByTestId("task-title-input").fill("Task A");
    await form1.getByTestId("save-task").click();

    // Assert the card is visible
    const cardA = page
      .locator('[data-testid^="task-"]')
      .filter({ hasText: "Task A" })
      .first();
    await expect(cardA).toBeVisible({ timeout: 10_000 });

    // --- EDIT TASK (inline) ---
    const editBtn = cardA
      .getByTestId("edit-task")
      .or(cardA.getByRole("button", { name: /edit/i }));
    await editBtn.click();

    const titleInput = page.getByTestId("task-title-input");
    await expect(titleInput).toBeVisible({ timeout: 10_000 });
    await titleInput.fill("Task A (edited)");

    const saveInline = page
      .getByTestId("save-task")
      .or(page.getByRole("button", { name: /save/i }));
    await saveInline.click();

    await expect(titleInput).toBeHidden();
    await expect(cardA).toContainText("Task A (edited)");
  });
});
