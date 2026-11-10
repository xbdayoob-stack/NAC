import type { Env } from "../config/env.js";

export function renderStatusPage(opts: {
  env: Env;
  orderId: string;
  orderNumber: string;
  shopName: string;
  status: string;
  etaMinutes: number | null;
}): string {
  const clipId = opts.env.APP_CLIP_BUNDLE_ID ?? "";
  const metaClip = clipId
    ? `<meta name="apple-itunes-app" content="app-clip-bundle-id=${clipId}">`
    : "";

  const eta =
    opts.etaMinutes != null ? `${opts.etaMinutes} min` : "—";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${metaClip}
  <title>Order ${opts.orderNumber}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; margin: 0; padding: 1.5rem; background: #f6f3ef; color: #1a1a1a; }
    .card { max-width: 28rem; margin: 0 auto; background: #fff; border-radius: 1rem; padding: 1.5rem; box-shadow: 0 4px 24px rgba(0,0,0,.08); }
    h1 { font-size: 1.5rem; margin: 0 0 .25rem; }
    .shop { color: #666; margin-bottom: 1rem; }
    .status { font-size: 1.25rem; font-weight: 600; text-transform: capitalize; }
    .eta { color: #444; margin-top: .5rem; }
    .pulse.ready { animation: pulse 1s ease-in-out 3; }
    @keyframes pulse { 50% { transform: scale(1.02); } }
  </style>
</head>
<body>
  <div class="card">
    <h1 id="orderNumber">${opts.orderNumber}</h1>
    <p class="shop">${opts.shopName}</p>
    <p class="status" id="status">${opts.status.replace("_", " ")}</p>
    <p class="eta">ETA: <span id="eta">${eta}</span></p>
  </div>
  <script>
    const orderId = ${JSON.stringify(opts.orderId)};
    const statusEl = document.getElementById("status");
    const etaEl = document.getElementById("eta");
    function onReady() {
      document.querySelector(".card")?.classList.add("pulse", "ready");
      try { navigator.vibrate?.([200, 100, 200]); } catch (e) {}
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.1, ctx.currentTime);
        o.start(); o.stop(ctx.currentTime + 0.2);
      } catch (e) {}
    }
    function apply(data) {
      statusEl.textContent = data.status.replace(/_/g, " ");
      etaEl.textContent = data.etaMinutes != null ? data.etaMinutes + " min" : "—";
      if (data.status === "ready") onReady();
    }
    function connect() {
      const es = new EventSource("/v1/orders/" + orderId + "/stream");
      es.addEventListener("status", (ev) => apply(JSON.parse(ev.data)));
      es.onerror = () => {
        es.close();
        setTimeout(poll, 30000);
      };
    }
    function poll() {
      fetch("/v1/orders/" + orderId)
        .then((r) => r.json())
        .then((d) => apply(d))
        .catch(() => {});
      setTimeout(poll, 30000);
    }
    connect();
    poll();
  </script>
</body>
</html>`;
}
