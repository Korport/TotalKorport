import "./style.css";
import { Battlefield } from "./renderer";
import { Simulation } from "./simulation";
import { levels, weaponNames } from "./campaign";
import {
  parseProgress,
  purchase,
  complete,
  upgradeCost,
  type Upgrade,
} from "./progress";
import { Audio } from "./audio";
const icon = (name: string) =>
  ({
    north: "▲",
    campaign: "▦",
    shop: "⬡",
    sound: "◖",
    pause: "II",
    arrow: "→",
    lock: "▣",
  })[name] ?? "•";
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
<header class="topbar"><a class="brand" href="#" aria-label="Northline home"><span class="brandmark">${icon("north")}</span><span>NORTHLINE<small>STRIKE COMMAND</small></span></a><span class="build-tag">FIELD OPERATIONS <b> / </b> VOL. 01</span><div class="top-actions"><span class="credit-pill"><span>◈</span> <b id="credits">0</b> <small>CREDITS</small></span><button class="icon-button" id="sound" aria-label="Mute audio" title="Toggle audio">◖</button><button class="icon-button" id="help" aria-label="How to play">?</button></div></header>
<div class="workspace"><aside class="sidebar"><div class="nav-label">COMMAND CENTER</div><nav><button class="nav-item active" id="campaign"><span>▦</span> Campaign <span class="nav-count">50</span></button><button class="nav-item" id="shop"><span>⬡</span> Armory <span class="nav-arrow">→</span></button></nav>
<div class="sidebar-line"></div><div class="section-heading">CURRENT OPERATION <span class="live-dot"></span></div><div class="operation-num" id="operation-num">01<span>/ 50</span></div><h2 id="level-name">First contact</h2><p class="muted" id="region-name">OUTSKIRTS / SECTOR 01</p><div class="mission-stats"><div><span>THREAT LEVEL</span><b id="threat">LOW <i>▮▮▯▯▯</i></b></div><div><span>COMPLETION BONUS</span><b class="lime" id="reward">◈ 100</b></div></div>
<button class="text-button" id="select-level">VIEW CAMPAIGN MAP <span>→</span></button>
<div class="field-note"><span class="tiny-label">FIELD MANUAL / 001</span><div class="note-icon">⇄</div><h3>Numbers change the fight.</h3><p>Take the green gates. Avoid the red. A bigger squad means a stronger push north.</p></div><div class="sidebar-footer"><span class="live-dot"></span> LOCAL SAVE ACTIVE <span id="save-state">✓</span></div></aside>
<main class="main"><div class="mobile-nav"><button id="mobile-campaign">▦ CAMPAIGN</button><button id="mobile-shop">⬡ ARMORY</button></div><div class="stage-header"><span><span class="live-dot"></span> <b id="stage-label">OPERATION PREVIEW</b></span><span id="stage-detail">3D TACTICAL RUNNER <span class="separator">/</span> SINGLE PLAYER</span></div><section class="stage" aria-label="3D battlefield"><canvas id="battlefield" aria-label="Game battlefield. Use A and D or arrow keys to move sideways." tabindex="0"></canvas><div class="scanline"></div>
<div class="intro" id="intro"><div class="eyebrow"><span></span> THE FRONTLINE IS YOURS</div><h1>SMALL SQUAD.<br>BIG <em>FIREPOWER.</em></h1><p>Build your numbers. Upgrade your arsenal.<br>Push through the line.</p><div class="intro-chips"><span>3D COMBAT</span><span>50 MISSIONS</span><span>NO DOWNLOAD</span></div></div>
<div class="preview-tag" id="preview-tag"><span class="live-dot"></span> YOUR SQUAD <b>05</b></div>
<div class="deploy-card" id="deploy-card"><div class="tiny-label">NEXT DEPLOYMENT <span>01</span></div><h3 id="deploy-title">First contact</h3><p>Every army starts somewhere.</p><button class="primary" id="deploy">DEPLOY SQUAD <span>→</span></button><div class="deploy-foot">AUTO-FIRE ENABLED <span>●</span> ~2 MIN RUN</div></div>
<div class="hud hidden" id="hud"><div class="hud-card"><small>SQUAD</small><strong id="squad">05</strong></div><div class="hud-center"><div><span id="weapon">ASSAULT RIFLE</span><span id="timer">00:00</span></div><div class="progress-track"><div id="mission-progress"></div></div><div class="armor-line"><span>ARMOR <b id="hp">100</b></span><span id="tank-time"></span></div></div><button class="icon-button" id="pause" aria-label="Pause game">II</button></div>
<div class="toast hidden" id="toast" role="status"></div><div class="play-hint hidden" id="play-hint">← &nbsp; MOVE TO CHOOSE A GATE &nbsp; →</div>
<div class="result hidden" id="result"></div><div class="loading" id="loading"><span class="brandmark">▲</span><p>PREPARING THE FRONTLINE…</p></div>
</section><div class="controls-bar"><div><kbd>A</kbd><kbd>D</kbd><span>or</span><kbd>←</kbd><kbd>→</kbd><span>MOVE SQUAD</span></div><div><span class="mouse-icon">↔</span> DRAG TO MOVE <span class="separator">/</span> AUTO-FIRE</div><span class="version">PROTOTYPE 0.1</span></div><div class="bottom-cards"><div><span class="feature-icon">⊕</span><div><h3>Make every gate count</h3><p>Recruit, multiply, or risk it all.</p></div><span class="card-index">01</span></div><div><span class="feature-icon">↟</span><div><h3>Built for the next run</h3><p>Earn credits. Upgrade your starting squad.</p></div><span class="card-index">02</span></div><div><span class="feature-icon">▱</span><div><h3>Bring the heavy metal</h3><p>Grab temporary armored support.</p></div><span class="card-index">03</span></div></div></main></div>
<dialog id="modal" aria-labelledby="modal-title"><div class="modal-top"><div><div class="tiny-label" id="modal-kicker"></div><h2 id="modal-title"></h2></div><button id="close-modal" class="icon-button" aria-label="Close dialog">×</button></div><div id="modal-body"></div></dialog>`;
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id)! as T;
const sim = new Simulation(),
  audio = new Audio();
let progress = parseProgress(localStorageSafe());
let selected = progress.unlocked;
let active = false,
  paused = false,
  finished = false;
let battlefield: Battlefield | undefined;
let last = performance.now(),
  uiTimer = 0;
const keys = new Set<string>();
let dragging = false;
function localStorageSafe() {
  try {
    return localStorage.getItem("northline-v1");
  } catch {
    return null;
  }
}
function save() {
  try {
    localStorage.setItem("northline-v1", JSON.stringify(progress));
    $("save-state").textContent = "✓";
  } catch {
    $("save-state").textContent = "UNAVAILABLE";
  }
  updateMeta();
}
function updateMeta() {
  const l = levels[selected - 1];
  $("credits").textContent = progress.credits.toLocaleString();
  $("operation-num").innerHTML =
    String(selected).padStart(2, "0") + "<span>/ 50</span>";
  $("level-name").textContent = l.name;
  $("region-name").textContent =
    `${l.region} / SECTOR ${String(Math.ceil(selected / 10)).padStart(2, "0")}`;
  $("reward").textContent =
    `◈ ${progress.stars[selected] ? Math.round(l.reward * 0.25) : l.reward}`;
  $("deploy-title").textContent = l.name;
  $("deploy-card").querySelector(".tiny-label span")!.textContent = String(
    selected,
  ).padStart(2, "0");
  $("threat").innerHTML =
    selected < 10
      ? "LOW <i>▮▮▯▯▯</i>"
      : selected < 30
        ? "MEDIUM <i>▮▮▮▯▯</i>"
        : "HIGH <i>▮▮▮▮▮</i>";
  if (!active) {
    sim.level = l;
    sim.squad = 5 + progress.upgrades.recruits * 2;
    $("preview-tag").querySelector("b")!.textContent = String(
      sim.squad,
    ).padStart(2, "0");
  }
}
function setHidden(id: string, hidden: boolean) {
  $(id).classList.toggle("hidden", hidden);
}
function start() {
  if (!battlefield) return;
  audio.unlock();
  audio.tone(330, 0.2);
  sim.start(levels[selected - 1], progress);
  active = true;
  paused = false;
  finished = false;
  keys.clear();
  $("result").classList.add("hidden");
  for (const id of ["intro", "deploy-card", "preview-tag"]) setHidden(id, true);
  setHidden("hud", false);
  setHidden("play-hint", false);
  $("stage-label").textContent = "OPERATION LIVE";
  $("stage-detail").textContent =
    `${sim.level.region} / MISSION ${String(selected).padStart(2, "0")}`;
  $("pause").textContent = "II";
  $("battlefield").focus();
  updateHud();
}
function home() {
  active = false;
  paused = false;
  sim.status = "idle";
  sim.enemies = [];
  sim.gates = [];
  sim.shots = [];
  sim.impacts = [];
  sim.tank = 0;
  keys.clear();
  setHidden("result", true);
  for (const id of ["intro", "deploy-card", "preview-tag"])
    setHidden(id, false);
  for (const id of ["hud", "toast", "play-hint"]) setHidden(id, true);
  $("stage-label").textContent = "OPERATION PREVIEW";
  $("stage-detail").textContent = "3D TACTICAL RUNNER / SINGLE PLAYER";
  updateMeta();
}
function togglePause() {
  if (!active || finished) return;
  paused = !paused;
  keys.clear();
  $("pause").textContent = paused ? "▶" : "II";
  $("pause").setAttribute("aria-label", paused ? "Resume game" : "Pause game");
  setHidden("result", !paused);
  if (paused) {
    $("result").innerHTML =
      `<div class="result-card"><div class="tiny-label">HOLDING POSITION</div><h2>Operation paused.</h2><p>Your squad is waiting for your command.</p><button class="primary" id="resume">RESUME OPERATION <span>→</span></button><button class="text-button" id="abort">RETURN TO COMMAND</button></div>`;
    $("resume").onclick = togglePause;
    $("abort").onclick = home;
  }
}
function updateHud() {
  $("squad").textContent = String(sim.squad).padStart(2, "0");
  $("weapon").textContent =
    sim.tank > 0 ? "ARMORED SUPPORT" : weaponNames[sim.weapon];
  $("hp").textContent = String(Math.ceil(sim.hp));
  $("hp").classList.toggle("danger", sim.hp < sim.maxHp * 0.3);
  $("timer").textContent = `${Math.floor(sim.time / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(sim.time % 60)
    .toString()
    .padStart(2, "0")}`;
  $("mission-progress").style.width =
    Math.min(100, (sim.time / sim.level.duration) * 100) + "%";
  $("tank-time").textContent =
    sim.tank > 0 ? `TANK ${sim.tank.toFixed(1)}s` : "";
  $("toast").textContent = sim.message;
  setHidden("toast", sim.time > sim.messageUntil || !active || finished);
  setHidden("play-hint", sim.time > 12 || !active || finished);
}
function finish() {
  finished = true;
  const won = sim.status === "won";
  let earned = 0;
  const stars =
    sim.hp / sim.maxHp > 0.65 ? 3 : sim.hp / sim.maxHp > 0.3 ? 2 : 1;
  if (won) {
    earned = complete(progress, selected, stars, sim.level.reward);
    save();
    audio.tone(660, 0.4);
  } else audio.tone(90, 0.4, "triangle");
  setHidden("toast", true);
  setHidden("play-hint", true);
  $("result").innerHTML =
    `<div class="result-card"><div class="tiny-label">${won ? "SECTOR SECURED" : "SQUAD LOST"}</div><div class="result-symbol">${won ? "✦".repeat(stars) : "↺"}</div><h2>${won ? "Mission accomplished." : "Regroup. Reload."}</h2><p>${sim.kills} hostiles eliminated ${won ? ` · +${earned} credits` : " · Your upgrades are safe."}</p><button class="primary" id="continue">${won && selected < 50 ? "NEXT OPERATION" : "REDEPLOY SQUAD"} <span>→</span></button><button class="text-button" id="return">RETURN TO COMMAND</button></div>`;
  setHidden("result", false);
  $("continue").onclick = () => {
    if (won && selected < 50) selected++;
    updateMeta();
    start();
  };
  $("return").onclick = home;
}
const modal = $<HTMLDialogElement>("modal");
let modalPaused = false;
function openModal(title: string, kicker: string) {
  if (active && !paused && !finished) {
    togglePause();
    modalPaused = true;
  } else modalPaused = false;
  $("modal-title").textContent = title;
  $("modal-kicker").textContent = kicker;
  modal.showModal();
}
function closeModal() {
  modal.close();
  if (modalPaused && paused) {
    modalPaused = false;
    togglePause();
  }
}
$("close-modal").onclick = closeModal;
modal.addEventListener("cancel", (e) => {
  e.preventDefault();
  closeModal();
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) closeModal();
});
function campaign() {
  openModal("Choose your operation.", "CAMPAIGN / 50 MISSIONS");
  renderCampaign();
}
function renderCampaign() {
  const body = $("modal-body");
  body.innerHTML = `<p class="modal-description">Complete operations to unlock the next mission. Replay cleared sectors for 25% credits.</p><div class="campaign-legend">✦ Your best rating <span>▣ Locked operation</span></div>${Array.from(
    { length: 5 },
    (_, r) =>
      `<section class="region"><h3><span>0${r + 1}</span> ${levels[r * 10].region}</h3><div class="level-grid">${levels
        .slice(r * 10, r * 10 + 10)
        .map(
          (l) =>
            `<button class="level-tile ${l.id === selected ? "selected" : ""}" ${l.id > progress.unlocked ? "disabled" : ""} data-level="${l.id}" aria-label="Mission ${l.id}: ${l.name}${l.id > progress.unlocked ? ", locked" : ""}"><span>${l.id > progress.unlocked ? "▣" : String(l.id).padStart(2, "0")}</span><small>${progress.stars[l.id] ? "✦".repeat(progress.stars[l.id]) : l.boss ? "BOSS" : "—"}</small></button>`,
        )
        .join("")}</div></section>`,
  ).join(
    "",
  )}<p class="prototype-note">Prototype campaign: 50 configured missions using remixed encounters. Art, pacing, and difficulty are still in development.</p>`;
  body.querySelectorAll<HTMLButtonElement>("[data-level]").forEach(
    (b) =>
      (b.onclick = () => {
        selected = Number(b.dataset.level);
        closeModal();
        home();
        updateMeta();
      }),
  );
}
function armory() {
  openModal("An edge for every operation.", "ARMORY / PERMANENT UPGRADES");
  renderArmory();
}
function renderArmory() {
  const specs: [Upgrade, string, string, string][] = [
    ["recruits", "Reinforcements", "+2 starting soldiers per rank", "♟"],
    ["damage", "Weapons training", "+18% base weapon damage per rank", "⌖"],
    ["armor", "Body armor", "+25 starting armor per rank", "⬡"],
  ];
  $("modal-body").innerHTML =
    `<div class="armory-balance"><span>AVAILABLE CREDITS</span><b>◈ ${progress.credits}</b></div><p class="modal-description">Earn credits in the field. Upgrades apply on your next deployment.</p><div class="upgrade-grid">${specs
      .map(([key, name, desc, mark]) => {
        const rank = progress.upgrades[key],
          cost = upgradeCost(rank);
        return `<article class="upgrade"><div class="upgrade-icon">${mark}</div><h3>${name}</h3><p>${desc}</p><div class="rank">${"▰".repeat(rank)}<span>${"▱".repeat(5 - rank)}</span><small>${rank} / 5</small></div><button class="primary" data-buy="${key}" ${rank >= 5 || progress.credits < cost ? "disabled" : ""}>${rank >= 5 ? "MAX RANK" : `UPGRADE <span>◈ ${cost}</span>`}</button></article>`;
      })
      .join(
        "",
      )}</div><p class="prototype-note">Gameplay credits only. No purchases or accounts required. Progress is stored in this browser.</p>`;
  $("modal-body")
    .querySelectorAll<HTMLButtonElement>("[data-buy]")
    .forEach(
      (b) =>
        (b.onclick = () => {
          if (purchase(progress, b.dataset.buy as Upgrade)) {
            audio.unlock();
            audio.tone(440, 0.15);
            save();
            renderArmory();
          }
        }),
    );
}
$("mobile-campaign").onclick = campaign;
$("mobile-shop").onclick = armory;
$("campaign").onclick = campaign;
$("select-level").onclick = campaign;
$("shop").onclick = armory;
$("deploy").onclick = start;
$("pause").onclick = togglePause;
$("sound").onclick = () => {
  audio.enabled = !audio.enabled;
  $("sound").textContent = audio.enabled ? "◖" : "◌";
  $("sound").setAttribute(
    "aria-label",
    audio.enabled ? "Mute audio" : "Enable audio",
  );
  if (audio.enabled) audio.unlock();
};
$("help").onclick = () => {
  openModal("Your orders are simple.", "FIELD MANUAL");
  $("modal-body").innerHTML =
    `<div class="help-content"><p><b>01 / MOVE SIDEWAYS</b>Use A/D, arrow keys, or drag across the battlefield. Your squad always fires north.</p><p><b>02 / CHOOSE YOUR GATES</b>Your squad’s center chooses the left or right gate. Green grows your squad; red takes soldiers away. Squad size is capped at 48.</p><p><b>03 / MATCH THE THREAT</b>Rifles fire straight ahead. Rapid fire cuts through crowds. Rockets and temporary tanks deal splash damage.</p><p><b>04 / HOLD THE LINE</b>Enemies reaching your squad cost armor and soldiers. Destroy all remaining enemies to finish. Losing all soldiers or armor ends the run.</p><p><b>05 / BUILD YOUR ADVANTAGE</b>Win credits and upgrade your starting squad in the Armory. Press P or Escape to pause. Leaving the tab pauses automatically.</p></div>`;
};
document.querySelector(".brand")!.addEventListener("click", (e) => {
  e.preventDefault();
  if (!active || finished) home();
  else togglePause();
});
window.addEventListener("keydown", (e) => {
  if (modal.open) return;
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key))
    e.preventDefault();
  if (["p", "P", "Escape"].includes(e.key) && !e.repeat) {
    togglePause();
    return;
  }
  keys.add(e.key.toLowerCase());
});
window.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  dragging = false;
  if (active && !paused && !finished) togglePause();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && active && !paused && !finished) togglePause();
});
const canvas = $<HTMLCanvasElement>("battlefield");
let dragX = 0,
  dragTarget = 0;
canvas.addEventListener("pointerdown", (e) => {
  if (!active || paused || finished) return;
  dragging = true;
  dragX = e.clientX;
  dragTarget = sim.targetX;
  canvas.setPointerCapture(e.pointerId);
  canvas.focus();
});
canvas.addEventListener("pointermove", (e) => {
  if (dragging && active && !paused)
    sim.targetX = Math.max(
      -5,
      Math.min(5, dragTarget + ((e.clientX - dragX) / canvas.clientWidth) * 18),
    );
});
for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
  canvas.addEventListener(event, () => (dragging = false));
updateMeta();
try {
  battlefield = new Battlefield(canvas);
  new ResizeObserver(() => battlefield?.resize()).observe(canvas);
  setHidden("loading", true);
  battlefield.engine.runRenderLoop(() => {
    const now = performance.now(),
      dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (active && !paused && !finished) {
      const dir =
        (keys.has("d") || keys.has("arrowright") ? 1 : 0) -
        (keys.has("a") || keys.has("arrowleft") ? 1 : 0);
      sim.targetX = Math.max(-5, Math.min(5, sim.targetX + dir * dt * 9));
      sim.step(dt);
      if (sim.fired) audio.shot(now / 1000);
      if (sim.status === "won" || sim.status === "lost") finish();
    }
    battlefield!.update(sim, paused || finished ? 0 : dt, active);
    uiTimer += dt;
    if (uiTimer > 0.08) {
      uiTimer = 0;
      if (active) updateHud();
    }
  });
} catch (error) {
  console.error(error);
  $("loading").innerHTML =
    "<h2>3D graphics unavailable.</h2><p>Enable hardware acceleration or try a browser with WebGL2 support.</p>";
  $<HTMLButtonElement>("deploy").disabled = true;
}
