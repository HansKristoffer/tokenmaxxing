import { CABINET_GAMES } from "@tokenmaxxing/core/tavern.ts";
import { useEffect, useRef, useState } from "react";
import { town } from "../net.ts";
import { storage } from "../storage.ts";
import { hud } from "../store.ts";
import { Modal } from "./ui.tsx";

const names = ["Token Trail", "Stack Overflow", "Cache Crawler", "Firewall Breaker"];
type Point = { x: number; y: number };
const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const random = (n: number) => Math.floor(Math.random() * n);

/** Solo cabinet scores are client-reported; they never affect the economy. */
export function Retro({ cabinet }: { cabinet: number }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const action = useRef<(key: string) => void>(() => {});
  const [run, setRun] = useState(0);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const [started, setStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [boardScores, setBoardScores] = useState<
    { userId: number; name: string; score: number; level: number }[]
  >([]);
  const [boardError, setBoardError] = useState(false);
  useEffect(() => {
    let live = true;
    town
      .retroBoard(cabinet)
      .then((rows) => {
        if (live) {
          setBoardScores(rows);
          setBoardError(false);
        }
      })
      .catch(() => {
        if (live) setBoardError(true);
      });
    return () => {
      live = false;
    };
  }, [cabinet]);
  const [best, setBest] = useState(() => Number(storage.getItem(`retro.${cabinet}`)) || 0);
  useEffect(() => {
    void run; // Restart creates a fresh game.
    const g = canvas.current?.getContext("2d");
    if (!g) return;
    let points = 0,
      ended = false,
      ticks = 0,
      stage = 1,
      playing = false,
      lines = 0,
      eaten = 0;
    const advance = () => {
      stage++;
      setLevel(stage);
    };
    const finish = () => {
      if (ended) return;
      ended = true;
      setOver(true);
      const high = Math.max(points, Number(storage.getItem(`retro.${cabinet}`)) || 0);
      storage.setItem(`retro.${cabinet}`, String(high));
      setBest(high);
      if (points > 0)
        town
          .retroScore(cabinet, points, stage)
          .then((rows) => {
            setBoardScores(rows);
            setBoardError(false);
          })
          .catch(() => setBoardError(true));
    };
    const add = (n: number) => {
      points += n;
      setScore(points);
    };
    setScore(0);
    setOver(false);
    setStarted(false);
    setLevel(1);
    const cell = (x: number, y: number, color: string, size = 20) => {
      g.fillStyle = color;
      g.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    };
    const snake: Point[] = [
      { x: 8, y: 10 },
      { x: 7, y: 10 },
      { x: 6, y: 10 },
    ];
    let dir = { x: 1, y: 0 },
      next = dir,
      food = { x: 13, y: 10 };
    let obstacles: Point[] = [];
    const shapes = [
      [[1, 1, 1, 1]],
      [
        [1, 1],
        [1, 1],
      ],
      [
        [0, 1, 0],
        [1, 1, 1],
      ],
      [
        [1, 0, 0],
        [1, 1, 1],
      ],
      [
        [0, 0, 1],
        [1, 1, 1],
      ],
      [
        [0, 1, 1],
        [1, 1, 0],
      ],
      [
        [1, 1, 0],
        [0, 1, 1],
      ],
    ];
    let board = Array.from({ length: 20 }, () => Array<number>(10).fill(0));
    let shape = shapes[random(shapes.length)]!.map((row) => [...row]),
      bx = 3,
      by = 0;
    const fits = (s: number[][], x: number, y: number) =>
      s.every((row, dy) =>
        row.every(
          (v, dx) =>
            !v || (x + dx >= 0 && x + dx < 10 && y + dy < 20 && (y + dy < 0 || !board[y + dy]![x + dx])),
        ),
      );
    const drop = () => {
      if (fits(shape, bx, by + 1)) {
        by++;
        return;
      }
      shape.forEach((row, y) => {
        row.forEach((v, x) => {
          if (v && by + y >= 0) board[by + y]![bx + x] = 1;
        });
      });
      const remaining = board.filter((row) => row.some((v) => !v));
      const cleared = 20 - remaining.length;
      if (cleared) {
        add(cleared * 100 * stage);
        lines += cleared;
        while (lines >= stage * 10) advance();
        board = [...Array.from({ length: cleared }, () => Array<number>(10).fill(0)), ...remaining];
      }
      shape = shapes[random(shapes.length)]!.map((row) => [...row]);
      bx = 3;
      by = 0;
      if (!fits(shape, bx, by)) finish();
    };
    // Connected corridors with original roaming bugs.
    const mazeTemplate = [
      "####################",
      "#........#.........#",
      "#.##.###.#.###.##..#",
      "#..................#",
      "#.##.#.#####.#.##..#",
      "#....#...#...#.....#",
      "####.###.#.###.##..#",
      "#..................#",
      "#.##.#.#####.#.##..#",
      "#....#...#...#.....#",
      "#.######.#.######..#",
      "#..................#",
      "#.##.###.#.###.##..#",
      "#....#.......#.....#",
      "####.#.#####.#.##..#",
      "#..................#",
      "#.##.###.#.###.##..#",
      "#........#.........#",
      "#..................#",
      "####################",
    ];
    let maze = mazeTemplate.map((row) => row.split(""));
    let player = { x: 1, y: 1 },
      bugs: Point[] = [
        { x: 18, y: 18 },
        { x: 18, y: 1 },
        { x: 1, y: 18 },
      ],
      wish = { x: 0, y: 0 };
    const open = (p: Point) => maze[p.y]?.[p.x] !== undefined && maze[p.y]?.[p.x] !== "#";
    let paddle = 8,
      ball = { x: 200, y: 300 },
      velocity = { x: 3, y: -3 };
    let bricks = Array.from({ length: 5 }, (_, y) =>
      Array.from({ length: 10 }, (_, x) => ({ x, y, alive: true })),
    ).flat();
    action.current = (key) => {
      if (ended) return;
      if (key === "Start") {
        playing = true;
        setStarted(true);
        return;
      }
      if (!playing) return;
      const moves: Record<string, Point> = {
        ArrowLeft: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 },
        ArrowUp: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 },
      };
      if (cabinet === 0 && moves[key]) {
        const d = moves[key]!;
        if (d.x !== -dir.x || d.y !== -dir.y) next = d;
      }
      if (cabinet === 1) {
        if (key === "ArrowLeft" && fits(shape, bx - 1, by)) bx--;
        if (key === "ArrowRight" && fits(shape, bx + 1, by)) bx++;
        if (key === "ArrowDown") drop();
        if (key === "ArrowUp") {
          const rotated = shape[0]!.map((_, x) => shape.map((row) => row[x]!).reverse());
          if (fits(rotated, bx, by)) shape = rotated;
        }
        if (key === " ") {
          while (fits(shape, bx, by + 1)) by++;
          drop();
        }
      }
      if (cabinet === 2 && moves[key]) wish = moves[key]!;
      if (cabinet === 3) {
        if (key === "ArrowLeft") paddle = Math.max(0, paddle - 1);
        if (key === "ArrowRight") paddle = Math.min(16, paddle + 1);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
        action.current(e.key);
      }
    };
    window.addEventListener("keydown", onKey, true);
    const timer = window.setInterval(() => {
      if (ended) return;
      if (playing) ticks++;
      g.fillStyle = "#101321";
      g.fillRect(0, 0, 400, 400);
      if (cabinet === 0) {
        if (playing && ticks % Math.max(2, 6 - Math.floor(stage / 2)) === 0) {
          dir = next;
          const head = { x: snake[0]!.x + dir.x, y: snake[0]!.y + dir.y };
          const eating = same(head, food);
          if (
            head.x < 0 ||
            head.x >= 20 ||
            head.y < 0 ||
            head.y >= 20 ||
            obstacles.some((p) => same(p, head)) ||
            snake.slice(0, eating ? undefined : -1).some((p) => same(p, head))
          )
            finish();
          else {
            snake.unshift(head);
            if (eating) {
              add(10 * stage);
              eaten++;
              if (eaten % 5 === 0) {
                advance();
                const candidates = [
                  { x: 4, y: 4 },
                  { x: 15, y: 15 },
                  { x: 15, y: 4 },
                  { x: 4, y: 15 },
                  { x: 10, y: 5 },
                  { x: 9, y: 14 },
                ];
                obstacles = candidates
                  .slice(0, Math.min(stage - 1, candidates.length))
                  .filter((p) => !snake.some((part) => same(part, p)));
              }
              const empty: Point[] = [];
              for (let y = 0; y < 20; y++)
                for (let x = 0; x < 20; x++)
                  if (
                    !snake.some((p) => p.x === x && p.y === y) &&
                    !obstacles.some((p) => p.x === x && p.y === y)
                  )
                    empty.push({ x, y });
              if (!empty.length) finish();
              else food = empty[random(empty.length)]!;
            } else snake.pop();
          }
        }
        snake.forEach((p) => {
          cell(p.x, p.y, "#72efb0");
        });
        cell(food.x, food.y, "#ffd36b");
        obstacles.forEach((p) => {
          cell(p.x, p.y, "#9469bd");
        });
      } else if (cabinet === 1) {
        if (playing && ticks % Math.max(3, 16 - stage) === 0) drop();
        board.forEach((row, y) => {
          row.forEach((v, x) => {
            if (v) cell(x + 5, y, "#62c9f4");
          });
        });
        shape.forEach((row, y) => {
          row.forEach((v, x) => {
            if (v) cell(bx + x + 5, by + y, "#f7ca6b");
          });
        });
      } else if (cabinet === 2) {
        if (playing && ticks % 5 === 0) {
          const target = { x: player.x + wish.x, y: player.y + wish.y };
          if (open(target)) player = target;
          if (maze[player.y]![player.x] === ".") {
            maze[player.y]![player.x] = " ";
            add(10);
          }
          if (!maze.some((row) => row.includes("."))) {
            advance();
            add(200 * stage);
            maze = mazeTemplate.map((row) => (stage % 2 === 0 ? [...row].reverse() : [...row]));
            player = { x: 1, y: 1 };
            bugs = [
              { x: 18, y: 18 },
              { x: 18, y: 1 },
              { x: 1, y: 18 },
            ];
            wish = { x: 0, y: 0 };
          }
          if (bugs.some((p) => same(p, player))) finish();
          if (ticks % (stage >= 3 ? 5 : 10) === 0)
            bugs = bugs.map((b) => {
              const options = [
                { x: b.x + 1, y: b.y },
                { x: b.x - 1, y: b.y },
                { x: b.x, y: b.y + 1 },
                { x: b.x, y: b.y - 1 },
              ].filter(open);
              return options[random(options.length)] ?? b;
            });
          if (bugs.some((p) => same(p, player))) finish();
        }
        maze.forEach((row, y) => {
          row.forEach((v, x) => {
            if (v === "#") cell(x, y, "#4259a0");
            else if (v === ".") {
              g.fillStyle = "#ffe8a8";
              g.fillRect(x * 20 + 8, y * 20 + 8, 4, 4);
            }
          });
        });
        cell(player.x, player.y, "#ffd36b");
        bugs.forEach((p) => {
          cell(p.x, p.y, "#f376a4");
        });
      } else {
        if (playing) {
          ball.x += velocity.x;
          ball.y += velocity.y;
          if (ball.x < 5 || ball.x > 395) velocity.x *= -1;
          if (ball.y < 5) velocity.y = Math.abs(velocity.y);
          if (
            ball.y >= 365 &&
            ball.y <= 375 &&
            ball.x >= paddle * 20 &&
            ball.x <= paddle * 20 + 80 &&
            velocity.y > 0
          ) {
            velocity.y = -Math.abs(velocity.y);
            velocity.x = (ball.x - (paddle * 20 + 40)) / 12 || 1;
          }
          if (ball.y > 400) finish();
          for (const b of bricks)
            if (
              b.alive &&
              ball.x >= b.x * 40 &&
              ball.x < b.x * 40 + 40 &&
              ball.y >= 30 + b.y * 20 &&
              ball.y < 50 + b.y * 20
            ) {
              b.alive = false;
              velocity.y *= -1;
              add(10);
              break;
            }
          if (bricks.every((b) => !b.alive)) {
            advance();
            add(100 * stage);
            velocity.x = Math.max(-6, Math.min(6, velocity.x * 1.1));
            velocity.y = Math.max(-6, Math.min(6, velocity.y * 1.1));
            bricks = bricks.map((b) => ({
              ...b,
              alive: stage % 3 === 1 || (stage % 3 === 2 ? (b.x + b.y) % 2 === 0 : b.y < 3 || b.x % 2 === 0),
            }));
          }
        }
        bricks
          .filter((b) => b.alive)
          .forEach((b) => {
            g.fillStyle = ["#fa718b", "#ffb76b", "#f2db6b", "#70dfb0", "#6bbefa"][b.y]!;
            g.fillRect(b.x * 40 + 1, 31 + b.y * 20, 38, 18);
          });
        g.fillStyle = "#e7f5ff";
        g.fillRect(paddle * 20, 370, 80, 8);
        g.beginPath();
        g.arc(ball.x, ball.y, 5, 0, Math.PI * 2);
        g.fill();
      }
    }, 30);
    return () => {
      clearInterval(timer);
      window.removeEventListener("keydown", onKey, true);
      action.current = () => {};
    };
  }, [cabinet, run]);
  return (
    <Modal title={`🕹️ ${names[cabinet]}`}>
      <p>
        Score: {score} · Level: {level} · Best on this device: {best}
        {over ? " · Game over!" : ""}
      </p>
      <canvas
        ref={canvas}
        width={400}
        height={400}
        aria-label={`${names[cabinet]} game board`}
        style={{
          width: "100%",
          maxWidth: 400,
          display: "block",
          imageRendering: "pixelated",
          background: "#101321",
        }}
      />
      <p className="muted small">
        {cabinet === 1
          ? "Arrow keys move and rotate; space drops."
          : cabinet === 3
            ? "Move the paddle with left and right."
            : "Use the arrow keys to move."}
      </p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {!started && !over && (
          <button type="button" className="primary" onClick={() => action.current("Start")}>
            Start game
          </button>
        )}
        {[
          ["←", "ArrowLeft"],
          ["↑", "ArrowUp"],
          ["↓", "ArrowDown"],
          ["→", "ArrowRight"],
          ...(cabinet === 1 ? [["Drop", " "]] : []),
        ].map(([label, key]) => (
          <button type="button" key={key} onClick={() => action.current(key!)}>
            {label}
          </button>
        ))}
        <button type="button" onClick={() => setRun((n) => n + 1)}>
          Restart
        </button>
        <button
          type="button"
          onClick={() => {
            const lobby = hud.get().lobby;
            const busy =
              lobby &&
              (lobby.me.table !== null || lobby.matches.some((m) => !m.outcome && m.id === lobby.me.match));
            hud.set({
              panel: busy ? { kind: "arcade" } : { kind: "newTable", game: CABINET_GAMES[cabinet] },
            });
          }}
        >
          Multiplayer table
        </button>
      </div>
      <h3>🏆 Cabinet leaderboard</h3>
      <p className="muted small">All-time best scores · client-reported and unverified</p>
      {boardError ? (
        <p>Leaderboard unavailable. Your local best is still saved.</p>
      ) : boardScores.length ? (
        <ol>
          {boardScores.map((row) => (
            <li key={row.userId}>
              {row.name} — {row.score.toLocaleString()} · level {row.level}
            </li>
          ))}
        </ol>
      ) : (
        <p className="muted small">No scores yet. Be the first!</p>
      )}
    </Modal>
  );
}
