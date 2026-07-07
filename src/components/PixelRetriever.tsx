"use client";

// Tiny pixel-art golden retriever (side view, facing right), built from a
// character grid so no image assets are needed. '.' = transparent, other
// letters map to PIXEL_COLORS. Left: curled tail. Right: head with floppy
// ear (DD columns), eye (E), snout ending in a 2px nose (NN), white chin (W).
const DOG_ROWS = [
  "...............DDDDD....",
  "..............DDBBBBD...",
  "..DD..........DDBBBEBBD.",
  ".DBBD.........DDBBBBBBNN",
  ".DBD..........DDBBBBWWD.",
  "..DBD...DDDDDDBBBBBBWD..",
  "...DBBBBBBBBBBBBBBBBD...",
  "...DBBBBBBBBBBBBBBBD....",
  "....DBBBBBBBBBBBBBD.....",
  "....DBD.DBD..DBD.DBD....",
  "....DBD.DBD..DBD.DBD....",
  "....DDD.DDD..DDD.DDD....",
];

const PIXEL_COLORS: Record<string, string> = {
  D: "#8b5a2b",
  B: "#e6b17e",
  E: "#2b1c12",
  N: "#2b1c12",
  W: "#fff7e6",
};

// Cell coordinates (col, row) of the two eye pixels, used to apply the
// blink animation without hand-editing every render call.
const EYE_CELLS = new Set(["19-2"]);

const COLS = DOG_ROWS[0].length;
const ROWS = DOG_ROWS.length;
const PIXEL_SIZE = 5;
// Keep in sync with the `walk-x` keyframe in tailwind.config.ts
// (left: calc(100% - 96px)).
const DOG_WIDTH = COLS * PIXEL_SIZE;

export default function PixelRetriever({
  bubble,
}: {
  bubble: { id: number; text: string } | null;
}) {
  return (
    <div className="relative h-20 w-full overflow-hidden">
      {/* walk-x moves this wrapper across the parent; the scaleX flip lives on
          an inner layer so the speech bubble text never mirrors. */}
      <div className="animate-walk-x absolute bottom-2 left-0" style={{ width: DOG_WIDTH }}>
        {bubble && (
          <div
            key={bubble.id}
            className="animate-pop-in absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-white px-3 py-1 text-xs font-semibold text-brown-700 shadow-md"
          >
            {bubble.text}
            <div className="absolute -bottom-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-white" />
          </div>
        )}
        <div
          className="animate-shadow-pulse absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-brown-700"
          style={{ width: DOG_WIDTH * 0.6, height: 6 }}
        />
        <div className="animate-walk-flip">
          <div
            className="animate-bob"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${COLS}, ${PIXEL_SIZE}px)`,
              gridTemplateRows: `repeat(${ROWS}, ${PIXEL_SIZE}px)`,
              imageRendering: "pixelated",
            }}
          >
            {DOG_ROWS.flatMap((row, y) =>
              row.split("").map((ch, x) => (
                <div
                  key={`${x}-${y}`}
                  className={EYE_CELLS.has(`${x}-${y}`) ? "animate-blink" : undefined}
                  style={{
                    width: PIXEL_SIZE,
                    height: PIXEL_SIZE,
                    backgroundColor: PIXEL_COLORS[ch] ?? "transparent",
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
