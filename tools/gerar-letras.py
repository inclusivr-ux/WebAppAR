#!/usr/bin/env python3
"""
Gera o contorno das letras 3D do zoológico (inclusiapp/assets/zoo/letras.json).

As letras são as do próprio app (Fraunces, licença OFL), no peso 650 (bem
cheinhas, para parecer desenho). O app extruda o contorno em 3D
(src/zoo/letterModel.js). Só as vogais por enquanto: são as cartas que
existem (sinal da vogal + letra). Para mais letras, acrescente em LETRAS.

    pip install fonttools brotli skia-pathops
    python3 tools/gerar-letras.py
"""
import io
import json
import os

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.ttLib.removeOverlaps import removeOverlaps
from fontTools.varLib import instancer

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
FONTE = os.path.join(ROOT, 'inclusiapp', 'assets', 'fonts', 'fraunces-soft.woff2')
SAIDA = os.path.join(ROOT, 'inclusiapp', 'assets', 'zoo', 'letras.json')
LETRAS = 'AEIOU'
PESO = 650


class Caminho(BasePen):
    """Grava o contorno como M, L, Q e Z (curvas quadráticas, como no TrueType)."""

    def __init__(self, glyphset):
        super().__init__(glyphset)
        self.cmds = []

    def _moveTo(self, p):
        self.cmds.append(['M', round(p[0], 1), round(p[1], 1)])

    def _lineTo(self, p):
        self.cmds.append(['L', round(p[0], 1), round(p[1], 1)])

    def _qCurveToOne(self, c, p):
        self.cmds.append(['Q', round(c[0], 1), round(c[1], 1), round(p[0], 1), round(p[1], 1)])

    def _curveToOne(self, c1, c2, p):
        self.cmds.append(['C', *(round(v, 1) for v in (*c1, *c2, *p))])

    def _closePath(self):
        self.cmds.append(['Z'])


def main():
    font = TTFont(FONTE)
    font = instancer.instantiateVariableFont(font, {'wght': PESO})
    # recarrega a instância (os contornos de glyf ficam resolvidos)
    buf = io.BytesIO()
    font.save(buf)
    font = TTFont(io.BytesIO(buf.getvalue()))
    cmap = font.getBestCmap()
    # a fonte variável guarda letras feitas de pedaços sobrepostos (o A, o E):
    # em 3D, as paredes de dentro apareceriam como riscos. Junta os pedaços.
    removeOverlaps(font, [cmap[ord(c)] for c in LETRAS])
    glyphs = font.getGlyphSet()
    out = {
        'fonte': 'Fraunces Soft (OFL), peso %d' % PESO,
        'unidades': font['head'].unitsPerEm,
        'letras': {},
    }
    for letra in LETRAS:
        nome = cmap[ord(letra)]
        pen = Caminho(glyphs)
        glyphs[nome].draw(pen)
        xs = [v for c in pen.cmds for v in c[1::2] if isinstance(v, (int, float))]
        ys = [v for c in pen.cmds for v in c[2::2] if isinstance(v, (int, float))]
        out['letras'][letra] = {
            'largura': glyphs[nome].width,
            'caixa': [min(xs), min(ys), max(xs), max(ys)],
            'caminho': pen.cmds,
        }
    os.makedirs(os.path.dirname(SAIDA), exist_ok=True)
    with open(SAIDA, 'w') as f:
        json.dump(out, f, separators=(',', ':'), ensure_ascii=False)
    print(f'{os.path.relpath(SAIDA, ROOT)}: {len(LETRAS)} letras, {os.path.getsize(SAIDA)} bytes')


if __name__ == '__main__':
    main()
