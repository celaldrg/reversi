/**
 * The board on screen: 64 square buttons on a felt, discs that flip in 3D,
 * move hints, a last-move marker, pointer input (mouse, touch and pen), a
 * keyboard cursor (arrow keys + Enter or Space) and clicks from screen
 * readers. DOM only; the rules live in board.js.
 */
import { BLACK, CELLS, EMPTY, SIZE, WHITE } from './board.js';

const FILES = 'abcdefgh';
const COLOR_NAMES = new Map([[BLACK, 'black'], [WHITE, 'white']]);
const ARROWS = Object.freeze({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] });
const START_CURSOR = 19; // d3, one of the opening moves
const FLIP_DELAY_MS = 90; // the placed disc lands before its neighbours turn
const FLIP_STAGGER_MS = 70; // each further disc along a line turns a little later
const FLIP_MS = 360; // matches --t-flip in style.css

/**
 * @typedef {object} RenderOptions
 * @property {'move'|'soft'|'none'} motion "move" flips the captured discs one after another
 *   from the new disc, "soft" animates every change at once, "none" jumps straight to the position
 * @property {boolean} hints show the legal moves of the side to move
 * @property {boolean} interactive whether the player may pick a square now
 * @property {(index: number) => string} label accessible name of a square
 */

/**
 * Builds the board inside `frame` and wires its input.
 * @param {HTMLElement} frame element holding the `.felt` and the two `.coords` rails
 * @param {(index: number) => void} onSelect called with the square the player picked
 * @returns {{render: (game: import('./game.js').GameState, options: RenderOptions) => void,
 *   flash: (index: number) => void, focus: () => void}}
 */
export function createBoardView(frame, onSelect) {
  const felt = frame.querySelector('.felt');
  fillCoordinates(frame.querySelector('.coords.files'), [...FILES]);
  fillCoordinates(frame.querySelector('.coords.ranks'), Array.from({ length: SIZE }, (_, row) => String(row + 1)));
  const cells = Array.from({ length: CELLS }, () => felt.appendChild(createCell()));
  const shown = new Array(CELLS).fill(EMPTY);
  let cursor = START_CURSOR;
  let pressed = -1;
  cells[cursor].tabIndex = 0;

  function moveCursor(index, withFocus) {
    cells[cursor].tabIndex = -1;
    cursor = index;
    cells[cursor].tabIndex = 0;
    if (withFocus) focus();
  }

  felt.addEventListener('focusin', (event) => {
    const index = cells.indexOf(event.target);
    if (index >= 0 && index !== cursor) moveCursor(index, false);
  });

  felt.addEventListener('keydown', (event) => {
    const step = ARROWS[event.key];
    if (step) {
      event.preventDefault();
      const row = clamp(Math.floor(cursor / SIZE) + step[0]);
      const col = clamp((cursor % SIZE) + step[1]);
      moveCursor(row * SIZE + col, true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(cursor);
    }
  });

  // A tap counts when it starts and ends on the same square; sliding away cancels it.
  felt.addEventListener('pointerdown', (event) => {
    pressed = event.isPrimary && event.button === 0 ? squareAt(felt, event) : -1;
  });
  felt.addEventListener('pointerup', (event) => {
    const index = squareAt(felt, event);
    if (event.isPrimary && index >= 0 && index === pressed) {
      moveCursor(index, false);
      onSelect(index);
    }
    pressed = -1;
  });
  felt.addEventListener('pointercancel', () => {
    pressed = -1;
  });

  // Screen readers activate a square with a bare click (detail 0: no pointer, no key handled above).
  felt.addEventListener('click', (event) => {
    const index = cells.indexOf(event.target.closest('.cell'));
    if (event.detail === 0 && index >= 0) {
      moveCursor(index, false);
      onSelect(index);
    }
  });

  /**
   * Shows a game state.
   * @param {import('./game.js').GameState} game
   * @param {RenderOptions} options
   */
  function render(game, { motion, hints, interactive, label }) {
    if (motion === 'none') felt.classList.add('instant');
    felt.dataset.turn = COLOR_NAMES.get(game.turn) ?? '';
    felt.setAttribute('aria-disabled', String(!interactive));
    const legal = new Set(hints ? game.moves : []);
    const captured = new Set(motion === 'move' ? game.flipped : []);
    cells.forEach((cell, index) => {
      const color = game.board[index];
      if (color !== shown[index]) {
        const delay = captured.has(index) ? flipDelay(index, game.lastMove) : 0;
        showColor(cell, color, shown[index], motion === 'none' ? -1 : delay);
        shown[index] = color;
      }
      cell.classList.toggle('legal', legal.has(index));
      cell.classList.toggle('last', index === game.lastMove);
      cell.setAttribute('aria-label', label(index));
    });
    if (motion === 'none') {
      void felt.offsetWidth; // apply the position before transitions come back
      felt.classList.remove('instant');
    }
  }

  /**
   * Briefly tints a square, e.g. after a tap on an illegal one.
   * @param {number} index square 0..63
   */
  function flash(index) {
    if (prefersReducedMotion()) return;
    cells[index].animate(
      [{ backgroundColor: 'rgba(248, 113, 113, 0.45)' }, { backgroundColor: 'rgba(248, 113, 113, 0)' }],
      { duration: 420, easing: 'ease-out' },
    );
  }

  /**
   * Puts the keyboard focus, with a visible ring, on the cursor square, so the
   * arrow keys work even when the focus started outside the board.
   */
  function focus() {
    cells[cursor].focus({ focusVisible: true });
  }

  return { render, flash, focus };
}

function createCell() {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.className = 'cell';
  cell.tabIndex = -1;
  const disc = span('disc', span('face face-black'), span('face face-white'));
  cell.append(span('hint'), span('piece', disc), span('marker'));
  return cell;
}

function span(className, ...children) {
  const element = document.createElement('span');
  element.className = className;
  element.append(...children);
  return element;
}

function fillCoordinates(rail, labels) {
  for (const text of labels) rail.append(Object.assign(document.createElement('span'), { textContent: text }));
}

/**
 * Puts a colour on a square. A disc that changes colour turns over after
 * `delay` ms (with a small lift); a new disc drops in already showing its
 * colour. A negative delay means no animation at all.
 */
function showColor(cell, color, before, delay) {
  const piece = cell.querySelector('.piece');
  const disc = cell.querySelector('.disc');
  const flips = before !== EMPTY && color !== EMPTY;
  if (flips) {
    disc.style.transitionDelay = `${Math.max(delay, 0)}ms`;
  } else {
    disc.style.transition = 'none'; // a disc that appears or vanishes must not spin
  }
  if (color === EMPTY) delete cell.dataset.color;
  else cell.dataset.color = COLOR_NAMES.get(color);
  if (!flips) {
    void disc.offsetWidth;
    disc.style.transition = '';
  } else if (delay >= 0 && !prefersReducedMotion()) {
    piece.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], {
      duration: FLIP_MS,
      delay,
      easing: 'ease-in-out',
    });
  }
}

function flipDelay(index, origin) {
  const rows = Math.abs(Math.floor(index / SIZE) - Math.floor(origin / SIZE));
  const cols = Math.abs((index % SIZE) - (origin % SIZE));
  return FLIP_DELAY_MS + (Math.max(rows, cols) - 1) * FLIP_STAGGER_MS;
}

function squareAt(felt, { clientX, clientY }) {
  const rect = felt.getBoundingClientRect();
  const col = Math.floor(((clientX - rect.left) / rect.width) * SIZE);
  const row = Math.floor(((clientY - rect.top) / rect.height) * SIZE);
  return row >= 0 && row < SIZE && col >= 0 && col < SIZE ? row * SIZE + col : -1;
}

function clamp(value) {
  return Math.min(SIZE - 1, Math.max(0, value));
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
