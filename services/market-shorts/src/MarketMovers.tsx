import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, interpolateColors, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, CardArt, Chart, Header, useCount, usePop} from './parts';
import {C, FONT, Mover, Week, layout, pct, round$, usd} from './types';

const color = (m: Mover) => (m.new >= m.old ? C.up : C.down);
const signed = (n: number) => (n > 0 ? '+' : '') + Math.round(n) + '%';

/**
 * One slide's content. Only this fades and slides between slides; the title bar, date,
 * slide dots and background glow live outside it and stay on screen.
 */
const Scene: React.FC<{dur: number; fadeIn?: boolean; fadeOut?: boolean; children: React.ReactNode}> = ({dur, fadeIn = true, fadeOut = true, children}) => {
  const frame = useCurrentFrame();
  const inn = fadeIn ? interpolate(frame, [0, 10], [0, 1], {extrapolateRight: 'clamp'}) : 1;
  const out = fadeOut ? interpolate(frame, [dur - 7, dur], [1, 0], {extrapolateLeft: 'clamp'}) : 1;
  return <AbsoluteFill style={{opacity: Math.min(inn, out), transform: `translateY(${(1 - inn) * 70 - (1 - out) * 30}px)`, fontFamily: FONT, color: C.text}}>{children}</AbsoluteFill>;
};

/**
 * Opening card and thumbnail: Flesh and Blood logo, FAB Trades logo top right, card art,
 * and your own words in big outlined type over the card.
 */
const Thumbnail: React.FC<{w: Week; dur: number}> = ({w, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = w.thumbnail!;
  const m = w.cards[Math.min(t.card ?? 0, w.cards.length - 1)];
  const hi = t.highlight ?? t.lines.length - 1;
  const logoIn = spring({frame: frame - 2, fps, config: {damping: 14, mass: 0.6}});
  const shake = frame > 4 && frame < 14 ? Math.sin(frame * 2.4) * (14 - frame) * 0.8 : 0;
  return (
    <Scene dur={dur} fadeIn={false}>
      <div style={{position: 'absolute', inset: 0, transform: `translate(${shake}px, ${shake * 0.6}px)`}}>
        <div style={{position: 'absolute', top: 45, left: 215, width: 650, height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: logoIn, transform: `translateY(${(1 - logoIn) * -40}px)`}}>
          {w.fabLogo ? (
            <Img src={staticFile(w.fabLogo)} style={{width: '100%', height: '100%', objectFit: 'contain', filter: 'drop-shadow(0 14px 30px rgba(0,0,0,.6))'}} />
          ) : (
            <div>
              <div style={{fontSize: 74, fontWeight: 900, letterSpacing: 3, lineHeight: 1, whiteSpace: 'nowrap'}}>FLESH AND BLOOD</div>
              <div style={{fontSize: 40, fontWeight: 700, letterSpacing: 14, color: C.accent, marginTop: 14, borderTop: `3px solid ${C.accent}`, paddingTop: 12, display: 'inline-block'}}>MARKET MOVERS</div>
            </div>
          )}
        </div>
        <Img src={staticFile('icon.png')} style={{position: 'absolute', top: 60, right: 50, width: 130, height: 130, borderRadius: 28, boxShadow: '0 16px 40px rgba(0,0,0,.6)', transform: `scale(${logoIn})`}} />
        <div style={{position: 'absolute', top: 380, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
          <CardArt m={m} width={880} from={2.2} />
        </div>
        <div style={{position: 'absolute', top: 380, left: 30, right: 30, height: 1228, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6}}>
          {t.lines.map((line, i) => {
            const pop = spring({frame: frame - 5 - i * 5, fps, config: {damping: 10, mass: 0.6}});
            const size = Math.min(200, 940 / (0.7 * Math.max(line.length, 4))); // keeps the widest line inside the frame
            return (
              <div key={i} style={{
                fontSize: size, fontWeight: 900, fontStyle: 'italic', lineHeight: 1.02, letterSpacing: -2, textTransform: 'uppercase', whiteSpace: 'nowrap',
                color: i === hi ? C.accentText : '#FFFFFF',
                WebkitTextStroke: `${Math.round(size * 0.12)}px #17110D`, paintOrder: 'stroke fill',
                textShadow: '0 14px 0 rgba(0,0,0,.55), 0 26px 50px rgba(0,0,0,.7)',
                opacity: Math.min(1, pop * 3), transform: `scale(${interpolate(pop, [0, 1], [2.2, 1])}) rotate(-3deg)`,
              }}>{line}</div>
            );
          })}
        </div>
      </div>
    </Scene>
  );
};

/** 0 to 3.5s. The number is on screen inside the first half second. */
const Hook: React.FC<{w: Week; dur: number}> = ({w, dur}) => {
  const frame = useCurrentFrame();
  const m = w.cards[0];
  const last = w.cards[w.cards.length - 1];
  const p = pct(m);
  const slam = usePop(3, 9);
  const n = useCount(0, p, 3, 22);
  const line = w.hook?.line ?? `This ${round$(m.old)} card just ${p >= 0 ? 'jumped' : 'dropped'}`;
  const sub = w.hook?.sub ?? (last !== m ? `and ${last.name.replace(/\s*\(.*\)$/, '')} ${pct(last) >= 0 ? 'gained' : 'lost'} ${Math.abs(pct(last))}%` : '');
  const subIn = usePop(48);
  const shake = frame > 3 && frame < 12 ? Math.sin(frame * 2.4) * (12 - frame) : 0;
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.text, transform: `translate(${shake}px, ${shake * 0.6}px)`, opacity: interpolate(frame, [dur - 7, dur], [1, 0], {extrapolateLeft: 'clamp'})}}>
      <div style={{position: 'absolute', top: 210, left: 0, right: 0, display: 'flex', justifyContent: 'center'}}>
        <CardArt m={m} width={600} from={2.6} />
      </div>
      <div style={{position: 'absolute', top: 880, left: 0, right: 0, textAlign: 'center'}}>
        <div style={{fontSize: 64, fontWeight: 800, textShadow: '0 6px 30px #000', opacity: slam}}>{line}</div>
        <div style={{fontSize: 330, fontWeight: 900, lineHeight: 0.95, letterSpacing: -12, color: color(m), textShadow: '0 12px 60px rgba(0,0,0,.85)', transform: `scale(${interpolate(slam, [0, 1], [2.4, 1])})`, opacity: Math.min(1, slam * 3)}}>
          {signed(n)}
        </div>
        <div style={{fontSize: 52, fontWeight: 700, color: C.dim, marginTop: 6, opacity: slam}}>{m.name} · {usd(m.old)} → {usd(m.new)}</div>
      </div>
      {sub ? (
        <div style={{position: 'absolute', top: 1400, left: 70, right: 70, textAlign: 'center', opacity: subIn, transform: `translateY(${(1 - subIn) * 60}px)`}}>
          <span style={{display: 'inline-block', padding: '22px 38px', borderRadius: 28, background: C.panel, border: `2px solid ${C.line}`, fontSize: 46, fontWeight: 700}}>
            {sub.split(/(\d+%)/).map((t, i) => (/\d+%/.test(t) ? <span key={i} style={{color: color(last)}}>{t}</span> : t))}
          </span>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

/** 5s per card: art pops in, percent and price count, the chart draws itself. */
const CardScene: React.FC<{w: Week; i: number; dur: number}> = ({w, i, dur}) => {
  const m = w.cards[i];
  const col = color(m);
  const p = pct(m);
  const tagIn = usePop(2);
  const n = useCount(0, p, 10, 26);
  const price = useCount(m.old, m.new, 14, 34);
  const pctIn = usePop(8, 9);
  const nameIn = usePop(14);
  const whyIn = usePop(70);
  return (
    <Scene dur={dur}>
      <div style={{position: 'absolute', top: 190, left: 70, fontSize: 42, fontWeight: 800, letterSpacing: 3, color: col, opacity: tagIn, transform: `translateX(${(1 - tagIn) * -80}px)`}}>
        {p >= 0 ? '▲' : '▼'} {m.tag}
      </div>
      <div style={{position: 'absolute', top: 275, left: 70}}><CardArt m={m} width={440} delay={2} from={1.5} /></div>
      <div style={{position: 'absolute', top: 285, left: 550, right: 40}}>
        <div style={{fontSize: 158, fontWeight: 900, lineHeight: 1, letterSpacing: -6, color: col, transformOrigin: 'left center', transform: `scale(${interpolate(pctIn, [0, 1], [1.7, 1])})`, opacity: Math.min(1, pctIn * 3)}}>{signed(n)}</div>
        <div style={{fontSize: 96, fontWeight: 800, marginTop: 34, fontVariantNumeric: 'tabular-nums'}}>{usd(price)}</div>
        <div style={{fontSize: 42, color: C.dim, marginTop: 8}}>was {usd(m.old)}<br />a week ago</div>
      </div>
      <div style={{position: 'absolute', top: 925, left: 70, right: 70, opacity: nameIn, transform: `translateY(${(1 - nameIn) * 40}px)`}}>
        <div style={{fontSize: m.name.length > 26 ? 52 : 64, fontWeight: 800, lineHeight: 1.08}}>{m.name}</div>
        <div style={{fontSize: 32, fontWeight: 500, color: C.dim, marginTop: 12}}>{m.printing}</div>
      </div>
      <div style={{position: 'absolute', top: 1130, left: 70}}><Chart series={m.series} color={col} delay={24} h={m.why ? 290 : 360} /></div>
      {m.why ? (
        <div style={{position: 'absolute', top: 1490, left: 70, right: 150, fontSize: 40, fontWeight: 700, padding: '18px 26px', borderRadius: 20, background: C.panel, borderLeft: `8px solid ${col}`, opacity: whyIn, transform: `translateY(${(1 - whyIn) * 30}px)`}}>{m.why}</div>
      ) : null}
    </Scene>
  );
};

const End: React.FC<{w: Week}> = ({w}) => {
  const icon = usePop(2, 9);
  const q = usePop(10);
  const url = usePop(26, 9);
  const cta = w.cta ?? {question: "What's your binder worth today?", url: 'fabtrades.net', foot: 'Free. Web, iPhone and Android.'};
  return (
    <Scene dur={100000} fadeOut={false}>
      <div style={{position: 'absolute', top: 400, left: 70, right: 70, textAlign: 'center'}}>
        <Img src={staticFile('icon.png')} style={{width: 260, height: 260, borderRadius: 56, transform: `scale(${icon})`, boxShadow: '0 30px 80px rgba(0,0,0,.6)'}} />
        <div style={{fontSize: 104, fontWeight: 800, lineHeight: 1.05, marginTop: 70, letterSpacing: -2, opacity: q, transform: `translateY(${(1 - q) * 50}px)`}}>{cta.question}</div>
        <div style={{fontSize: 84, fontWeight: 900, color: C.accent, marginTop: 60, transform: `scale(${interpolate(url, [0, 1], [0.6, 1])})`, opacity: Math.min(1, url * 2)}}>{cta.url}</div>
        <div style={{fontSize: 40, color: C.dim, marginTop: 24, opacity: url}}>{cta.foot}</div>
      </div>
    </Scene>
  );
};

/** Background glow, title bar, date and slide dots. These never fade between slides. */
const Chrome: React.FC<{w: Week}> = ({w}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const l = layout(w);
  const first = l.cards[0]?.from ?? l.end.from;
  // Background colour follows the slide (green for a riser, red for a faller) with a short blend.
  const stops: number[] = [0];
  const colors: string[] = [color(w.cards[w.thumbnail?.card ?? 0] ?? w.cards[0])];
  [...l.cards.map((c, i) => ({from: c.from, col: color(w.cards[i])})), {from: l.end.from, col: C.accent}].forEach(({from, col}) => {
    stops.push(Math.max(from - 4, stops[stops.length - 1] + 1));
    colors.push(colors[colors.length - 1]);
    stops.push(Math.max(from + 10, stops[stops.length - 1] + 1));
    colors.push(col);
  });
  const glow = interpolateColors(frame, stops, colors);
  // The marker glides to the next dot as each slide starts.
  const pos = l.cards.slice(1).reduce((sum, c) => sum + spring({frame: frame - c.from + 4, fps, config: {damping: 14, mass: 0.7}}), 0);
  const fade = (at: number, a: number, b: number) => interpolate(frame, [at - 2, at + 10], [a, b], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const titleIn = w.thumbnail ? fade(first, 0, 1) : 1;
  const out = fade(l.end.from, 1, 0);
  return (
    <>
      <Backdrop color={glow} />
      <div style={{opacity: Math.min(titleIn, out), transform: `translateY(${(1 - titleIn) * -30}px)`}}>
        <Header week={w.week} count={w.cards.length} pos={pos} dots={fade(first, 0, 1)} />
      </div>
    </>
  );
};

export const MarketMovers: React.FC<Week> = (w) => {
  const l = layout(w);
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {w.audio ? <Audio src={staticFile(w.audio)} /> : null}
      <Chrome w={w} />
      <Sequence durationInFrames={l.hook.dur}>
        {w.thumbnail?.lines?.length ? <Thumbnail w={w} dur={l.hook.dur} /> : <Hook w={w} dur={l.hook.dur} />}
      </Sequence>
      {l.cards.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.dur}><CardScene w={w} i={i} dur={c.dur} /></Sequence>
      ))}
      <Sequence from={l.end.from} durationInFrames={l.end.dur}><End w={w} /></Sequence>
    </AbsoluteFill>
  );
};
