// Price scale for the chart: a few round dollar values that sit inside the plotted range.

/**
 * Returns 2 to 5 round values between `min` and `max` (inclusive), e.g. 2..10 -> [2, 4, 6, 8, 10].
 * @param {number} min
 * @param {number} max
 * @param {number} [target] roughly how many labels to aim for
 * @returns {number[]}
 */
export function niceTicks(min, max, target = 4) {
  if (!(max > min)) return [min];
  const rough = (max - min) / target;
  const pow = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= rough);
  const ticks = [];
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) ticks.push(+v.toFixed(6));
  return ticks;
}

/**
 * Formats tick labels consistently: cents only when the step between labels needs them.
 * @param {number[]} ticks
 * @returns {string[]}
 */
export function tickLabels(ticks) {
  const whole = ticks.every((t) => Number.isInteger(t));
  return ticks.map((t) => '$' + (whole ? t.toLocaleString('en-US') : t.toFixed(2)));
}
