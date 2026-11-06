#!/usr/bin/env python3
"""
Monta as imagens das instruções do livro em AR, só com a arte final
(página do Igor, moldura de celular do design system e o animal 3D), sem
etiquetas por cima:

  assets/img/instrucoes-ar.webp     o celular a ~30 cm da página, com o
                                    elefante 3D saindo da tela
  assets/img/pagina-dupla.webp      a página da runa (sem AR) ao lado da
                                    página do animal (com AR); as marcas de
                                    sim/não vêm do CSS do app

    python3 tools/compor-instrucoes.py --elefante render.png --moldura celular.png --runa p16.jpg --animal p17.jpg

  --elefante  o elefante 3D renderizado com fundo transparente
              (tools/model-viewer.html?names=elefante_lagoa&clip=parado&t=0.8)
  --moldura   celular-moldura.png do design system
  --runa      a ilustração da página da runa E (pág. 16)
  --animal    a ilustração da página do elefante (pág. 17)
"""
import argparse
import os
import random

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'inclusiapp', 'assets', 'img')


def perspective(src, dst):
    a = []
    for (xs, ys), (xd, yd) in zip(src, dst):
        a.append([xd, yd, 1, 0, 0, 0, -xs * xd, -xs * yd])
        a.append([0, 0, 0, xd, yd, 1, -ys * xd, -ys * yd])
    return np.linalg.solve(np.array(a, dtype=np.float64), np.array(src).reshape(8))


def shadow(layer, blur=18, opacity=0.35, offset=(0, 14)):
    alpha = layer.split()[3].point(lambda v: int(v * opacity))
    sh = Image.new('RGBA', layer.size, (20, 24, 18, 0))
    sh.putalpha(alpha)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    out = Image.new('RGBA', layer.size, (0, 0, 0, 0))
    out.alpha_composite(sh, offset)
    return out


def faiscas(canvas, box, n=16, seed=7):
    rnd = random.Random(seed)
    x0, y0, x1, y1 = box
    for _ in range(n):
        s = rnd.randint(7, 15)
        x = rnd.randint(x0, x1)
        y = rnd.randint(y0, y1)
        color = (116, 208, 216, rnd.randint(150, 230)) if rnd.random() < 0.6 else (166, 228, 224, rnd.randint(140, 220))
        sq = Image.new('RGBA', (s, s), color)
        canvas.alpha_composite(sq, (x, y))


def instrucoes(a):
    W, H = 1000, 760
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    page = Image.open(a.animal_ar).convert('RGBA').resize((660, 465), Image.LANCZOS)

    # a página deitada na mesa (vista de cima e de frente)
    pw, ph = page.size
    dst = [(70, 0), (pw - 70, 0), (pw, ph * 0.6), (0, ph * 0.6)]
    coeffs = perspective([(0, 0), (pw, 0), (pw, ph), (0, ph)], dst)
    flat = page.transform((pw, int(ph * 0.6)), Image.PERSPECTIVE, coeffs, Image.BICUBIC)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.alpha_composite(flat, (30, 470))
    canvas.alpha_composite(shadow(layer, 16, 0.3, (0, 10)))
    canvas.alpha_composite(layer)

    # o celular, com a câmera vendo a página
    frame = Image.open(a.moldura).convert('RGBA').resize((300, 605), Image.LANCZOS)
    fw, fh = frame.size
    screen = Image.open(a.animal_ar).convert('RGBA')
    sw, sh = screen.size
    crop = screen.crop((int(sw * 0.3), int(sh * 0.05), int(sw * 0.7), int(sh * 0.95)))
    crop = crop.resize((fw - 36, fh - 60), Image.LANCZOS)
    phone = Image.new('RGBA', (fw, fh), (0, 0, 0, 0))
    phone.alpha_composite(crop, (18, 30))
    phone.alpha_composite(frame)
    phone = phone.rotate(-9, resample=Image.BICUBIC, expand=True)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    layer.alpha_composite(phone, (610, 40))
    canvas.alpha_composite(shadow(layer, 20, 0.4, (10, 16)))
    canvas.alpha_composite(layer)

    # o elefante 3D saindo da tela
    ele = Image.open(a.elefante).convert('RGBA')
    ele = ele.crop(ele.getbbox())
    ele.thumbnail((420, 420), Image.LANCZOS)
    ex, ey = 560, 175
    canvas.alpha_composite(ele, (ex, ey))
    faiscas(canvas, (ex - 20, ey - 40, ex + ele.size[0], ey + 80))

    canvas = canvas.crop(canvas.getbbox())
    canvas.save(f'{OUT}/instrucoes-ar.webp', 'WEBP', quality=84, method=6)
    print('instrucoes-ar.webp', canvas.size, os.path.getsize(f'{OUT}/instrucoes-ar.webp') // 1024, 'KB')


def dupla(a):
    left = Image.open(a.runa).convert('RGB')
    right = Image.open(a.animal).convert('RGB')
    h = 520
    left = left.resize((int(left.width * h / left.height), h), Image.LANCZOS)
    right = right.resize((int(right.width * h / right.height), h), Image.LANCZOS)
    gap = 6
    out = Image.new('RGB', (left.width + right.width + gap, h), (66, 67, 58))
    out.paste(left, (0, 0))
    out.paste(right, (left.width + gap, 0))
    out.save(f'{OUT}/pagina-dupla.webp', 'WEBP', quality=80, method=6)
    print('pagina-dupla.webp', out.size, f'(runa até x={left.width})', os.path.getsize(f'{OUT}/pagina-dupla.webp') // 1024, 'KB')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--elefante', required=True)
    ap.add_argument('--moldura', required=True)
    ap.add_argument('--runa', required=True)
    ap.add_argument('--animal', required=True)
    ap.add_argument('--animal-ar', default=os.path.join(ROOT, 'inclusiapp', 'pag', 'Pagina2.png'))
    args = ap.parse_args()
    instrucoes(args)
    dupla(args)
