/**
 * Game flow for the UI: immutable snapshots with automatic passes, game-over
 * detection and undo. Pure module (no DOM, no storage, no timers).
 */
import {
  BLACK,
  EMPTY,
  WHITE,
  applyMove,
  countDiscs,
  createBoard,
  fromAlgebraic,
  getLegalMoves,
  getWinner,
  resolveTurn,
} from './board.js';
import { LEVELS } from './ai.js';

/** Game modes: against the computer, or two people sharing one device. */
export const MODES = Object.freeze(['ai', 'pvp']);

const DEFAULT_SETTINGS = Object.freeze({ mode: 'ai', humanColor: BLACK, level: 'medium' });

// Opening replayed by createDemoGame: 16 moves, 20 discs, black to move.
const DEMO_LINE = Object.freeze('d3 c3 c4 e3 c2 c5 f5 f4 f6 d6 g4 f3 e6 g3 b5 c6'.split(' '));

/**
 * @typedef {object} GameState
 * @property {readonly number[]} board 64 cells: BLACK, WHITE or EMPTY
 * @property {number} turn side to move; EMPTY once the game is over
 * @property {readonly number[]} moves legal moves of `turn`, ascending (empty once over)
 * @property {number} lastMove square of the last disc placed, -1 before the first move
 * @property {readonly number[]} flipped discs flipped by the last move, nearest first per line
 * @property {number} passed side that had to pass right after the last move, else EMPTY
 * @property {{black: number, white: number, empty: number}} score disc counts
 * @property {boolean} over true when neither side can move
 * @property {number|null} winner BLACK, WHITE or EMPTY (draw) once over; null while playing
 * @property {'ai'|'pvp'} mode
 * @property {number} humanColor the human's colour in "ai" mode
 * @property {'easy'|'medium'|'hard'} level AI strength in "ai" mode
 * @property {GameState|null} previous the state before the last move (undo history)
 */

/**
 * Starts a game. Missing or unknown settings fall back to the defaults
 * (against the AI, human plays black, medium), so stored values are safe to pass.
 * @param {object} [options]
 * @param {'ai'|'pvp'} [options.mode]
 * @param {number} [options.humanColor] BLACK or WHITE
 * @param {'easy'|'medium'|'hard'} [options.level]
 * @param {ArrayLike<number>} [options.board] custom start position instead of the standard one
 * @param {number} [options.turn] side due to move first, BLACK unless WHITE is given
 * @returns {GameState}
 */
export function createGame(options = {}) {
  const board = options.board ? Array.from(options.board) : createBoard();
  const due = options.turn === WHITE ? WHITE : BLACK;
  return buildState(sanitizeSettings(options), board, due, { lastMove: -1, flipped: [], previous: null });
}

/**
 * Plays a disc for the side to move. If the opponent then has no legal move
 * the turn comes straight back (recorded in `passed`); if neither side can
 * move the game is over.
 * @param {GameState} game
 * @param {number} index square 0..63
 * @returns {GameState|null} the next state, or null when the move is not legal
 */
export function playMove(game, index) {
  if (game.over) return null;
  const result = applyMove(game.board, game.turn, index);
  if (!result) return null;
  return buildState(settingsOf(game), result.board, -game.turn, {
    lastMove: index,
    flipped: result.flips,
    previous: game,
  });
}

/**
 * Takes moves back. Two players: one move. Against the AI: back to the
 * position before the human's latest move, so the AI's replies go too.
 * @param {GameState} game
 * @returns {GameState} the earlier state, or `game` itself when there is nothing to undo
 */
export function undo(game) {
  if (game.mode === 'pvp') return game.previous ?? game;
  let state = game.previous;
  while (state && state.turn !== game.humanColor) state = state.previous;
  return state ?? game;
}

/**
 * Tells whether undo would change anything.
 * @param {GameState} game
 * @returns {boolean}
 */
export function canUndo(game) {
  return undo(game) !== game;
}

/**
 * Tells whether the computer should move now.
 * @param {GameState} game
 * @returns {boolean}
 */
export function isAiTurn(game) {
  return game.mode === 'ai' && !game.over && game.turn !== game.humanColor;
}

/**
 * Builds the "?demo" position: a fixed opening of 16 moves (20 discs), against
 * the AI with the human (black) to move. Always identical, for screenshots.
 * @returns {GameState}
 */
export function createDemoGame() {
  return DEMO_LINE.reduce((game, square) => {
    const next = playMove(game, fromAlgebraic(square));
    if (!next) throw new Error(`Illegal demo move: ${square}`);
    return next;
  }, createGame(DEFAULT_SETTINGS));
}

function sanitizeSettings({ mode, humanColor, level }) {
  return {
    mode: MODES.includes(mode) ? mode : DEFAULT_SETTINGS.mode,
    humanColor: humanColor === WHITE ? WHITE : BLACK,
    level: LEVELS.includes(level) ? level : DEFAULT_SETTINGS.level,
  };
}

function settingsOf({ mode, humanColor, level }) {
  return { mode, humanColor, level };
}

function buildState(settings, board, due, { lastMove, flipped, previous }) {
  const turn = resolveTurn(board, due);
  const over = turn === EMPTY;
  return Object.freeze({
    ...settings,
    board: Object.freeze(board),
    turn,
    moves: Object.freeze(over ? [] : getLegalMoves(board, turn)),
    lastMove,
    flipped: Object.freeze(flipped),
    passed: over || turn === due ? EMPTY : due,
    score: Object.freeze(countDiscs(board)),
    over,
    winner: over ? getWinner(board) : null,
    previous,
  });
}
