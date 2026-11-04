# NORTHLINE — Strike Command

An original browser-first 3D squad shooter inspired by the gate-runner format. Built with Babylon.js, TypeScript, and Vite. Working title and procedural prototype art.

## Download the prebuilt game

Download [`downloads/northline-play.zip`](downloads/northline-play.zip) from GitHub, extract it, and open a terminal in the extracted `northline-play` folder. With Python 3 installed, run:

```sh
# Windows
py -m http.server 8080 --bind 127.0.0.1

# macOS / Linux
python3 -m http.server 8080 --bind 127.0.0.1
```

Enter `localhost:8080` in your browser address bar and click **Deploy Squad**. Do not open `index.html` directly. This bundle needs no Node.js installation. The bundle includes the individual-bullet, splash-impact, and denser early-wave update; rebuild from source for subsequent code changes.

## Play locally

Requires Node.js 24 and npm. From the checkout:

```sh
npm ci
npm run dev
```

Open the address Vite prints in a browser with WebGL2 enabled. A/D or left/right arrows move the squad; mouse/touch dragging also works. Shooting is automatic and points north. P or Escape pauses. Switching away from the window pauses automatically.

Green gates recruit or multiply soldiers, upgrade weapons, restore armor, or activate a temporary tank. Red gates subtract or divide soldiers. The squad center chooses one gate per row. The squad cap is 48. Enemies that breach the line reduce armor and soldiers. Destroy all remaining enemies after the mission timer to win.

## Included in this first build

- Procedural 3D soldiers, terrain, enemies, gates, tank, bullets, splash rings, hit effects, and synthesized sound.
- Individual traveling bullets for rifles and rapid fire; larger, slower-firing rocket and tank rounds with splash damage on impact, plus 12-second tank support.
- Denser early encounters: six enemies per wave in the first three missions, with waves roughly 4.5 seconds apart.
- Recruit/multiplier/penalty gates, repair gates, armored enemies, and tank bosses.
- 50 sequentially unlocked mission configurations across five regions, using shared encounter templates with timing and difficulty variations. These are a campaign foundation, **not 50 finished, hand-balanced levels**.
- Armory upgrades for starting recruits, damage, and armor; first-clear rewards and reduced replay rewards.
- Browser-local versioned saves. No accounts, cloud synchronization, purchases, or backend yet.
- Responsive desktop/mobile interface, keyboard/touch controls, pause, retry, and next mission.

## Validation

```sh
npm test             # gate math, progression, saving, combat, full mission simulation
npm run build        # strict TypeScript + production assets in dist/
npm run test:e2e     # Chromium desktop/mobile browser tests
```

The cloud environment supplies `/usr/bin/chromium`. On another machine set `CHROMIUM_PATH` to your Chromium/Chrome binary, or install Playwright Chromium (`npx playwright install chromium`); the configuration uses it when no system Chromium is present. Browser tests launch software WebGL for headless Linux. Device emulation verifies the mobile layout and input flow; real phone performance still needs testing.

## Structure

- `src/simulation.ts`: rendering-independent combat state and mission loop.
- `src/campaign.ts`: gate effects, mission definitions, and regional progression.
- `src/progress.ts`: versioned save validation, upgrades, and rewards.
- `src/renderer.ts`: Babylon scene, procedural units, and effects.
- `src/main.ts`: menu, input, lifecycle, browser persistence, and HUD.
- `src/style.css`: responsive command-center interface.

## Hosting on your Azure VM

The prototype is a static site: no GPU or database is needed on the server. Build with `npm ci && npm run build` and serve `dist/` through your HTTPS web server, or use the included container:

```sh
docker compose up -d --build
curl --fail http://127.0.0.1:8080/
```

Compose binds only to the VM's loopback address. Put an HTTPS reverse proxy on the same VM in front of port 8080, configure your domain and certificate, and allow HTTPS through the Azure network security group. Do not use Vite's development server for public hosting. The container recipe is provided but has not been built or deployed in this cloud task.

Later: add a separate API container and PostgreSQL for accounts, cloud saves, and validated scores. Keep PostgreSQL private and its backups outside the VM. No Azure resources are provisioned by this repository.

## Next milestones

1. Playtest the first three missions; tune camera, feedback, enemy pacing, gate choices, and difficulty.
2. Integrate a consistent animated GLB asset set; add graphics/audio settings and accessibility improvements.
3. Author distinct mission objectives and encounters for all 50 levels; balance the economy.
4. Add save export/import, then optional backend-backed accounts and cloud saves.
5. Test real desktop/phone browsers and deploy to Azure.

## Asset contributions

Prefer GLB/glTF with embedded textures; include source files separately. Use a consistent meter scale with a standing soldier around 1.7 m, ground-level origins, and a documented forward direction. Characters need running, firing, hit, and defeat animations. Keep models and textures lightweight, with licensed or original assets. Test one soldier and one vehicle before producing a full set. Models can replace renderer templates without changing combat rules.

## Current limitations

Prototype difficulty and economy require human playtesting. Later missions reuse encounters. The first mission is verified winnable by simulation; the entire campaign is not yet verified beatable. Local saves can be edited or cleared by the player and do not sync across devices. No competitive score integrity is claimed. WebGL2 and browser audio support are required; audio begins after a player gesture. Background animation and effects are preliminary.
