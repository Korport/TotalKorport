import { test, expect } from "@playwright/test";
test("renders 3D battlefield, starts combat, moves, pauses, and returns to command", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await expect(
    page.getByRole("heading", { name: "SMALL SQUAD. BIG FIREPOWER." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/command-center.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "DEPLOY SQUAD" }).click();
  await expect(page.locator("#hud")).toBeVisible();
  await expect(page.locator("#weapon")).toHaveText("ASSAULT RIFLE");
  await page.keyboard.down("d");
  await page.waitForTimeout(700);
  await page.keyboard.up("d");
  await page.waitForTimeout(1200);
  await expect(page.locator("#timer")).not.toHaveText("00:00");
  await page.getByRole("button", { name: "Pause game" }).click();
  await expect(
    page.getByRole("heading", { name: "Operation paused." }),
  ).toBeVisible();
  const time = await page.locator("#timer").textContent();
  await page.waitForTimeout(1200);
  expect(await page.locator("#timer").textContent()).toBe(time);
  await page.getByRole("button", { name: "RESUME OPERATION" }).click();
  await expect(page.locator("#result")).toBeHidden();
  await page.screenshot({ path: "test-results/combat.png" });
  await page.keyboard.press("p");
  await page.getByRole("button", { name: "RETURN TO COMMAND" }).click();
  await expect(page.locator("#deploy")).toBeVisible();
  expect(errors).toEqual([]);
});
test("campaign locks later missions and armory persists a purchased upgrade", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "northline-v1",
      JSON.stringify({
        version: 1,
        credits: 300,
        unlocked: 2,
        stars: { "1": 3 },
        upgrades: { recruits: 0, damage: 0, armor: 0 },
      }),
    ),
  );
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#campaign").click();
  await expect(
    page.getByRole("button", {
      name: "Mission 3: Heavy metal, locked",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Mission 1: First contact", exact: true })
    .click();
  await expect(page.locator("#level-name")).toHaveText("First contact");
  await page.locator("#shop").click();
  await page.locator('[data-buy="recruits"]').click();
  await expect(page.locator("#credits")).toHaveText("180");
  await page.locator("#close-modal").click();
  await page.locator("#deploy").click();
  await expect(page.locator("#squad")).toHaveText("07");
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("northline-v1")!),
  );
  expect(saved.upgrades.recruits).toBe(1);
  expect(saved.credits).toBe(180);
});
test("mobile exposes campaign and armory, supports touch dragging without horizontal overflow", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await expect(page.locator("#mobile-shop")).toBeVisible();
  await page.locator("#mobile-shop").click();
  await expect(
    page.getByRole("heading", { name: "An edge for every operation." }),
  ).toBeVisible();
  await page.locator("#close-modal").click();
  await page.screenshot({
    path: "test-results/mobile-command.png",
    fullPage: true,
  });
  await page.locator("#deploy").click();
  const canvas = page.locator("canvas");
  const box = (await canvas.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 100, y: box.y + 300 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 240, y: box.y + 300 }],
  });
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "test-results/mobile-combat.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});

test("first recruitment gate visibly increases the squad during a real browser run", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  await page.locator("#deploy").click();
  await page.keyboard.down("a");
  await page.waitForTimeout(500);
  await page.keyboard.up("a");
  await expect(page.locator("#squad")).toHaveText("11", { timeout: 45000 });
  await page.getByRole("button", { name: "Pause game" }).click();
  await expect(
    page.getByRole("heading", { name: "Operation paused." }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/first-gate.png" });
});

test("renders moving bullet dots and expanding rocket impact effects", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#loading")).toBeHidden();
  const result = await page.evaluate(async () => {
    const simulationPath = "/src/simulation.ts",
      rendererPath = "/src/renderer.ts",
      campaignPath = "/src/campaign.ts",
      progressPath = "/src/progress.ts";
    const { Simulation } = await import(simulationPath);
    const { Battlefield } = await import(rendererPath);
    const { levels } = await import(campaignPath);
    const { freshProgress } = await import(progressPath);
    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    const field = new Battlefield(canvas),
      sim = new Simulation();
    sim.start({ ...levels[0], rows: [], boss: false }, freshProgress());
    sim.step(0.05);
    field.update(sim, 0.05, true);
    const bullets = field.scene.meshes.filter(
      (m: { name: string }) => m.name === "bullet",
    );
    const bulletCount = bullets.length,
      startZ = bullets[0].position.z;
    sim.step(0.05);
    field.update(sim, 0.05, true);
    const moved = bullets[0].position.z > startZ;
    field.update(sim, 0, true);
    const pausedZ = bullets[0].position.z;
    field.update(sim, 0, true);
    const paused = bullets[0].position.z === pausedZ;
    sim.start({ ...levels[0], rows: [], boss: false }, freshProgress());
    field.update(sim, 0, true);
    sim.weapon = 2;
    sim.enemies = [
      {
        id: 1000,
        x: 0,
        z: 14,
        hp: 100,
        maxHp: 100,
        type: "grunt",
        speed: 0,
        attack: 0,
      },
    ];
    let rocketCount = 0,
      blastCount = 0;
    for (let i = 0; i < 15; i++) {
      sim.step(0.05);
      field.update(sim, 0.05, true);
      rocketCount = Math.max(
        rocketCount,
        field.scene.meshes.filter((m: { name: string }) => m.name === "rocket")
          .length,
      );
      blastCount = Math.max(
        blastCount,
        field.scene.meshes.filter(
          (m: { name: string }) => m.name === "rocket explosion",
        ).length,
      );
    }
    sim.shots = [];
    sim.explosions = [];
    field.update(sim, 0, false);
    const cleaned = !field.scene.meshes.some((m: { name: string }) =>
      ["bullet", "rocket", "rocket explosion"].includes(m.name),
    );
    field.scene.dispose();
    field.engine.dispose();
    canvas.remove();
    return { bulletCount, moved, paused, rocketCount, blastCount, cleaned };
  });
  expect(result.bulletCount).toBe(5);
  expect(result.moved).toBe(true);
  expect(result.paused).toBe(true);
  expect(result.rocketCount).toBeGreaterThan(0);
  expect(result.blastCount).toBeGreaterThan(0);
  expect(result.cleaned).toBe(true);
});
