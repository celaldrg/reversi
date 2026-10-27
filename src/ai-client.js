/**
 * Runs the computer player in a module Web Worker (ai-worker.js), so the page
 * stays responsive while it searches. Should the worker fail to start, the
 * search runs on the main thread instead. Browser-only module.
 */
import { chooseMove } from './ai.js';
import { createRng } from './rng.js';

/**
 * @typedef {object} AiJob
 * @property {number[]} board 64 cells
 * @property {number} player BLACK or WHITE
 * @property {'easy'|'medium'|'hard'} level
 * @property {number} seed seed for the random choices of "easy"
 */

/**
 * Creates the client. Only one search runs at a time: a new request or a
 * cancel settles the previous one with null.
 * @returns {{request: (job: AiJob) => Promise<number|null>, cancel: () => void}}
 *   `request` resolves with the chosen square, or null when it was cancelled
 */
export function createAiClient() {
  let worker = null;
  let pending = null; // { id, job, resolve }
  let lastId = 0;
  let inline = typeof Worker !== 'function';

  function settle(move) {
    if (!pending) return;
    const { resolve } = pending;
    pending = null;
    resolve(move);
  }

  function runInline(job) {
    // A timeout first, so the "thinking" state is painted before the page blocks.
    setTimeout(() => {
      if (pending?.job !== job) return;
      settle(chooseMove(job.board, job.player, { level: job.level, rng: createRng(job.seed) }).move);
    }, 0);
  }

  function startWorker() {
    try {
      const instance = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
      instance.addEventListener('message', ({ data }) => {
        if (pending?.id === data.id) settle(data.move);
      });
      instance.addEventListener('error', (event) => {
        event.preventDefault();
        fallBack();
      });
      return instance;
    } catch {
      inline = true;
      return null;
    }
  }

  function fallBack() {
    inline = true;
    worker?.terminate();
    worker = null;
    if (pending) runInline(pending.job);
  }

  function stopWorker() {
    worker?.terminate();
    worker = null;
  }

  return {
    request(job) {
      if (pending) {
        settle(null);
        stopWorker(); // do not let an abandoned search delay this one
      }
      return new Promise((resolve) => {
        pending = { id: ++lastId, job, resolve };
        if (!inline) worker ??= startWorker();
        if (worker) worker.postMessage({ id: pending.id, ...job });
        else runInline(job);
      });
    },
    cancel() {
      if (!pending) return;
      settle(null);
      stopWorker();
    },
  };
}
