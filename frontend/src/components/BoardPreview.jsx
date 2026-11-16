const PREVIEW_SIZE = 9;
const VIEWBOX_SIZE = 1000;
const BOARD_INSET = 100;
const BLACK_STONES = [[2, 2], [3, 3], [4, 4], [5, 2], [6, 5]];
const WHITE_STONES = [[3, 2], [5, 4], [4, 5], [6, 3]];
const LAST_MOVE = [6, 3];

function getCoordinate(index) {
  return BOARD_INSET + index * ((VIEWBOX_SIZE - BOARD_INSET * 2) / (PREVIEW_SIZE - 1));
}

function renderStones(stones, color) {
  return stones.map(([x, y]) => (
    <g key={`${color}-${x}-${y}`}>
      <circle
        className={`preview-stone preview-stone--${color}`}
        cx={getCoordinate(x)}
        cy={getCoordinate(y)}
        r="31"
      />
      {color === "white" && LAST_MOVE[0] === x && LAST_MOVE[1] === y && (
        <circle className="preview-last-move" cx={getCoordinate(x)} cy={getCoordinate(y)} r="10" />
      )}
    </g>
  ));
}

export default function BoardPreview() {
  const intersections = Array.from({ length: PREVIEW_SIZE }, (_, index) => index);
  const starPoints = [2, 4, 6];

  return (
    <div
      className="board-preview"
      data-moment="cursor-spotlight"
      data-moment-opts='{"rest":[0.72,0.28],"radius":320,"grid":false}'
      aria-hidden="true"
    >
      <svg viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} focusable="false">
        <rect className="preview-board-wood" width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} />
        <g className="preview-board-lines">
          {intersections.map((index) => (
            <g key={index}>
              <line
                x1={BOARD_INSET}
                y1={getCoordinate(index)}
                x2={VIEWBOX_SIZE - BOARD_INSET}
                y2={getCoordinate(index)}
              />
              <line
                x1={getCoordinate(index)}
                y1={BOARD_INSET}
                x2={getCoordinate(index)}
                y2={VIEWBOX_SIZE - BOARD_INSET}
              />
            </g>
          ))}
        </g>
        <g className="preview-star-points">
          {starPoints.flatMap((y) => starPoints.map((x) => (
            <circle key={`${x}-${y}`} cx={getCoordinate(x)} cy={getCoordinate(y)} r="10" />
          )))}
        </g>
        <g className="preview-stones">
          {renderStones(BLACK_STONES, "black")}
          {renderStones(WHITE_STONES, "white")}
        </g>
      </svg>
    </div>
  );
}

