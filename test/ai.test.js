import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BLACK,
  CELLS,
  EMPTY,
  PASS,
  WHITE,
  applyMove,
  countDiscs,
  createBoard,
  fromAlgebraic,
  getLegalMoves,
  hasLegalMove,
  isGameOver,
  isLegalMove,
  parseBoard,
  resolveTurn,
} from '../src/board.js';
import { LEVELS, chooseMove, evaluate } from '../src/ai.js';
import { createRng } from '../src/rng.js';

const MATCHUPS = [
  ['easy', 'easy'],
  ['easy', 'medium'],
  ['medium', 'easy'],
  ['hard', 'easy'],
];
// Deterministic "hard": a depth cap instead of the wall clock.
const HARD_FIXED = { maxDepth: 3, timeLimitMs: Infinity };

/** Plays seeded easy moves from the start until `empties` squares are left. */
function reachEmpties(seed, empties) {
  const rng = createRng(seed);
  let board = createBoard();
  let player = BLACK;
  while (countDiscs(board).empty > empties) {
    assert.notEqual(player, EMPTY, `seed ${seed} ended too early`);
    board = applyMove(board, player, chooseMove(board, player, { level: 'easy', rng }).move).board;
    player = resolveTurn(board, -player);
  }
  assert.notEqual(player, EMPTY, `seed ${seed} ended too early`);
  return { board, player };
}

/** Plays a whole game at one level; returns the moves. */
function playLine(seed, level) {
  const rng = createRng(seed);
  let board = createBoard();
  let player = BLACK;
  const line = [];
  while (player !== EMPTY) {
    const { move } = chooseMove(board, player, { level, rng });
    line.push(move);
    board = applyMove(board, player, move).board;
    player = resolveTurn(board, -player);
  }
  return line;
}

/** Final disc difference for `player` under perfect play, by plain minimax over every line. */
function perfectScore(board, player) {
  const moves = getLegalMoves(board, player);
  if (moves.length === 0) {
    if (hasLegalMove(board, -player)) return -perfectScore(board, -player);
    const { black, white } = countDiscs(board);
    return player * (black - white);
  }
  return Math.max(...moves.map((move) => -perfectScore(applyMove(board, player, move).board, -player)));
}

const rotateSquare = (index) => (index % 8) * 8 + (7 - Math.floor(index / 8));

/** Turns a board a quarter turn clockwise. */
function rotate(board) {
  const turned = new Array(CELLS);
  board.forEach((cell, index) => {
    turned[rotateSquare(index)] = cell;
  });
  return turned;
}

const swapColours = (board) => board.map((cell) => (cell === EMPTY ? EMPTY : -cell));

test('the AI never plays an illegal move in 100 seeded self-play games', () => {
  for (let game = 0; game < 100; game++) {
    const rng = createRng(game);
    const [blackLevel, whiteLevel] = MATCHUPS[game % MATCHUPS.length];
    const levels = { [BLACK]: blackLevel, [WHITE]: whiteLevel };
    let board = createBoard();
    let player = BLACK;
    while (player !== EMPTY) {
      const { move } = chooseMove(board, player, { level: levels[player], rng, ...HARD_FIXED });
      assert.ok(isLegalMove(board, player, move), `game ${game}: illegal move ${move}`);
      board = applyMove(board, player, move).board;
      player = resolveTurn(board, -player);
    }
    assert.ok(isGameOver(board));
  }
});

test('medium takes an available corner', () => {
  let board = parseBoard(`
    . . . . . . . .
    . W . . . . . .
    . . B . . . . .
    . . . W B . . .
    . . . B W . . .
    . . . . . . . .
    . . . . . . . .
    . . . . . . . .`);
  let corner = fromAlgebraic('a1');
  for (let quarterTurns = 0; quarterTurns < 4; quarterTurns++) {
    for (const [player, position] of [[BLACK, board], [WHITE, swapColours(board)]]) {
      assert.ok(isLegalMove(position, player, corner));
      assert.ok(getLegalMoves(position, player).length > 1, 'the corner is not the only option');
      assert.equal(chooseMove(position, player, { level: 'medium' }).move, corner);
    }
    board = rotate(board);
    corner = rotateSquare(corner);
  }
});

test('hard plays the endgame perfectly', () => {
  for (const seed of [1, 7, 8]) {
    const { board, player } = reachEmpties(seed, 8);
    assert.ok(getLegalMoves(board, player).length > 1, `seed ${seed}: a forced move proves nothing`);
    const result = chooseMove(board, player, { level: 'hard', timeLimitMs: Infinity });
    const best = perfectScore(board, player);
    assert.equal(result.exact, true);
    assert.ok(result.score === best, `seed ${seed}: score ${result.score}, perfect ${best}`);
    const reached = -perfectScore(applyMove(board, player, result.move).board, -player);
    assert.ok(reached === best, `seed ${seed}: the chosen move only reaches ${reached}`);
  }
});

test('hard solves the last 10 empty squares exactly', () => {
  for (const seed of [5, 6]) {
    const { board, player } = reachEmpties(seed, 10);
    assert.ok(getLegalMoves(board, player).length > 1, `seed ${seed}: a forced move proves nothing`);
    const result = chooseMove(board, player, { level: 'hard', timeLimitMs: Infinity });
    assert.equal(result.exact, true);
    assert.equal(result.depth, 10);
    assert.ok(isLegalMove(board, player, result.move));
  }
});

test('hard stops at its time limit and still answers with a legal move', () => {
  const { board, player } = reachEmpties(9, 40);
  let clock = 0;
  const now = () => clock++; // every look at the clock costs one millisecond
  const result = chooseMove(board, player, { level: 'hard', timeLimitMs: 25, now });
  assert.ok(isLegalMove(board, player, result.move));
  assert.equal(result.exact, false);
  assert.ok(result.depth >= 2, `iterative deepening reached depth ${result.depth}`);
  assert.ok(clock <= 27, `the search kept reading the clock (${clock} reads)`);
});

test('hard plays a forced move at once instead of using up its thinking time', () => {
  const board = parseBoard(`
    . . . . . . . .
    . B . W . . . .
    W . W . . . . .
    W W B B B . . .
    W . . B B . . .
    . . . . B . . .
    . . . . . . . .
    . . . . . . . .`);
  const forced = fromAlgebraic('c2');
  assert.deepEqual(getLegalMoves(board, BLACK), [forced], 'black has a single legal move');
  assert.ok(countDiscs(board).empty > 50 && hasLegalMove(board, WHITE), 'and the game is far from over');
  let reads = 0;
  const now = () => reads++; // every look at the clock costs one millisecond
  const result = chooseMove(board, BLACK, { level: 'hard', now });
  assert.equal(result.move, forced);
  assert.equal(result.depth, 1);
  assert.ok(reads <= 1, `it searched deeper (${reads} looks at the clock)`);
});

test('every level passes when there is no legal move, and only then', () => {
  const board = parseBoard(`B W . . . . . .${'. '.repeat(56)}`);
  for (const level of LEVELS) {
    assert.equal(chooseMove(board, WHITE, { level }).move, PASS);
    assert.equal(chooseMove(board, BLACK, { level }).move, fromAlgebraic('c1'));
  }
});

test('chooseMove leaves the board untouched and rejects unknown levels', () => {
  const board = createBoard();
  const before = [...board];
  for (const level of LEVELS) chooseMove(board, BLACK, { level, ...HARD_FIXED });
  assert.deepEqual(board, before);
  assert.throws(() => chooseMove(board, BLACK, { level: 'expert' }), RangeError);
});

test('easy is reproducible per seed and varies between seeds', () => {
  assert.deepEqual(playLine(1, 'easy'), playLine(1, 'easy'));
  const distinct = new Set([1, 2, 3, 4, 5].map((seed) => playLine(seed, 'easy').join()));
  assert.ok(distinct.size >= 4, `only ${distinct.size} different games`);
});

test('evaluate is zero-sum and ranks a finished win above any heuristic score', () => {
  for (const empties of [56, 40, 24, 12]) {
    const { board } = reachEmpties(2, empties);
    assert.equal(evaluate(board, BLACK) + evaluate(board, WHITE), 0);
  }
  const won = parseBoard('B'.repeat(40) + 'W'.repeat(24));
  assert.ok(evaluate(won, BLACK) > 100000);
  assert.ok(evaluate(won, WHITE) < -100000);
});
