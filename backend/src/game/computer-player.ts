import {
  GoGame,
  Stone,
  gtpCoordToPosition,
  type GameMove,
  type MovePreview,
  type Position,
} from './go-game.js';

const computerPassThreshold = 10;
const defaultKataGoTimeoutMs = 12000;

interface KataGoMoveCandidate {
  moveCoord: string;
  visits: number;
  winrate: number;
  scoreLead: number;
  prior: number;
  order: number;
  pv?: string[];
}

interface KataGoAnalysisPayload {
  id?: string;
  turnNumber?: number;
  moveInfos?: KataGoMoveCandidate[];
  rootInfo?: {
    winrate: number;
    scoreLead: number;
    visits: number;
    currentPlayer: string;
  };
}

export class ComputerPlayer {
  private readonly katagoServerUrl: string;

  constructor(customKataGoUrl?: string) {
    this.katagoServerUrl =
      customKataGoUrl || process.env.KATAGO_API_URL || 'http://127.0.0.1:2718';
  }

  async chooseMove(game: GoGame): Promise<GameMove> {
    const color = Stone.White;

    try {
      const selectedMove = await this.queryKataGoEngine(game, color);
      if (selectedMove) {
        return selectedMove;
      }
    } catch (engineError) {
      const errorMessage =
        engineError instanceof Error ? engineError.message : String(engineError);
      console.warn(
        `[ComputerPlayer] KataGo service unavailable (${errorMessage}); using local fallback heuristic.`,
      );
    }

    return this.chooseFallbackMove(game, color);
  }

  private async queryKataGoEngine(game: GoGame, color: Stone): Promise<GameMove | null> {
    const formattedMoves = game.getFormattedMoveHistory();
    const boardSize = game.getSize();
    const visits = game.getVisits();

    const requestBody = {
      moves: formattedMoves,
      boardXSize: boardSize,
      boardYSize: boardSize,
      rules: 'chinese',
      komi: 7.5,
      maxVisits: visits,
    };

    const abortController = new AbortController();
    const timeoutHandle = setTimeout(
      () => abortController.abort(),
      defaultKataGoTimeoutMs,
    );

    let httpResponse: Response;
    try {
      httpResponse = await fetch(`${this.katagoServerUrl}/api/v1/analysis`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: abortController.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }

    if (!httpResponse.ok) {
      throw new Error(`server responded with HTTP ${httpResponse.status}`);
    }

    const analysisData = (await httpResponse.json()) as KataGoAnalysisPayload;
    const candidates = analysisData.moveInfos;
    if (!candidates || candidates.length === 0) {
      return { kind: 'pass' };
    }

    // For beginner level, introduce natural human variation by sampling among top candidates
    let chosenCandidate = candidates[0];
    if (game.getDifficulty() === 'beginner' && candidates.length > 1) {
      const topSlice = candidates.slice(0, Math.min(3, candidates.length));
      const randomIndex = Math.floor(Math.random() * topSlice.length);
      chosenCandidate = topSlice[randomIndex];
    }

    const rawCoordinate = chosenCandidate.moveCoord?.trim();
    if (!rawCoordinate || rawCoordinate.toLowerCase() === 'pass') {
      return { kind: 'pass' };
    }
    if (rawCoordinate.toLowerCase() === 'resign') {
      return { kind: 'resign' };
    }

    const targetPosition = gtpCoordToPosition(rawCoordinate, boardSize);
    if (targetPosition && this.isLegalMove(game, color, targetPosition)) {
      return { kind: 'move', position: targetPosition };
    }

    // If the top sampled candidate was not legal, attempt other candidates in descending order
    for (const candidate of candidates) {
      const candidateCoord = candidate.moveCoord?.trim();
      if (!candidateCoord || candidateCoord.toLowerCase() === 'pass') {
        return { kind: 'pass' };
      }
      const candidatePosition = gtpCoordToPosition(candidateCoord, boardSize);
      if (candidatePosition && this.isLegalMove(game, color, candidatePosition)) {
        return { kind: 'move', position: candidatePosition };
      }
    }

    return { kind: 'pass' };
  }

  private isLegalMove(game: GoGame, color: Stone, position: Position): boolean {
    try {
      game.previewMove(color, position);
      return true;
    } catch {
      return false;
    }
  }

  private chooseFallbackMove(game: GoGame, color: Stone): GameMove {
    let bestMove: GameMove = { kind: 'pass' };
    let bestScore = Number.NEGATIVE_INFINITY;
    let legalMoveCount = 0;

    for (let y = 0; y < game.getSize(); y += 1) {
      for (let x = 0; x < game.getSize(); x += 1) {
        const position = { x, y };
        let preview: MovePreview;
        try {
          preview = game.previewMove(color, position);
        } catch {
          continue;
        }
        legalMoveCount += 1;

        const moveScore = this.evaluateMove(game, color, position, preview);
        if (moveScore > bestScore) {
          bestScore = moveScore;
          bestMove = { kind: 'move', position };
        }
      }
    }

    if (
      legalMoveCount === 0 ||
      (game.getConsecutivePasses() > 0 && bestScore < computerPassThreshold)
    ) {
      return { kind: 'pass' };
    }
    return bestMove;
  }

  private evaluateMove(
    game: GoGame,
    color: Stone,
    position: Position,
    preview: MovePreview,
  ): number {
    let moveScore = preview.capturedStones * 100;
    if (preview.ownLiberties === 1) {
      moveScore -= 80;
    } else {
      moveScore += Math.min(preview.ownLiberties, 4) * 4;
    }

    let emptyNeighbors = 0;
    let friendlyNeighbors = 0;
    for (const neighbor of game.adjacentPositions(position)) {
      const neighborStone = game.getStoneAt(neighbor);
      if (neighborStone === Stone.Empty) {
        emptyNeighbors += 1;
      } else if (neighborStone === color) {
        friendlyNeighbors += 1;
      }
    }
    moveScore += emptyNeighbors * 2;
    moveScore += friendlyNeighbors * 1.5;
    moveScore += this.countFriendlyAtariGroups(game, color, position) * 24;
    moveScore += this.countEnemyGroupsPutInAtari(game, color, position, preview.board) * 14;
    moveScore += this.evaluateBoardPosition(game, position);
    return moveScore;
  }

  private countFriendlyAtariGroups(game: GoGame, color: Stone, position: Position): number {
    const seenGroups = new Set<string>();
    let atariGroups = 0;
    for (const neighbor of game.adjacentPositions(position)) {
      if (game.getStoneAt(neighbor) !== color) {
        continue;
      }

      const group = game.collectGroupAt(neighbor);
      if (group.liberties !== 1) {
        continue;
      }

      const groupKey = this.positionKey(group.stones[0]);
      if (seenGroups.has(groupKey)) {
        continue;
      }
      seenGroups.add(groupKey);
      atariGroups += 1;
    }
    return atariGroups;
  }

  private countEnemyGroupsPutInAtari(
    game: GoGame,
    color: Stone,
    position: Position,
    candidateBoard: Stone[][],
  ): number {
    const opponent = this.opposite(color);
    const seenGroups = new Set<string>();
    let atariGroups = 0;
    for (const neighbor of game.adjacentPositions(position)) {
      if (candidateBoard[neighbor.y][neighbor.x] !== opponent) {
        continue;
      }

      const group = game.collectGroup(candidateBoard, neighbor);
      if (group.liberties !== 1) {
        continue;
      }

      const groupKey = this.positionKey(group.stones[0]);
      if (seenGroups.has(groupKey)) {
        continue;
      }
      seenGroups.add(groupKey);
      atariGroups += 1;
    }
    return atariGroups;
  }

  private evaluateBoardPosition(game: GoGame, position: Position): number {
    const boardSize = game.getSize();
    const targetLine = Math.max(2, Math.floor(boardSize / 5));
    const edgeDistance = Math.min(
      position.x,
      position.y,
      boardSize - 1 - position.x,
      boardSize - 1 - position.y,
    );
    let score = Math.max(0, 6 - Math.abs(edgeDistance - targetLine)) * 1.2;

    let stoneCount = 0;
    let nearestStoneDistance = boardSize * 2;
    for (let y = 0; y < boardSize; y += 1) {
      for (let x = 0; x < boardSize; x += 1) {
        if (game.getStoneAt({ x, y }) === Stone.Empty) {
          continue;
        }
        stoneCount += 1;
        nearestStoneDistance = Math.min(
          nearestStoneDistance,
          Math.abs(x - position.x) + Math.abs(y - position.y),
        );
      }
    }

    if (stoneCount === 0) {
      if (this.isStarPoint(boardSize, position, targetLine)) {
        score += 14;
      }
      return score;
    }

    const preferredSpacing = Math.max(3, Math.floor(boardSize / 4));
    score += Math.max(0, 7 - Math.abs(nearestStoneDistance - preferredSpacing)) * 0.8;
    if (edgeDistance <= 1) {
      score -= 4;
    }
    return score;
  }

  private isStarPoint(boardSize: number, position: Position, targetLine: number): boolean {
    return (
      (position.x === targetLine || position.x === boardSize - 1 - targetLine) &&
      (position.y === targetLine || position.y === boardSize - 1 - targetLine)
    );
  }

  private positionKey(position: Position): string {
    return `${position.x},${position.y}`;
  }

  private opposite(color: Stone): Stone {
    return color === Stone.Black ? Stone.White : Stone.Black;
  }
}
