import { compact } from "@tokenmaxxing/core/format.ts";
import { useState } from "react";
import { dayText } from "./format.ts";
import { heatCells } from "./heat.ts";

const TIP_WIDTH = 130;

/**
 * The last 30 days as a calendar grid: a column a week, a row a weekday, darker where there were more
 * tokens. Hover or focus a day for its date and tokens (never cost); a native `title` doesn't show in
 * every browser, so the tip is ours.
 */
export function Heatmap({ daily }: { daily: readonly { day: string; tokens: number }[] }) {
  const cells = heatCells(daily);
  const active = daily.filter((d) => d.tokens > 0).length;
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  const show = (e: { currentTarget: HTMLElement }, text: string) => {
    const li = e.currentTarget;
    const room = li.offsetParent!.clientWidth - TIP_WIDTH;
    setTip({ text, x: Math.max(0, Math.min(li.offsetLeft, room)), y: li.offsetTop });
  };
  return (
    <figure className="heatmap">
      <ul aria-label={`Tokens per day, last 30 days: ${active} active days`}>
        {cells.map((c, i) => {
          if (!c) {
            // biome-ignore lint/suspicious/noArrayIndexKey: blanks before the first day have no identity
            return <li key={`blank${i}`} className="heat-blank" aria-hidden="true" />;
          }
          const text = `${dayText(c.day, { day: "numeric", month: "short" })}: ${c.tokens ? `${compact(c.tokens)} tokens` : "quiet"}`;
          return (
            <li
              key={c.day}
              className={`heat-${c.level}`}
              aria-label={text}
              // biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows the day's tip, as hover does
              tabIndex={0}
              onMouseEnter={(e) => show(e, text)}
              onFocus={(e) => show(e, text)}
              onMouseLeave={() => setTip(null)}
              onBlur={() => setTip(null)}
            />
          );
        })}
      </ul>
      {tip && (
        <span className="heat-tip" role="tooltip" style={{ left: tip.x, top: tip.y }}>
          {tip.text}
        </span>
      )}
      <figcaption className="muted small">Last 30 days · {active} active</figcaption>
    </figure>
  );
}
