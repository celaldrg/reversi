import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK,
  CELLS,
  EMPTY,
  WHITE,
  applyMove,
  countDiscs,
  countLegalMoves,
  createBoard,
  fromAlgebraic,
  getFlips,
  getLegalMoves,
  getWinner,
  hasLegalMove,
  isGameOver,
  isLegalMove,
  makeMove,
  parseBoard,
  resolveTurn,
  toAlgebraic,
  undoMove,
} from '../src/board.js';

const names = (squares) => squares.map(toAlgebraic).sort();
const emptyRows = (count) => '. . . . . . . .\n'.repeat(count);

test('the start position has two discs of each colour in the centre', () => {
  const board = createBoard();
  assert.equal(board.length, CELLS);
  assert.equal(board[fromAlgebraic('d4')], WHITE);
  assert.equal(board[fromAlgebraic('e5')], WHITE);
  assert.equal(board[fromAlgebraic('e4')], BLACK);
  assert.equal(board[fromAlgebraic('d5')], BLACK);
  assert.deepEqual(countDiscs(board), { black: 2, white: 2, empty: 60 });
});

test('black opens with exactly d3, c4, f5 and e6', () => {
  const board = createBoard();
  assert.deepEqual(names(getLegalMoves(board, BLACK)), ['c4', 'd3', 'e6', 'f5']);
  assert.equal(countLegalMoves(board, BLACK), 4);
  assert.deepEqual(names(getLegalMoves(board, WHITE)), ['c5', 'd6', 'e3', 'f4']);
});

test('algebraic notation round-trips for every square', () => {
  for (let index = 0; index < CELLS; index++) {
    assert.equal(fromAlgebraic(toAlgebraic(index)), index);
  }
  assert.equal(fromAlgebraic('a1'), 0);
  assert.equal(fromAlgebraic('H8'), 63);
  assert.throws(() => fromAlgebraic('i9'), RangeError);
  assert.throws(() => toAlgebraic(64), RangeError);
  assert.throws(() => toAlgebraic(-1), RangeError);
});

test('one move flips flanked lines in all eight directions', () => {
  const board = parseBoard(`
    . . . . . . . .
    . B . B . B . .
    . . W W W . . .
    . B W . W B . .
    . . W W W . . .
    . B . B . B . .
    ${emptyRows(2)}`);
  const d4 = fromAlgebraic('d4');
  assert.deepEqual(names(getFlips(board, BLACK, d4)), ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5']);
  const { board: after } = applyMove(board, BLACK, d4);
  assert.deepEqual(countDiscs(after), { black: 17, white: 0, empty: 47 });
});

test('only closed lines flip: long runs do, runs ending in an empty square do not', () => {
  const board = parseBoard(`
    W B B B . B B .
    . . . . B B . .
    . . . . B . W .
    ${emptyRows(5)}`);
  const e1 = fromAlgebraic('e1');
  assert.deepEqual(names(getFlips(board, WHITE, e1)), ['b1', 'c1', 'd1', 'f2']);
  const { board: after, flips } = applyMove(board, WHITE, e1);
  assert.equal(flips.length, 4);
  assert.equal(after[fromAlgebraic('f1')], BLACK, 'f1-g1 is open at h1');
  assert.equal(after[fromAlgebraic('e2')], BLACK, 'e2-e3 is open at e4');
});

test('occupied squares and moves that flank nothing are illegal', () => {
  const board = createBoard();
  for (const square of ['d4', 'e4', 'a1', 'e3', 'c5']) {
    assert.equal(isLegalMove(board, BLACK, fromAlgebraic(square)), false, square);
  }
  assert.equal(isLegalMove(board, BLACK, -1), false);
  assert.equal(isLegalMove(board, BLACK, CELLS), false);
  assert.deepEqual(getFlips(board, BLACK, fromAlgebraic('d4')), []);
  assert.equal(applyMove(board, BLACK, fromAlgebraic('a1')), null);
});

test('applyMove works on a copy and makeMove/undoMove are exact inverses', () => {
  const board = createBoard();
  const before = [...board];
  const { board: after } = applyMove(board, BLACK, fromAlgebraic('f5'));
  assert.deepEqual(board, before);
  assert.equal(after[fromAlgebraic('f5')], BLACK);
  assert.equal(after[fromAlgebraic('e5')], BLACK);

  const d3 = fromAlgebraic('d3');
  const flips = makeMove(board, BLACK, d3);
  assert.deepEqual(names(flips), ['d4']);
  undoMove(board, BLACK, d3, flips);
  assert.deepEqual(board, before);
  assert.deepEqual(makeMove(board, BLACK, fromAlgebraic('a1')), []);
  assert.deepEqual(board, before, 'an illegal makeMove changes nothing');
});

test('a player without a legal move passes and the opponent moves again', () => {
  const board = parseBoard(`B W . . . . . .\n${emptyRows(7)}`);
  assert.equal(hasLegalMove(board, WHITE), false);
  assert.deepEqual(names(getLegalMoves(board, BLACK)), ['c1']);
  assert.equal(resolveTurn(board, WHITE), BLACK);
  assert.equal(resolveTurn(board, BLACK), BLACK);
  assert.equal(isGameOver(board), false);
});

test('the game ends when neither side can move and the disc count decides', () => {
  const blocked = parseBoard(`B . . . . . . W\n${emptyRows(7)}`);
  assert.equal(isGameOver(blocked), true);
  assert.equal(resolveTurn(blocked, BLACK), EMPTY);
  assert.equal(getWinner(blocked), EMPTY);

  const wipedOut = applyMove(parseBoard(`B W . . . . . .\n${emptyRows(7)}`), BLACK, fromAlgebraic('c1')).board;
  assert.equal(isGameOver(wipedOut), true);
  assert.deepEqual(countDiscs(wipedOut), { black: 3, white: 0, empty: 61 });
  assert.equal(getWinner(wipedOut), BLACK);

  const whiteMajority = parseBoard('B'.repeat(24) + 'W'.repeat(40));
  assert.equal(isGameOver(whiteMajority), true);
  assert.equal(getWinner(whiteMajority), WHITE);
  assert.equal(getWinner(parseBoard('B'.repeat(32) + 'W'.repeat(32))), EMPTY);
});

test('parseBoard rejects malformed diagrams', () => {
  assert.throws(() => parseBoard('B W .'), RangeError);
  assert.throws(() => parseBoard('X'.repeat(CELLS)), RangeError);
});
