// Turns the pauses in a voiceover into scene start times.
// The script has one paragraph per scene (hook, each card, sign-off). Read with a short breath
// between paragraphs, the longest pauses in the recording are the scene changes.

/** Parses ffmpeg `silencedetect` output into [{start, end, dur}] in seconds. */
export function parseSilences(log) {
  const out = [];
  let start = null;
  for (const line of log.split('\n')) {
    const s = line.match(/silence_start:\s*(-?[\d.]+)/);
    const e = line.match(/silence_end:\s*([\d.]+)\s*\|\s*silence_duration:\s*([\d.]+)/);
    if (s) start = Math.max(0, Number(s[1]));
    if (e && start !== null) {
      out.push({start, end: Number(e[1]), dur: Number(e[2])});
      start = null;
    }
  }
  return out;
}

/**
 * silences: from parseSilences. duration: audio length in seconds. cards: how many card scenes.
 * Returns {cards: [start seconds], end: start of the sign-off, total: video length}.
 * Throws when the recording doesn't have enough clear pauses, so a bad sync is never silent.
 */
export function timingFromSilences(silences, duration, cards, {lead = 0.12, tail = 0.8, minScene = 1.5} = {}) {
  const need = cards + 1; // hook|card 1, card|card ..., last card|sign-off
  // Ignore silence at the very start and end of the file: those are not scene changes.
  const inner = silences.filter((s) => s.start > 0.4 && s.end < duration - 0.3);
  if (inner.length < need) {
    throw new Error(`Found ${inner.length} pauses in the recording but need ${need} (one between each part of the script). Leave a clear breath between parts, or set "timing" by hand in the data file.`);
  }
  const cuts = [...inner].sort((a, b) => b.dur - a.dur).slice(0, need).sort((a, b) => a.start - b.start)
    .map((s) => +(s.end - lead).toFixed(2)); // the scene changes just before the next words start
  const all = [0, ...cuts, duration];
  for (let i = 1; i < all.length; i++) {
    if (all[i] - all[i - 1] < minScene) {
      throw new Error(`Part ${i} of the recording is only ${(all[i] - all[i - 1]).toFixed(1)}s long, so the pauses were probably misread. Set "timing" by hand in the data file.`);
    }
  }
  return {cards: cuts.slice(0, cards), end: cuts[cards], total: +(duration + tail).toFixed(2)};
}
