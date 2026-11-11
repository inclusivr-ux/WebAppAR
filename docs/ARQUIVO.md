# O que foi arquivado (e como trazer de volta)

Arquivar aqui quer dizer: **sai do app, mas nada se perde**. Tudo continua no
histórico do git, e os modelos continuam nos repositórios de origem.

A versão completa de antes, com tudo o que está abaixo funcionando, é o
commit **`a6eba3a`** (versão 2.1.1, que entrou no `main` pelo PR #4).

---

## 1. A Maga Aia e o Seu Zé em 3D (arquivados em 10/11/2026, versão 2.2)

### Por quê (palavras da equipe)

> "Modelos deles com poses e animações genéricas. Ângulo de visão um pouco
> estranho. Não ficou muito bom a apresentação."

Além disso:
- as 4 páginas deles deixavam o reconhecimento das páginas mais lento (de 5
  para 9 páginas procuradas);
- o app baixava os dois modelos (8 MB) com a câmera aberta.

As duas coisas pioravam o rastreio dos animais.

### O que saiu do app

| O quê | Onde estava |
|---|---|
| Os modelos VRM leves | `inclusiapp/assets/personagens/aia.vrm`, `seuze.vrm` |
| O código dos personagens (olá, feliz, andar, molas do cabelo e da roupa) | `inclusiapp/src/characters/characterModel.js` |
| As bibliotecas que só eles usavam | `inclusiapp/vendor/three-vrm/`, `inclusiapp/vendor/three/basis/`, `KTX2Loader.js`, `WorkerPool.js`, `ktx-parse.module.js`, `zstddec.module.js` |
| As 4 páginas do livro com eles (págs. 8, 11, 22 e 23) | `inclusiapp/pag/Pagina6.jpg` a `Pagina9.jpg`, miniaturas `assets/img/paginas/pagina8/11/22/23.webp` |
| Os retratos | `assets/img/aia-rosto.webp`, `assets/img/seuze-rosto.webp` |
| Os botões "AIA" e "SEU ZÉ" do zoológico e o texto "Toque na Aia ou no Seu Zé" | `index.html`, `src/zoo/zooAR.js`, `src/ar/bookAR.js` |

- O arquivo de reconhecimento das páginas voltou a ser o da primeira versão:
  5 páginas, o mesmo arquivo do JLeo (`paginas.mind`, checksum `000a1d0f`).
- A ilustração da abertura (a cena do livro com todos no zoológico) **ficou**:
  ela é o desenho do Igor, não o 3D.

### De onde vêm os modelos

- Maga Aia: repositório `inclusivr-aia` (gerador e VRM web).
- Seu Zé: repositório `inclusivr-personagens`.

### Como trazer de volta

1. Recupere os arquivos do commit `a6eba3a`:

   ```bash
   git checkout a6eba3a -- inclusiapp/src/characters inclusiapp/assets/personagens inclusiapp/vendor/three-vrm inclusiapp/vendor/three/basis inclusiapp/vendor/three/addons inclusiapp/pag inclusiapp/assets/img/paginas inclusiapp/assets/img/aia-rosto.webp inclusiapp/assets/img/seuze-rosto.webp
   ```

2. Gere de novo as páginas reconhecíveis (`npm run targets`). As páginas 6 a 9 entram como alvos 5 a 8.
3. Devolva `CHARACTERS` e as páginas com `characters` em `BOOK_PAGES` (`src/config.js`, versão `a6eba3a`).
4. Devolva o carregamento dos personagens no livro (`src/ar/bookAR.js` da `a6eba3a`), adaptado ao palco de brincar da 2.2.

Antes de trazer de volta, vale refazer as poses e animações. Foi o motivo do arquivamento.

---

## 2. O zoológico com a página 22 (substituído em 10/11/2026)

### Por quê (palavras da equipe)

> "O sistema parece não acomodar mais de 4 animais por página (problema em
> partes físico, pois muitas cartas no livro tampam a página, fazendo com que
> o sistema não consiga reconhecer a página em si). Os modelos parecem estar
> também sobrecarregando a página."

### O que mudou

- Na versão 2.2, as **cartas viram validadores**.
- Cada carta, em qualquer posição, traz o seu animal ou a sua letra para um "palco" no meio da tela.
- A página 22 não é mais usada.

O que saiu:
- `assets/targets/zoologico.*`, o arquivo com a página 22 e as 20 cartas;
- `tools/montar-zoologico.py`;
- os quadros de teste com a página.

### Se o zoológico novo não ficar fluido no celular

A equipe pediu para arquivar o zoológico, se ele não ficar fluido. O caminho é este:

1. No `index.html`, tire o cartão "ZOOLÓGICO" da sala de jogos e as duas telas `zoo-intro` e `zoo`.
2. No `src/main.js`:
   - faça as rotas `zoo` e `zoo/ar` (e as antigas `bichinho`) levarem a `sala`;
   - tire o `ZooExperience`.
3. Remova:
   - `src/zoo/`;
   - `assets/zoo/letras.json` e `tools/gerar-letras.py`;
   - os testes `tests/unit/zooState.test.mjs` e a parte `zoo` de `tests/e2e/run.mjs`.
4. Registre aqui e no `docs/ATUALIZACAO-2026-11.md`.

---

## 3. Os pontos e o tempo do Sinalize! (retirados em 10/11/2026)

### Por quê (palavras da equipe)

> "O tempo passa a impressão de que tem que fazer rápido, e isso vai
> ativamente contra o bom funcionamento do MediaPipe. Apenas certo e errado
> está ótimo."

### O que saiu

- `src/sign/signScore.js` (os pontos e o bônus de rapidez);
- `src/sign/signRecords.js` (os recordes) e o teste dele;
- a contagem 3-2-1, o tempo limite de cada tentativa e as estrelas do fim.

Tudo está no commit `a6eba3a`.

**A contagem 3, 2, 1 voltou na versão 2.2.2** (11/11/2026), a pedido da equipe:
"o 3, 2, 1... sua vez estava funcionando melhor". O tempo limite, os pontos e
as estrelas continuam fora.
