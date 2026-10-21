import { TROPHIES, type Trophy } from "@tokenmaxxing/core/trophies.ts";
import { useEffect, useRef, useState } from "react";
import { TROPHY_H, TROPHY_W, trophySprite } from "../art/trophies.ts";
import { loadTrophies } from "../game/trophies.ts";
import { errorText } from "../net.ts";
import { Modal } from "./ui.tsx";

const SCALE = 4;

/** `2026-10-20` as "20 Oct 2026": a world day, so no time zone to shift it. */
const dayText = (day: string) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** The shelf up close: every trophy, earned ones with the day they came, the rest with how to get them. */
export function Trophies({ userId, name }: { userId: number; name: string }) {
  const [trophies, setTrophies] = useState<Trophy[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    void loadTrophies(userId).then(setTrophies, (e) => setFailed(errorText(e)));
  }, [userId]);
  const title = `🏆 ${name}'s trophies`;
  if (!trophies) return <Modal title={title}>{failed ?? "Loading…"}</Modal>;
  const earned = new Map(trophies.map((t) => [t.id, t.day]));
  return (
    <Modal title={title} wide>
      <p className="muted">
        {earned.size} of {TROPHIES.length}. No coins, just bragging rights.
      </p>
      <ul className="trophies">
        {TROPHIES.map((t) => {
          const day = earned.get(t.id);
          return (
            <li key={t.id} className={day ? "" : "unearned"}>
              <TrophyImage id={t.id} earned={day !== undefined} />
              <span>
                <strong>{t.name}</strong>
                <span className="muted small">{t.how}</span>
                {day && <span className="small earned">Earned {dayText(day)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

function TrophyImage({ id, earned }: { id: string; earned: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, TROPHY_W * SCALE, TROPHY_H * SCALE);
    g.drawImage(trophySprite(id, earned), 0, 0, TROPHY_W * SCALE, TROPHY_H * SCALE);
  }, [id, earned]);
  return <canvas ref={ref} width={TROPHY_W * SCALE} height={TROPHY_H * SCALE} />;
}
