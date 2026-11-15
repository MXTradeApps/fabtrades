import React from 'react';
import {Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import {C, FONT, Mover} from './types';
import {niceTicks, tickLabels} from '../ticks.mjs';

const src = (img: string) => (/^https?:/.test(img) ? img : staticFile(img));

/** Card art with a pop-in, a slow float and a light sweep. Shows a plain slot when there is no image. */
export const CardArt: React.FC<{m: Mover; width: number; delay?: number; from?: number}> = ({m, width, delay = 0, from = 1.9}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const pop = spring({frame: frame - delay, fps, config: {damping: 13, mass: 0.7}});
  const scale = interpolate(pop, [0, 1], [from, 1]);
  const float = Math.sin(frame / 22) * 8;
  const tilt = interpolate(pop, [0, 1], [-14, 0]) + Math.sin(frame / 30) * 1.6;
  const sweep = interpolate(frame - delay, [8, 40], [-60, 160], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const height = width * 1.396;
  return (
    <div style={{width, height, perspective: 1400, opacity: Math.min(1, pop * 2)}}>
      <div style={{
        width, height, borderRadius: width * 0.055, overflow: 'hidden', position: 'relative', background: C.panel,
        border: `2px solid ${C.line}`, boxShadow: '0 40px 90px rgba(0,0,0,.6)',
        transform: `translateY(${float}px) scale(${scale}) rotateY(${tilt}deg) rotateZ(${tilt * 0.15}deg)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5E564E', fontSize: 30, fontFamily: FONT,
      }}>
        {m.img ? <Img src={src(m.img)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} /> : 'card art'}
        <div style={{position: 'absolute', inset: 0, background: `linear-gradient(105deg, transparent ${sweep - 18}%, rgba(255,255,255,.22) ${sweep}%, transparent ${sweep + 18}%)`}} />
      </div>
    </div>
  );
};

/** Number that counts from `from` to `to`, starting at `delay`. */
export const useCount = (from: number, to: number, delay: number, dur = 28) => {
  const frame = useCurrentFrame();
  return interpolate(frame - delay, [0, dur], [from, to], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
};

/** Spring from 0 to 1 starting at `delay`. */
export const usePop = (delay: number, damping = 12) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - delay, fps, config: {damping, mass: 0.6}});
};

/**
 * 30 day price line that draws itself, with a price scale on the left, this week shaded
 * and a live price dot.
 */
export const Chart: React.FC<{series: number[]; color: string; delay: number; w?: number; h?: number}> = ({series, color, delay, w = 940, h = 360}) => {
  const frame = useCurrentFrame();
  const G = 118; // gutter for the price labels
  const s = series.filter((v) => Number.isFinite(v));
  const lo = Math.min(...s), hi = Math.max(...s), pad = (hi - lo) * 0.14 || 1;
  const x = (i: number) => G + (i / (s.length - 1)) * (w - G);
  const y = (v: number) => h - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * h;
  const ticks = niceTicks(lo - pad, hi + pad).filter((v) => y(v) > 14 && y(v) < h - 14);
  const labels = tickLabels(ticks);
  const t = interpolate(frame - delay, [0, 50], [0, s.length - 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const i0 = Math.floor(t), f = t - i0;
  const head = {x: x(t), y: y(s[i0] + ((s[Math.min(i0 + 1, s.length - 1)] - s[i0]) * f))};
  const pts = [...s.slice(0, i0 + 1).map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`), `${head.x.toFixed(1)},${head.y.toFixed(1)}`].join(' ');
  const wk = Math.max(0, s.length - 8);
  const shade = interpolate(frame - delay, [30, 50], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const scale = interpolate(frame - delay, [-8, 8], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const pulse = 1 + 0.25 * Math.sin(frame / 4);
  return (
    <svg width={w} height={h + 56} viewBox={`0 0 ${w} ${h + 56}`} style={{overflow: 'visible'}}>
      {ticks.map((v, i) => (
        <g key={v} opacity={scale}>
          <line x1={G} y1={y(v)} x2={w} y2={y(v)} stroke={C.line} strokeWidth={2} strokeDasharray="6 10" />
          <text x={G - 16} y={y(v) + 10} textAnchor="end" fill={C.dim} fontSize={28} fontWeight={600} fontFamily={FONT}>{labels[i]}</text>
        </g>
      ))}
      <rect x={x(wk)} y={0} width={w - x(wk)} height={h} fill={color} opacity={0.12 * shade} />
      <polygon points={`${G},${h} ${pts} ${head.x.toFixed(1)},${h}`} fill={color} opacity={0.16} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth={8} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={head.x} cy={head.y} r={22 * pulse} fill={color} opacity={0.25} />
      <circle cx={head.x} cy={head.y} r={13} fill={color} />
      <line x1={G} y1={h} x2={w} y2={h} stroke={C.line} strokeWidth={2} />
      <text x={G} y={h + 44} fill={C.faint} fontSize={28} fontFamily={FONT}>30 days ago</text>
      <text x={x(wk) + 10} y={h + 44} fill={C.dim} fontSize={28} fontFamily={FONT} opacity={shade}>this week</text>
    </svg>
  );
};

/**
 * Title bar that stays put for the whole video. `pos` is the active slide as a fraction
 * (1.5 is halfway between the second and third slide), so the marker glides between dots.
 */
export const Header: React.FC<{week: string; count?: number; pos?: number; dots?: number}> = ({week, count = 0, pos = 0, dots = 1}) => {
  const STEP = 26, DOT = 14, PILL = 36;
  const frac = pos - Math.floor(pos);
  const stretch = Math.sin(Math.PI * frac); // 0 at rest, 1 mid-move
  return (
    <div style={{position: 'absolute', top: 70, left: 70, right: 70, display: 'flex', alignItems: 'center', gap: 22, fontSize: 30, fontWeight: 600, color: C.dim, fontFamily: FONT}}>
      <Img src={staticFile('icon.png')} style={{width: 64, height: 64, borderRadius: 14}} />
      <div style={{flex: 1, whiteSpace: 'nowrap'}}><b style={{color: C.text}}>FAB Market Movers</b> · {week}</div>
      {count ? (
        <div style={{position: 'relative', width: (count - 1) * STEP + PILL, height: DOT, opacity: dots}}>
          {Array.from({length: count}).map((_, i) => (
            <div key={i} style={{position: 'absolute', left: i * STEP + (PILL - DOT) / 2, width: DOT, height: DOT, borderRadius: DOT / 2, background: C.line}} />
          ))}
          <div style={{
            position: 'absolute', left: pos * STEP - stretch * 6, top: -stretch * 3, width: PILL + stretch * 12, height: DOT + stretch * 6,
            borderRadius: DOT, background: C.accent, boxShadow: `0 0 ${10 + stretch * 26}px ${C.accent}`,
          }} />
        </div>
      ) : null}
    </div>
  );
};

/** Soft moving glow behind everything so the frame is never static. */
export const Backdrop: React.FC<{color: string}> = ({color}) => {
  const frame = useCurrentFrame();
  const a = frame / 60;
  return (
    <div style={{position: 'absolute', inset: 0, background: C.bg, overflow: 'hidden'}}>
      <div style={{position: 'absolute', width: 1100, height: 1100, borderRadius: '50%', left: 200 + Math.cos(a) * 160, top: 60 + Math.sin(a) * 120, opacity: 0.2, background: `radial-gradient(circle, ${color}, transparent 62%)`}} />
      <div style={{position: 'absolute', width: 900, height: 900, borderRadius: '50%', left: -300 - Math.cos(a) * 100, top: 1000 + Math.sin(a * 0.7) * 140, opacity: 0.13, background: `radial-gradient(circle, ${C.accent}, transparent 62%)`}} />
    </div>
  );
};
