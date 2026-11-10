# SinalizaAção: Animais em Voga — WebApp de Realidade Aumentada

O app que dá vida ao livro *SinalizaAção: Animais em Voga* (InclusiVR), para
crianças de 3 a 8 anos — muitas ainda sem saber ler. Roda no navegador do
celular (Android e iPhone), sem instalar nada.

- **LIVRO** — aponte o celular para uma página com AR: o animal (traço do Igor
  Bucioli, em 3D) **salta do desenho**, fica feliz e **passeia pela página**.
  Tocar nele é **carinho**. Se a página some da câmera, ele **espera um
  instante** (uma falha curta passa despercebida) e depois **pisca, fica
  transparente e pede "QUERO VOLTAR PARA MINHA PÁGINA!"**. O botão **LIBRAS**
  chama o **intérprete de LIBRAS**: **SINAL DO ANIMAL** (repete quantas vezes quiser) e
  **SOLETRAR O NOME** (cada letra destacada em sincronia, como karaokê). Nas
  páginas sem animal em AR, a **Maga Aia** e o **Seu Zé** acenam, ficam
  felizes, andam e respondem ao toque.
- **JOGOS**:
  - **Jogo de Cartas** — o jogo mostra o animal (ou a letra) e a criança acha,
    entre as cartas com a face de LIBRAS para cima, **o sinal que combina**.
    Embaralha **uma vez por partida** (com semente); errar não tira pontos.
  - **Zoológico (em AR)** — o livro aberto na **página 22** (o zoológico cheio)
    vira o chão; cada **carta** colocada em cima da página traz o seu animal,
    e a carta do **sinal de uma vogal** traz a **letra** do português, em 3D.
    Todos brincam juntos (o urso come o mel da abelha, o elefante joga água, a
    onça brinca, a letra acende quando o seu animal chega). A Aia e o Seu Zé
    vêm por botões; a **casinha** leva alguém para descansar.
  - **Sinalize!** — o jogo mostra uma **vogal**; o intérprete faz o sinal
    **duas vezes**, e a criança repete para a **câmera frontal**; reconhecido a
    tempo = pontos. O jogo precisa da câmera e **não grava imagens**.

Tudo no navegador: [MindAR](https://github.com/hiukim/mind-ar-js) (imagens),
[Three.js](https://threejs.org/) r160 (3D), [three-vrm](https://github.com/pixiv/three-vrm)
2.1 (Aia e Seu Zé) e [MediaPipe](https://ai.google.dev/edge/mediapipe) (mãos).
Visual: **Telas do Signária** do design system InclusiVR.

> **Regra (10/11/2026, vale para todos os produtos):** o app nunca mostra o nome
> de ninguém da equipe. Aparece a **função** ("o intérprete de LIBRAS"), que é o
> que importa para quem usa. Os nomes ficam só nos créditos deste README. Se um
> dia for preciso citar um nome, ele vem sempre junto com o título ou a função.

| Início | Instruções | Elefante na página | LIBRAS: soletrar |
|---|---|---|---|
| ![Início](docs/screenshots/inicio.jpg) | ![Instruções](docs/screenshots/livro-instrucoes.jpg) | ![Elefante](docs/screenshots/livro-elefante.jpg) | ![Soletrar](docs/screenshots/livro-libras-soletrar.jpg) |

| Quero voltar! | Aia e Seu Zé | Jogo de Cartas | Zoológico | Sinalize! |
|---|---|---|---|---|
| ![Quero voltar](docs/screenshots/livro-quero-voltar.jpg) | ![Aia e Seu Zé](docs/screenshots/livro-aia-seu-ze.jpg) | ![Cartas](docs/screenshots/cartas-acerto.jpg) | ![Zoológico](docs/screenshots/zoologico.jpg) | ![Sinalize](docs/screenshots/sinalize-acerto.jpg) |

O que mudou na atualização de novembro de 2026, a análise feita antes e o que
depende de material: **[docs/ATUALIZACAO-2026-11.md](docs/ATUALIZACAO-2026-11.md)**.

---

## 1. Como abrir

**Publicado:** a câmera só funciona em `https://`. Com o GitHub Pages ativado
(seção 11), a raiz redireciona para `inclusiapp/`.

**No computador, para desenvolver:**

```bash
npm install
npm start            # http://localhost:8080/inclusiapp/
```

## 2. Estrutura

```text
inclusiapp/
├── index.html                 telas (início, livro, jogos) + ícones de linha (SVG)
├── sw.js                      service worker (VERSION: aumente ao publicar mudanças grandes)
├── src/
│   ├── config.js              ★ animais, páginas do livro, personagens, pares das cartas, AR
│   ├── main.js · router.js    rotas: #/ #/livro #/livro/ar #/sala #/cartas #/cartas/jogar #/zoo #/zoo/ar #/sinalize #/sinalize/jogar
│   ├── ar/
│   │   ├── arSession.js       câmera + MindAR + Three.js (renderer único do app); busca focada e alvos ignorados
│   │   ├── targets.js         alvos .mind comprimidos, com verificação
│   │   ├── bookAR.js          o livro (um modo só): páginas → animais/personagens + LIBRAS
│   │   ├── pageActor.js       a vida na página: saltar, passear, carinho, esperar, "quero voltar", ir para casa
│   │   ├── pageWalker.js      o passeio dentro da página (sem DOM — testado)
│   │   ├── modelManager.js    animais .glb (meshopt) e as animações gravadas
│   │   └── videoChroma.js     vídeo do intérprete sem o fundo verde (trechos, com pausa no fim)
│   ├── characters/characterModel.js   Aia e Seu Zé (VRM): olá, feliz, andar, preocupado; molas na escala certa
│   ├── lib/download.js        downloads com progresso (barra "chegando...") e pré-carga
│   ├── libras/
│   │   ├── librasVideos.js    ★ tempos de cada letra e do sinal em cada vídeo
│   │   └── librasPanel.js     o módulo do intérprete (SINAL / SOLETRAR em karaokê)
│   ├── game/                  Jogo de Cartas (gameState.js = regras, random.js = semente)
│   ├── zoo/                   Zoológico em AR (zooConfig.js ★ cartas e interações, zooState.js = regras,
│   │                          zooAR.js = página 22 + cartas, letterModel.js = letras 3D)
│   ├── sign/                  Sinalize! (signConfig.js ★, signRecognizers.js, handSigns.js...)
│   ├── ui/                    menu, jogos, instruções, avisos, sons, faíscas
│   └── styles/                tokens.css (design system) · signaria.css (componentes) · app.css (telas)
├── assets/
│   ├── models/*.glb           os 5 animais (repositório inclusivr-animais)
│   ├── personagens/*.vrm      Maga Aia (inclusivr-aia) e Seu Zé (inclusivr-personagens)
│   ├── targets/               paginas.mind (9 páginas), cartas.mind (20 faces), zoologico.mind (página 22 + 20 faces)
│   ├── zoo/letras.json        contorno das vogais 3D (tools/gerar-letras.py)
│   ├── img/                   arte final do Igor e do design system, em WebP
│   └── fonts/                 Fraunces Soft (substituta livre da Cooper; OFL)
├── vendor/                    MindAR 1.2.5, Three.js r160 (+ meshopt, KTX2, SkeletonUtils), three-vrm 2.1.0, MediaPipe 1.0.1
└── cartas/ pag/ videos/ exemplo/ codes/      arquivos originais
tools/                         servidor, alvos (compile-targets, montar-zoologico), imagens, letras 3D, medição dos vídeos de LIBRAS
tests/                         testes de unidade, de reconhecimento e ponta a ponta
```

## 3. Configuração central — `inclusiapp/src/config.js`

- `ANIMALS`: cada animal com modelo, retrato (recorte da ilustração do Igor),
  as duas faces da sua carta (`picture` e `sign`), as animações e a letra.
- `BOOK_PAGES`: **as páginas que têm AR** — alvo no `paginas.mind`, número da
  página no livro, quem aparece e onde está desenhado (`home`, de onde ele
  salta). Cada página é uma lista de "camadas"; a leitura da história pela Maga
  Aia (plugin de LIBRAS) pode entrar depois como outra camada.
- `CARD_PAIRS`: os 10 pares do Jogo de Cartas (o que o jogo mostra → a face de
  LIBRAS que a criança precisa achar).
- `BOOK`, `LIBRAS` (chroma key), `GAME` (pontuação), `AR` (rastreamento).

| Página do livro | Alvo | Quem aparece |
|---|---|---|
| 15 | 0 (`pag/Pagina1.png`) | Abelha |
| 17 | 1 | Elefante (o da lagoa, com o reflexo turquesa) |
| 19 | 2 | Iguana |
| 21 | 3 | Onça |
| 23 | 4 | Urso |
| 10, 13, 24, 25 | 5 a 8 (`pag/Pagina6.jpg` a `Pagina9.jpg`) | Seu Zé e Maga Aia |

A **runa** (a página da esquerda, com textura) não tem AR: o reconhecimento é
pelo desenho do animal, na página ao lado. As cartas recortadas têm AR só nos jogos.

## 4. Os animais, a Aia e o Seu Zé

- **Animais** (`inclusivr-animais`, aprovados em 29/10/2026): `.glb` leves
  (malha e animações com meshopt, textura WebP), material sem luz com a pintura
  do Igor. Animações gravadas: `parado`, `andar` (a abelha: `voar`), `feliz` e a
  especial — `agua` (elefante), `crista` (iguana), `brincar` (onça), `mel`
  (urso). O app não troca o material; toca os clipes com `AnimationMixer`.
- **No livro** (`pageActor.js`): salta do desenho (`feliz`), passeia sem sair
  da página e espia a beirada; toque = carinho (`feliz`), a cada 3 toques a
  especial. Sem a página: fica parado onde estava, pisca, fica transparente e se
  preocupa (`BOOK.lostGraceMs`). Se o arquivo ganhar um clipe `preocupado`, ele é
  usado sozinho; até lá, o efeito é feito por código.
- **Aia e Seu Zé** (VRM 1.0, três-vrm): as animações são feitas nos ossos do
  esqueleto (`characterModel.js`): olá, feliz, andar, preocupado, piscar. A Aia
  leve usa texturas KTX2 (Basis), lidas pelo `KTX2Loader` (só baixado quando ela aparece).

Para trocar um modelo: copie o novo `.glb` para `assets/models/` com o mesmo
nome (o contrato está no `docs/ENTREGA.md` do `inclusivr-animais`) e confira em
`tools/model-viewer.html`.

## 5. LIBRAS com o intérprete

Cada vídeo (`videos/<animal>.mp4`) tem a **soletração** e depois o **sinal**
(gravado 2 a 4 vezes). `src/libras/librasVideos.js` guarda onde começa e
termina cada letra e o sinal. Os tempos foram medidos com
`node tools/medir-libras.mjs` (o reconhecimento de mãos acha as pausas da mão)
e conferidos quadro a quadro. **Falta o intérprete conferir** (`conferido: false`).

- O módulo só aparece pelo botão **LIBRAS**, nas páginas com animal.
- **SINAL DO ANIMAL** toca só o trecho do sinal; **DE NOVO** repete.
- **SOLETRAR O NOME** toca a soletração e destaca a letra da vez (âmbar); as
  anteriores ficam ciano e as próximas, de pedra.
- O chroma key do fundo verde-limão está em `LIBRAS.chroma` (seção 7 do histórico).
- Nada fica por cima do vídeo (nem sombra, nem fundo): as mãos aparecem
  inteiras, acima do painel.
- As **vogais sozinhas** (Sinalize!) começam com a mão chegando e terminam
  ainda na vogal, antes da letra seguinte (o U de URSO não mostra o R), e o
  vídeo para um pouco na vogal (`VOWEL_CLIPS`, medido quadro a quadro).

## 6. Alvos do MindAR (páginas e cartas)

```bash
npm run targets          # compila páginas e cartas (lê as pastas pag/ e cartas/)
npm run targets -- paginas
```

Reconhecimento medido com o detector real do MindAR em fotos sintéticas
(`python3 tests/make_frames.py` e `node tests/e2e/recognition.mjs`):

| Conjunto | Resultado |
|---|---|
| 9 páginas × 4 situações (de frente, inclinada, longe, escura) | **100% (36/36)**, 0 confusões |
| 4 páginas da Aia e do Seu Zé com uma cartela de texto simulada por cima | **100% (8/8)** |
| 20 faces das cartas | 98,8% (medição anterior) |

As páginas 8, 11, 22 e 23 (números do livro impresso) foram feitas das
**ilustrações do Igor sem as cartelas de texto**. Conferir com o livro
impresso; o ideal é exportar as páginas da diagramação final (troque
`pag/Pagina6.jpg`... e rode `npm run targets`). Os nomes dos arquivos de
referência (`livro_p15`...) contam 2 páginas a mais que o livro impresso.

O **zoológico** usa `zoologico.mind`: a página 22 (alvo 0) e as 20 faces das
cartas (carta N = alvo N), copiadas byte a byte dos outros dois arquivos
(`pip install msgpack` e `python3 tools/montar-zoologico.py`, sempre que
`paginas.mind` ou `cartas.mind` mudarem).

**Rastreamento no livro**: ao perder a página, o animal espera parado
1,2 s antes de piscar (`BOOK.holdGraceMs`), e por 2 s o MindAR procura só
aquela página (`BOOK.refocusMs`), o que reencontra mais rápido quem abaixa o
celular para ver o animal de lado.

## 7. Jogo de Cartas

As cartas físicas têm duas faces: o desenho (animal ou letra) e o sinal em
LIBRAS. O jogo mostra uma face e pede a **outra face da mesma carta** — a
criança precisa relacionar o animal ao seu sinal, não achar a mesma imagem.

- Dica na tela: deixar todas as cartas com o **lado do sinal para cima**.
- Mostrou o desenho do mesmo par? "VIRE A CARTA!". Outra carta? "QUASE!" (sem perder pontos).
- Acerto: 100 pontos + até 50 de rapidez; "ISSO!" e o próximo desafio na hora.
- Embaralha **uma vez** no começo (semente nova a cada partida; a ordem fica
  fixa e continua igual se o jogo for retomado). 10 desafios; resumo com 1 a 3 estrelas.

## 8. Zoológico (em AR)

Um jogo de realidade aumentada com o livro e as cartas (pedido de 10/11/2026).

- Abra o livro na **página 22** (o zoológico cheio) e aponte o celular: a
  página vira o chão do zoológico.
- Coloque uma **carta** em cima da página: o animal (as duas faces da carta
  valem) **salta da carta** e fica no zoológico. A carta do **sinal de uma
  vogal** (ou a da letra) traz a **letra do português em 3D**, animada (pula,
  gira), para a criança ver o par entre o sinal e a letra. Um de cada; até 12.
- O MindAR acompanha a página e **uma** carta por vez. A carta que já trouxe
  alguém deixa de ser procurada (`ARSession.ignoreTarget`), então dá para
  deixar a carta na página e colocar a próxima.
- **Carinho**: toque. **Aia e Seu Zé**: botões (ainda não têm carta).
  **Casinha** (no lugar da lixeira): leva alguém para descansar; a carta volta a valer.
- **Necessidades** em balões com ícones, sem barras: o urso sente **fome de
  mel**; os outros **querem brincar**; depois aparecem **feliz** e **satisfeito**.
- **Interações** (`src/zoo/zooConfig.js`, só o que a história mostra; páginas do
  livro impresso): urso + abelha → a abelha voa até ele e o urso come mel (pág. 21);
  o elefante joga água em quem chega (pág. 15); a onça brinca (pág. 19); outros
  encontros = os dois ficam felizes (pág. 22); de tempos em tempos um animal vai
  visitar a sua letra ou um amigo; **o animal perto da letra da sua inicial** →
  a letra acende em turquesa e ele faz a animação especial.
- As letras ficam sempre viradas para quem segura o celular e reclinam como
  uma placa quando vistas de cima (dá para LER).

## 9. Sinalize!

```text
a vogal na tela (a letra + a carta do sinal) → OLHE: o intérprete faz o sinal 2 vezes
→ 3, 2, 1 → SUA VEZ (câmera frontal) → reconhecido a tempo: ISSO! + pontos → próxima
→ não deu em 15 s: QUASE! → TENTAR DE NOVO (vê o sinal de novo, com mais 15 s) ou PRÓXIMO
```

- **Só as 5 vogais** (configurações de mão paradas, que a câmera reconhece bem).
  Os sinais dos animais têm movimento e saíram do jogo (10/11/2026); as regras
  provisórias deles estão no histórico do git (commit `9ceda81`), para o Signária IA.
- Cada tentativa tem os seus 15 s (antes, a 2ª tentativa começava com o tempo
  esgotado: "3, 2, 1… QUASE!"). O bônus de rapidez soma as tentativas.
- O jogo **precisa da câmera** (não há ACERTEI/ERREI, que davam para trapacear).
  Sem câmera, explica o que fazer e diz que **não gravamos imagens**.
- A tela ocupa a altura do aparelho: vídeo e câmera dividem o espaço e os
  botões ficam sempre à vista, sem rolar.
- Câmera **frontal** por padrão, espelhada; botão para trocar. Sem esqueleto da
  mão na tela e sem termos técnicos.
- **Vogais**: classificador da configuração de mão (`handSigns.js`) + juiz de
  vários quadros (`signJudge.js`), conferidos com a mão 3D e com os vídeos do intérprete.

## 10. Visual e acessibilidade

- **Telas do Signária** (design system InclusiVR): plaquinhas de pergaminho com
  cantos recortados e contorno tinta, botão principal âmbar embaixo, ciano para
  acerto e progresso, rosa para dica e "quase", Fraunces Soft, fundo com a
  floresta esmaecida do Igor. **Sem emoji**: ícones de linha no `index.html`.
- **Para quem ainda não lê**: cada instrução tem ícone e imagem; os jogos
  começam com uma demonstração em passos visuais; os retratos dos animais e as
  runas são a arte do Igor. Os textos continuam lá para quem lê e para os adultos.
- Leitores de tela (anúncios), foco visível, alvos de toque grandes, "reduzir
  movimento" respeitado, retorno visual de todo som.
- **Abertura**: a cena do livro com todos no zoológico (o Seu Zé, a Maga Aia e
  os cinco animais), numa janela em arco, com o logo por cima.
- **Instruções do livro**: um esquema desenhado por código (não é ilustração):
  a pessoa com o celular a ± 30 cm do livro aberto na mesa, andando em volta.
- **Sons**: provisórios, gerados na hora (kalimba, madeira e um brilho), no
  lugar dos bipes genéricos da primeira versão. Quando o sound design (Luigi)
  entregar os arquivos, é só pôr em `assets/sons/` e listar em `ARQUIVOS`
  (`src/ui/sound.js`).

## 11. Publicar no GitHub Pages

**Settings → Pages → Deploy from a branch** → a branch e a pasta **/ (root)**.
Ao publicar mudanças grandes, aumente `VERSION` em `inclusiapp/sw.js`.

## 12. Testes

```bash
npm test                         # 92 testes de unidade
python3 tests/e2e/make_zoo_frames.py   # fotos sintéticas do zoológico (página 22 + cartas)
python3 tests/make_frames.py     # (opcional) fotos sintéticas das páginas e cartas
node tests/e2e/recognition.mjs   # reconhecimento real das páginas e cartas
npm run test:e2e                 # ponta a ponta no Chromium (telas, livro, personagens, cartas, zoo, sinalize, erros, paisagem)
npm run test:e2e -- livro        # só uma parte
```

Os testes ponta a ponta usam uma **câmera falsa** (`tests/e2e/fakeCamera.js`):
o caminho real (câmera → MindAR/MediaPipe → 3D → LIBRAS) roda no navegador.
Verificam, entre outros: nenhum nome da equipe no app; o intérprete não aparece
sozinho; o karaokê destaca a letra certa; o animal passeia dentro da página,
espera numa falha curta e pede para voltar sem ela; a Aia e o Seu Zé na página
11, com as molas no espaço deles e os olhos que não somem; a face do desenho
não vale no Jogo de Cartas; o zoológico em AR (a carta traz o animal no lugar
dela, a carta do sinal traz a letra, a casinha); o Sinalize só com vogais,
sem rolar em 360×640 e sem câmera = aviso; câmera desligada ao sair; mensagens
de câmera negada/ocupada/inexistente; sem rolagem lateral em paisagem, tablet
e computador. Os testes de unidade conferem o reconhecedor com as medidas reais
dos vídeos do intérprete (`tests/fixtures/libras/medidas.json.gz`).

`CHROMIUM_PATH=/caminho/do/chrome` usa um Chromium já instalado.

O servidor de teste (`tools/serve.mjs`) comprime os arquivos como o GitHub
Pages (gzip, com o `Content-Length` comprimido), para os testes verem o mesmo
que o celular (`SEM_GZIP=1` desliga).

## 13. Compatibilidade e desempenho

- Android (Chrome) e iPhone/iPad (Safari, iOS 15+); computador com webcam.
- Sem CDN: bibliotecas, fontes e modelos ficam no próprio site.
- Tudo sob demanda: animais (95–427 KB cada) e, em seguida, Aia e Seu Zé
  (≈ 4 MB cada) baixam em segundo plano quando o livro abre (sem "economia de
  dados"), com barra de progresso se a página aparecer antes; o reconhecimento
  de mãos (≈ 19 MB) só no Sinalize. O service worker guarda tudo.
- Um único contexto WebGL para o livro, os jogos e o vídeo do intérprete.

## 14. Problemas comuns

| Sintoma | Solução |
|---|---|
| "Precisamos acessar sua câmera" | permita a câmera: Android — cadeado → Permissões; iPhone — **aA** → Ajustes do Site |
| Página não reconhecida | é uma das páginas com AR? (veja a tela de instruções) ~30 cm, página inteira, boa luz |
| Apontei para a runa e nada | a runa sozinha não tem AR: aponte para o desenho do animal ao lado |
| Sinal não reconhecido no Sinalize | lugar iluminado, a mão inteira na tela; use **VER DE NOVO** ou **PULAR** |
| Zoológico: a carta não traz ninguém | a página 22 precisa estar na câmera; a carta inteira em cima da página, com luz |
| Letra do karaokê fora do tempo | ajuste os números em `src/libras/librasVideos.js` |

## 15. Créditos e licenças

- Ilustrações, cartas, vídeos, animais 3D, Maga Aia e Seu Zé: InclusiVR —
  ilustrador: Igor Bucioli; intérprete de LIBRAS: Fauston Zandoná; diagramação do livro: Nina Nunes.
- [MindAR](https://github.com/hiukim/mind-ar-js) 1.2.5 — MIT · [Three.js](https://threejs.org/) r160 — MIT ·
  [three-vrm](https://github.com/pixiv/three-vrm) 2.1.0 — MIT · Basis Universal (transcodificador) — Apache-2.0 ·
  [MediaPipe Tasks Vision](https://github.com/google-ai-edge/mediapipe) 1.0.1 — Apache-2.0.
- Fonte [Fraunces](https://github.com/undercasetype/Fraunces) (Fraunces Soft) — SIL Open Font License.
- Só nos testes: mão 3D "generic-hand" do WebXR Input Profiles — MIT.
