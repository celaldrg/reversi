/**
 * Turns game states into interface messages: a translation key plus its
 * parameters, so the wording itself lives in i18n.js. Pure module.
 */
import { BLACK, EMPTY, toAlgebraic } from './board.js';

/** @typedef {import('./game.js').GameState} GameState */
/** @typedef {{key: string, params?: Record<string, string|number|Message>}} Message */

const LEVEL_KEYS = Object.freeze({ easy: 'levelEasy', medium: 'levelMedium', hard: 'levelHard' });

/**
 * The status line: whose turn it is, a pass that just happened, the computer
 * thinking, or the final result.
 * @param {GameState} game
 * @param {boolean} [thinking=false] whether the computer is searching right now
 * @returns {Message & {tone: 'turn'|'pass'|'thinking'|'over'}}
 */
export function statusMessage(game, thinking = false) {
  if (game.over) return { ...resultMessage(game), tone: 'over' };
  if (game.mode === 'pvp') {
    const black = game.turn === BLACK;
    if (game.passed !== EMPTY) return { key: black ? 'passBlackToMove' : 'passWhiteToMove', tone: 'pass' };
    return { key: black ? 'blackToMove' : 'whiteToMove', tone: 'turn' };
  }
  if (game.turn === game.humanColor) {
    return game.passed === EMPTY ? { key: 'yourTurn', tone: 'turn' } : { key: 'passYourTurn', tone: 'pass' };
  }
  const humanPassed = game.passed === game.humanColor;
  if (thinking) return { key: humanPassed ? 'passThinking' : 'thinking', tone: 'thinking' };
  return humanPassed ? { key: 'passComputerTurn', tone: 'pass' } : { key: 'computerTurn', tone: 'turn' };
}

/**
 * A short notice to flash right after a move: a forced pass or the result.
 * @param {GameState} game the state the move led to
 * @returns {Message|null} null when there is nothing to announce
 */
export function noticeMessage(game) {
  if (game.over) return resultMessage(game);
  if (game.passed === EMPTY) return null;
  if (game.mode === 'ai') return { key: game.passed === game.humanColor ? 'toastYouPass' : 'toastComputerPass' };
  return { key: game.passed === BLACK ? 'toastBlackPass' : 'toastWhitePass' };
}

/**
 * Accessible name of a square, e.g. "d3, empty, legal move".
 * @param {GameState} game
 * @param {number} index square 0..63
 * @param {boolean} showMoves whether legal moves may be announced (hints are on and it is the human's turn)
 * @returns {Message}
 */
export function cellMessage(game, index, showMoves) {
  const params = { square: toAlgebraic(index) };
  const cell = game.board[index];
  if (cell === EMPTY) {
    return { key: showMoves && game.moves.includes(index) ? 'cellEmptyLegal' : 'cellEmpty', params };
  }
  const last = index === game.lastMove;
  if (cell === BLACK) return { key: last ? 'cellBlackLast' : 'cellBlack', params };
  return { key: last ? 'cellWhiteLast' : 'cellWhite', params };
}

/**
 * Who plays a colour: "You" or "Computer" against the AI, "Player 1" or "Player 2" otherwise.
 * @param {GameState} game
 * @param {number} color BLACK or WHITE
 * @returns {Message}
 */
export function roleMessage(game, color) {
  if (game.mode === 'pvp') return { key: color === BLACK ? 'playerOne' : 'playerTwo' };
  return { key: color === game.humanColor ? 'you' : 'computer' };
}

/**
 * One line about the current game: the opponent and, against the AI, its level.
 * @param {GameState} game
 * @returns {Message}
 */
export function infoMessage(game) {
  if (game.mode === 'pvp') return { key: 'infoTwoPlayers' };
  return { key: 'infoComputer', params: { level: { key: LEVEL_KEYS[game.level] } } };
}

function resultMessage(game) {
  const { black, white } = game.score;
  const params = { score: `${Math.max(black, white)}–${Math.min(black, white)}` };
  if (game.winner === EMPTY) return { key: 'resultDraw', params };
  if (game.mode === 'ai') return { key: game.winner === game.humanColor ? 'resultYouWin' : 'resultComputerWins', params };
  return { key: game.winner === BLACK ? 'resultBlackWins' : 'resultWhiteWins', params };
}
