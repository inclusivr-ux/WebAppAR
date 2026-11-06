/**
 * Números "aleatórios" com semente: a mesma semente sempre dá a mesma
 * sequência. O Jogo de Cartas e o Sinalize embaralham UMA vez por partida
 * com uma semente nova; a ordem fica fixa até o fim da partida (e continua
 * igual se o jogo for retomado depois).
 */

/** Gerador mulberry32: devolve uma função que dá números em [0, 1). */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uma semente nova (número inteiro de 32 bits). */
export function newSeed() {
  try {
    return crypto.getRandomValues(new Uint32Array(1))[0];
  } catch {
    return Math.floor(Math.random() * 2 ** 32) >>> 0;
  }
}
