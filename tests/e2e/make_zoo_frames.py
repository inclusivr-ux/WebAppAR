#!/usr/bin/env python3
"""
Quadros de teste do ZOOLÓGICO EM AR (tests/fixtures/frames/zoo/), 640×480,
como a câmera falsa dos testes entrega ao app:

    pagina.jpg                 a página 22 (zoológico cheio) na mesa
    pagina_carta3.jpg          + a carta do urso (desenho) em cima, à esquerda
    pagina_carta3_carta11.jpg  + a carta do sinal do A, à direita
    carta3.jpg                 só a carta do urso, sem a página
    inclinada_carta3_carta11.jpg  a página com as duas cartas vista de lado (celular inclinado)

A página e as cartas são as imagens dos alvos (inclusiapp/pag e
inclusiapp/cartas); a carta fica um pouco girada, como numa mesa de verdade.

    python3 tests/e2e/make_zoo_frames.py
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
APP = os.path.join(ROOT, 'inclusiapp')
OUT = os.path.join(ROOT, 'tests', 'fixtures', 'frames', 'zoo')
MESA = (123, 90, 60)
PAGINA = 440  # lado da página no quadro (px)
CARTA = 128   # largura da carta no quadro (px): a carta tem ~0,29 da largura da página


def carta(n, angulo):
    im = Image.open(os.path.join(APP, 'cartas', f'carta{n}.png')).convert('RGBA')
    h = round(im.height * CARTA / im.width)
    im = im.resize((CARTA, h), Image.LANCZOS)
    return im.rotate(angulo, expand=True, resample=Image.BICUBIC)


def quadro(com_pagina=True, cartas=()):
    q = Image.new('RGB', (640, 480), MESA)
    x0, y0 = (640 - PAGINA) // 2, (480 - PAGINA) // 2
    if com_pagina:
        pag = Image.open(os.path.join(APP, 'pag', 'Pagina8.jpg')).convert('RGB').resize((PAGINA, PAGINA), Image.LANCZOS)
        q.paste(pag, (x0, y0))
    for n, (fx, fy), ang in cartas:
        c = carta(n, ang)
        cx, cy = x0 + fx * PAGINA, y0 + fy * PAGINA
        q.paste(c, (round(cx - c.width / 2), round(cy - c.height / 2)), c)
    return q


def inclinar(im, k=0.24):
    """Como se o celular estivesse mais baixo, olhando a página de lado: o alto fica mais estreito."""
    w, h = im.size
    # pontos de destino (quadrilátero) → origem: PIL usa os coeficientes da transformação inversa
    dst = [(w * k, h * 0.1), (w * (1 - k), h * 0.1), (w, h), (0, h)]
    src = [(0, 0), (w, 0), (w, h), (0, h)]
    import numpy as np
    A = []
    B = []
    for (x, y), (u, v) in zip(dst, src):
        A.append([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.append(u)
        A.append([0, 0, 0, x, y, 1, -v * x, -v * y]); B.append(v)
    coef = np.linalg.solve(np.array(A, float), np.array(B, float))
    out = im.transform((w, h), Image.PERSPECTIVE, tuple(coef), Image.BICUBIC, fillcolor=MESA)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    quadro().save(os.path.join(OUT, 'pagina.jpg'), quality=90)
    urso = (3, (0.28, 0.62), 8)
    a = (11, (0.74, 0.58), -6)
    quadro(cartas=[urso]).save(os.path.join(OUT, 'pagina_carta3.jpg'), quality=90)
    quadro(cartas=[urso, a]).save(os.path.join(OUT, 'pagina_carta3_carta11.jpg'), quality=90)
    inclinar(quadro(cartas=[urso, a])).save(os.path.join(OUT, 'inclinada_carta3_carta11.jpg'), quality=90)
    sozinha = Image.new('RGB', (640, 480), MESA)
    c = carta(3, 4).resize((int(carta(3, 4).width * 2), int(carta(3, 4).height * 2)))
    sozinha.paste(c, ((640 - c.width) // 2, (480 - c.height) // 2), c)
    sozinha.save(os.path.join(OUT, 'carta3.jpg'), quality=90)
    print('ok:', sorted(os.listdir(OUT)))


if __name__ == '__main__':
    main()
