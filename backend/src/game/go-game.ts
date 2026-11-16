export enum Stone {
  Empty,
  Black,
  White,
}

export type DifficultyLevel =
  | 'beginner'
  | 'easy'
  | 'medium'
  | 'hard'
  | 'master'
  | 'custom';

export const DIFFICULTY_VISITS: Record<Exclude<DifficultyLevel, 'custom'>, number> = {
  beginner: 5,
  easy: 20,
  medium: 80,
  hard: 250,
  master: 800,
};

const GTP_COLUMNS = 'ABCDEFGHJKLMNOPQRST';

export function positionToGtpCoord(position: Position, boardSize: number): string {
  const column = GTP_COLUMNS[position.x];
  const row = boardSize - position.y;
  return `${column}${row}`;
}

export function gtpCoordToPosition(coord: string, boardSize: number): Position | null {
  if (!coord || coord.length < 2) return null;
  const colLetter = coord[0].toUpperCase();
  const colIndex = GTP_COLUMNS.indexOf(colLetter);
  if (colIndex === -1 || colIndex >= boardSize) return null;
  const rowNumber = parseInt(coord.slice(1), 10);
  if (isNaN(rowNumber) || rowNumber < 1 || rowNumber > boardSize) return null;
  return {
    x: colIndex,
    y: boardSize - rowNumber,
  };
}

export interface Position {
  x: number;
  y: number;
}

export interface CaptureCounts {
  black: number;
  white: number;
}

export interface GameScore {
  blackArea: number;
  whiteArea: number;
  neutralArea: number;
  whiteKomi: number;
  blackTotal: number;
  whiteTotal: number;
  winner: string;
}

export interface GameResult {
  winner: string;
  reason: string;
  score?: GameScore;
}

export interface GameMetadata {
  name?: string;
  inviteCode?: string;
  gameMode?: 'PUBLIC' | 'PRIVATE';
  opponentType?: 'BOT' | 'HUMAN';
  creatorId?: string | null;
  blackPlayerId?: string | null;
  whitePlayerId?: string | null;
}

export interface GameSnapshot {
  id: string;
  name?: string;
  inviteCode?: string;
  gameMode?: 'PUBLIC' | 'PRIVATE';
  opponentType?: 'BOT' | 'HUMAN';
  creatorId?: string | null;
  blackPlayerId?: string | null;
  whitePlayerId?: string | null;
  size: number;
  board: string[][];
  toMove: string;
  humanColor: string;
  computerColor: string;
  captures: CaptureCounts;
  consecutivePasses: number;
  moveNumber: number;
  lastMove?: Position;
  status: 'active' | 'finished';
  difficulty: DifficultyLevel;
  visits: number;
  result?: GameResult;
}

export type GameMove =
  | { kind: 'move'; position: Position }
  | { kind: 'pass' }
  | { kind: 'resign' };

export interface MovePreview {
  board: Stone[][];
  capturedStones: number;
  ownLiberties: number;
}

export interface StoneGroup {
  stones: Position[];
  liberties: number;
}

export class GameRuleError extends Error {}

export class GoGame {
  private board: Stone[][];
  private readonly size: number;
  private toMove = Stone.Black;
  private readonly captures: CaptureCounts = { black: 0, white: 0 };
  private consecutivePasses = 0;
  private moveNumber = 0;
  private boardBeforeLastMove: Stone[][] | undefined;
  private lastMove: Position | undefined;
  private status: 'active' | 'finished' = 'active';
  private gameResult: GameResult | undefined;
  private readonly difficulty: DifficultyLevel;
  private readonly visits: number;
  private readonly moveHistory: Array<{ color: Stone; move: GameMove }> = [];
  private metadata: GameMetadata | undefined;

  setMetadata(metadata: Partial<GameMetadata>): void {
    this.metadata = { ...this.metadata, ...metadata };
  }

  getMetadata(): GameMetadata | undefined {
    return this.metadata;
  }

  constructor(
    private readonly id: string,
    boardSize: number | undefined,
    difficulty: DifficultyLevel = 'medium',
    customVisits?: number,
  ) {
    if (boardSize !== 9 && boardSize !== 19) {
      throw new GameRuleError('board size must be 9 or 19');
    }

    this.size = boardSize;
    this.board = Array.from({ length: boardSize }, () => Array<Stone>(boardSize).fill(Stone.Empty));
    this.difficulty = difficulty;
    if (difficulty === 'custom') {
      this.visits = Math.max(1, Math.min(2000, customVisits ?? 100));
    } else {
      this.visits = DIFFICULTY_VISITS[difficulty] ?? DIFFICULTY_VISITS.medium;
    }
  }

  getSize(): number {
    return this.size;
  }

  getDifficulty(): DifficultyLevel {
    return this.difficulty;
  }

  getVisits(): number {
    return this.visits;
  }

  getMoveHistory(): Array<{ color: Stone; move: GameMove }> {
    return [...this.moveHistory];
  }

  getFormattedMoveHistory(): Array<[string, string]> {
    return this.moveHistory.map((entry) => {
      const colorLetter = entry.color === Stone.Black ? 'B' : 'W';
      let moveStr = 'pass';
      if (entry.move.kind === 'move') {
        moveStr = positionToGtpCoord(entry.move.position, this.size);
      }
      return [colorLetter, moveStr];
    });
  }

  getStatus(): 'active' | 'finished' {
    return this.status;
  }

  getConsecutivePasses(): number {
    return this.consecutivePasses;
  }

  getStoneAt(position: Position): Stone {
    return this.board[position.y][position.x];
  }

  collectGroupAt(position: Position): StoneGroup {
    return this.collectGroup(this.board, position);
  }

  getSnapshot(): GameSnapshot {
    const snapshot: GameSnapshot = {
      id: this.id,
      size: this.getSize(),
      board: this.board.map((row) => row.map((stone) => this.stoneName(stone))),
      toMove: this.stoneName(this.toMove),
      humanColor: this.stoneName(Stone.Black),
      computerColor: this.stoneName(Stone.White),
      captures: { ...this.captures },
      consecutivePasses: this.consecutivePasses,
      moveNumber: this.moveNumber,
      status: this.status,
      difficulty: this.difficulty,
      visits: this.visits,
    };

    if (this.lastMove) {
      snapshot.lastMove = { ...this.lastMove };
    }
    if (this.gameResult) {
      snapshot.result = {
        ...this.gameResult,
        ...(this.gameResult.score ? { score: { ...this.gameResult.score } } : {}),
      };
    }
    if (this.metadata) {
      Object.assign(snapshot, this.metadata);
    }

    return snapshot;
  }

  play(color: Stone, move: GameMove): void {
    if (this.status !== 'active') {
      throw new GameRuleError('the game has finished');
    }
    if (color !== this.toMove) {
      throw new GameRuleError("it is not this color's turn");
    }

    switch (move.kind) {
      case 'move':
        this.placeStone(color, move.position);
        this.moveHistory.push({ color, move });
        return;
      case 'pass':
        this.boardBeforeLastMove = this.cloneBoard(this.board);
        this.consecutivePasses += 1;
        this.moveNumber += 1;
        this.lastMove = undefined;
        this.toMove = this.opposite(color);
        this.moveHistory.push({ color, move });
        if (this.consecutivePasses >= 2) {
          this.finishByAreaScore();
        }
        return;
      case 'resign':
        this.status = 'finished';
        this.moveHistory.push({ color, move });
        this.gameResult = {
          winner: this.stoneName(this.opposite(color)),
          reason: 'resignation',
        };
        return;
      default:
        throw new GameRuleError('move type must be move, pass, or resign');
    }
  }

  previewMove(color: Stone, position: Position): MovePreview {
    if (color !== Stone.Black && color !== Stone.White) {
      throw new GameRuleError("it is not this color's turn");
    }
    if (!this.isOnBoard(position)) {
      throw new GameRuleError('intersection is outside the board');
    }
    if (this.board[position.y][position.x] !== Stone.Empty) {
      throw new GameRuleError('intersection is already occupied');
    }

    const candidateBoard = this.cloneBoard(this.board);
    candidateBoard[position.y][position.x] = color;
    const opponent = this.opposite(color);
    let capturedStones = 0;

    for (const neighbor of this.adjacentPositions(position)) {
      if (candidateBoard[neighbor.y][neighbor.x] !== opponent) {
        continue;
      }

      const enemyGroup = this.collectGroup(candidateBoard, neighbor);
      if (enemyGroup.liberties === 0) {
        for (const capturedPosition of enemyGroup.stones) {
          candidateBoard[capturedPosition.y][capturedPosition.x] = Stone.Empty;
          capturedStones += 1;
        }
      }
    }

    const ownGroup = this.collectGroup(candidateBoard, position);
    if (ownGroup.liberties === 0) {
      throw new GameRuleError('suicide moves are not allowed');
    }
    if (
      this.boardBeforeLastMove &&
      this.isSameBoardPosition(candidateBoard, this.boardBeforeLastMove)
    ) {
      throw new GameRuleError('move repeats the previous board position');
    }

    return {
      board: candidateBoard,
      capturedStones,
      ownLiberties: ownGroup.liberties,
    };
  }

  private placeStone(color: Stone, position: Position): void {
    const preview = this.previewMove(color, position);
    const boardBeforeMove = this.board;
    this.board = preview.board;
    this.boardBeforeLastMove = boardBeforeMove;
    this.consecutivePasses = 0;
    this.moveNumber += 1;
    this.lastMove = { x: position.x, y: position.y };
    this.toMove = this.opposite(color);

    if (color === Stone.Black) {
      this.captures.black += preview.capturedStones;
    } else {
      this.captures.white += preview.capturedStones;
    }
  }

  private finishByAreaScore(): void {
    const score = this.calculateAreaScore();
    let winner = 'draw';
    if (score.blackTotal > score.whiteTotal) {
      winner = this.stoneName(Stone.Black);
    } else if (score.whiteTotal > score.blackTotal) {
      winner = this.stoneName(Stone.White);
    }

    score.winner = winner;
    this.status = 'finished';
    this.gameResult = { winner, reason: 'area_score', score };
  }

  private calculateAreaScore(): GameScore {
    const score: GameScore = {
      blackArea: 0,
      whiteArea: 0,
      neutralArea: 0,
      whiteKomi: 7.5,
      blackTotal: 0,
      whiteTotal: 0,
      winner: '',
    };
    const hasVisitedPosition = Array.from(
      { length: this.getSize() },
      () => Array<boolean>(this.getSize()).fill(false),
    );

    for (let y = 0; y < this.getSize(); y += 1) {
      for (let x = 0; x < this.getSize(); x += 1) {
        const stone = this.board[y][x];
        if (stone === Stone.Black) {
          score.blackArea += 1;
        } else if (stone === Stone.White) {
          score.whiteArea += 1;
        }

        if (stone !== Stone.Empty || hasVisitedPosition[y][x]) {
          continue;
        }

        const region = this.collectEmptyRegion({ x, y }, hasVisitedPosition);
        if (region.isBorderedByBlack && !region.isBorderedByWhite) {
          score.blackArea += region.size;
        } else if (region.isBorderedByWhite && !region.isBorderedByBlack) {
          score.whiteArea += region.size;
        } else {
          score.neutralArea += region.size;
        }
      }
    }

    score.blackTotal = score.blackArea;
    score.whiteTotal = score.whiteArea + score.whiteKomi;
    return score;
  }

  private collectEmptyRegion(
    start: Position,
    hasVisitedPosition: boolean[][],
  ): { size: number; isBorderedByBlack: boolean; isBorderedByWhite: boolean } {
    const queue: Position[] = [start];
    hasVisitedPosition[start.y][start.x] = true;
    let regionSize = 0;
    let isBorderedByBlack = false;
    let isBorderedByWhite = false;

    let queuePosition = 0;
    while (queuePosition < queue.length) {
      const position = queue[queuePosition]!;
      queuePosition += 1;
      regionSize += 1;
      for (const neighbor of this.adjacentPositions(position)) {
        const stone = this.board[neighbor.y][neighbor.x];
        if (stone === Stone.Black) {
          isBorderedByBlack = true;
        } else if (stone === Stone.White) {
          isBorderedByWhite = true;
        } else if (!hasVisitedPosition[neighbor.y][neighbor.x]) {
          hasVisitedPosition[neighbor.y][neighbor.x] = true;
          queue.push(neighbor);
        }
      }
    }

    return { size: regionSize, isBorderedByBlack, isBorderedByWhite };
  }

  collectGroup(board: Stone[][], start: Position): StoneGroup {
    const color = board[start.y][start.x];
    if (color === Stone.Empty) {
      return { stones: [], liberties: 0 };
    }

    const stones: Position[] = [];
    const queue: Position[] = [start];
    const visitedStones = new Set<string>([this.positionKey(start)]);
    const liberties = new Set<string>();

    let queuePosition = 0;
    while (queuePosition < queue.length) {
      const position = queue[queuePosition]!;
      queuePosition += 1;
      stones.push(position);
      for (const neighbor of this.adjacentPositions(position)) {
        const neighborStone = board[neighbor.y][neighbor.x];
        if (neighborStone === Stone.Empty) {
          liberties.add(this.positionKey(neighbor));
          continue;
        }
        if (neighborStone !== color) {
          continue;
        }

        const neighborKey = this.positionKey(neighbor);
        if (visitedStones.has(neighborKey)) {
          continue;
        }
        visitedStones.add(neighborKey);
        queue.push(neighbor);
      }
    }

    return { stones, liberties: liberties.size };
  }

  adjacentPositions(position: Position): Position[] {
    const candidates: Position[] = [
      { x: position.x - 1, y: position.y },
      { x: position.x + 1, y: position.y },
      { x: position.x, y: position.y - 1 },
      { x: position.x, y: position.y + 1 },
    ];

    return candidates.filter((candidate) => this.isOnBoard(candidate));
  }

  private isOnBoard(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x < this.getSize() &&
      position.y >= 0 &&
      position.y < this.getSize()
    );
  }

  private cloneBoard(board: Stone[][]): Stone[][] {
    return board.map((row) => [...row]);
  }

  private isSameBoardPosition(first: Stone[][], second: Stone[][]): boolean {
    if (first.length !== second.length) {
      return false;
    }
    for (let y = 0; y < first.length; y += 1) {
      if (first[y].length !== second[y].length) {
        return false;
      }
      for (let x = 0; x < first[y].length; x += 1) {
        if (first[y][x] !== second[y][x]) {
          return false;
        }
      }
    }
    return true;
  }

  private positionKey(position: Position): string {
    return `${position.x},${position.y}`;
  }

  private opposite(color: Stone): Stone {
    return color === Stone.Black ? Stone.White : Stone.Black;
  }

  private stoneName(stone: Stone): string {
    switch (stone) {
      case Stone.Black:
        return 'black';
      case Stone.White:
        return 'white';
      default:
        return 'empty';
    }
  }
}
