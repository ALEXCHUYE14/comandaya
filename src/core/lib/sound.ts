/**
 * Alerta sonora sintetizada con Web Audio (sin archivos externos).
 * Los navegadores exigen un gesto del usuario antes de reproducir audio:
 * llama a unlockAudio() en el primer toque de la pantalla.
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx ??= new AC();
  return ctx;
}

export function unlockAudio() {
  const c = getCtx();
  if (c && c.state === "suspended") void c.resume();
  return c?.state === "running";
}

export function isAudioReady() {
  return ctx?.state === "running";
}

/** Campanita de comanda: dos tonos ascendentes, fuerte y corta. */
export function playNewOrderChime() {
  const c = getCtx();
  if (!c) return;
  const now = c.currentTime;
  [[880, 0], [1318.5, 0.16], [1760, 0.32]].forEach(([freq, delay]) => {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = freq!;
    gain.gain.setValueAtTime(0.0001, now + delay!);
    gain.gain.exponentialRampToValueAtTime(0.55, now + delay! + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + delay! + 0.42);
    osc.connect(gain).connect(c.destination);
    osc.start(now + delay!);
    osc.stop(now + delay! + 0.45);
  });
  if ("vibrate" in navigator) navigator.vibrate?.([120, 60, 120]);
}
