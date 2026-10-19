let playerSequence = 0;

/** Track the player in memory; persist only changed, whole playback seconds. */
export function watchYouTubePlayback(frame: HTMLIFrameElement, options: {
  initialSeconds: number;
  saveIntervalMs: number;
  onSave: (seconds: number) => void;
  onEnded?: () => void;
}) {
  const origin = "https://www.youtube.com";
  const playerId = ++playerSequence;
  let savedSecond = Math.floor(Math.max(0, Number.isFinite(options.initialSeconds) ? options.initialSeconds : 0));
  let seconds = savedSecond;
  let observed = false;
  let observedAt = 0;
  let savedAt = Date.now();
  let playerState = -1;
  let playbackRate = 1;
  let seekPending = false;
  let flushNextPosition = false;
  let listening = false;
  let stopped = false;

  const flush = () => {
    const second = Math.floor(seconds);
    if (!observed || second === savedSecond) return;
    options.onSave(second);
    savedSecond = second;
    savedAt = Date.now();
  };
  const subscribeState = () => {
    frame.contentWindow?.postMessage(JSON.stringify({ event: "command", func: "addEventListener", args: ["onStateChange"], id: playerId, channel: "widget" }), origin);
  };
  const subscribe = () => {
    const target = frame.contentWindow;
    if (!target) return;
    // The iframe sends currentTime in infoDelivery after the listening handshake.
    target.postMessage(JSON.stringify({ event: "listening", id: playerId, channel: "widget" }), origin);
    subscribeState();
  };
  const receiveState = (state: number) => {
    if (![-1, 0, 1, 2, 3, 5].includes(state)) return;
    const previous = playerState;
    playerState = state;
    if (state === 2 || state === 0 || (state === 1 && (previous === 3 || seekPending))) {
      flush();
      // State and position may arrive in separate messages, in either order.
      flushNextPosition = true;
      seekPending = false;
    }
    if (state === 0 && previous !== 0) options.onEnded?.();
  };
  const onMessage = (event: MessageEvent) => {
    if (event.origin !== origin || event.source !== frame.contentWindow) return;
    let data;
    try { data = typeof event.data === "string" ? JSON.parse(event.data) : event.data; }
    catch { return; }
    if (!data || typeof data !== "object") return;
    if (data.event === "onReady") { listening = true; subscribeState(); return; }
    if (data.event === "onStateChange" && typeof data.info === "number") { receiveState(data.info); return; }
    if (data.event !== "infoDelivery" && data.event !== "initialDelivery") return;
    const info = data.info;
    if (!info || typeof info !== "object") return;
    listening = true;
    if (typeof info.playbackRate === "number" && Number.isFinite(info.playbackRate) && info.playbackRate > 0) playbackRate = info.playbackRate;
    const nextState = typeof info.playerState === "number" ? info.playerState : playerState;
    if (typeof info.currentTime === "number" && Number.isFinite(info.currentTime) && info.currentTime >= 0 && (observed || [0, 1, 2, 3].includes(nextState))) {
      const now = Date.now();
      const delta = info.currentTime - seconds;
      const expected = playerState === 1 || playerState === 3 ? Math.max(0, now - observedAt) / 1000 * playbackRate : 0;
      if (observed && (delta < -0.5 || delta > expected + 1.25)) seekPending = true;
      seconds = info.currentTime;
      observedAt = now;
      observed = true;
      if (flushNextPosition || nextState === 2 || nextState === 0 || (seekPending && nextState !== 3)) {
        flush();
        flushNextPosition = false;
        if (nextState !== 3) seekPending = false;
      }
    }
    if (typeof info.playerState === "number" && info.playerState !== playerState) receiveState(info.playerState);
  };
  const onHidden = () => { if (document.visibilityState === "hidden") flush(); };
  const timer = window.setInterval(() => {
    if (!listening) subscribe();
    if (Date.now() - savedAt >= options.saveIntervalMs) flush();
  }, 5000);
  frame.addEventListener("load", subscribe);
  window.addEventListener("message", onMessage);
  window.addEventListener("pagehide", flush);
  window.addEventListener("beforeunload", flush);
  document.addEventListener("visibilitychange", onHidden);
  subscribe();
  return {
    flush,
    stop() {
      if (stopped) return;
      stopped = true;
      flush();
      window.clearInterval(timer);
      frame.removeEventListener("load", subscribe);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHidden);
    }
  };
}
