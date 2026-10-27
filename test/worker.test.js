import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLACK, createBoard, isLegalMove } from '../src/board.js';

test('the AI worker answers a move request with a legal move and the same id', async () => {
  const posted = [];
  let listener = null;
  globalThis.self = {
    addEventListener(type, handler) {
      if (type === 'message') listener = handler;
    },
    postMessage(message) {
      posted.push(message);
    },
  };
  try {
    await import('../src/ai-worker.js');
    const board = createBoard();
    listener({ data: { id: 7, board, player: BLACK, level: 'easy', seed: 3 } });
    listener({ data: { id: 8, board, player: BLACK, level: 'hard', seed: 3, timeLimitMs: 50 } });
    assert.deepEqual(posted.map((message) => message.id), [7, 8]);
    for (const { move } of posted) assert.ok(isLegalMove(board, BLACK, move));
  } finally {
    delete globalThis.self;
  }
});
