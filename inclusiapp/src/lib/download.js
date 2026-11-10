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

export function download(url) {
  let entry = entries.get(url);
  if (entry) return entry.promise;
  entry = { loaded: 0, total: 0, done: false };
  entry.promise = (async () => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
    entry.total = Number(res.headers.get('content-length')) || 0;
    if (!res.body?.getReader || !entry.total) {
      const buffer = await res.arrayBuffer();
      entry.loaded = entry.total = buffer.byteLength;
      return buffer;
    }
    const reader = res.body.getReader();
    const bytes = new Uint8Array(entry.total);
    let offset = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (offset + value.length > bytes.length) throw new Error(`${url}: tamanho inesperado`);
      bytes.set(value, offset);
      offset += value.length;
      entry.loaded = offset;
      notify();
    }
    return offset === bytes.length ? bytes.buffer : bytes.slice(0, offset).buffer;
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
      loaded += e.loaded / e.total;
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
