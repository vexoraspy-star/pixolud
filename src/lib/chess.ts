export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Square = [number, number]; // [file 0-7 (a-h), rank 0-7 (1-8)]

export type Board = (Piece | null)[][]; // board[rank][file]

export interface CastlingRights {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export interface ChessMove {
  from: Square;
  to: Square;
  promotion?: PieceType;
}

export interface ChessState {
  board: Board;
  turn: Color;
  castling: CastlingRights;
  enPassant: Square | null;
  lastMove: ChessMove | null;
}

export function initialBoard(): Board {
  const back: PieceType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: Board = Array.from({ length: 8 }, () => Array<Piece | null>(8).fill(null));
  for (let x = 0; x < 8; x++) {
    board[0][x] = { type: back[x], color: "w" };
    board[1][x] = { type: "p", color: "w" };
    board[6][x] = { type: "p", color: "b" };
    board[7][x] = { type: back[x], color: "b" };
  }
  return board;
}

export function initialState(): ChessState {
  return {
    board: initialBoard(),
    turn: "w",
    castling: { wk: true, wq: true, bk: true, bq: true },
    enPassant: null,
    lastMove: null,
  };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && x < 8 && y >= 0 && y < 8;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function cloneState(state: ChessState): ChessState {
  return {
    board: cloneBoard(state.board),
    turn: state.turn,
    castling: { ...state.castling },
    enPassant: state.enPassant ? [...state.enPassant] : null,
    lastMove: state.lastMove
      ? { from: [...state.lastMove.from], to: [...state.lastMove.to], promotion: state.lastMove.promotion }
      : null,
  };
}

const ROOK_DIRS: Square[] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS: Square[] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];
const KNIGHT_OFFSETS: Square[] = [
  [1, 2],
  [2, 1],
  [-1, 2],
  [-2, 1],
  [1, -2],
  [2, -1],
  [-1, -2],
  [-2, -1],
];

function opposite(color: Color): Color {
  return color === "w" ? "b" : "w";
}

/** Cases attaquees par `color`, sans se soucier de la sécurité du roi (sert a la detection d'echec). */
export function isSquareAttacked(board: Board, x: number, y: number, byColor: Color): boolean {
  const dir = byColor === "w" ? 1 : -1;
  for (const dx of [-1, 1]) {
    const px = x + dx;
    const py = y - dir;
    if (inBounds(px, py)) {
      const p = board[py][px];
      if (p && p.color === byColor && p.type === "p") return true;
    }
  }

  for (const [dx, dy] of KNIGHT_OFFSETS) {
    const nx = x + dx;
    const ny = y + dy;
    if (inBounds(nx, ny)) {
      const p = board[ny][nx];
      if (p && p.color === byColor && p.type === "n") return true;
    }
  }

  for (const [dx, dy] of ROOK_DIRS) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny)) {
      const p = board[ny][nx];
      if (p) {
        if (p.color === byColor && (p.type === "r" || p.type === "q")) return true;
        break;
      }
      nx += dx;
      ny += dy;
    }
  }

  for (const [dx, dy] of BISHOP_DIRS) {
    let nx = x + dx;
    let ny = y + dy;
    while (inBounds(nx, ny)) {
      const p = board[ny][nx];
      if (p) {
        if (p.color === byColor && (p.type === "b" || p.type === "q")) return true;
        break;
      }
      nx += dx;
      ny += dy;
    }
  }

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (inBounds(nx, ny)) {
        const p = board[ny][nx];
        if (p && p.color === byColor && p.type === "k") return true;
      }
    }
  }

  return false;
}

function findKing(board: Board, color: Color): Square | null {
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const p = board[y][x];
      if (p && p.color === color && p.type === "k") return [x, y];
    }
  }
  return null;
}

export function isInCheck(board: Board, color: Color): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], opposite(color));
}

/** Coups pseudo-legaux (sans filtrer les coups qui laissent son propre roi en echec). */
function pseudoMovesFor(state: ChessState, x: number, y: number): Square[] {
  const piece = state.board[y][x];
  if (!piece) return [];
  const { board } = state;
  const moves: Square[] = [];

  if (piece.type === "p") {
    const dir = piece.color === "w" ? 1 : -1;
    const startRank = piece.color === "w" ? 1 : 6;
    if (inBounds(x, y + dir) && !board[y + dir][x]) {
      moves.push([x, y + dir]);
      if (y === startRank && !board[y + 2 * dir][x]) {
        moves.push([x, y + 2 * dir]);
      }
    }
    for (const dx of [-1, 1]) {
      const nx = x + dx;
      const ny = y + dir;
      if (!inBounds(nx, ny)) continue;
      const target = board[ny][nx];
      if (target && target.color !== piece.color) {
        moves.push([nx, ny]);
      } else if (state.enPassant && state.enPassant[0] === nx && state.enPassant[1] === ny) {
        moves.push([nx, ny]);
      }
    }
  } else if (piece.type === "n") {
    for (const [dx, dy] of KNIGHT_OFFSETS) {
      const nx = x + dx;
      const ny = y + dy;
      if (!inBounds(nx, ny)) continue;
      const target = board[ny][nx];
      if (!target || target.color !== piece.color) moves.push([nx, ny]);
    }
  } else if (piece.type === "b" || piece.type === "r" || piece.type === "q") {
    const dirs = piece.type === "b" ? BISHOP_DIRS : piece.type === "r" ? ROOK_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
    for (const [dx, dy] of dirs) {
      let nx = x + dx;
      let ny = y + dy;
      while (inBounds(nx, ny)) {
        const target = board[ny][nx];
        if (!target) {
          moves.push([nx, ny]);
        } else {
          if (target.color !== piece.color) moves.push([nx, ny]);
          break;
        }
        nx += dx;
        ny += dy;
      }
    }
  } else if (piece.type === "k") {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (!inBounds(nx, ny)) continue;
        const target = board[ny][nx];
        if (!target || target.color !== piece.color) moves.push([nx, ny]);
      }
    }

    const rank = piece.color === "w" ? 0 : 7;
    if (y === rank && x === 4 && !isInCheck(board, piece.color)) {
      const kingSideRight = piece.color === "w" ? state.castling.wk : state.castling.bk;
      const queenSideRight = piece.color === "w" ? state.castling.wq : state.castling.bq;
      const enemy = opposite(piece.color);

      if (
        kingSideRight &&
        !board[rank][5] &&
        !board[rank][6] &&
        board[rank][7]?.type === "r" &&
        board[rank][7]?.color === piece.color &&
        !isSquareAttacked(board, 5, rank, enemy) &&
        !isSquareAttacked(board, 6, rank, enemy)
      ) {
        moves.push([6, rank]);
      }

      if (
        queenSideRight &&
        !board[rank][3] &&
        !board[rank][2] &&
        !board[rank][1] &&
        board[rank][0]?.type === "r" &&
        board[rank][0]?.color === piece.color &&
        !isSquareAttacked(board, 3, rank, enemy) &&
        !isSquareAttacked(board, 2, rank, enemy)
      ) {
        moves.push([2, rank]);
      }
    }
  }

  return moves;
}

export function applyMove(state: ChessState, move: ChessMove): ChessState {
  const next = cloneState(state);
  const [fx, fy] = move.from;
  const [tx, ty] = move.to;
  const piece = next.board[fy][fx];
  if (!piece) return next;

  const isEnPassantCapture =
    piece.type === "p" && !!state.enPassant && tx === state.enPassant[0] && ty === state.enPassant[1] && fx !== tx;
  if (isEnPassantCapture) {
    next.board[fy][tx] = null;
  }

  const isCastle = piece.type === "k" && Math.abs(tx - fx) === 2;
  if (isCastle) {
    const rank = fy;
    if (tx === 6) {
      next.board[rank][5] = next.board[rank][7];
      next.board[rank][7] = null;
    } else if (tx === 2) {
      next.board[rank][3] = next.board[rank][0];
      next.board[rank][0] = null;
    }
  }

  next.board[fy][fx] = null;
  next.board[ty][tx] =
    piece.type === "p" && (ty === 0 || ty === 7)
      ? { type: move.promotion ?? "q", color: piece.color }
      : piece;

  if (piece.type === "k") {
    if (piece.color === "w") {
      next.castling.wk = false;
      next.castling.wq = false;
    } else {
      next.castling.bk = false;
      next.castling.bq = false;
    }
  }
  if (fx === 0 && fy === 0) next.castling.wq = false;
  if (fx === 7 && fy === 0) next.castling.wk = false;
  if (fx === 0 && fy === 7) next.castling.bq = false;
  if (fx === 7 && fy === 7) next.castling.bk = false;
  if (tx === 0 && ty === 0) next.castling.wq = false;
  if (tx === 7 && ty === 0) next.castling.wk = false;
  if (tx === 0 && ty === 7) next.castling.bq = false;
  if (tx === 7 && ty === 7) next.castling.bk = false;

  next.enPassant =
    piece.type === "p" && Math.abs(ty - fy) === 2 ? [fx, (fy + ty) / 2] : null;

  next.turn = opposite(piece.color);
  next.lastMove = { from: [fx, fy], to: [tx, ty], promotion: move.promotion };

  return next;
}

/** Coups legaux pour la piece en (x,y) : filtre les coups qui laisseraient son propre roi en echec. */
export function legalMovesFrom(state: ChessState, x: number, y: number): Square[] {
  const piece = state.board[y][x];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = pseudoMovesFor(state, x, y);
  return pseudo.filter(([tx, ty]) => {
    const after = applyMove(state, { from: [x, y], to: [tx, ty] });
    return !isInCheck(after.board, piece.color);
  });
}

export function allLegalMoves(state: ChessState): { from: Square; to: Square }[] {
  const moves: { from: Square; to: Square }[] = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const piece = state.board[y][x];
      if (!piece || piece.color !== state.turn) continue;
      for (const to of legalMovesFrom(state, x, y)) {
        moves.push({ from: [x, y], to });
      }
    }
  }
  return moves;
}

export type GameStatus = "playing" | "check" | "checkmate" | "stalemate";

export function getGameStatus(state: ChessState): GameStatus {
  const inCheck = isInCheck(state.board, state.turn);
  const hasMoves = allLegalMoves(state).length > 0;
  if (!hasMoves) return inCheck ? "checkmate" : "stalemate";
  return inCheck ? "check" : "playing";
}

export const PIECE_SYMBOLS: Record<Color, Record<PieceType, string>> = {
  w: { p: "♙", n: "♘", b: "♗", r: "♖", q: "♕", k: "♔" },
  b: { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" },
};
