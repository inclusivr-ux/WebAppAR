#!/usr/bin/env python3
"""
Monta os alvos do ZOOLÓGICO EM AR (inclusiapp/assets/targets/zoologico.*):

    alvo 0       a página do zoológico cheio (pág. 22 do livro; paginas.mind, alvo 7)
    alvos 1..20  as 20 cartas (cartas.mind, alvos 0..19: carta1 -> alvo 1)

Não compila nada de novo: copia os bytes de cada alvo, exatamente como estão,
dos arquivos que o livro e o Jogo de Cartas já usam (o .mind é um pacote
msgpack com a lista de alvos, e cada alvo é independente). Assim o zoológico
reconhece a página e as cartas do mesmo jeito que o livro e o jogo.

Rode de novo sempre que paginas.mind ou cartas.mind mudarem:

    pip install msgpack
    python3 tools/montar-zoologico.py
"""
import gzip
import json
import os
import struct
import sys
from datetime import datetime, timezone

import msgpack

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
TARGETS = os.path.join(ROOT, 'inclusiapp', 'assets', 'targets')
ZOO_PAGE = 7  # Pagina8.jpg: a volta ao zoológico (pág. 22 do livro)


def split_targets(path):
    """Devolve (versão, [bytes de cada alvo]) sem decodificar os alvos."""
    data = open(path, 'rb').read()
    u = msgpack.Unpacker(raw=False, strict_map_key=False)
    u.feed(data)
    n = u.read_map_header()
    version = None
    items = None
    for _ in range(n):
        key = u.unpack()
        if key == 'v':
            version = u.unpack()
        elif key == 'dataList':
            count = u.read_array_header()
            items = []
            for _ in range(count):
                start = u.tell()
                u.skip()
                items.append(data[start:u.tell()])
        else:
            u.skip()
    if items is None:
        sys.exit(f'{path}: sem dataList')
    return version, items


def fnv1a(data):
    """O mesmo checksum do app (src/ar/targets.js) e do compilador: FNV-1a 32 bits."""
    h = 0x811c9dc5
    for b in data:
        h ^= b
        h = (h * 0x01000193) & 0xffffffff
    return f'{h:08x}'


def array_header(n):
    if n < 16:
        return bytes([0x90 | n])
    if n < 0x10000:
        return b'\xdc' + struct.pack('>H', n)
    return b'\xdd' + struct.pack('>I', n)


def main():
    v1, pages = split_targets(os.path.join(TARGETS, 'paginas.mind'))
    v2, cards = split_targets(os.path.join(TARGETS, 'cartas.mind'))
    if v1 != v2:
        sys.exit(f'versões diferentes do MindAR: {v1} e {v2}')
    items = [pages[ZOO_PAGE]] + cards
    out = msgpack.packb({'v': v1}, use_bin_type=True)
    # {'v': v, 'dataList': [...]} : troca o mapa de 1 item por um de 2 itens
    assert out[0] == 0x81
    out = bytes([0x82]) + out[1:] + msgpack.packb('dataList', use_bin_type=True) + array_header(len(items)) + b''.join(items)

    # confere: decodifica o resultado e compara cada alvo com a origem
    check = msgpack.unpackb(out, raw=False, strict_map_key=False)
    assert check['v'] == v1 and len(check['dataList']) == len(items)
    for raw, dec in zip(items, check['dataList']):
        assert msgpack.unpackb(raw, raw=False, strict_map_key=False) == dec

    with open(os.path.join(TARGETS, 'zoologico.mind'), 'wb') as f:
        f.write(out)
    gz = gzip.compress(out, compresslevel=9, mtime=0)
    with open(os.path.join(TARGETS, 'zoologico.mind.gz'), 'wb') as f:
        f.write(gz)

    pag = json.load(open(os.path.join(TARGETS, 'paginas.json')))
    car = json.load(open(os.path.join(TARGETS, 'cartas.json')))
    targets = [dict(pag['targets'][ZOO_PAGE], index=0)]
    targets += [dict(t, index=i + 1) for i, t in enumerate(car['targets'])]
    manifest = {
        'version': 1,
        'generatedAt': datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z'),
        'mind': 'zoologico.mind',
        'bytes': len(out),
        'checksum': fnv1a(out),
        'from': {'paginas.mind': [ZOO_PAGE], 'cartas.mind': list(range(len(cards)))},
        'count': len(items),
        'targets': targets,
    }
    with open(os.path.join(TARGETS, 'zoologico.json'), 'w') as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
        f.write('\n')
    print(f'zoologico.mind: {len(items)} alvos, {len(out) // 1024} KB (gz {len(gz) // 1024} KB)')


if __name__ == '__main__':
    main()
