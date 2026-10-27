/**
 * Interface strings in English and Turkish plus a tiny formatter. Pure
 * module: main.js puts the strings on the page.
 *
 * Templates use {name} placeholders. A parameter may itself be a message
 * ({key, params}), which is translated first, e.g. a level name inside a sentence.
 */

/** Supported interface languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

/** Every interface string, per language. Both tables have the same keys. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    pageTitle: 'Reversi',
    title: 'Reversi',
    newGame: 'New game',
    langButton: 'TR',
    langButtonLabel: 'TR – switch to Turkish',
    scoreLabel: 'Score',
    black: 'Black',
    white: 'White',
    you: 'You',
    computer: 'Computer',
    playerOne: 'Player 1',
    playerTwo: 'Player 2',
    boardLabel: 'Board',
    undo: 'Undo',
    hints: 'Hints',
    infoComputer: 'Against the computer · {level}',
    infoTwoPlayers: 'Two players, one device',
    levelEasy: 'Easy',
    levelMedium: 'Medium',
    levelHard: 'Hard',
    yourTurn: 'Your turn',
    computerTurn: "Computer's turn",
    thinking: 'Computer is thinking',
    blackToMove: 'Black to move',
    whiteToMove: 'White to move',
    passYourTurn: 'Computer passes · your turn',
    passThinking: 'You pass · computer thinking',
    passComputerTurn: "You pass · computer's turn",
    passBlackToMove: 'White passes · Black to move',
    passWhiteToMove: 'Black passes · White to move',
    resultYouWin: 'You win {score}!',
    resultComputerWins: 'Computer wins {score}',
    resultBlackWins: 'Black wins {score}!',
    resultWhiteWins: 'White wins {score}!',
    resultDraw: 'Draw {score}',
    toastYouPass: 'No legal move · you pass',
    toastComputerPass: 'Computer has no move · pass',
    toastBlackPass: 'Black has no move · pass',
    toastWhitePass: 'White has no move · pass',
    toastIllegal: 'Not a legal move',
    cellEmpty: '{square}, empty',
    cellEmptyLegal: '{square}, empty, legal move',
    cellBlack: '{square}, black',
    cellWhite: '{square}, white',
    cellBlackLast: '{square}, black, last move',
    cellWhiteLast: '{square}, white, last move',
    setupTitle: 'New game',
    setupMode: 'Mode',
    modeComputer: 'vs computer',
    modeTwoPlayers: '2 players',
    setupColor: 'Your color',
    blackFirst: 'Black · moves first',
    setupLevel: 'Level',
    start: 'Start',
    cancel: 'Cancel',
    helpTitle: 'How to play',
    helpRules:
      "Place a disc so that it traps a straight line of your opponent's discs against one of yours: every trapped line flips. No legal move means you pass. When neither side can move, the most discs wins.",
    helpKeys: 'Keyboard: arrow keys move, Enter places a disc, U undoes, H toggles hints, N starts a new game.',
    footer: 'MIT · Source on GitHub',
  }),
  tr: Object.freeze({
    pageTitle: 'Reversi',
    title: 'Reversi',
    newGame: 'Yeni oyun',
    langButton: 'EN',
    langButtonLabel: 'EN – İngilizceye geç',
    scoreLabel: 'Skor',
    black: 'Siyah',
    white: 'Beyaz',
    you: 'Sen',
    computer: 'Bilgisayar',
    playerOne: '1. oyuncu',
    playerTwo: '2. oyuncu',
    boardLabel: 'Tahta',
    undo: 'Geri al',
    hints: 'İpuçları',
    infoComputer: 'Bilgisayara karşı · {level}',
    infoTwoPlayers: 'İki oyuncu, tek cihaz',
    levelEasy: 'Kolay',
    levelMedium: 'Orta',
    levelHard: 'Zor',
    yourTurn: 'Sıra sende',
    computerTurn: 'Sıra bilgisayarda',
    thinking: 'Bilgisayar düşünüyor',
    blackToMove: 'Sıra siyahta',
    whiteToMove: 'Sıra beyazda',
    passYourTurn: 'Bilgisayar pas geçti · sıra sende',
    passThinking: 'Pas geçtin · bilgisayar düşünüyor',
    passComputerTurn: 'Pas geçtin · sıra bilgisayarda',
    passBlackToMove: 'Beyaz pas geçti · sıra siyahta',
    passWhiteToMove: 'Siyah pas geçti · sıra beyazda',
    resultYouWin: 'Kazandın, {score}!',
    resultComputerWins: 'Bilgisayar kazandı, {score}',
    resultBlackWins: 'Siyah kazandı, {score}!',
    resultWhiteWins: 'Beyaz kazandı, {score}!',
    resultDraw: 'Berabere, {score}',
    toastYouPass: 'Hamlen yok · pas geçtin',
    toastComputerPass: 'Bilgisayarın hamlesi yok · pas',
    toastBlackPass: 'Siyahın hamlesi yok · pas',
    toastWhitePass: 'Beyazın hamlesi yok · pas',
    toastIllegal: 'Buraya oynanamaz',
    cellEmpty: '{square}, boş',
    cellEmptyLegal: '{square}, boş, oynanabilir',
    cellBlack: '{square}, siyah',
    cellWhite: '{square}, beyaz',
    cellBlackLast: '{square}, siyah, son hamle',
    cellWhiteLast: '{square}, beyaz, son hamle',
    setupTitle: 'Yeni oyun',
    setupMode: 'Mod',
    modeComputer: 'Bilgisayara karşı',
    modeTwoPlayers: 'İki oyuncu',
    setupColor: 'Rengin',
    blackFirst: 'Siyah · ilk hamle',
    setupLevel: 'Seviye',
    start: 'Başla',
    cancel: 'Vazgeç',
    helpTitle: 'Nasıl oynanır',
    helpRules:
      'Taşını, rakibin taşlarından oluşan düz bir sırayı kendi taşlarından biriyle arasına sıkıştıracak bir kareye koy: sıkışan her sıra döner. Oynanabilir hamlen yoksa pas geçersin. İki taraf da oynayamadığında en çok taşı olan kazanır.',
    helpKeys: 'Klavye: oklar imleci taşır, Enter taş koyar, U geri alır, H ipuçlarını açıp kapar, N yeni oyun başlatır.',
    footer: 'MIT · Kaynak kodu GitHub’da',
  }),
});

/**
 * Returns `value` when it names a supported language, otherwise the default
 * (English). Safe for whatever came out of storage.
 * @param {unknown} value
 * @returns {'en'|'tr'}
 */
export function pickLanguage(value) {
  return LANGUAGES.includes(value) ? value : LANGUAGES[0];
}

/**
 * Looks up a string and fills in its {placeholders}. An unknown language
 * falls back to English; an unknown key comes back unchanged.
 * @param {string} lang 'en' or 'tr'
 * @param {string} key
 * @param {Record<string, string|number|{key: string, params?: object}>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const table = STRINGS[pickLanguage(lang)];
  const template = Object.hasOwn(table, key) ? table[key] : key;
  return template.replace(/\{(\w+)\}/g, (placeholder, name) => {
    if (!Object.hasOwn(params, name)) return placeholder;
    const value = params[name];
    return typeof value === 'object' && value !== null ? translate(lang, value.key, value.params) : String(value);
  });
}
