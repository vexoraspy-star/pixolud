import { allLegalMoves, applyMove, getGameStatus, type ChessMove, type ChessState, type PieceType } from "./chess";

export type BotLevel = "apprenti" | "normal" | "expert";

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

const DEPTH_BY_LEVEL: Record<BotLevel, number> = {
  apprenti: 0,
  normal: 2,
  expert: 3,
};

function materialScore(state: ChessState): number {
  let score = 0;
  for (const row of state.board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUES[piece.type];
      score += piece.color === "w" ? value : -value;
    }
  }
  return score;
}

/** Score du point de vue du joueur au trait (convention negamax). */
function evaluate(state: ChessState): number {
  const status = getGameStatus(state);
  if (status === "checkmate") return -1_000_000;
  if (status === "stalemate") return 0;
  const material = materialScore(state);
  return state.turn === "w" ? material : -material;
}

function orderedMoves(state: ChessState): { from: [number, number]; to: [number, number] }[] {
  const moves = allLegalMoves(state);
  return moves.sort((a, b) => {
    const capA = state.board[a.to[1]][a.to[0]] ? 1 : 0;
    const capB = state.board[b.to[1]][b.to[0]] ? 1 : 0;
    return capB - capA;
  });
}

function negamax(state: ChessState, depth: number, alpha: number, beta: number): number {
  const status = getGameStatus(state);
  if (status === "checkmate") return -1_000_000 + (3 - depth);
  if (status === "stalemate") return 0;
  if (depth === 0) return evaluate(state);

  let best = -Infinity;
  for (const move of orderedMoves(state)) {
    const next = applyMove(state, move);
    const score = -negamax(next, depth - 1, -beta, -alpha);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function pickBotMove(state: ChessState, level: BotLevel): ChessMove | null {
  const moves = allLegalMoves(state);
  if (moves.length === 0) return null;

  if (level === "apprenti") {
    // Prefere une capture une fois sur deux si possible, sinon un coup au hasard.
    const captures = moves.filter((m) => state.board[m.to[1]][m.to[0]]);
    if (captures.length > 0 && Math.random() < 0.5) return randomChoice(captures);
    return randomChoice(moves);
  }

  const depth = DEPTH_BY_LEVEL[level];
  let bestMove: ChessMove = moves[0];
  let bestScore = -Infinity;
  let alpha = -Infinity;
  const beta = Infinity;

  for (const move of orderedMoves(state)) {
    const next = applyMove(state, move);
    const score = -negamax(next, depth - 1, -beta, -alpha);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
    if (bestScore > alpha) alpha = bestScore;
  }

  return bestMove;
}
