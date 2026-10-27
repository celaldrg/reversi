import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, fromAlgebraic, parseBoard } from '../src/board.js';
import { createGame, playMove } from '../src/game.js';
import { translate } from '../src/i18n.js';
import { cellMessage, infoMessage, noticeMessage, roleMessage, statusMessage } from '../src/status.js';

const EMPTY_ROWS = '........'.repeat(7);
/** First row "BW......": black can play c1, white has no move at all. */
const WHITE_STUCK = parseBoard(`BW......${EMPTY_ROWS}`);
/** First row "WB......": the mirror image, black has no move. */
const BLACK_STUCK = parseBoard(`WB......${EMPTY_ROWS}`);
const say = (lang, message) => translate(lang, message.key, message.params);

test('status while playing against the computer', () => {
  const start = createGame({ mode: 'ai', humanColor: BLACK, level: 'easy' });
  assert.deepEqual(statusMessage(start), { key: 'yourTurn', tone: 'turn' });
  const replyDue = playMove(start, fromAlgebraic('d3'));
  assert.deepEqual(statusMessage(replyDue, true), { key: 'thinking', tone: 'thinking' });
  assert.deepEqual(statusMessage(replyDue, false), { key: 'computerTurn', tone: 'turn' });
  assert.equal(noticeMessage(replyDue), null, 'an ordinary move needs no notice');
});

test('status in a two-player game', () => {
  const start = createGame({ mode: 'pvp' });
  assert.deepEqual(statusMessage(start), { key: 'blackToMove', tone: 'turn' });
  const next = playMove(start, fromAlgebraic('d3'));
  assert.deepEqual(statusMessage(next, true), { key: 'whiteToMove', tone: 'turn' }, 'nobody "thinks" in two-player mode');
});

test('passes are reported for the right side', () => {
  const computerPassed = createGame({ mode: 'ai', humanColor: BLACK, board: WHITE_STUCK, turn: WHITE });
  assert.equal(computerPassed.turn, BLACK);
  assert.deepEqual(statusMessage(computerPassed), { key: 'passYourTurn', tone: 'pass' });
  assert.deepEqual(noticeMessage(computerPassed), { key: 'toastComputerPass' });

  const humanPassed = createGame({ mode: 'ai', humanColor: WHITE, board: WHITE_STUCK, turn: WHITE });
  assert.deepEqual(statusMessage(humanPassed, true), { key: 'passThinking', tone: 'thinking' });
  assert.deepEqual(statusMessage(humanPassed, false), { key: 'passComputerTurn', tone: 'pass' });
  assert.deepEqual(noticeMessage(humanPassed), { key: 'toastYouPass' });

  const whitePassed = createGame({ mode: 'pvp', board: WHITE_STUCK, turn: WHITE });
  assert.deepEqual(statusMessage(whitePassed), { key: 'passBlackToMove', tone: 'pass' });
  assert.deepEqual(noticeMessage(whitePassed), { key: 'toastWhitePass' });

  const blackPassed = createGame({ mode: 'pvp', board: BLACK_STUCK, turn: BLACK });
  assert.equal(blackPassed.turn, WHITE);
  assert.deepEqual(statusMessage(blackPassed), { key: 'passWhiteToMove', tone: 'pass' });
  assert.deepEqual(noticeMessage(blackPassed), { key: 'toastBlackPass' });
});

test('final results name the winner and the score', () => {
  const blackOnly = parseBoard(`B.......${EMPTY_ROWS}`);
  const youWin = createGame({ mode: 'ai', humanColor: BLACK, board: blackOnly });
  assert.ok(youWin.over);
  assert.deepEqual(statusMessage(youWin), { key: 'resultYouWin', params: { score: '1–0' }, tone: 'over' });
  assert.deepEqual(noticeMessage(youWin), { key: 'resultYouWin', params: { score: '1–0' } });
  assert.equal(say('en', statusMessage(youWin)), 'You win 1–0!');

  const computerWins = createGame({ mode: 'ai', humanColor: WHITE, board: blackOnly });
  assert.equal(statusMessage(computerWins).key, 'resultComputerWins');
  assert.equal(say('tr', statusMessage(computerWins)), 'Bilgisayar kazandı, 1–0');

  assert.equal(statusMessage(createGame({ mode: 'pvp', board: blackOnly })).key, 'resultBlackWins');
  const whiteOnly = parseBoard(`W.......${EMPTY_ROWS}`);
  assert.equal(statusMessage(createGame({ mode: 'pvp', board: whiteOnly })).key, 'resultWhiteWins');

  const draw = createGame({ mode: 'ai', board: parseBoard(`B......W${EMPTY_ROWS}`) });
  assert.ok(draw.over);
  assert.deepEqual(statusMessage(draw), { key: 'resultDraw', params: { score: '1–1' }, tone: 'over' });
});

test('square names describe the disc, the last move and legal moves', () => {
  const start = createGame();
  const d3 = fromAlgebraic('d3');
  assert.deepEqual(cellMessage(start, d3, true), { key: 'cellEmptyLegal', params: { square: 'd3' } });
  assert.deepEqual(cellMessage(start, d3, false), { key: 'cellEmpty', params: { square: 'd3' } });
  assert.equal(cellMessage(start, fromAlgebraic('a1'), true).key, 'cellEmpty');

  const afterBlack = playMove(start, d3);
  assert.equal(cellMessage(afterBlack, d3, true).key, 'cellBlackLast');
  assert.equal(cellMessage(afterBlack, fromAlgebraic('d4'), true).key, 'cellBlack', 'the flipped disc');
  assert.equal(cellMessage(afterBlack, fromAlgebraic('e5'), true).key, 'cellWhite');

  const reply = fromAlgebraic('c3');
  const afterWhite = playMove(afterBlack, reply);
  assert.equal(cellMessage(afterWhite, reply, false).key, 'cellWhiteLast');
  assert.equal(say('en', cellMessage(afterWhite, reply, false)), 'c3, white, last move');
  assert.equal(say('tr', cellMessage(afterWhite, reply, false)), 'c3, beyaz, son hamle');
});

test('roles and the info line follow the mode', () => {
  const black = createGame({ mode: 'ai', humanColor: BLACK });
  assert.deepEqual([roleMessage(black, BLACK).key, roleMessage(black, WHITE).key], ['you', 'computer']);
  const white = createGame({ mode: 'ai', humanColor: WHITE, level: 'hard' });
  assert.deepEqual([roleMessage(white, BLACK).key, roleMessage(white, WHITE).key], ['computer', 'you']);
  const pvp = createGame({ mode: 'pvp' });
  assert.deepEqual([roleMessage(pvp, BLACK).key, roleMessage(pvp, WHITE).key], ['playerOne', 'playerTwo']);

  assert.equal(say('en', infoMessage(white)), 'Against the computer · Hard');
  assert.equal(say('tr', infoMessage(createGame({ level: 'easy' }))), 'Bilgisayara karşı · Kolay');
  assert.deepEqual(infoMessage(pvp), { key: 'infoTwoPlayers' });
});
