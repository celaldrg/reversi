/**
 * Computer opponent: negamax with alpha-beta pruning and move ordering over a
 * heuristic evaluation (square weights, mobility, disc parity late in the
 * game). A search that reaches the last move is exact. Pure module, so it
 * runs in a module Web Worker (see ai-worker.js) as well as in Node tests.
 */
import {
  CELLS,
  EMPTY,
  PASS,
  countDiscs,
  countLegalMoves,
  getLegalMoves,
  hasLegalMove,
  makeMove,
  undoMove,
} from './board.js';
import { createRng } from './rng.js';

/** Difficulty levels accepted by chooseMove, weakest first. */
export const LEVELS = Object.freeze(['easy', 'medium', 'hard']);

// Value of a square to the disc owner: corners are prized, while the C and X
// squares next to an empty corner tend to hand that corner to the opponent.
const WEIGHTS = Object.freeze([
  120, -25, 15, 8, 8, 15, -25, 120,
  -25, -45, -4, -3, -3, -4, -45, -25,
  15, -4, 2, 1, 1, 2, -4, 15,
  8, -3, 1, 0, 0, 1, -3, 8,
  8, -3, 1, 0, 0, 1, -3, 8,
  15, -4, 2, 1, 1, 2, -4, 15,
  -25, -45, -4, -3, -3, -4, -45, -25,
  120, -25, 15, 8, 8, 15, -25, 120,
]);

// Each corner with its C and X squares, whose penalty lapses once the corner is taken.
const CORNER_ZONES = Object.freeze([
  { corner: 0, near: [1, 8, 9] },
  { corner: 7, near: [6, 15, 14] },
  { corner: 56, near: [57, 48, 49] },
  { corner: 63, near: [62, 55, 54] },
]);

// Every square, heaviest weight first: generating moves in this order is free move ordering.
const SQUARES_BY_WEIGHT = Object.freeze(
  Array.from({ length: CELLS }, (_, index) => index).sort((a, b) => WEIGHTS[b] - WEIGHTS[a]),
);

const MOBILITY_WEIGHT = 10; // per legal move more than the opponent has
const PARITY_EMPTIES = 20; // disc count starts to matter below this many empty squares
const WIN_SCORE = 100000; // a finished game outranks every heuristic score
const EASY_NOISE = 80; // range of the random bonus that makes "easy" sloppy
const MEDIUM_DEPTH = 3;
const ENDGAME_EMPTIES = 10; // from here on "hard" goes for a perfect solve
const SORT_DEPTH = 3; // nodes with at least this much depth left sort their moves
const DEFAULT_TIME_LIMIT_MS = 1000;
const CLOCK_CHECK_INTERVAL = 1024; // nodes between two looks at the clock
const TIMEOUT = Symbol('search timeout'); // thrown to unwind a search that ran out of time

/**
 * Scores a position for `player`; positive is good for `player`. A finished
 * game scores beyond +100000 when won and -100000 when lost (0 for a draw),
 * so a sure win beats any heuristic advantage.
 * @param {ArrayLike<number>} board
 * @param {number} player BLACK or WHITE
 * @returns {number}
 */
export function evaluate(board, player) {
  const ownMoves = countLegalMoves(board, player);
  const theirMoves = countLegalMoves(board, -player);
  if (ownMoves === 0 && theirMoves === 0) return finalScore(board, player);
  let positional = -lapsedPenalties(board);
  let balance = 0;
  let empties = 0;
  for (let index = 0; index < CELLS; index++) {
    const cell = board[index];
    if (cell === EMPTY) empties++;
    positional += WEIGHTS[index] * cell;
    balance += cell;
  }
  const parityWeight = Math.max(0, PARITY_EMPTIES - empties);
  return player * (positional + parityWeight * balance) + MOBILITY_WEIGHT * (ownMoves - theirMoves);
}

/**
 * Picks a move for `player`.
 * - easy: one ply of lookahead plus seeded random noise;
 * - medium: a 3-ply alpha-beta search;
 * - hard: iterative deepening within the time limit, and a perfect solve once
 *   10 or fewer squares are empty (when it finishes in time); a forced move
 *   (the only legal one) is played at once.
 * @param {ArrayLike<number>} board 64 cells, left untouched
 * @param {number} player BLACK or WHITE
 * @param {object} [options]
 * @param {'easy'|'medium'|'hard'} [options.level='medium']
 * @param {() => number} [options.rng] random source in [0, 1) for "easy"; defaults to a fixed seed
 * @param {number} [options.timeLimitMs=1000] thinking time for "hard"
 * @param {number} [options.maxDepth] depth cap for "hard"; needed with an infinite time limit
 * @param {() => number} [options.now=Date.now] clock in milliseconds for "hard"
 * @returns {{move: number, score: number, depth: number, exact: boolean}}
 *   `move` is a square index, or PASS when there is no legal move; with
 *   `exact` set, `score` is the final disc difference under perfect play
 * @throws {RangeError} for an unknown level
 */
export function chooseMove(board, player, options = {}) {
  const { level = 'medium' } = options;
  if (!LEVELS.includes(level)) throw new RangeError(`Unknown level: ${level}`);
  const moves = getLegalMoves(board, player, SQUARES_BY_WEIGHT);
  if (moves.length === 0) return { move: PASS, score: 0, depth: 0, exact: false };
  if (level === 'easy') return chooseEasyMove(board, player, moves, options.rng ?? createRng(1));
  if (level === 'medium') {
    const best = searchRoot(board, player, MEDIUM_DEPTH, moves, createSearch());
    return report(best, MEDIUM_DEPTH, countDiscs(board).empty);
  }
  return chooseHardMove(board, player, moves, options);
}

/** Black-minus-white sum of the C/X penalties that lapsed because their corner is taken. */
function lapsedPenalties(board) {
  let total = 0;
  for (const { corner, near } of CORNER_ZONES) {
    if (board[corner] === EMPTY) continue;
    for (const square of near) total += WEIGHTS[square] * board[square];
  }
  return total;
}

/** Score of a finished game: ±WIN_SCORE plus the disc difference. */
function finalScore(board, player) {
  let balance = 0;
  for (let index = 0; index < CELLS; index++) balance += board[index];
  const margin = player * balance;
  return Math.sign(margin) * WIN_SCORE + margin;
}

/** Turns a finished-game score back into the plain disc difference. */
function toDiscDifference(score) {
  return score - Math.sign(score) * WIN_SCORE;
}

/** Book-keeping for one search; `isExpired` is consulted every few nodes. */
function createSearch(isExpired = () => false) {
  return { isExpired, nodes: 0 };
}

function tick(search) {
  search.nodes++;
  if (search.nodes % CLOCK_CHECK_INTERVAL === 0 && search.isExpired()) throw TIMEOUT;
}

/** Fail-soft negamax with alpha-beta pruning; scores are from `player`'s side. */
function negamax(board, player, depth, alpha, beta, search) {
  tick(search);
  if (depth === 0) return evaluate(board, player);
  const moves = orderedMoves(board, player, depth);
  if (moves.length === 0) {
    if (!hasLegalMove(board, -player)) return finalScore(board, player);
    return -negamax(board, -player, depth, -beta, -alpha, search); // a pass costs no depth
  }
  let best = -Infinity;
  for (const move of moves) {
    const flips = makeMove(board, player, move);
    const score = -negamax(board, -player, depth - 1, -beta, -alpha, search);
    undoMove(board, player, move, flips);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

/**
 * Legal moves, likely best first. Deep nodes try the moves that leave the
 * opponent the fewest replies first; shallow ones keep the cheap weight order.
 */
function orderedMoves(board, player, depth) {
  const moves = getLegalMoves(board, player, SQUARES_BY_WEIGHT);
  if (depth < SORT_DEPTH || moves.length < 2) return moves;
  return moves
    .map((move) => ({ move, replies: repliesAfter(board, player, move) }))
    .sort((a, b) => a.replies - b.replies)
    .map(({ move }) => move);
}

function repliesAfter(board, player, move) {
  const flips = makeMove(board, player, move);
  const replies = countLegalMoves(board, -player);
  undoMove(board, player, move, flips);
  return replies;
}

/** Searches each root move `depth` plies deep on a private copy; the first best move wins ties. */
function searchRoot(position, player, depth, moves, search) {
  const board = Int8Array.from(position);
  let best = { move: moves[0], score: -Infinity };
  for (const move of moves) {
    const flips = makeMove(board, player, move);
    const score = -negamax(board, -player, depth - 1, -Infinity, -best.score, search);
    undoMove(board, player, move, flips);
    if (score > best.score) best = { move, score };
  }
  return best;
}

/** A search reaching every empty square sees only finished games, so its score is exact. */
function report({ move, score }, depth, empties) {
  const exact = depth >= empties;
  return { move, score: exact ? toDiscDifference(score) : score, depth, exact };
}

function chooseEasyMove(position, player, moves, rng) {
  const board = Int8Array.from(position);
  let best = null;
  for (const move of moves) {
    const flips = makeMove(board, player, move);
    const score = -evaluate(board, -player) + rng() * EASY_NOISE;
    undoMove(board, player, move, flips);
    if (best === null || score > best.score) best = { move, score };
  }
  return { ...best, depth: 1, exact: false };
}

/**
 * Iterative deepening until the deadline. Depth 1 always completes (and is
 * all a forced move gets); deeper iterations that run out of time are thrown
 * away. With few empty squares left, once a medium-depth answer is in hand,
 * it jumps straight to a full-depth (perfect) search.
 */
function chooseHardMove(position, player, moves, options) {
  const now = options.now ?? Date.now;
  const deadline = now() + (options.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS);
  const timed = createSearch(() => now() >= deadline);
  const empties = countDiscs(position).empty;
  // A forced move needs no deeper look: answer at once instead of using up the thinking time.
  const maxDepth = moves.length === 1 ? 1 : Math.min(options.maxDepth ?? empties, empties);
  let ordered = moves;
  let depth = 1;
  let best = searchRoot(position, player, depth, ordered, createSearch());
  while (depth < maxDepth) {
    const nextDepth = empties <= ENDGAME_EMPTIES && depth >= MEDIUM_DEPTH ? maxDepth : depth + 1;
    const found = unlessTimedOut(() => searchRoot(position, player, nextDepth, ordered, timed));
    if (!found) break;
    depth = nextDepth;
    best = found;
    ordered = [found.move, ...ordered.filter((move) => move !== found.move)];
  }
  return report(best, depth, empties);
}

/** Runs a search, or returns null when it hits the deadline. */
function unlessTimedOut(run) {
  try {
    return run();
  } catch (error) {
    if (error === TIMEOUT) return null;
    throw error;
  }
}
