/**
 * Seeded pseudo-random numbers (mulberry32). Everything random in the game
 * goes through an instance of this generator, so a seed replays it exactly.
 */

/**
 * Creates a deterministic random number generator.
 * @param {number} seed any number; its lowest 32 bits are used
 * @returns {() => number} a function returning floats in [0, 1)
 */
export function createRng(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), state | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
