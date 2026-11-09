import { compact } from "@tokenmaxxing/core/format.ts";
import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { dayText } from "./format.ts";

/**
 * Eight hues in an order checked for colour-blind separation on the panel (the dataviz palette's dark
 * steps). So at most eight lines: a ninth would need a hue you can't tell from the others.
 */
const SERIES = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const MAX_LINES = SERIES.length;

export type TrendMode = "daily" | "total";

export interface TrendSeries {
  key: string;
  rank: number;
  name: string;
  picture: ReactNode;
  /** Tokens on each day. */
  daily: number[];
  mine?: boolean;
}

const HEIGHT = 260;
/** On the right: room for the character at the end of each line. */
const PAD = { top: 14, right: 46, bottom: 24, left: 46 };
/** How close (px) the pointer must be to a line to pick it out. */
const NEAR = 14;
/** The character at a line's end: its size, how far right of the end, and how close two may stack. */
const END = { size: 24, offset: 16, gap: 20 };

/**
 * Where each of `ys` can go with at least `gap` between neighbours, in order, kept in `[min, max]`
 * where there's room: lines ending close together fan their characters out instead of stacking them.
 */
function dodge(ys: number[], gap: number, min: number, max: number): number[] {
  const order = ys.map((y, i) => ({ y, i })).sort((a, b) => a.y - b.y);
  const placed = order.map((o) => o.y);
  for (let k = 0; k < placed.length; k++) placed[k] = Math.max(placed[k]!, k ? placed[k - 1]! + gap : min);
  for (let k = placed.length - 1; k >= 0; k--)
    placed[k] = Math.min(placed[k]!, k < placed.length - 1 ? placed[k + 1]! - gap : max);
  const out = Array<number>(ys.length);
  order.forEach((o, k) => {
    out[o.i] = placed[k]!;
  });
  return out;
}

/** Up to five round ticks from 0 that cover `max`. */
function ticks(max: number): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return Array.from({ length: Math.ceil(max / step) + 1 }, (_, i) => i * step);
}

const sum = (xs: number[]) => xs.reduce((n, v) => n + v, 0);

const running = (daily: number[]) => {
  let n = 0;
  return daily.map((d) => (n += d));
};

/** The first eight, each in the slot of its own colour. */
const topSlots = (series: TrendSeries[]) => SERIES.map((_, i) => series[i]?.key ?? null);

/**
 * The leaderboard as lines: everyone in a list under the chart, the top eight drawn to begin with, and
 * a click on someone draws or drops their line. Each keeps their colour while drawn: it's the slot they
 * took, so dropping one never repaints the others. The pointer picks a day and lists every drawn
 * line's number on it, busiest first.
 */
export function TrendChart({
  days,
  series,
  mode,
}: {
  days: string[];
  series: TrendSeries[];
  mode: TrendMode;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [at, setAt] = useState<number | null>(null);
  const [focus, setFocus] = useState<string | null>(null);
  /** Who's drawn, by colour: `SERIES[i]` is `slots[i]`'s. */
  const [slots, setSlots] = useState<(string | null)[]>(() => topSlots(series));
  const drawn = slots.filter((k) => k !== null && series.some((s) => s.key === k)).length;
  const full = drawn >= MAX_LINES;

  const toggle = (key: string) =>
    setSlots((now) => {
      const at = now.indexOf(key);
      if (at >= 0) return now.map((k, i) => (i === at ? null : k));
      const free = now.findIndex((k) => k === null || !series.some((s) => s.key === k));
      return free < 0 ? now : now.map((k, i) => (i === free ? key : k));
    });

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e!.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const colorOf = (key: string) => {
    const i = slots.indexOf(key);
    return i < 0 ? null : SERIES[i]!;
  };
  const lines = series.flatMap((s) => {
    const color = colorOf(s.key);
    return color ? [{ ...s, color, values: mode === "total" ? running(s.daily) : s.daily }] : [];
  });
  const yTicks = ticks(Math.max(0, ...lines.flatMap((l) => l.values)));
  const yMax = yTicks.at(-1)!;
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / Math.max(1, days.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH * (1 - v / yMax);
  const last = days.length - 1;
  // A label a week apart, counted back from today.
  const xLabels = days.map((_, i) => i).filter((i) => (last - i) % 7 === 0);

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left;
    const py = e.clientY - r.top;
    const i = Math.round(((px - PAD.left) / plotW) * last);
    const day = Math.min(last, Math.max(0, i));
    setAt(day);
    const near = lines
      .map((l) => ({ key: l.key, d: Math.abs(y(l.values[day]!) - py) }))
      .sort((a, b) => a.d - b.d)[0];
    setFocus(near && near.d <= NEAR ? near.key : null);
  };

  const step = (e: KeyboardEvent) => {
    const move = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    if (!move) return;
    e.preventDefault();
    setAt((a) => Math.min(last, Math.max(0, (a ?? last + (move > 0 ? -1 : 1)) + move)));
  };

  // The one picked out is drawn last, on top.
  const order = [...lines].sort((a, b) => Number(a.key === focus) - Number(b.key === focus));
  const atDay = at === null ? null : [...lines].sort((a, b) => b.values[at]! - a.values[at]!);
  const ends = dodge(
    lines.map((l) => y(l.values[last]!)),
    END.gap,
    END.size / 2,
    HEIGHT - PAD.bottom,
  );
  const endX = x(last) + END.offset;
  const dim = (key: string) => focus !== null && key !== focus;
  const tipLeft = at !== null && x(at) > width / 2;

  return (
    <div className="trend">
      {/* The arrow keys walk the days, so it's a slider over them. */}
      <div
        ref={box}
        className="trend-plot"
        role="slider"
        tabIndex={0}
        onKeyDown={step}
        onBlur={() => setAt(null)}
        aria-label={`Tokens ${mode === "total" ? "added up" : "per day"} over the last 30 days`}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={at ?? last}
        aria-valuetext={days[at ?? last]}
      >
        <svg
          width={width}
          height={HEIGHT}
          aria-hidden="true"
          onPointerMove={pick}
          onPointerLeave={() => {
            setAt(null);
            setFocus(null);
          }}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line className="trend-grid" x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} />
              <text
                className="trend-axis"
                x={PAD.left - 6}
                y={y(t)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {t === 0 ? "0" : compact(t)}
              </text>
            </g>
          ))}
          {xLabels.map((i) => (
            <text
              key={i}
              className="trend-axis"
              x={x(i)}
              y={HEIGHT - 6}
              textAnchor={i === last ? "end" : "middle"}
            >
              {i === last ? "Today" : dayText(days[i]!, { day: "numeric", month: "short" })}
            </text>
          ))}
          {at !== null && (
            <line className="trend-cross" x1={x(at)} x2={x(at)} y1={PAD.top} y2={PAD.top + plotH} />
          )}
          {order.map((l) => (
            <polyline
              key={l.key}
              className="trend-line"
              points={l.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")}
              stroke={l.color}
              strokeWidth={l.key === focus ? 3 : 2}
              opacity={dim(l.key) ? 0.22 : 1}
            />
          ))}
          {/* A dot where each line ends, and a dotted lead from it to its character (moved aside to make room). */}
          {lines.map((l, i) => (
            <g key={l.key} opacity={dim(l.key) ? 0.22 : 1}>
              <polyline
                className="trend-leader"
                points={`${x(last)},${y(l.values[last]!)} ${endX - 2},${ends[i]}`}
                stroke={l.color}
              />
              <circle cx={x(last)} cy={y(l.values[last]!)} r={2.5} fill={l.color} />
            </g>
          ))}
          {at !== null &&
            order.map((l) => (
              <circle
                key={l.key}
                className="trend-dot"
                cx={x(at)}
                cy={y(l.values[at]!)}
                r={l.key === focus ? 5 : 4}
                fill={l.color}
                opacity={dim(l.key) ? 0.3 : 1}
              />
            ))}
        </svg>
        {lines.map((l, i) => (
          <span
            key={l.key}
            className="trend-end"
            data-dim={dim(l.key) || undefined}
            data-focus={l.key === focus || undefined}
            style={{ left: endX, top: ends[i]! - END.size / 2 }}
            title={`${l.name}: ${compact(sum(l.daily))}`}
            onPointerEnter={() => setFocus(l.key)}
            onPointerLeave={() => setFocus(null)}
          >
            {l.picture}
          </span>
        ))}
        {lines.length === 0 && (
          <p className="trend-none muted small">Pick someone below to draw their line.</p>
        )}
        {at !== null && atDay && atDay.length > 0 && (
          <div
            className="trend-tip"
            style={tipLeft ? { right: width - x(at) + 12 } : { left: x(at) + 12 }}
            aria-live="polite"
          >
            <strong className="trend-tip-day">
              {at === last
                ? "Today"
                : dayText(days[at]!, { weekday: "short", day: "numeric", month: "short" })}
            </strong>
            <ol>
              {atDay.map((l) => (
                <li key={l.key} className={l.key === focus ? "focus" : undefined}>
                  <Key color={l.color} />
                  <b>{compact(l.values[at]!)}</b>
                  <span>{l.name}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <div className="trend-pick">
        <span className="muted small">
          {drawn} of {MAX_LINES} lines{full ? " · take one off to add another" : ""}
        </span>
        <span className="trend-pick-actions">
          <button type="button" className="link small" onClick={() => setSlots(topSlots(series))}>
            Top {MAX_LINES}
          </button>
          <button type="button" className="link small" onClick={() => setSlots(SERIES.map(() => null))}>
            Clear
          </button>
        </span>
      </div>
      <ol className="trend-legend">
        {series.map((s) => {
          const color = colorOf(s.key);
          return (
            <li key={s.key} className={s.mine ? "mine" : undefined}>
              <button
                type="button"
                onClick={() => toggle(s.key)}
                onPointerEnter={() => setFocus(color ? s.key : null)}
                onPointerLeave={() => setFocus(null)}
                onFocus={() => setFocus(color ? s.key : null)}
                onBlur={() => setFocus(null)}
                aria-pressed={!!color}
                aria-disabled={!color && full}
                data-focus={(color && s.key === focus) || undefined}
              >
                <span className="lb-rank">{s.rank}</span>
                {color ? <Key color={color} /> : <span className="trend-key trend-key-off" />}
                {s.picture}
                <strong>{s.name}</strong>
                <span className="lb-value">{compact(sum(s.daily))}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** A short stroke of a line's colour: what keys it in the legend and the readout. */
function Key({ color }: { color: string }) {
  return (
    <svg className="trend-key" width="16" height="8" aria-hidden="true">
      <line x1="1" x2="15" y1="4" y2="4" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
