import React from 'react';
import {AbsoluteFill, Audio, Img, Sequence, interpolate, interpolateColors, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {Backdrop, CardArt, Chart, Header, useCount, usePop} from './parts';
import {C, FONT, FPS, Mover, Week, layout, pct, round$, usd} from './types';

const color = (m: Mover) => (m.new >= m.old ? C.up : C.down);
const signed = (n: number) => (n > 0 ? '+' : '') + Math.round(n) + '%';
/** Last part of "Set · Rarity · Finish". */
const finish = (printing: string) => printing.split(' · ').pop() ?? printing;

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

/** Second opening screen: what the video is about, with every card's art in a row. */
const Intro: React.FC<{w: Week; dur: number}> = ({w, dur}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = w.intro!;
  const subIn = usePop(6 + t.lines.length * 5);
  const n = w.cards.length;
  const gap = 16;
  const artW = Math.min(200, Math.floor((940 - gap * (n - 1)) / n));
  return (
    <Scene dur={dur}>
      <div style={{position: 'absolute', top: 330, left: 60, right: 60, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4}}>
        {t.lines.map((line, i) => {
          const pop = spring({frame: frame - 2 - i * 5, fps, config: {damping: 11, mass: 0.6}});
          const size = Math.min(210, 940 / (0.66 * Math.max(line.length, 4)));
          const col = /gain|ris|winner/i.test(line) ? C.up : /los|fall|drop/i.test(line) ? C.down : C.text;
          return (
            <div key={i} style={{fontSize: size, fontWeight: 900, lineHeight: 1.04, letterSpacing: -3, textTransform: 'uppercase', whiteSpace: 'nowrap', color: col, textShadow: '0 12px 50px rgba(0,0,0,.8)', opacity: Math.min(1, pop * 3), transform: `scale(${interpolate(pop, [0, 1], [1.8, 1])})`}}>{line}</div>
          );
        })}
      </div>
      {t.sub ? (
        <div style={{position: 'absolute', top: 1010, left: 60, right: 60, textAlign: 'center', opacity: subIn, transform: `translateY(${(1 - subIn) * 40}px)`}}>
          <span style={{display: 'inline-block', padding: '22px 42px', borderRadius: 28, background: C.panel, border: `2px solid ${C.line}`, fontSize: 54, fontWeight: 800}}>{t.sub}</span>
        </div>
      ) : null}
      <div style={{position: 'absolute', top: 1230, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap}}>
        {w.cards.map((m, i) => (
          <div key={i} style={{borderBottom: `8px solid ${color(m)}`, paddingBottom: 14}}><CardArt m={m} width={artW} delay={14 + i * 4} from={1.4} /></div>
        ))}
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
  const ago = w.period?.ago ?? 'a week ago';
  const also = m.also ?? {printing: '', old: 1, new: 1};
  const n2 = useCount(0, Math.round(((also.new - also.old) / also.old) * 100), 22, 26);
  const price2 = useCount(also.old, also.new, 26, 34);
  const alsoIn = usePop(18);
  return (
    <Scene dur={dur}>
      <div style={{position: 'absolute', top: 190, left: 70, fontSize: 42, fontWeight: 800, letterSpacing: 3, color: col, opacity: tagIn, transform: `translateX(${(1 - tagIn) * -80}px)`}}>
        {p >= 0 ? '▲' : '▼'} {m.tag}
      </div>
      <div style={{position: 'absolute', top: 275, left: 70}}><CardArt m={m} width={440} delay={2} from={1.5} /></div>
      {m.also ? (
        // Two printings of the same card, stacked: finish, percent, price now and before.
        <div style={{position: 'absolute', top: 268, left: 550, right: 30}}>
          {[{label: finish(m.printing), old: m.old, pc: n, now: price, c: col}, {label: finish(m.also.printing), old: m.also.old, pc: n2, now: price2, c: m.also.new >= m.also.old ? C.up : C.down}].map((r, k) => (
            <div key={k} style={{marginTop: k ? 30 : 0, paddingTop: k ? 26 : 0, borderTop: k ? `2px solid ${C.line}` : 'none', opacity: k ? alsoIn : 1, transform: `translateY(${k ? (1 - alsoIn) * 30 : 0}px)`}}>
              <div style={{fontSize: 34, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: C.dim}}>{r.label}</div>
              <div style={{fontSize: 124, fontWeight: 900, lineHeight: 1.02, letterSpacing: -5, color: r.c}}>{signed(r.pc)}</div>
              <div style={{fontSize: 70, fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1}}>{usd(r.now)}</div>
              <div style={{fontSize: 32, color: C.dim, marginTop: 2}}>was {usd(r.old)} {ago}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{position: 'absolute', top: 285, left: 550, right: 40}}>
          <div style={{fontSize: 158, fontWeight: 900, lineHeight: 1, letterSpacing: -6, color: col, transformOrigin: 'left center', transform: `scale(${interpolate(pctIn, [0, 1], [1.7, 1])})`, opacity: Math.min(1, pctIn * 3)}}>{signed(n)}</div>
          <div style={{fontSize: 96, fontWeight: 800, marginTop: 34, fontVariantNumeric: 'tabular-nums'}}>{usd(price)}</div>
          <div style={{fontSize: 42, color: C.dim, marginTop: 8}}>was {usd(m.old)}<br />{ago}</div>
          {m.priceLabel ? <div style={{fontSize: 30, color: C.faint, marginTop: 12}}>{m.priceLabel}</div> : null}
        </div>
      )}
      <div style={{position: 'absolute', top: 925, left: 70, right: 70, opacity: nameIn, transform: `translateY(${(1 - nameIn) * 40}px)`}}>
        <div style={{fontSize: m.name.length > 26 ? 52 : 64, fontWeight: 800, lineHeight: 1.08}}>{m.name}</div>
        <div style={{fontSize: 32, fontWeight: 500, color: C.dim, marginTop: 12}}>{m.also ? [...m.printing.split(' · ').slice(0, -1), m.priceLabel].filter(Boolean).join(' · ') : m.printing}</div>
      </div>
      <div style={{position: 'absolute', top: m.also?.series ? 1170 : 1130, left: 70}}><Chart series={m.series} color={col} delay={24} h={m.why ? 290 : m.also?.series ? 330 : 360} days={w.period?.days} recent={w.period?.recent} series2={m.also?.series} legend={m.also ? [finish(m.printing), finish(m.also.printing)] : undefined} /></div>
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

/** A picture that slides up over the lower part of the slide, holds, and slides away. */
const Shot: React.FC<{img: string; caption?: string; dur: number}> = ({img, caption, dur}) => {
  const frame = useCurrentFrame();
  const inn = usePop(0, 14);
  const out = interpolate(frame, [dur - 8, dur], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{fontFamily: FONT, color: C.text, opacity: Math.min(1, inn * 2) * out}}>
      <div style={{position: 'absolute', left: 30, right: 30, top: 1085, transform: `translateY(${(1 - inn) * 160 + (1 - out) * 60}px) rotate(${(1 - inn) * 2 - 1}deg)`}}>
        {/* Sized by whichever runs out first, width or height, so a tall picture stays inside the frame. */}
        <div style={{display: 'flex', justifyContent: 'center'}}>
          <div style={{borderRadius: 28, overflow: 'hidden', border: `6px solid ${C.text}`, boxShadow: '0 30px 90px rgba(0,0,0,.85)', background: C.panel}}>
            <Img src={staticFile(img)} style={{display: 'block', width: 'auto', height: 'auto', maxWidth: 1008, maxHeight: caption ? 680 : 780}} />
          </div>
        </div>
        {caption ? (
          <div style={{textAlign: 'center', marginTop: 22}}>
            <span style={{display: 'inline-block', padding: '14px 30px', borderRadius: 22, background: C.panel, border: `2px solid ${C.line}`, fontSize: 40, fontWeight: 700}}>{caption}</span>
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
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
  // The optional intro screen takes over the end of the opening, if it fits inside it.
  const at = w.intro?.lines?.length ? Math.round(w.intro.at * FPS) : 0;
  const introAt = at > 15 && at < l.hook.dur - 15 ? at : null;
  const hookDur = introAt ?? l.hook.dur;
  return (
    <AbsoluteFill style={{background: C.bg}}>
      {w.audio ? <Audio src={staticFile(w.audio)} /> : null}
      <Chrome w={w} />
      <Sequence durationInFrames={hookDur}>
        {w.thumbnail?.lines?.length ? <Thumbnail w={w} dur={hookDur} /> : <Hook w={w} dur={hookDur} />}
      </Sequence>
      {introAt !== null ? (
        <Sequence from={introAt} durationInFrames={l.hook.dur - introAt}><Intro w={w} dur={l.hook.dur - introAt} /></Sequence>
      ) : null}
      {l.cards.map((c, i) => (
        <Sequence key={i} from={c.from} durationInFrames={c.dur}><CardScene w={w} i={i} dur={c.dur} /></Sequence>
      ))}
      <Sequence from={l.end.from} durationInFrames={l.end.dur}><End w={w} /></Sequence>
      {(w.shots ?? []).map((sh, i) => {
        const dur = Math.round((sh.dur ?? 4) * FPS);
        return <Sequence key={`shot${i}`} from={Math.round(sh.at * FPS)} durationInFrames={dur}><Shot img={sh.img} caption={sh.caption} dur={dur} /></Sequence>;
      })}
    </AbsoluteFill>
  );
};
