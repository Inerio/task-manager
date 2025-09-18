import { test, expect } from "@playwright/test";

// Read shared UID/board name from env (fallbacks kept for local runs)
const E2E_UID = process.env["E2E_UID"] || `e2e-smoke-${Date.now()}`;
const BOARD_NAME = process.env["BOARD_NAME"] || "E2E Smoke Board";

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
  });

  test("lang & theme → create board → 2 cols → create & edit task", async ({
    page,
  }) => {
    // --- OPEN HOME ---
    await page.goto("/");
    await page.waitForLoadState("networkidle");

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
      await nameInput.press("Enter");
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
