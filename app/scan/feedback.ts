// Vibration (Android only; iOS ignores it) and a short beep, so staff don't
// have to read the screen to know the result.

let audio: AudioContext | null = null;

/** Browsers only allow audio after a user gesture; call this from one. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") void audio.resume();
  } catch {
    audio = null;
  }
}

function beep(ok: boolean) {
  if (!audio || audio.state !== "running") return;
  const tones = ok ? [{ f: 880, at: 0, d: 0.15 }] : [{ f: 220, at: 0, d: 0.18 }, { f: 220, at: 0.26, d: 0.18 }];
  for (const { f, at, d } of tones) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "square";
    osc.frequency.value = f;
    gain.gain.value = 0.06;
    osc.connect(gain).connect(audio.destination);
    const t = audio.currentTime + at;
    osc.start(t);
    osc.stop(t + d);
  }
}

export function signal(ok: boolean) {
  navigator.vibrate?.(ok ? 80 : [200, 100, 200]);
  beep(ok);
}
