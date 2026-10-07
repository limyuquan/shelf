/**
 * A fake cursor for recordings, injected into the page: headless Chromium draws
 * none. It glides between targets, shows a ripple on click, and can flash the
 * keys being pressed. Runs in the browser, so it must not reference anything
 * outside the function.
 */
export function installCursor(): void {
  const w = window as unknown as { __cursor?: unknown };
  if (w.__cursor) return;

  const ACCENT = "124, 108, 242";
  const css = `
    #__cursor { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
      width: 26px; height: 26px; will-change: transform; transition: opacity 200ms ease;
      filter: drop-shadow(0 1.5px 2px rgba(0, 0, 0, 0.35)); }
    #__cursor svg { display: block; transform-origin: 5px 3px; transition: transform 110ms ease-out; }
    #__cursor.down svg { transform: scale(0.84); }
    .__ripple { position: fixed; z-index: 2147483646; pointer-events: none; width: 40px; height: 40px;
      margin: -20px 0 0 -20px; border-radius: 9999px; background: rgba(${ACCENT}, 0.28);
      box-shadow: 0 0 0 1.5px rgba(${ACCENT}, 0.75); animation: __ripple 560ms cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes __ripple { from { transform: scale(0.25); opacity: 1; } to { transform: scale(1.45); opacity: 0; } }
    #__keys { position: fixed; left: 50%; bottom: 28px; z-index: 2147483647; pointer-events: none;
      display: flex; gap: 6px; transform: translateX(-50%) translateY(8px); opacity: 0;
      transition: opacity 160ms ease, transform 160ms ease; }
    #__keys.show { opacity: 1; transform: translateX(-50%) translateY(0); }
    #__keys span { min-width: 34px; height: 34px; padding: 0 10px; border-radius: 8px; display: grid;
      place-items: center; font: 600 15px/1 Inter, system-ui, sans-serif; color: #f4f1ea;
      background: rgba(28, 26, 24, 0.92); box-shadow: 0 0 0 1px rgba(255,255,255,.12), 0 6px 20px rgba(0,0,0,.35); }
  `;
  const svg = `<svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg">
    <path d="M5 3 L5 20.5 L9.6 16.4 L12.6 23.2 L15.7 21.9 L12.8 15.2 L19 15.2 Z"
      fill="#0d0d0f" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  // The arrow's tip, relative to the element's top-left corner.
  const TIP = { x: 5, y: 3 };

  let el: HTMLDivElement | null = null;
  let keys: HTMLDivElement | null = null;
  const saved = JSON.parse(sessionStorage.getItem("__cursor") ?? "null") as {
    x: number;
    y: number;
  } | null;
  const pos = saved ?? { x: innerWidth * 0.62, y: innerHeight * 0.58 };

  const place = () => {
    if (el) el.style.transform = `translate(${pos.x - TIP.x}px, ${pos.y - TIP.y}px)`;
    sessionStorage.setItem("__cursor", JSON.stringify(pos));
  };
  const mount = () => {
    if (el || !document.body) return;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    el = document.createElement("div");
    el.id = "__cursor";
    el.innerHTML = svg;
    keys = document.createElement("div");
    keys.id = "__keys";
    document.body.append(el, keys);
    place();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();

  const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

  w.__cursor = {
    position: () => ({ ...pos }),
    set(x: number, y: number) {
      mount();
      pos.x = x;
      pos.y = y;
      place();
    },
    /** Glides to (x, y) along a gentle arc; resolves on arrival. */
    move(x: number, y: number, ms?: number): Promise<void> {
      mount();
      const from = { ...pos };
      const dx = x - from.x;
      const dy = y - from.y;
      const distance = Math.hypot(dx, dy);
      if (distance < 1) return Promise.resolve();
      const duration = ms ?? Math.min(1100, Math.max(420, 300 + distance * 0.55));
      // Bow the path slightly to one side, as a hand would.
      const bow = Math.min(60, distance * 0.12);
      const control = {
        x: from.x + dx / 2 - (dy / distance) * bow,
        y: from.y + dy / 2 + (dx / distance) * bow,
      };
      const start = performance.now();
      return new Promise((resolve) => {
        const frame = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          const e = ease(t);
          const u = 1 - e;
          pos.x = u * u * from.x + 2 * u * e * control.x + e * e * x;
          pos.y = u * u * from.y + 2 * u * e * control.y + e * e * y;
          place();
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
    },
    press() {
      mount();
      el?.classList.add("down");
      const ripple = document.createElement("div");
      ripple.className = "__ripple";
      ripple.style.left = `${pos.x}px`;
      ripple.style.top = `${pos.y}px`;
      document.body.append(ripple);
      setTimeout(() => ripple.remove(), 700);
    },
    release() {
      el?.classList.remove("down");
    },
    /** Shows the keys of a shortcut (e.g. ["⌘", "K"]) for a moment. */
    keys(labels: string[], ms = 1100) {
      mount();
      if (!keys) return;
      keys.innerHTML = labels.map((label) => `<span>${label}</span>`).join("");
      keys.classList.add("show");
      setTimeout(() => keys?.classList.remove("show"), ms);
    },
    /** A tiny invisible change, so a screencast emits a first frame right away. */
    nudge() {
      if (el) el.style.opacity = el.style.opacity === "0.999" ? "1" : "0.999";
    },
  };
}
