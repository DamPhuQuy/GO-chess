import { useState } from "react";

const VIEWBOX_SIZE = 1000;
const BOARD_INSET = 58;
const VALID_MOVEMENT_KEYS = new Set(["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"]);

function getColumnLabel(column) {
  return String.fromCharCode("A".charCodeAt(0) + column + (column >= 8 ? 1 : 0));
}

function describeIntersection(gameState, x, y) {
  const stone = gameState.board[y][x];
  const stoneDescription = stone === "empty"
    ? "giao điểm trống"
    : `quân ${stone === "black" ? "Đen" : "Trắng"}`;

  return `${getColumnLabel(x)}${gameState.size - y}, ${stoneDescription}`;
}

function getStarPoints(boardSize) {
  const coordinates = boardSize === 9 ? [2, 4, 6] : [3, 9, 15];
  return coordinates.flatMap((y) => coordinates.map((x) => ({ x, y })));
}

function getBoardCoordinate(event, boardSize) {
  const bounds = event.currentTarget.getBoundingClientRect();
  if (bounds.width === 0 || bounds.height === 0) return null;

  const lastCoordinate = boardSize - 1;
  const lineSpacing = (VIEWBOX_SIZE - (BOARD_INSET * 2)) / lastCoordinate;
  const localX = ((event.clientX - bounds.left) / bounds.width) * VIEWBOX_SIZE;
  const localY = ((event.clientY - bounds.top) / bounds.height) * VIEWBOX_SIZE;
  const relativeX = localX - BOARD_INSET;
  const relativeY = localY - BOARD_INSET;

  if (
    relativeX < -lineSpacing / 2
    || relativeY < -lineSpacing / 2
    || relativeX > lineSpacing * lastCoordinate + lineSpacing / 2
    || relativeY > lineSpacing * lastCoordinate + lineSpacing / 2
  ) {
    return null;
  }

  return {
    x: Math.min(lastCoordinate, Math.max(0, Math.round(relativeX / lineSpacing))),
    y: Math.min(lastCoordinate, Math.max(0, Math.round(relativeY / lineSpacing))),
  };
}

function getPoint(position, boardSize) {
  const spacing = (VIEWBOX_SIZE - (BOARD_INSET * 2)) / (boardSize - 1);
  return {
    x: BOARD_INSET + position.x * spacing,
    y: BOARD_INSET + position.y * spacing,
  };
}

function BoardArtwork({ gameState, activePosition }) {
  const boardSize = gameState.size;
  const coordinates = Array.from({ length: boardSize }, (_, index) => index);
  const starPoints = getStarPoints(boardSize);
  const activePoint = getPoint(activePosition, boardSize);
  const lastMovePoint = gameState.lastMove ? getPoint(gameState.lastMove, boardSize) : null;

  return (
    <svg className="go-board-art" viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} aria-hidden="true" focusable="false">
      <rect className="go-board-wood" width={VIEWBOX_SIZE} height={VIEWBOX_SIZE} />
      <g className="go-board-lines">
        {coordinates.map((index) => {
          const position = BOARD_INSET + index * ((VIEWBOX_SIZE - BOARD_INSET * 2) / (boardSize - 1));
          return (
            <g key={index}>
              <line x1={BOARD_INSET} y1={position} x2={VIEWBOX_SIZE - BOARD_INSET} y2={position} />
              <line x1={position} y1={BOARD_INSET} x2={position} y2={VIEWBOX_SIZE - BOARD_INSET} />
            </g>
          );
        })}
      </g>

      <g className="go-board-star-points">
        {starPoints.map(({ x, y }) => {
          const point = getPoint({ x, y }, boardSize);
          return <circle key={`${x}-${y}`} cx={point.x} cy={point.y} r="7" />;
        })}
      </g>

      <g className="go-board-stones">
        {gameState.board.flatMap((row, y) => row.map((stone, x) => {
          if (stone === "empty") return null;
          const point = getPoint({ x, y }, boardSize);
          return (
            <g key={`${x}-${y}`}>
              <circle className={`go-stone go-stone--${stone}`} cx={point.x} cy={point.y} r="22" />
            </g>
          );
        }))}
      </g>

      <g className="go-board-active-point" transform={`translate(${activePoint.x} ${activePoint.y})`}>
        <circle className="active-point-outline" r="28" />
        <circle className="active-point-ring" r="22" />
      </g>
      {lastMovePoint && (
        <circle
          className="go-last-move-marker"
          cx={lastMovePoint.x}
          cy={lastMovePoint.y}
          r="8"
        />
      )}
    </svg>
  );
}

function getNextPosition(event, position, boardSize) {
  let { x, y } = position;
  const lastCoordinate = boardSize - 1;
  const isWholeBoardKey = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;

  if (event.key === "ArrowLeft") x = Math.max(0, x - 1);
  if (event.key === "ArrowRight") x = Math.min(lastCoordinate, x + 1);
  if (event.key === "ArrowUp") y = Math.max(0, y - 1);
  if (event.key === "ArrowDown") y = Math.min(lastCoordinate, y + 1);

  if (event.key === "Home") {
    if (isWholeBoardKey) return { x: 0, y: 0 };
    x = 0;
  }
  if (event.key === "End") {
    if (isWholeBoardKey) return { x: lastCoordinate, y: lastCoordinate };
    x = lastCoordinate;
  }

  return { x, y };
}

export default function GoBoard({ gameState, canPlay, onMove }) {
  const boardSize = gameState.size;
  const [activePosition, setActivePosition] = useState(() => (
    gameState.lastMove || {
      x: Math.floor(boardSize / 2),
      y: Math.floor(boardSize / 2),
    }
  ));
  const activeCellID = `go-cell-${activePosition.x}-${activePosition.y}`;

  function handleBoardKeyDown(event) {
    if (VALID_MOVEMENT_KEYS.has(event.key)) {
      event.preventDefault();
      setActivePosition(getNextPosition(event, activePosition, boardSize));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (canPlay) onMove(activePosition.x, activePosition.y);
    }
  }

  function handleBoardClick(event) {
    const nextPosition = getBoardCoordinate(event, boardSize);
    if (!nextPosition) return;

    event.currentTarget.focus();
    setActivePosition(nextPosition);
    if (canPlay) onMove(nextPosition.x, nextPosition.y);
  }

  return (
    <div
      className="go-board"
      role="grid"
      tabIndex={0}
      aria-label={`Bàn cờ vây ${boardSize} nhân ${boardSize}. Dùng các phím mũi tên để chọn giao điểm, Enter hoặc Space để đi.`}
      aria-activedescendant={activeCellID}
      aria-rowcount={boardSize}
      aria-colcount={boardSize}
      aria-disabled={!canPlay}
      onKeyDown={handleBoardKeyDown}
      onClick={handleBoardClick}
    >
      <BoardArtwork gameState={gameState} activePosition={activePosition} />
      <div className="go-board-semantic-grid" role="rowgroup">
        {gameState.board.map((row, y) => (
          <div className="go-board-semantic-row" role="row" key={y}>
            {row.map((_, x) => (
              <span
                className="go-board-semantic-cell"
                id={`go-cell-${x}-${y}`}
                role="gridcell"
                aria-label={describeIntersection(gameState, x, y)}
                key={`${x}-${y}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
