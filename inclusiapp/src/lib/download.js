/**
 * Downloads com progresso (modelos 3D: animais e personagens).
 *
 *   download(url)          → Promise<ArrayBuffer> (uma vez por endereço)
 *   progressOf([urls])     → 0…1, somando os bytes de todos
 *   onProgress(fn)         → avisa a cada pedaço baixado; devolve "desligar"
 *
 * A pré-carga (em segundo plano) e a página que aparece usam o MESMO download:
 * se a criança chega na página da Aia enquanto ela ainda baixa, a barra de
 * progresso continua de onde estava, sem baixar de novo.
 */
const entries = new Map(); // url → { promise, loaded, total, done }
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

/**
 * Quanto o arquivo cresce ao descomprimir (gzip do GitHub Pages), para a barra
 * de progresso: medido nos modelos do app (abelha 1,47×, Aia 1,39×).
 */
const GZIP_RATIO = 1.45;

export function download(url) {
  let entry = entries.get(url);
  if (entry) return entry.promise;
  entry = { loaded: 0, total: 0, done: false };
  entry.promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    // ATENÇÃO: com compressão (o GitHub Pages manda .glb, .vrm, .mind e .json
    // em gzip), o Content-Length é o tamanho COMPRIMIDO, e o que chega aqui já
    // vem descomprimido (maior). Ele só serve para estimar a barra; os pedaços
    // são juntados sem limite de tamanho. (Na versão 2.1.0 o download reservava
    // o tamanho comprimido e falhava: "Não foi possível carregar esta página".)
    const length = Number(res.headers.get('content-length')) || 0;
    const encoding = (res.headers.get('content-encoding') || 'identity').toLowerCase();
    entry.total = encoding === 'identity' ? length : Math.round(length * GZIP_RATIO);
    if (!res.body?.getReader) {
      const buffer = await res.arrayBuffer();
      entry.loaded = buffer.byteLength;
      return buffer;
    }
    const reader = res.body.getReader();
    const chunks = [];
    let received = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      entry.loaded = received;
      notify();
    }
    const bytes = new Uint8Array(received);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    return bytes.buffer;
  })().then((buffer) => {
    entry.done = true;
    entry.loaded = entry.total = buffer.byteLength;
    notify();
    return buffer;
  }, (err) => {
    entries.delete(url);
    notify();
    throw err;
  });
  entries.set(url, entry);
  return entry.promise;
}

/** Fração baixada (0…1) de um ou mais endereços; o que ainda não começou conta como 0. */
export function progressOf(urls) {
  let loaded = 0;
  let total = 0;
  let unknown = 0;
  for (const url of [].concat(urls)) {
    const e = entries.get(url);
    if (e?.done) {
      loaded += 1;
      total += 1;
    } else if (e?.total) {
      // a estimativa (com gzip) pode errar: a barra para em 97% até o fim de verdade
      loaded += Math.min(0.97, e.loaded / e.total);
      total += 1;
    } else {
      unknown += 1;
    }
  }
  const n = total + unknown;
  return n ? loaded / n : 1;
}

export function isDownloaded(url) {
  return !!entries.get(url)?.done;
}

export function onProgress(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
