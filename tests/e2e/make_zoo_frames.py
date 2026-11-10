#!/usr/bin/env python3
"""
Quadros de teste do ZOOLÓGICO EM AR (tests/fixtures/frames/zoo/), 640×480,
como a câmera falsa dos testes entrega ao app. Desde a versão 2.2 o
zoológico não usa a página 22: só as CARTAS, em qualquer posição.

    carta3.jpg               a carta do urso (desenho) na mesa, um pouco girada
    carta3_deitada.jpg       a mesma carta girada 90° (deitada na mesa)
    carta11_de_cabeca.jpg    a carta do sinal do A de cabeça para baixo
    carta20_inclinada.jpg    a carta da letra U vista de lado (celular inclinado)
    carta1_carta12.jpg       duas cartas juntas: a abelha e o sinal do E
    mesa.jpg                 a mesa vazia

As cartas são as imagens dos alvos (inclusiapp/cartas).

    python3 tests/e2e/make_zoo_frames.py
"""
import os
import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
APP = os.path.join(ROOT, 'inclusiapp')
OUT = os.path.join(ROOT, 'tests', 'fixtures', 'frames', 'zoo')
MESA = (123, 90, 60)
CARTA = 230  # largura da carta no quadro (px): a uns 20 cm da câmera


def carta(n, angulo=0, largura=CARTA):
    im = Image.open(os.path.join(APP, 'cartas', f'carta{n}.png')).convert('RGBA')
    h = round(im.height * largura / im.width)
    im = im.resize((largura, h), Image.LANCZOS)
    return im.rotate(angulo, expand=True, resample=Image.BICUBIC)


def quadro(cartas):
    q = Image.new('RGB', (640, 480), MESA)
    for n, (cx, cy), ang, larg in cartas:
        c = carta(n, ang, larg)
        q.paste(c, (round(cx - c.width / 2), round(cy - c.height / 2)), c)
    return q


def inclinar(im, k=0.22):
    """Como se o celular estivesse mais baixo, olhando a carta de lado: o alto fica mais estreito."""
    w, h = im.size
    dst = [(w * k, h * 0.08), (w * (1 - k), h * 0.08), (w, h), (0, h)]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    A, B = [], []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    coef = np.linalg.solve(np.array(A, float), np.array(B, float))
    return im.transform((w, h), Image.PERSPECTIVE, tuple(coef), Image.BICUBIC, fillcolor=MESA)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    salvar = lambda im, nome: im.save(os.path.join(OUT, nome), quality=90)
    salvar(quadro([]), 'mesa.jpg')
    salvar(quadro([(3, (320, 240), 8, CARTA)]), 'carta3.jpg')
    salvar(quadro([(3, (320, 240), 90, CARTA)]), 'carta3_deitada.jpg')
    salvar(quadro([(11, (320, 240), 180, CARTA)]), 'carta11_de_cabeca.jpg')
    salvar(inclinar(quadro([(20, (320, 250), -5, CARTA)])), 'carta20_inclinada.jpg')
    salvar(quadro([(1, (180, 240), -10, 200), (12, (460, 240), 12, 200)]), 'carta1_carta12.jpg')
    # o resto, para completar os 10 (5 animais + 5 letras) em posições variadas
    for n, ang in ((2, -20), (4, 135), (5, 45), (13, -90), (19, 200)):
        salvar(quadro([(n, (320, 240), ang, CARTA)]), f'carta{n}.jpg')
    print('ok:', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
