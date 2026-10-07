// shelf landing page: nav, copy buttons, videos that play in view, typed
// terminals, and the dithered pixel scenes behind the product windows.
// No dependencies. Everything degrades to static content without JS.

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const prefersReduced = () => reducedMotion.matches;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ---------- Live region for "Copied" and similar announcements ---------- */

const live = document.createElement("p");
live.className = "sr-only";
live.setAttribute("aria-live", "polite");
document.body.append(live);
const announce = (text) => {
  live.textContent = "";
  requestAnimationFrame(() => {
    live.textContent = text;
  });
};

/* ---------- Nav ---------- */

function setupNav() {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (!nav || !toggle) return;

  const onScroll = () => nav.toggleAttribute("data-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const setOpen = (open) => {
    nav.toggleAttribute("data-open", open);
    toggle.setAttribute("aria-expanded", String(open));
  };
  toggle.addEventListener("click", () => setOpen(!nav.hasAttribute("data-open")));
  for (const link of nav.querySelectorAll(".nav-links a")) {
    link.addEventListener("click", () => setOpen(false));
  }
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.hasAttribute("data-open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 721px)").addEventListener("change", () => setOpen(false));
}

/* ---------- Copy buttons ---------- */

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function setupCopy() {
  for (const button of document.querySelectorAll("[data-copy]")) {
    let timer = 0;
    button.addEventListener("click", async () => {
      await copyText(button.dataset.copy ?? "");
      button.setAttribute("data-copied", "");
      announce("Copied to clipboard");
      clearTimeout(timer);
      timer = setTimeout(() => button.removeAttribute("data-copied"), 1600);
    });
  }
}

/* ---------- Videos: play while in view, never under reduced motion ---------- */

const ICON_PAUSE =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z"/></svg>';
const ICON_PLAY =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4.5 2.5v11l9-5.5z"/></svg>';

function setupVideos() {
  const boxes = [...document.querySelectorAll("[data-video]")];
  const state = new Map();

  for (const box of boxes) {
    const video = box.querySelector("video");
    if (!video) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "video-toggle";
    box.append(button);

    const entry = { video, userPaused: prefersReduced(), visible: false };
    state.set(box, entry);

    const render = () => {
      const paused = video.paused;
      button.innerHTML = paused ? ICON_PLAY : ICON_PAUSE;
      button.setAttribute("aria-label", paused ? "Play video" : "Pause video");
      button.toggleAttribute("data-paused", paused);
    };
    render();
    video.addEventListener("play", render);
    video.addEventListener("pause", render);
    button.addEventListener("click", () => {
      if (video.paused) {
        entry.userPaused = false;
        video.play().catch(() => {});
      } else {
        entry.userPaused = true;
        video.pause();
      }
    });
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const entry = state.get(target);
        if (!entry) continue;
        entry.visible = isIntersecting;
        if (isIntersecting && !entry.userPaused) entry.video.play().catch(() => {});
        else if (!isIntersecting) entry.video.pause();
      }
    },
    { threshold: 0.1 },
  );
  for (const box of state.keys()) observer.observe(box);

  reducedMotion.addEventListener("change", () => {
    for (const entry of state.values()) {
      entry.userPaused = prefersReduced();
      if (entry.userPaused) entry.video.pause();
      else if (entry.visible) entry.video.play().catch(() => {});
    }
  });
}

/* ---------- Terminals: type commands, reveal output, cycle scenes ---------- */

function setupTerminal(term) {
  const tabs = [...term.querySelectorAll('[role="tab"]')];
  const scenes = [...term.querySelectorAll(".term-scene")];
  if (scenes.length === 0) return;
  let current = 0;
  let run = 0;
  let auto = true;
  let visible = false;
  let started = false;

  const typedOf = (line) => line.querySelector(".typed");
  // A fresh prompt after the output, as in a real terminal.
  if (tabs.length > 0) {
    for (const scene of scenes) {
      const prompt = document.createElement("span");
      prompt.className = "l";
      prompt.innerHTML = '<span class="t-p">$</span> <span class="cursor"></span>';
      scene.append(prompt);
    }
  }
  for (const scene of scenes) {
    for (const typed of scene.querySelectorAll(".typed")) typed.dataset.text = typed.textContent;
  }

  const showAll = (scene) => {
    for (const line of scene.querySelectorAll(".l")) {
      line.classList.remove("is-hidden");
      const typed = typedOf(line);
      if (typed) {
        typed.textContent = typed.dataset.text;
        typed.classList.remove("typing");
      }
    }
  };

  const hideAll = (scene) => {
    for (const line of scene.querySelectorAll(".l")) line.classList.add("is-hidden");
  };

  async function play(index, id) {
    const scene = scenes[index];
    hideAll(scene);
    await wait(380);
    for (const line of scene.querySelectorAll(".l")) {
      if (id !== run) return;
      const typed = typedOf(line);
      if (typed) {
        const text = typed.dataset.text;
        typed.textContent = "";
        typed.classList.add("typing");
        line.classList.remove("is-hidden");
        await wait(260);
        for (let i = 1; i <= text.length; i++) {
          if (id !== run) return;
          typed.textContent = text.slice(0, i);
          await wait(22 + Math.random() * 38);
        }
        await wait(420);
        typed.classList.remove("typing");
      } else {
        line.classList.remove("is-hidden");
        await wait(line.textContent.trim() ? 70 : 40);
      }
    }
    if (id !== run || !auto || scenes.length < 2) return;
    await wait(3600);
    if (id === run && auto && visible) select((index + 1) % scenes.length, { animate: true });
  }

  function select(index, { animate = false, focus = false } = {}) {
    run++;
    const old = scenes[current];
    if (old && old !== scenes[index]) showAll(old);
    current = index;
    tabs.forEach((tab, i) => {
      tab.setAttribute("aria-selected", String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
    });
    scenes.forEach((scene, i) => {
      scene.classList.toggle("is-active", i === index);
      if (tabs.length > 0) scene.hidden = i !== index;
    });
    if (focus) tabs[index]?.focus();
    if (animate && !prefersReduced()) play(index, run);
    else showAll(scenes[index]);
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => {
      auto = false;
      select(i, { animate: true });
    });
    tab.addEventListener("keydown", (event) => {
      const last = tabs.length - 1;
      const next = {
        ArrowRight: i === last ? 0 : i + 1,
        ArrowLeft: i === 0 ? last : i - 1,
        Home: 0,
        End: last,
      }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      auto = false;
      select(next, { animate: true, focus: true });
    });
  });

  select(0);
  if (prefersReduced()) return;
  hideAll(scenes[0]);

  const observer = new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !started) {
        started = true;
        select(current, { animate: true });
      } else if (!visible && started) {
        // Leave the scene complete while off screen; resume the cycle on return.
        select(current);
        started = false;
      }
    },
    { threshold: 0.35 },
  );
  observer.observe(term);

  reducedMotion.addEventListener("change", () => {
    if (prefersReduced()) {
      auto = false;
      select(current);
    }
  });
}

/* ---------- Reveal sections as they scroll in ---------- */

function setupReveal() {
  if (prefersReduced()) return;
  const selector = [
    ".why .wrap",
    ".split-head",
    ".center-head",
    ".stage-term",
    ".facts",
    ".feature",
    ".bento > .card",
    ".harnesses",
    ".local",
    ".diagram",
    ".steps",
    ".install-card",
  ].join(",");
  const fold = window.innerHeight;
  const targets = [...document.querySelectorAll(selector)].filter(
    (el) => el.getBoundingClientRect().top > fold,
  );
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute("data-shown", "");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  for (const el of targets) {
    if (el.matches(".bento > .card:nth-child(even), .install-card + .install-card")) {
      el.style.transitionDelay = "90ms";
    }
    el.setAttribute("data-reveal", "");
    observer.observe(el);
  }
}

/* ---------- Dithered pixel scenes ---------- */

// 8×8 Bayer matrix: ordered dithering, the look of old pixel art.
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26, 12, 44, 4, 36, 14, 46, 6, 38, 60, 28,
  52, 20, 62, 30, 54, 22, 3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25, 15, 47, 7,
  39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21,
];

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const hex = (name) => {
    const value = style.getPropertyValue(name).trim().replace("#", "");
    const full =
      value.length === 3
        ? value
            .split("")
            .map((c) => c + c)
            .join("")
        : value;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  return {
    bg: hex("--bg"),
    wood: hex("--wood"),
    woodDark: hex("--wood-dark"),
    woodBack: hex("--wood-back"),
    violet: hex("--book-violet"),
    teal: hex("--book-teal"),
    amber: hex("--book-amber"),
    coral: hex("--book-coral"),
    paper: hex("--paper"),
  };
}

const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash = (x, y) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** Splits each gradient segment into smaller steps, so neighbouring dither colours stay close. */
function refine(stops, steps = 3) {
  const out = [stops[0]];
  for (let i = 1; i < stops.length; i++) {
    const [a, ca] = stops[i - 1];
    const [b, cb] = stops[i];
    for (let k = 1; k <= steps; k++) out.push([a + ((b - a) * k) / steps, mix(ca, cb, k / steps)]);
  }
  return out;
}

/** Picks one of two neighbouring gradient colours per pixel, by the Bayer threshold. */
function dither(stops, t, threshold) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [at, color] = stops[i];
    if (t <= at) {
      const [prevAt, prev] = stops[i - 1];
      const u = (t - prevAt) / (at - prevAt || 1);
      return u > threshold ? color : prev;
    }
  }
  return stops[stops.length - 1][1];
}

/** A ridge line: y (0–1) for x (0–1), from a few seeded sine waves. */
function ridge(base, amp, seed) {
  const r = rng(seed);
  const waves = [
    [2 + r() * 1.5, r() * 6.28, 0.55],
    [5 + r() * 3, r() * 6.28, 0.28],
    [13 + r() * 6, r() * 6.28, 0.12],
    [34 + r() * 10, r() * 6.28, 0.05],
  ];
  return (x) => {
    let v = 0;
    for (const [f, p, w] of waves) v += Math.sin(x * f + p) * w;
    return base - amp * v;
  };
}

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Scene recipes. Each returns sky stops, an optional sun or moon, ridges (far
 * to near), optional water and banks. Colours are mixes of the brand tokens.
 */
const SCENES = {
  dusk: (P) => landscape(P, { horizon: 0.62, sunX: 0.055, water: true, seed: 11 }),
  "dusk-low": (P) => landscape(P, { horizon: 0.7, sunX: 0.68, water: true, seed: 5 }),
  violet: (P) =>
    simple(P, {
      sky: [
        [0, P.bg],
        [0.3, mix(P.bg, P.violet, 0.18)],
        [0.62, mix(P.bg, P.violet, 0.36)],
        [0.86, mix(P.bg, mix(P.violet, P.coral, 0.4), 0.52)],
      ],
      moon: [0.93, 0.13],
      ridges: [
        [0.7, 0.06, mix(P.bg, P.violet, 0.22)],
        [0.84, 0.05, mix(P.bg, P.woodBack, 0.7)],
      ],
      stars: 0.5,
      seed: 3,
    }),
  amber: (P) =>
    simple(P, {
      sky: [
        [0, mix(P.bg, P.woodBack, 0.6)],
        [0.35, mix(P.bg, P.wood, 0.36)],
        [0.68, mix(P.bg, P.amber, 0.5)],
        [0.82, mix(P.bg, mix(P.amber, P.paper, 0.3), 0.66)],
      ],
      sun: [0.78, 0.74, 0.07],
      ridges: [
        [0.76, 0.05, mix(P.bg, P.coral, 0.32)],
        [0.86, 0.04, mix(P.bg, P.woodBack, 0.85)],
      ],
      stars: 0,
      seed: 8,
    }),
  teal: (P) =>
    simple(P, {
      sky: [
        [0, P.bg],
        [0.34, mix(P.bg, P.teal, 0.16)],
        [0.66, mix(P.bg, P.teal, 0.32)],
        [0.9, mix(P.bg, mix(P.teal, P.amber, 0.35), 0.46)],
      ],
      moon: [0.1, 0.16],
      ridges: [
        [0.72, 0.06, mix(P.bg, P.teal, 0.2)],
        [0.85, 0.04, mix(P.bg, P.woodBack, 0.6)],
      ],
      stars: 0.7,
      seed: 21,
    }),
  coral: (P) =>
    simple(P, {
      sky: [
        [0, mix(P.bg, P.violet, 0.1)],
        [0.36, mix(P.bg, P.coral, 0.24)],
        [0.66, mix(P.bg, P.coral, 0.42)],
        [0.88, mix(P.bg, mix(P.coral, P.amber, 0.5), 0.58)],
      ],
      sun: [0.26, 0.8, 0.06],
      ridges: [
        [0.74, 0.06, mix(P.bg, P.violet, 0.28)],
        [0.86, 0.05, mix(P.bg, P.woodBack, 0.8)],
      ],
      stars: 0.25,
      seed: 34,
    }),
  night: (P) =>
    simple(P, {
      sky: [
        [0, P.bg],
        [0.4, mix(P.bg, P.violet, 0.16)],
        [0.75, mix(P.bg, mix(P.violet, P.teal, 0.5), 0.3)],
        [0.95, mix(P.bg, P.teal, 0.36)],
      ],
      moon: [0.9, 0.1],
      ridges: [
        [0.74, 0.07, mix(P.bg, P.violet, 0.2)],
        [0.87, 0.05, mix(P.bg, P.woodBack, 0.5)],
      ],
      stars: 1,
      seed: 55,
    }),
};

function landscape(P, { horizon: h, sunX, water, seed }) {
  return {
    sky: [
      [0, P.bg],
      [h * 0.3, mix(P.bg, P.violet, 0.14)],
      [h * 0.58, mix(P.bg, P.violet, 0.3)],
      [h * 0.8, mix(P.bg, mix(P.violet, P.coral, 0.55), 0.46)],
      [h * 0.94, mix(P.bg, P.coral, 0.58)],
      [h, mix(P.bg, mix(P.coral, P.amber, 0.65), 0.74)],
    ],
    sun: [sunX, h - 0.015, 0.06],
    glow: mix(P.bg, P.amber, 0.82),
    sunColor: mix(P.amber, P.paper, 0.5),
    stars: 0.8,
    starLimit: h * 0.55,
    ridges: [
      {
        line: ridge(h - 0.035, 0.05, seed),
        top: mix(P.bg, P.coral, 0.42),
        fill: mix(P.bg, P.violet, 0.3),
        base: mix(P.bg, P.violet, 0.2),
      },
      {
        line: ridge(h - 0.005, 0.03, seed + 1),
        top: mix(P.bg, P.coral, 0.3),
        fill: mix(P.bg, P.woodBack, 0.85),
        base: mix(P.bg, P.woodBack, 0.7),
      },
    ],
    water: water ? h + 0.025 : null,
    banks: [
      { from: 0, to: 0.46, line: ridge(0, 0.012, seed + 2) },
      { from: 1, to: 0.6, line: ridge(0, 0.012, seed + 3) },
    ],
    bankColors: [mix(P.bg, P.teal, 0.26), mix(P.bg, P.teal, 0.12), P.bg],
    bankBase: h + 0.04,
    P,
  };
}

function simple(P, { sky, sun, moon, ridges, stars, seed }) {
  return {
    sky,
    sun: sun ?? (moon ? [moon[0], moon[1], 0.045] : null),
    glow: sun ? mix(P.bg, P.amber, 0.78) : mix(P.bg, P.paper, 0.22),
    sunColor: sun ? mix(P.amber, P.paper, 0.45) : mix(P.paper, P.bg, 0.08),
    stars,
    starLimit: 0.55,
    ridges: ridges.map(([base, amp, color], i) => ({
      line: ridge(base, amp, seed + i),
      top: mix(color, P.paper, 0.1),
      fill: color,
      base: mix(color, P.bg, 0.4),
    })),
    water: null,
    banks: [],
    P,
  };
}

function render(canvas, spec, W, H) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const image = ctx.createImageData(W, H);
  const data = image.data;
  const { P } = spec;

  // Ridge heights per column, in pixels.
  const ridgeY = spec.ridges.map((r) => {
    const ys = new Float32Array(W);
    for (let x = 0; x < W; x++) ys[x] = r.line(x / W) * H;
    return ys;
  });
  const bankY = new Float32Array(W).fill(Number.POSITIVE_INFINITY);
  for (const bank of spec.banks) {
    for (let x = 0; x < W; x++) {
      const fx = x / W;
      const d = smooth(bank.to, bank.from, fx);
      if (d <= 0) continue;
      const y = (spec.bankBase + (1 - d) * 0.45 + bank.line(fx)) * H;
      bankY[x] = Math.min(bankY[x], y);
    }
  }
  const starRand = rng(97);
  const stars = new Set();
  const starCount = Math.round(((W * H) / 1400) * spec.stars);
  for (let i = 0; i < starCount; i++) {
    const x = Math.floor(starRand() * W);
    const y = Math.floor(starRand() ** 1.6 * spec.starLimit * H);
    stars.add(y * W + x);
  }

  const sun = spec.sun;
  const sunX = sun ? sun[0] * W : 0;
  const sunY = sun ? sun[1] * H : 0;
  const sunR = sun ? sun[2] * H : 0;
  const waterY = spec.water ? spec.water * H : Number.POSITIVE_INFINITY;

  const skyStops = refine(spec.sky);
  const sky = (y, threshold) => dither(skyStops, y / H, threshold);
  const skyAt = (x, y, threshold) => {
    let c = sky(y, threshold);
    if (sun) {
      const d = Math.hypot(x - sunX, y - sunY);
      if (d < sunR) return spec.sunColor;
      const glow = 1 - (d - sunR) / (sunR * 5);
      if (glow > 0 && glow * glow * 0.9 > threshold) c = mix(c, spec.glow, 0.5);
    }
    return c;
  };
  const hillAt = (x, y, threshold) => {
    for (let i = ridgeY.length - 1; i >= 0; i--) {
      const top = ridgeY[i][x];
      if (y >= top) {
        const r = spec.ridges[i];
        if (y - top < 1) return r.top;
        const t = Math.min(1, (y - top) / (H * 0.18));
        return t > threshold ? r.base : r.fill;
      }
    }
    return null;
  };

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const threshold = (BAYER[(y & 7) * 8 + (x & 7)] + 0.5) / 64;
      let c;
      if (y >= bankY[x]) {
        const t = Math.min(1, (y - bankY[x]) / (H * 0.25));
        c =
          y - bankY[x] < 1
            ? mix(spec.bankColors[0], P.paper, 0.08)
            : dither(
                [
                  [0, spec.bankColors[0]],
                  [0.5, spec.bankColors[1]],
                  [1, spec.bankColors[2]],
                ],
                t,
                threshold,
              );
      } else if (y >= waterY) {
        // Reflection: mirror the scene above the waterline, darker, with ripples.
        const my = waterY - (y - waterY) * 1.25;
        let m = hillAt(x, my, threshold) ?? skyAt(x, Math.max(0, my), threshold);
        m = mix(P.bg, m, 0.62);
        const glint =
          sun &&
          Math.abs(x - sunX) < sunR * (0.9 + (y - waterY) / (H * 0.12)) &&
          hash(x >> 1, y) > 0.7;
        if (glint && (y & 1) === 0) m = mix(m, spec.sunColor, 0.3);
        else if (hash(x >> 3, y) > 0.86) m = mix(m, P.paper, 0.06);
        c = m;
      } else {
        c = hillAt(x, y, threshold);
        if (!c) {
          c = skyAt(x, y, threshold);
          if (stars.has(y * W + x)) c = mix(c, P.paper, 0.35 + hash(x, y) * 0.5);
        }
      }
      const o = (y * W + x) * 4;
      data[o] = c[0];
      data[o + 1] = c[1];
      data[o + 2] = c[2];
      data[o + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
}

function setupScenes() {
  const canvases = [...document.querySelectorAll("canvas[data-scene]")];
  if (canvases.length === 0) return;
  const palette = readPalette();
  const sizes = new WeakMap();

  const paint = (canvas) => {
    const recipe = SCENES[canvas.dataset.scene ?? ""];
    const box = canvas.parentElement;
    if (!recipe || !box) return;
    const { width, height } = box.getBoundingClientRect();
    if (width < 2 || height < 2) return;
    const px = width < 640 ? 3 : 4;
    const W = Math.ceil(width / px);
    const H = Math.ceil(height / px);
    const key = `${W}x${H}`;
    if (sizes.get(canvas) === key) return;
    sizes.set(canvas, key);
    canvas.width = W;
    canvas.height = H;
    // Exact multiples of the pixel size keep every pixel square and crisp.
    canvas.style.width = `${W * px}px`;
    canvas.style.height = `${H * px}px`;
    render(canvas, recipe(palette), W, H);
    canvas.setAttribute("data-ready", "");
  };

  let frame = 0;
  const queue = new Set();
  const flush = () => {
    frame = 0;
    for (const canvas of queue) paint(canvas);
    queue.clear();
  };
  const observer = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const canvas = entry.target.querySelector(":scope > canvas[data-scene]");
      if (canvas) queue.add(canvas);
    }
    if (!frame) frame = requestAnimationFrame(flush);
  });
  for (const canvas of canvases) {
    if (canvas.parentElement) observer.observe(canvas.parentElement);
  }
}

/* ---------- Start ---------- */

setupNav();
setupCopy();
setupScenes();
setupVideos();
for (const term of document.querySelectorAll("[data-term]")) setupTerminal(term);
setupReveal();
