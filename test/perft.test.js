import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, WHITE, createBoard, parseBoard, perft } from '../src/board.js';

// Known perft counts from the start position, passes counted as moves.
const START_PERFT = [1, 4, 12, 56, 244, 1396, 8200];

for (let depth = 1; depth < START_PERFT.length; depth++) {
  test(`perft(${depth}) from the start position is ${START_PERFT[depth]}`, () => {
    assert.equal(perft(createBoard(), BLACK, depth), START_PERFT[depth]);
  });
}

test('perft leaves the board untouched and counts the root at depth 0', () => {
  const board = createBoard();
  const before = [...board];
  assert.equal(perft(board, BLACK, 0), 1);
  perft(board, BLACK, 3);
  assert.deepEqual(board, before);
});

test('perft counts a forced pass as a ply and nothing after the game ends', () => {
  // White cannot move and must pass; black then takes b1 with c1, which ends the game.
  const board = parseBoard(`
    B W . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .`);
  assert.equal(perft(board, WHITE, 1), 1);
  assert.equal(perft(board, WHITE, 2), 1);
  assert.equal(perft(board, WHITE, 3), 0);
});
