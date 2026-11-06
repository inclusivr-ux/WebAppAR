#!/usr/bin/env python3
"""
Prepara as imagens do app (WebP leves) a partir da arte final do Igor e do
design system "InclusiVR".

    python3 tools/preparar-imagens.py --ds PASTA_DS --animais PASTA_ANIMAIS --personagens PASTA_PERSONAGENS

  --ds           pasta com os arquivos baixados do design system (o nome de
                 cada arquivo é o id do asset; veja DS abaixo)
  --animais      clone do repositório inclusivr-animais (com o LFS baixado)
  --personagens  clone do repositório inclusivr-personagens (com o LFS baixado)

Saída em inclusiapp/assets/img/. Nada é desenhado aqui: só recortes e
reduções das ilustrações originais (o traço do Igor manda na aparência).
"""
import argparse
import glob
import os
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'inclusiapp', 'assets', 'img')

# id do asset no design system → nome
DS = {
    'f3a5413112ce029cf403199ed59d3320': 'fundo-claro',            # CenasApp/fundo-claro.jpg (floresta esmaecida, vertical)
    '5f361d8946af1c6e5a6e19921dcb6829': 'fundo-floresta-esmaecida',
    '0da151f340aa8bfd7fdd95aa0031c89e': 'fundo-floresta',
    '2fc25ecc6e7545fcedf823ac8762eb87': 'runa-a',
    '70694544afb1535834a4b52df272abe6': 'runa-e',
    '8fa7b943592e6ea3c171ef8eed21bcb3': 'runa-i',
    'b437c8cd503aeaa959a94f23a8df597a': 'runa-o',
    'ff5be68468b0de513ec6f22b854dcb7f': 'runa-u',
    '9931705b58d5b914bf7882e12749318e': 'acesa-a',
    '8335c07225d133d5a99da4001ef1647e': 'acesa-e',
    'ebc28a9e971bb750688df1ae8de91b86': 'acesa-i',
    '1c0d48aaf6b581772da24fae70278049': 'acesa-o',
    'e72faa92f90a0e188b074e0cb7d46313': 'acesa-u',
    '23364933b3e95026ee31e6c2db2cefe8': 'logo-livro',
    '4c8cccea5ea922c4464b784720a2c6fd': 'inclusivr',
    '9d5ca41c2f113335538ce4f2f622c460': 'celular-moldura',
    '7cb8cf7d8de25828fbac516e4c212465': 'aia-rosto',
    'afa67296a8e22135686fce7505c8ab20': 'cena-zoologico',
}

# retratos redondos dos animais: (arquivo do repositório inclusivr-animais, recorte)
RETRATOS = {
    'abelha': ('Abelha/00_referencias/igor/2025-11_livro_p15_abelhas.jpg', (440, 436, 810, 806)),
    'elefante': ('Elefante/00_referencias/igor/2025-11_livro_p24_elefante_zoo.jpg', (20, 0, 620, 600)),
    'iguana': ('Iguana/00_referencias/igor/2025-11_livro_p19_iguana_recorte.png', (940, 0, 1356, 416)),
    'onca': ('Onca/00_referencias/igor/2025-11_livro_p24_onca_zoo.jpg', (40, 300, 440, 700)),
    'urso': ('Urso/00_referencias/igor/2025-11_livro_p24_urso_zoo.jpg', (30, 60, 350, 380)),
}

# páginas sem animal em AR em que a Aia e o Seu Zé aparecem (ilustrações do Igor)
PAGINAS_PERSONAGENS = {
    'pagina10': '2025-11_livro_p10_portao_do_zoo.jpg',
    'pagina13': '2025-11_livro_p13_runas_nas_maos.jpg',
    'pagina24': '2025-11_livro_p24_volta_ao_zoo.jpg',
    'pagina25': '2025-11_livro_p25_devolve_as_runas.jpg',
}


def webp(im, path, size=None, quality=82):
    if size:
        im = im.copy()
        im.thumbnail(size, Image.LANCZOS)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, 'WEBP', quality=quality, method=6)
    print(f'{os.path.relpath(path, ROOT)}  {im.size[0]}x{im.size[1]}  {os.path.getsize(path) // 1024} KB')


def redondo(im, size=256):
    """Retrato quadrado com a borda transparente em círculo (o contorno tinta vem do CSS)."""
    im = im.convert('RGBA').resize((size, size), Image.LANCZOS)
    mask = Image.new('L', (size * 4, size * 4), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4 - 1, size * 4 - 1), fill=255)
    out = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask.resize((size, size), Image.LANCZOS))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--ds', required=True)
    ap.add_argument('--animais', required=True)
    ap.add_argument('--personagens', required=True)
    a = ap.parse_args()

    src = {}
    for path in glob.glob(os.path.join(a.ds, '*')):
        key = os.path.splitext(os.path.basename(path))[0]
        if key in DS:
            src[DS[key]] = path
    falta = sorted(set(DS.values()) - set(src))
    if falta:
        raise SystemExit(f'faltam no --ds: {falta}')

    Image.MAX_IMAGE_PIXELS = None
    webp(Image.open(src['fundo-claro']).convert('RGB'), f'{OUT}/fundo-claro.webp', (720, 1500), 70)
    webp(Image.open(src['fundo-floresta-esmaecida']).convert('RGB'), f'{OUT}/fundo-largo.webp', (1600, 800), 70)
    webp(Image.open(src['fundo-floresta']).convert('RGB'), f'{OUT}/fundo-zoo.webp', (1600, 800), 74)
    webp(Image.open(src['cena-zoologico']).convert('RGB'), f'{OUT}/cena-zoologico.webp', (1200, 600), 74)
    webp(Image.open(src['logo-livro']), f'{OUT}/logo-livro.webp', (640, 460), 86)
    webp(Image.open(src['inclusivr']), f'{OUT}/inclusivr.webp', (160, 224), 88)
    webp(Image.open(src['celular-moldura']), f'{OUT}/celular-moldura.webp', (320, 645), 88)
    webp(Image.open(src['aia-rosto']).convert('RGB'), f'{OUT}/aia-rosto.webp', (256, 256), 80)
    for v in 'aeiou':
        webp(Image.open(src[f'runa-{v}']), f'{OUT}/runas/runa-{v}.webp', (240, 348), 84)
        webp(Image.open(src[f'acesa-{v}']).convert('RGB'), f'{OUT}/runas/acesa-{v}.webp', (240, 348), 80)

    for animal, (rel, box) in RETRATOS.items():
        im = Image.open(os.path.join(a.animais, rel)).convert('RGBA')
        bg = Image.new('RGBA', im.size, (230, 240, 220, 255))
        bg.alpha_composite(im)
        webp(redondo(bg.crop(box)), f'{OUT}/animais/{animal}.webp', None, 84)

    for nome, arq in PAGINAS_PERSONAGENS.items():
        im = Image.open(os.path.join(a.personagens, 'SeuZe/00_referencias/igor', arq)).convert('RGB')
        webp(im, f'{OUT}/paginas/{nome}.webp', (420, 420), 78)
    for i in range(1, 6):
        im = Image.open(os.path.join(ROOT, 'inclusiapp', 'pag', f'Pagina{i}.png')).convert('RGB')
        webp(im, f'{OUT}/paginas/pagina-ar{i}.webp', (420, 420), 78)


if __name__ == '__main__':
    main()
