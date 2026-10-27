/**
 * Page entry point: connects the pure game modules to the board view, the AI
 * worker, the controls, the language switch and the saved preferences.
 * "?demo" opens a fixed mid-game position (used for the README screenshot).
 */
import { BLACK, EMPTY, WHITE } from './board.js';
import { createAiClient } from './ai-client.js';
import { createBoardView } from './board-view.js';
import { canUndo, createDemoGame, createGame, isAiTurn, playMove, undo } from './game.js';
import { LANGUAGES, pickLanguage, translate } from './i18n.js';
import { createRng } from './rng.js';
import { cellMessage, infoMessage, noticeMessage, roleMessage, statusMessage } from './status.js';
import { storage } from './storage.js';

const MIN_THINK_MS = 550; // the computer never answers faster, so its move is easy to follow
const PASS_THINK_MS = 1400; // a little longer after the human had to pass, to read the notice
const NOTICE_MS = 1800;
const RESULT_NOTICE_MS = 3200;
const SIDES = Object.freeze([
  [BLACK, 'black'],
  [WHITE, 'white'],
]);

const byId = (id) => document.getElementById(id);
const els = {
  newGame: byId('new-game'),
  lang: byId('lang'),
  status: byId('status'),
  statusText: byId('status-text'),
  toast: byId('toast'),
  undo: byId('undo'),
  hints: byId('hints'),
  info: byId('info'),
  ratio: byId('ratio-black'),
  setup: byId('setup'),
  setupForm: byId('setup-form'),
  setupCancel: byId('setup-cancel'),
};

const demo = new URLSearchParams(window.location.search).has('demo');
const ui = {
  lang: pickLanguage(storage.get('lang')),
  hints: storage.get('hints', true) !== false,
  game: demo ? createDemoGame() : createGame(savedSettings()),
  thinking: false,
};
const seeds = createRng(demo ? 1 : Date.now());
const ai = createAiClient();
const view = createBoardView(byId('board-frame'), selectSquare);
const shortcuts = new Map([
  ['u', takeBack],
  ['h', toggleHints],
  ['n', openSetup],
]);
let toastTimer = 0;

/** Settings of the last game started, keeping only the known fields. */
function savedSettings() {
  const saved = storage.get('settings');
  if (typeof saved !== 'object' || saved === null) return {};
  return { mode: saved.mode, humanColor: saved.humanColor, level: saved.level };
}

function t(key, params) {
  return translate(ui.lang, key, params);
}

function say(message) {
  return translate(ui.lang, message.key, message.params);
}

/** Makes `game` the current position, redraws, and lets the computer move if it is its turn. */
function commit(game, motion) {
  ai.cancel();
  ui.game = game;
  ui.thinking = isAiTurn(game);
  render(motion);
  if (motion === 'move') announce(game);
  if (ui.thinking) playComputer(game);
}

async function playComputer(position) {
  const job = {
    board: Array.from(position.board),
    player: position.turn,
    level: position.level,
    seed: Math.floor(seeds() * 2 ** 32),
  };
  const pause = position.passed === position.humanColor ? PASS_THINK_MS : MIN_THINK_MS;
  const [move] = await Promise.all([ai.request(job), wait(pause)]);
  if (ui.game !== position || move === null) return; // undone or restarted meanwhile
  const next = playMove(position, move);
  if (next) commit(next, 'move');
}

function selectSquare(index) {
  const { game } = ui;
  if (game.over || ui.thinking || isAiTurn(game)) return;
  const next = playMove(game, index);
  if (next) {
    hideToast();
    commit(next, 'move');
  } else if (game.board[index] === EMPTY) {
    view.flash(index);
    showToast(t('toastIllegal'), NOTICE_MS);
  }
}

function takeBack() {
  if (!canUndo(ui.game)) return;
  hideToast();
  commit(undo(ui.game), 'soft');
}

function toggleHints() {
  ui.hints = !ui.hints;
  storage.set('hints', ui.hints);
  render('soft');
}

function switchLanguage() {
  ui.lang = LANGUAGES[(LANGUAGES.indexOf(ui.lang) + 1) % LANGUAGES.length];
  storage.set('lang', ui.lang);
  hideToast();
  translatePage();
  render('soft');
}

/** Puts the current language on every static string of the page. */
function translatePage() {
  document.documentElement.lang = ui.lang;
  document.title = t('pageTitle');
  for (const element of document.querySelectorAll('[data-i18n]')) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const element of document.querySelectorAll('[data-i18n-label]')) {
    element.setAttribute('aria-label', t(element.dataset.i18nLabel));
  }
}

function render(motion) {
  const { game, thinking } = ui;
  const humanToMove = !game.over && !thinking && !isAiTurn(game);
  const showMoves = ui.hints && humanToMove;
  view.render(game, {
    motion,
    hints: showMoves,
    interactive: humanToMove,
    label: (index) => say(cellMessage(game, index, showMoves)),
  });
  renderScore(game, thinking);
  const status = statusMessage(game, thinking);
  els.status.dataset.tone = status.tone;
  els.statusText.textContent = say(status);
  els.info.textContent = say(infoMessage(game));
  els.undo.disabled = !canUndo(game);
  els.hints.setAttribute('aria-pressed', String(ui.hints));
  els.newGame.classList.toggle('attention', game.over);
}

function renderScore(game, thinking) {
  for (const [color, name] of SIDES) {
    const player = byId(`player-${name}`);
    player.classList.toggle('active', game.turn === color);
    player.classList.toggle('thinking', thinking && game.turn === color);
    player.classList.toggle('winner', game.over && game.winner === color);
    byId(`count-${name}`).textContent = String(game.score[name]);
    byId(`role-${name}`).textContent = say(roleMessage(game, color));
  }
  const { black, white } = game.score;
  els.ratio.style.width = `${(100 * black) / (black + white)}%`;
}

function announce(game) {
  const notice = noticeMessage(game);
  if (notice) showToast(say(notice), game.over ? RESULT_NOTICE_MS : NOTICE_MS);
}

function showToast(text, duration) {
  clearTimeout(toastTimer);
  els.toast.textContent = text;
  els.toast.classList.add('show');
  toastTimer = setTimeout(hideToast, duration);
}

function hideToast() {
  clearTimeout(toastTimer);
  els.toast.classList.remove('show');
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function openSetup() {
  const { elements } = els.setupForm;
  elements.mode.value = ui.game.mode;
  elements.color.value = String(ui.game.humanColor);
  elements.level.value = ui.game.level;
  syncSetup();
  if (typeof els.setup.showModal !== 'function') {
    startGame(readSetup()); // no <dialog> support: restart with the current settings
    return;
  }
  els.setup.showModal();
}

/** Colour and level only matter against the computer. */
function syncSetup() {
  const vsComputer = els.setupForm.elements.mode.value === 'ai';
  for (const fieldset of els.setupForm.querySelectorAll('.ai-only')) fieldset.disabled = !vsComputer;
}

function readSetup() {
  const { elements } = els.setupForm;
  return { mode: elements.mode.value, humanColor: Number(elements.color.value), level: elements.level.value };
}

function startGame(settings) {
  storage.set('settings', settings);
  hideToast();
  commit(createGame(settings), 'none');
}

/** Page-wide keys: board keys pressed elsewhere bring the focus to the board; U, H and N are shortcuts. */
function handleKey(event) {
  if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (els.setup.open || event.target.closest?.('input, select, textarea')) return;
  if (wantsBoard(event)) {
    event.preventDefault();
    view.focus(); // the first press shows the cursor; the next ones move it or place a disc
    return;
  }
  const action = shortcuts.get(String(event.key).toLowerCase());
  if (action) {
    event.preventDefault();
    action();
  }
}

/**
 * A board key pressed while the focus is elsewhere (on the board the view
 * handles it first and marks it handled): any arrow key, or Enter / Space
 * while nothing has the focus, since a focused button needs those two itself.
 */
function wantsBoard({ key, target }) {
  if (String(key).startsWith('Arrow')) return true;
  const nothingFocused = target === document.body || target === document.documentElement;
  return nothingFocused && (key === 'Enter' || key === ' ');
}

els.newGame.addEventListener('click', openSetup);
els.lang.addEventListener('click', switchLanguage);
els.undo.addEventListener('click', takeBack);
els.hints.addEventListener('click', toggleHints);
els.setupForm.addEventListener('change', syncSetup);
els.setupForm.addEventListener('submit', () => startGame(readSetup())); // method="dialog" then closes it
els.setupCancel.addEventListener('click', () => els.setup.close());
els.setup.addEventListener('click', (event) => {
  if (event.target === els.setup) els.setup.close(); // a click on the backdrop
});
document.addEventListener('keydown', handleKey);

translatePage();
commit(ui.game, 'none');
