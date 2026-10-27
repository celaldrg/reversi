import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, EMPTY, WHITE, fromAlgebraic, parseBoard, toAlgebraic } from '../src/board.js';
import { MODES, canUndo, createDemoGame, createGame, isAiTurn, playMove, undo } from '../src/game.js';

const at = fromAlgebraic;
const names = (squares) => squares.map(toAlgebraic);

/** Plays a list of moves in algebraic notation, failing on the first illegal one. */
function playLine(game, line) {
  return line.split(' ').reduce((state, square) => {
    const next = playMove(state, at(square));
    assert.ok(next, `${square} should be legal`);
    return next;
  }, game);
}

test('a new game starts from the standard position with black to move', () => {
  const game = createGame();
  assert.equal(game.turn, BLACK);
  assert.deepEqual(names(game.moves), ['d3', 'c4', 'f5', 'e6']);
  assert.deepEqual(game.score, { black: 2, white: 2, empty: 60 });
  assert.equal(game.lastMove, -1);
  assert.deepEqual(game.flipped, []);
  assert.equal(game.passed, EMPTY);
  assert.equal(game.over, false);
  assert.equal(game.winner, null);
  assert.equal(game.previous, null);
  assert.equal(canUndo(game), false);
  assert.deepEqual([game.mode, game.humanColor, game.level], ['ai', BLACK, 'medium']);
  assert.ok(Object.isFrozen(game) && Object.isFrozen(game.board));
});

test('settings are kept when valid and fall back to the defaults otherwise', () => {
  const custom = createGame({ mode: 'pvp', humanColor: WHITE, level: 'hard' });
  assert.deepEqual([custom.mode, custom.humanColor, custom.level], ['pvp', WHITE, 'hard']);
  const junk = createGame({ mode: 'online', humanColor: 3, level: 'expert' });
  assert.deepEqual([junk.mode, junk.humanColor, junk.level], ['ai', BLACK, 'medium']);
  assert.deepEqual(MODES, ['ai', 'pvp']);
});

test('playMove places, flips and hands over the turn without touching the old state', () => {
  const game = createGame();
  const next = playMove(game, at('d3'));
  assert.equal(next.board[at('d3')], BLACK);
  assert.deepEqual(next.flipped, [at('d4')]);
  assert.equal(next.lastMove, at('d3'));
  assert.equal(next.turn, WHITE);
  assert.deepEqual(names(next.moves), ['c3', 'e3', 'c5']);
  assert.deepEqual(next.score, { black: 4, white: 1, empty: 59 });
  assert.equal(next.previous, game);
  assert.equal(game.board[at('d3')], EMPTY);
  assert.equal(game.turn, BLACK);
});

test('illegal moves are rejected', () => {
  const game = createGame();
  for (const index of [at('a1'), at('d4'), at('e3'), -1, 64]) {
    assert.equal(playMove(game, index), null, String(index));
  }
});

test('a side without moves passes automatically, and the game ends when nobody can move', () => {
  const board = parseBoard(`
    B W . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    B W . . . . . .`);
  const game = createGame({ mode: 'pvp', board });
  const afterC1 = playMove(game, at('c1'));
  assert.equal(afterC1.passed, WHITE, 'white has no reply and passes');
  assert.equal(afterC1.turn, BLACK);
  assert.deepEqual(names(afterC1.moves), ['c8']);

  const finished = playMove(afterC1, at('c8'));
  assert.equal(finished.over, true);
  assert.equal(finished.turn, EMPTY);
  assert.equal(finished.passed, EMPTY);
  assert.deepEqual(finished.moves, []);
  assert.equal(finished.winner, BLACK);
  assert.deepEqual(finished.score, { black: 6, white: 0, empty: 58 });
  assert.equal(playMove(finished, at('d1')), null);
  assert.equal(isAiTurn(finished), false);
});

test('a custom start where the side due cannot move begins with a pass', () => {
  const board = parseBoard(`B W . . . . . .${'. '.repeat(56)}`);
  const game = createGame({ board, turn: WHITE });
  assert.equal(game.turn, BLACK);
  assert.equal(game.passed, WHITE);
});

test('a draw has no winner colour', () => {
  const game = createGame({ board: parseBoard(`B . . . . . . W${'. '.repeat(56)}`) });
  assert.equal(game.over, true);
  assert.equal(game.winner, EMPTY);
});

test('undo in two-player mode takes back one move at a time', () => {
  const start = createGame({ mode: 'pvp' });
  const first = playMove(start, at('d3'));
  const second = playMove(first, at('c3'));
  assert.equal(isAiTurn(second), false);
  assert.equal(undo(second), first);
  assert.equal(undo(first), start);
  assert.equal(undo(start), start);
});

test('undo against the AI goes back to before the human move', () => {
  const start = createGame({ mode: 'ai', humanColor: BLACK });
  const human = playMove(start, at('d3'));
  assert.equal(isAiTurn(human), true);
  const reply = playMove(human, at('c3'));
  assert.equal(isAiTurn(reply), false);
  assert.equal(undo(reply), start, 'removes the AI reply and the human move');
  assert.equal(undo(human), start, 'also while the AI is still thinking');
});

test('when the AI opens as black, its first move alone cannot be undone', () => {
  const start = createGame({ mode: 'ai', humanColor: WHITE });
  assert.equal(isAiTurn(start), true);
  const opening = playLine(start, 'f5');
  assert.equal(canUndo(opening), false);
  const reply = playLine(opening, 'f6 e6');
  assert.equal(isAiTurn(reply), false);
  assert.equal(undo(reply), opening);
});

test('the demo is a fixed mid-game position with the human to move', () => {
  const demo = createDemoGame();
  assert.deepEqual(createDemoGame().board, demo.board);
  assert.equal(demo.score.black + demo.score.white, 20);
  assert.deepEqual([demo.mode, demo.humanColor, demo.turn], ['ai', BLACK, BLACK]);
  assert.equal(demo.over, false);
  assert.equal(isAiTurn(demo), false);
  assert.ok(demo.moves.length >= 6, 'enough move hints to show');
  assert.equal(demo.board[demo.lastMove], WHITE, 'white made the last move');
  assert.ok(canUndo(demo));
});
