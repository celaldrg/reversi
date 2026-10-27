/**
 * Reversi rules on a compact 64-cell board. Pure functions only (no DOM, no
 * storage, no randomness), so the module runs in pages, workers and Node.
 *
 * A board is an array-like of 64 cells holding BLACK (1), WHITE (-1) or
 * EMPTY (0). Square index = row * 8 + col, where row 0 is rank "1" at the top
 * and col 0 is file "a" on the left: "a1" is 0 and "h8" is 63.
 * The opponent of `player` is always `-player`.
 */

export const SIZE = 8;
export const CELLS = SIZE * SIZE;
export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = -1;
/** Move value meaning "no legal move, the turn passes". */
export const PASS = -1;

const FILES = 'abcdefgh';
const SYMBOLS = Object.freeze({ B: BLACK, W: WHITE, '.': EMPTY });
const ALL_SQUARES = Object.freeze(Array.from({ length: CELLS }, (_, index) => index));
const DIRECTIONS = Object.freeze([
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
]);

/**
 * RAYS[index] lists, per direction, the squares met when walking from `index`
 * to the edge. Rays shorter than two squares can never flank, so they are left out.
 */
const RAYS = ALL_SQUARES.map((index) =>
  DIRECTIONS.map(([rowStep, colStep]) => walkToEdge(index, rowStep, colStep)).filter((ray) => ray.length > 1),
);

function walkToEdge(index, rowStep, colStep) {
  const ray = [];
  let row = Math.floor(index / SIZE) + rowStep;
  let col = (index % SIZE) + colStep;
  while (row >= 0 && row < SIZE && col >= 0 && col < SIZE) {
    ray.push(row * SIZE + col);
    row += rowStep;
    col += colStep;
  }
  return ray;
}

/** How many opponent discs a ray flanks: a run of them closed by `player`, else 0. */
function flankedCount(board, player, ray) {
  for (let step = 0; step < ray.length; step++) {
    const cell = board[ray[step]];
    if (cell === player) return step;
    if (cell !== -player) return 0;
  }
  return 0;
}

/**
 * Creates the standard start position: white on d4 and e5, black on e4 and d5.
 * @returns {number[]} a new board
 */
export function createBoard() {
  const board = new Array(CELLS).fill(EMPTY);
  board[fromAlgebraic('d4')] = WHITE;
  board[fromAlgebraic('e5')] = WHITE;
  board[fromAlgebraic('e4')] = BLACK;
  board[fromAlgebraic('d5')] = BLACK;
  return board;
}

/**
 * Builds a board from a text diagram: eight rows of eight cells, "B" for
 * black, "W" for white and "." for empty. Whitespace is ignored.
 * @param {string} diagram
 * @returns {number[]}
 * @throws {RangeError} unless the diagram holds exactly 64 valid cells
 */
export function parseBoard(diagram) {
  const symbols = [...diagram.replace(/\s+/g, '')];
  if (symbols.length !== CELLS || !symbols.every((symbol) => Object.hasOwn(SYMBOLS, symbol))) {
    throw new RangeError('A board diagram needs 64 cells of "B", "W" or "."');
  }
  return symbols.map((symbol) => SYMBOLS[symbol]);
}

/**
 * Names a square in algebraic notation.
 * @param {number} index 0..63
 * @returns {string} "a1".."h8"
 * @throws {RangeError} for an index outside the board
 */
export function toAlgebraic(index) {
  if (!Number.isInteger(index) || index < 0 || index >= CELLS) {
    throw new RangeError(`Not a square index: ${index}`);
  }
  return FILES[index % SIZE] + (Math.floor(index / SIZE) + 1);
}

/**
 * Converts algebraic notation (case-insensitive) to a square index.
 * @param {string} square "a1".."h8"
 * @returns {number} 0..63
 * @throws {RangeError} for anything that is not a square name
 */
export function fromAlgebraic(square) {
  const match = /^([a-h])([1-8])$/i.exec(square);
  if (!match) throw new RangeError(`Not a square: ${square}`);
  return (Number(match[2]) - 1) * SIZE + FILES.indexOf(match[1].toLowerCase());
}

/**
 * Tells whether `player` may place a disc on `index`.
 * @param {ArrayLike<number>} board
 * @param {number} player BLACK or WHITE
 * @param {number} index square 0..63 (anything else is simply illegal)
 * @returns {boolean}
 */
export function isLegalMove(board, player, index) {
  if (board[index] !== EMPTY) return false;
  return RAYS[index].some((ray) => flankedCount(board, player, ray) > 0);
}

/**
 * Lists the discs a move would flip, nearest first along each line.
 * @param {ArrayLike<number>} board
 * @param {number} player BLACK or WHITE
 * @param {number} index square 0..63
 * @returns {number[]} flipped squares; empty when the move is illegal
 */
export function getFlips(board, player, index) {
  const flips = [];
  if (board[index] !== EMPTY) return flips;
  for (const ray of RAYS[index]) {
    const count = flankedCount(board, player, ray);
    for (let step = 0; step < count; step++) flips.push(ray[step]);
  }
  return flips;
}

/**
 * Lists the legal moves of `player`.
 * @param {ArrayLike<number>} board
 * @param {number} player BLACK or WHITE
 * @param {readonly number[]} [squares] squares to try, in the order the result keeps
 * @returns {number[]}
 */
export function getLegalMoves(board, player, squares = ALL_SQUARES) {
  return squares.filter((index) => isLegalMove(board, player, index));
}

/**
 * Counts the legal moves of `player` (its mobility) without building a list.
 * @param {ArrayLike<number>} board
 * @param {number} player BLACK or WHITE
 * @returns {number}
 */
export function countLegalMoves(board, player) {
  let count = 0;
  for (let index = 0; index < CELLS; index++) {
    if (isLegalMove(board, player, index)) count++;
  }
  return count;
}

/**
 * Tells whether `player` has at least one legal move.
 * @param {ArrayLike<number>} board
 * @param {number} player BLACK or WHITE
 * @returns {boolean}
 */
export function hasLegalMove(board, player) {
  return ALL_SQUARES.some((index) => isLegalMove(board, player, index));
}

/**
 * Plays a move in place: places the disc and flips every flanked line.
 * An illegal move leaves the board untouched.
 * @param {number[]|Int8Array} board mutated
 * @param {number} player BLACK or WHITE
 * @param {number} index square 0..63
 * @returns {number[]} the flipped squares (empty for an illegal move), for undoMove
 */
export function makeMove(board, player, index) {
  const flips = getFlips(board, player, index);
  if (flips.length > 0) {
    board[index] = player;
    for (const square of flips) board[square] = player;
  }
  return flips;
}

/**
 * Takes back a move made with makeMove, in place.
 * @param {number[]|Int8Array} board mutated
 * @param {number} player the player who made the move
 * @param {number} index the square the disc was placed on
 * @param {readonly number[]} flips what makeMove returned
 */
export function undoMove(board, player, index, flips) {
  board[index] = EMPTY;
  for (const square of flips) board[square] = -player;
}

/**
 * Plays a move on a copy of the board.
 * @param {ArrayLike<number>} board left untouched
 * @param {number} player BLACK or WHITE
 * @param {number} index square 0..63
 * @returns {{board: number[], flips: number[]} | null} null when the move is illegal
 */
export function applyMove(board, player, index) {
  const next = Array.from(board);
  const flips = makeMove(next, player, index);
  return flips.length > 0 ? { board: next, flips } : null;
}

/**
 * Works out who actually moves when it is `due`'s turn: `due` if they can,
 * otherwise the opponent (so `due` passes), or EMPTY when neither side can
 * move and the game is over.
 * @param {ArrayLike<number>} board
 * @param {number} due BLACK or WHITE
 * @returns {number} BLACK, WHITE or EMPTY
 */
export function resolveTurn(board, due) {
  if (hasLegalMove(board, due)) return due;
  if (hasLegalMove(board, -due)) return -due;
  return EMPTY;
}

/**
 * Tells whether the game is over, i.e. neither side has a legal move.
 * @param {ArrayLike<number>} board
 * @returns {boolean}
 */
export function isGameOver(board) {
  return resolveTurn(board, BLACK) === EMPTY;
}

/**
 * Counts the discs of each colour and the empty squares.
 * @param {ArrayLike<number>} board
 * @returns {{black: number, white: number, empty: number}}
 */
export function countDiscs(board) {
  const count = { black: 0, white: 0, empty: 0 };
  for (let index = 0; index < CELLS; index++) {
    if (board[index] === BLACK) count.black++;
    else if (board[index] === WHITE) count.white++;
    else count.empty++;
  }
  return count;
}

/**
 * Decides the game by disc count.
 * @param {ArrayLike<number>} board
 * @returns {number} BLACK or WHITE for the side with more discs, EMPTY for a draw
 */
export function getWinner(board) {
  const { black, white } = countDiscs(board);
  if (black === white) return EMPTY;
  return black > white ? BLACK : WHITE;
}

/**
 * Counts the positions reached after exactly `depth` plies ("perft").
 * A forced pass counts as a ply; a game that ends sooner adds nothing.
 * From the start position, depths 1..6 give 4, 12, 56, 244, 1396 and 8200.
 * @param {ArrayLike<number>} board left untouched
 * @param {number} player side to move
 * @param {number} depth plies, 0 or more
 * @returns {number}
 */
export function perft(board, player, depth) {
  return countLeaves(Int8Array.from(board), player, depth);
}

function countLeaves(board, player, depth) {
  if (depth === 0) return 1;
  const moves = getLegalMoves(board, player);
  if (moves.length === 0) {
    return hasLegalMove(board, -player) ? countLeaves(board, -player, depth - 1) : 0;
  }
  let leaves = 0;
  for (const index of moves) {
    const flips = makeMove(board, player, index);
    leaves += countLeaves(board, -player, depth - 1);
    undoMove(board, player, index, flips);
  }
  return leaves;
}
