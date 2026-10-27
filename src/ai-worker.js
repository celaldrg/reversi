/**
 * Module Web Worker that runs the AI off the main thread.
 *   new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' })
 *
 * Request:  { id, board: number[64], player, level, seed, timeLimitMs? }
 * Response: { id, move, score, depth, exact } (move is a square index or PASS)
 * The id is echoed so the page can ignore answers to requests it abandoned.
 */
import { chooseMove } from './ai.js';
import { createRng } from './rng.js';

self.addEventListener('message', ({ data }) => {
  const { id, board, player, level, seed, timeLimitMs } = data;
  const result = chooseMove(board, player, { level, rng: createRng(seed), timeLimitMs });
  self.postMessage({ id, ...result });
});
