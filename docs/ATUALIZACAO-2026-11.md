# Atualização de novembro de 2026: análise, plano e o que foi feito

Pedido da equipe (06/11/2026): nove pontos de melhoria no app de AR do livro
*SinalizaAção: Animais em Voga*, para crianças de 3 a 8 anos, muitas ainda
sem saber ler. Este documento registra a análise feita antes de mexer no
código, a ordem dos módulos e o que depende de material que ainda não existe.
A seção final diz o que foi entregue e o que fica para depois.

## 1. Como o app estava (antes desta atualização)

| Parte | Arquivos | Situação |
|---|---|---|
| Sessão de AR (câmera + MindAR + Three.js) | `src/ar/arSession.js`, `targets.js` | Boa. Reaproveitada sem mudar o contrato |
| Livro em AR | `src/ar/bookAR.js`, `modelManager.js`, `animalMaterial.js`, `gestures.js`, `videoChroma.js` | Dois modos (Página e Interação); modelos antigos sem textura, pintados por código; vídeo do Fauston ligado sempre |
| Jogo de Cartas | `src/game/*` | Pedia a mesma carta mostrada na tela; "roleta" de 2 s a cada rodada |
| Bichinho Virtual | `src/pet/*` (≈ 110 KB) | 6 necessidades, mochila, doenças, cartas mágicas, Livro de Magias: complexo para 3–8 anos |
| Sinalize e Conte | `src/sign/*` | Escanear carta → sinal da vogal → contar animais; esqueleto da mão na tela; cita o MediaPipe |
| Visual | `src/styles/*.css`, `index.html` | Verde-escuro com Baloo/Nunito e emojis; anterior ao design system do Signária |

## 2. Material encontrado (outros repositórios da conta)

| Material | Onde | Estado |
|---|---|---|
| 5 animais novos, do traço do Igor, animados (`parado`, `andar`/`voar`, `feliz`, especial) | `inclusivr-animais/<Animal>/02_entrega/<animal>.glb` | Aprovados pelo Luciano em 29/10/2026; versão leve (meshopt + WebP), 95–427 KB |
| Elefante da lagoa (reflexo turquesa) | `inclusivr-animais/Elefante/02_entrega/elefante_lagoa.glb` | Para a página da lagoa (pág. 17) |
| Maga Aia leve para navegador | `inclusivr-aia/MagaAia/01_source/web/MagaAia_web.vrm` | 4,35 MB, VRM 1.0 |
| Seu Zé leve para navegador | `inclusivr-personagens/SeuZe/02_entrega/SeuZe_web.vrm` | 3,95 MB, VRM 1.0, aprovado em 29/10/2026 |
| Ilustrações do Igor (cenas, runas, peças, fundos) | Design System "InclusiVR" (artefato) e `00_referencias/igor/` dos repositórios | Finais (livro) |
| Ilustrações das páginas 10, 13, 24 e 25 (Aia e Seu Zé, sem animal em AR) | `inclusivr-personagens/SeuZe/00_referencias/igor/` | 1600 px, sem as cartelas de texto da página impressa |

## 3. Módulos, ordem e dependências

```text
M1 base visual ─┬─ M4 instruções ─────────────┐
                ├─ M7 jogo de cartas          │
M2 animais ─────┼─ M3 livro unificado ── M5 LIBRAS do Fauston
                ├─ M8 zoológico               │
                └─ M6 Aia e Seu Zé ───────────┘
M5 (tempos dos vídeos) ── M9 Sinalize
deck com semente (M7) ─── M9 Sinalize
```

| Módulo | O que muda | Depende de |
|---|---|---|
| M1 Base visual | Tokens do design system (tema `signaria-app`), Fraunces Soft, plaquinhas, `BotaoPlaca` âmbar, ciano para acerto, sem emoji; ícones dos animais recortados das ilustrações do Igor | — |
| M2 Animais | Leitor com decodificador meshopt; controlador de animações (mantém o material e as animações do arquivo) | — |
| M3 Livro unificado | Um modo só: o animal salta da página, fica feliz, anda dentro da página; toque = carinho; sem a página: pisca, some aos poucos e pede para voltar | M2 |
| M4 Instruções de AR | Imagem limpa (sem etiquetas); quais páginas têm AR; a runa sozinha não tem AR; as cartas só nos jogos | M1 |
| M5 LIBRAS do Fauston | Só aparece pelo botão; "Sinal do animal" e "Soletrar" (letras destacadas em sincronia, como karaokê) | M3; tempos medidos nos vídeos |
| M6 Aia e Seu Zé | Leitor de VRM; olá, feliz, andar, reação ao toque; páginas 10, 13, 24 e 25 | M2, M3; alvos das páginas |
| M7 Jogo de cartas | Mostra o animal ou a letra; a criança acha a face em LIBRAS do par; embaralha uma vez por partida, com semente | M1 |
| M8 Zoológico | Substitui o Bichinho Virtual: caixa de areia com animais e runas das vogais; interações do livro | M1, M2 |
| M9 Sinalize | Vídeo do Fauston (sinal 2 vezes) → a criança repete → câmera confere; câmera frontal; sem esqueleto; sem contagem | M5, deck com semente |

O que fica como estava: `arSession.js` (só ganhou a opção de câmera frontal),
`targets.js`, `videoChroma.js`, o classificador das vogais (`handSigns.js`,
`signJudge.js`), o carregador do MediaPipe, o roteador, os avisos e o
armazenamento local.

## 4. Limitações e dependências identificadas antes de implementar

1. **Animação de despedida/preocupação.** Os animais novos não têm um clipe
   de "triste" ou "tchau". O app faz o efeito por código (pisca, fica
   transparente, encolhe e balança) e usa um clipe `preocupado` automaticamente
   quando ele existir no `.glb`. Pedido para o repositório dos animais: um
   clipe curto `preocupado` (uma vez) para cada animal.
2. **Tempos da soletração.** Os vídeos são contínuos. Os tempos de cada letra
   foram medidos com o reconhecimento de mãos (`tools/medir-libras.mjs`) e
   conferidos quadro a quadro, com erro de cerca de 0,1 s. **O Fauston precisa
   conferir** (`src/libras/librasVideos.js`, campo `conferido`).
3. **Reconhecimento dos sinais dos animais pela câmera.** O reconhecimento
   atual lê a configuração de mão parada (as 5 vogais) e foi testado. Sinais
   com movimento e com o corpo (ABELHA, ELEFANTE, IGUANA, ONÇA, URSO) pedem
   um modelo treinado com várias pessoas (é o trabalho do Signária IA). Ver a
   seção 5 para o que foi feito.
4. **Páginas da Aia e do Seu Zé.** Os alvos foram feitos das ilustrações do
   Igor (sem as cartelas de texto). O ideal é exportar as páginas da
   diagramação final da Nina; até lá, é preciso testar com o livro impresso.
5. **Letras no zoológico.** Só as vogais têm arte final (as runas do Igor).
   As consoantes do design system são provisórias (mãos 3D). O zoológico usa
   as 5 runas das vogais.
6. **Nome do jogo 3.** Sem a contagem, "Sinalize e Conte" deixa de fazer
   sentido. Nome usado: **Sinalize!** (a equipe pode trocar em
   `index.html`).

## 5. O que foi feito (06/11/2026)

| Ponto do pedido | Situação | Onde |
|---|---|---|
| 1. Identidade visual e assets | Feito: Telas do Signária (pergaminho, contorno tinta, âmbar, ciano, rosa, Fraunces Soft), sem emoji; retratos dos animais recortados das ilustrações do Igor; runas e fundos do design system; os 5 animais novos; imagem das instruções refeita só com arte final, sem etiquetas (o texto ficou o mesmo) | `src/styles/`, `index.html`, `assets/img/`, `assets/models/` |
| 2. Instruções de AR | Feito: as páginas com AR aparecem com miniatura e número; imagem da página dupla mostra que a runa sozinha não tem AR; cartas só nos jogos; "em breve, mais páginas" | tela LIVRO |
| 3. Livro sem modos | Feito: salta, fica feliz, passeia dentro da página, toque = carinho; sem a página pisca, fica transparente, se preocupa e diz "QUERO VOLTAR PARA MINHA PÁGINA!" | `ar/bookAR.js`, `ar/pageActor.js` |
| 4. LIBRAS do Fauston | Feito: só pelo botão; SINAL DO ANIMAL e SOLETRAR O NOME (karaokê) | `libras/` |
| 5. Aia e Seu Zé | Feito nas páginas 10, 13, 24 e 25 (olá, feliz, andar, toque, preocupado) | `characters/`, `config.js` |
| 6. Jogo de cartas | Feito: o par em LIBRAS, sem penalidade, uma semente por partida, sem roleta por rodada | `game/` |
| 7. Zoológico | Feito: caixa de areia com os animais e as runas, interações da história, balões visuais | `zoo/` |
| 8. Sinalize! | Feito: sorteio com semente, o Fauston 2 vezes, câmera frontal, sem esqueleto, sem contagem, sem escanear carta | `sign/` |
| 9. Acessibilidade visual | Feito em todas as telas: ícones, demonstrações em passos, frases curtas, textos mantidos | todas |

**Medido:**
- 86 testes de unidade e 66 verificações ponta a ponta passando.
- Reconhecimento das 9 páginas: 100% (36 de 36 fotos), sem confusão; as
  páginas da Aia e do Seu Zé também com uma cartela de texto simulada por cima.
- Sinais dos animais (regras simplificadas), nos vídeos do Fauston: cada um
  aceito no próprio vídeo (em 0,9 a 2,2 s) e recusado nos outros quatro e nas
  cinco soletrações.
- O classificador das vogais agora reconhece também o E e o O do Fauston, sem
  perder o que já reconhecia (mão 3D, 72 leituras reais, mãos que não são vogais).

**Removido** (fica no histórico do git): o Bichinho Virtual (`src/pet/`), a
contagem de animais do Sinalize, os modelos antigos e o conversor de Unity
(`modelo3d/`, `tools/convert_models.py`), os estilos antigos.

## 6. Pendências para a equipe

| Quem | O quê |
|---|---|
| Fauston | Conferir os tempos das letras e do sinal (`src/libras/librasVideos.js`); conferir o trecho "sinal duas vezes" da iguana e da onça |
| Equipe (com crianças) | Testar o Sinalize com crianças, sobretudo os sinais dos animais (regras simplificadas, provisórias). Ajustes em `src/sign/signRecognizers.js` |
| Equipe (livro impresso) | Testar as páginas 10, 13, 24 e 25 com o livro na mão. Se falhar, exportar essas páginas da diagramação final (Nina) e rodar `npm run targets` |
| Repositório dos animais | Pedido: um clipe curto `preocupado` (uma vez) para cada animal; o app usa sozinho quando existir |
| Igor / equipe | Arte final das consoantes, se o zoológico ganhar o alfabeto inteiro (hoje: as 5 runas das vogais) |
| Equipe | Confirmar o nome **Sinalize!** (antes "Sinalize e Conte") |
| Futuro | Leitura da história pela Maga Aia (plugin de LIBRAS): entra como mais uma "camada" de `BOOK_PAGES`, sem mudar o resto |

## 7. Correções de 10/11/2026 (documento "correções do AR")

A equipe testou no celular e mandou 20 pedidos. Todos foram atendidos; o que
depende do aparelho ou de outra pessoa está marcado.

| Pedido | O que foi feito | Onde |
|---|---|---|
| Imagem das instruções: um esquema real, com a distância | Esquema desenhado por código: a pessoa segura o celular a ± 30 cm do livro **aberto na mesa**, o elefante sai da página, e uma seta mostra que dá para andar em volta. Novo passo no texto: "deixe o livro aberto em cima de uma mesa" | `index.html` (SVG), `app.css` (`.esquema`) |
| Nunca citar nomes da equipe no app | "Fauston" virou "intérprete de LIBRAS" em todos os textos, avisos e descrições (e nos comentários do código publicado). Teste automático confere que nenhum nome aparece | todo o app; regra no README |
| Números das páginas 2 a mais | Animais: 13, 15, 17, 19, 21. Aia e Seu Zé: 8, 11, 22, 23 (os arquivos de referência contam 2 a mais) | `config.js` |
| Aia e Seu Zé demoravam até 15 s, sem barra | Pré-carga em segundo plano assim que o livro abre (animais primeiro); os dois baixam ao mesmo tempo; barra "SEU ZÉ E MAGA AIA ESTÃO CHEGANDO..." com a porcentagem | `lib/download.js`, `bookAR.js` |
| Vestido da Aia quebrado, Seu Zé sem pupilas | A física (molas do VRM) rodava na escala do AR (≈1000×): agora roda no espaço da personagem, com as colisões na escala certa. Os olhos (e as sobrancelhas) sumiam depois de a página sair e voltar: o "sumir aos poucos" agora devolve cada material ao estado original. (O olho do Seu Zé é o oval verde do livro, sem pupila: decisão de 28/10 na ficha dele) | `characters/characterModel.js` |
| Tracking pior ao inclinar; a abelha "flickava" | Falha curta não pisca mais (o animal espera 1,2 s parado antes de se preocupar); por 2 s depois de perder a página, o MindAR procura só ela (com 9 páginas, cada tentativa ficava quase 2× mais lenta); a abelha voa mais baixo | `pageActor.js`, `arSession.js`, `config.js` |
| Vídeo do intérprete escuro, com fundo, cobrindo a mão | O "palco" tinha uma sombra escura **por cima** do vídeo: saiu. O vídeo ficou maior e termina acima do painel | `app.css` (`.libras__palco`) |
| Trocar os efeitos sonoros | Sons provisórios novos (kalimba, madeira, brilho), no lugar dos bipes genéricos. O app já aceita os arquivos do sound design | `ui/sound.js` |
| Iguana e abelha pequenas; todos maiores | Abelha 0,16 → 0,27; iguana 0,26 → 0,40; elefante, onça e urso ≈ 0,35 da largura da página | `config.js` |
| "Não tem o livro?" em uma linha | Texto sem quebra, tamanho que se ajusta à tela | `app.css` |
| Abertura mais bonita, com o Seu Zé e os animais (desenho, não 3D) | A cena do livro com todos no zoológico numa janela em arco, o logo por cima, brilhos turquesa; cabe sem rolar em 360×640 | `index.html`, `app.css`, `assets/img/abertura-zoologico.webp` |
| Carta do elefante esticada nas regras | Proporção certa da carta | `app.css` |
| Zoológico tem que ser AR, com o livro e as cartas | Refeito: página 22 + cartas em cima → o animal salta da carta; carta do sinal da vogal → a **letra** do português em 3D, animada; todos juntos, com as interações da história; Aia e Seu Zé por botões | `zoo/zooAR.js`, `zoo/letterModel.js`, `zoo/zooState.js`, `zoologico.mind` |
| Não falar em "lixeira" | A **casinha**: o animal dá tchau e vai descansar | `zoo/zooAR.js` |
| Resumo do Sinalize pouco descritivo ("A carta") | VEJA A VOGAL · OLHE O INTÉRPRETE · FAÇA NA CÂMERA · GANHE PONTOS, e o texto de baixo explica que é uma vogal | `index.html` |
| Sem ACERTEI/ERREI; sem câmera, o jogo não funciona | Botões retirados; sem câmera, aviso "ESTE JOGO PRECISA DA CÂMERA" com o que fazer. "Não gravamos suas imagens em nenhum momento" na tela de regras e no aviso | `sign/signGame.js`, `index.html` |
| Tela do Sinalize deve caber no aparelho | O jogo ocupa a altura da tela: vídeo e câmera dividem o espaço, botões sempre à vista (testado em 360×640) | `app.css` |
| Urso e abelha: "3, 2, 1… QUASE!" sem dar tempo | Era o cronômetro: a 2ª tentativa começava com o tempo esgotado. Agora cada tentativa tem os seus 15 s | `sign/signState.js` |
| Letras mal cortadas (o U com o R junto) | Cada vogal começa com a mão chegando e termina ainda na vogal (medido quadro a quadro); o vídeo para um pouco na vogal | `libras/librasVideos.js`, `ar/videoChroma.js` |
| Tirar os sinais dos animais do Sinalize | Só as 5 vogais | `sign/signConfig.js`, `sign/signRecognizers.js` |

**Medido nesta rodada:** 88 testes de unidade; testes ponta a ponta com a
câmera falsa (livro, personagens, cartas, zoológico em AR, Sinalize em 360×640,
erros, paisagem); os seis sons novos gravados "offline" e medidos (nenhum mudo,
nenhum estoura).

**O que só o aparelho de verdade confirma (pedido de teste à equipe):**
1. O tracking ao abaixar o celular e a abelha sem tremer (no computador não dá
   para medir a câmera de um celular).
2. O zoológico com o livro e as cartas de verdade: tamanho das cartas, luz,
   quantas cartas o celular aguenta em cima da página.
3. O vestido da Aia se mexendo com a física e o tempo de carregamento numa
   internet de celular.

**Pendências para outras pessoas:**

| Quem | O quê |
|---|---|
| Sound design (Luigi) | Os sons finais: acerto, quase, tique, aparece, pular, festa. Basta pôr os arquivos em `assets/sons/` e listar em `src/ui/sound.js` (`ARQUIVOS`) |
| Intérprete de LIBRAS | Conferir os tempos das vogais e das letras (`src/libras/librasVideos.js`). Se houver vídeos só das vogais, eles podem entrar no lugar dos trechos |
| Equipe | Cartas para a Maga Aia e o Seu Zé (hoje eles vêm por botão no zoológico) |

### 7.1 Versão 2.1.1 — o erro que só aparecia no site (10/11/2026)

No teste em dois celulares, a página era reconhecida (o botão LIBRAS
aparecia), mas o animal não vinha: "Não foi possível carregar esta página
agora". Não era o rastreamento. O baixador novo da 2.1.0 (o da barra de
progresso, `src/lib/download.js`) reservava o tamanho que o servidor
informava. O GitHub Pages entrega os modelos **comprimidos** (gzip): a abelha
é informada com 65.786 bytes e chega com 97.020. O baixador desistia, em todos
os celulares, com todos os animais e personagens. Os testes não pegaram porque
o servidor de teste não comprimia.

- Correção: o baixador junta os pedaços sem limite; o tamanho informado só
  estima a barra (que para em 97% até o fim de verdade).
- Para não voltar: o servidor de teste (`tools/serve.mjs`) agora comprime como
  o GitHub Pages (.glb, .vrm, .mind, .json, .wasm, código), e há 4 testes de
  unidade com a resposta do jeito que o GitHub manda (`tests/unit/download.test.mjs`).
- Medido: o teste do livro, com o código antigo e o servidor comprimindo, falha
  igual ao celular; com a correção, 92 testes de unidade e 83 verificações
  ponta a ponta passam.

## 8. Versão 2.2 — "Web App AR simplificado" (10/11/2026)

A equipe testou a 2.1.1 em dois celulares (vídeos de demonstração no Drive) e
pediu um app mais simples e mais liso. As respostas às perguntas:
- zoológico: tentar sem a página 22;
- página perdida: o animal vai para o centro;
- imagens: da versão do site com o plugin;
- música: o arquivo "oogway morto", no PC do Luciano.

| Pedido | O que foi feito | Onde |
|---|---|---|
| Arquivar a Aia e o Seu Zé (e as menções a eles) | Saíram os modelos, o código, as bibliotecas, as 4 páginas, os retratos, os botões do zoológico e todos os textos. O reconhecimento voltou a ser **o arquivo de 5 páginas da primeira versão** (o mesmo do JLeo). Como trazer de volta: `docs/ARQUIVO.md` | `config.js`, `bookAR.js`, `zooAR.js`, `index.html` |
| Tracking liso, sem o animal "travando" | Antes o animal ficava preso à pose do rastreio, que muda só 10 a 20 vezes por segundo (a tela muda 60). Agora ele **segue** a página com amortecimento a cada quadro (`poseFollower.js`). Também saíram o "congela e pula" ao perder a página, a pré-carga de 8 MB com a câmera aberta e as 4 páginas a mais na procura. Virar para a câmera usa a pose já suavizada (o tremor não aumenta mais) | `ar/poseFollower.js`, `ar/bookAR.js`, `ar/pageActor.js` |
| A página é o validador: tirar a câmera da página e continuar brincando | Sem a página, o animal **desliza para o palco de brincar**, no meio da tela, e continua: passeia, recebe carinho, gira com um dedo e aproxima com dois (os gestos do "Modo Interação" da primeira versão). A mesma página voltou: ele desliza de volta. Outra página: ele se despede e o novo animal salta. Saíram o piscar, o "sumir aos poucos" e o "QUERO VOLTAR PARA MINHA PÁGINA!" | `ar/bookAR.js`, `ar/gestures.js`, `config.js` (`STAGE`, `BOOK`) |
| Imagem de distância genérica, com uma pessoa | A foto do livro aberto e o celular, **do site da InclusiVR**, com o elefante saltando da página para o celular (a animação do "salto" do site) e "± 30 cm". O elefante é **o do próprio app** (traço do Igor), não o elefante cinza do site: é o que a criança vai ver na câmera. Sem pessoa desenhada | `index.html`, `app.css` (`.salto`), `assets/img/instrucoes/`, `tools/render-instrucoes.mjs` |
| Tela inicial sem rolar | A tela inicial ocupa a altura exata do aparelho: a janela em arco usa o espaço que sobra, e a marca da InclusiVR fica sempre à vista. Conferido em 360×640, 375×667, 390×844, 412×915, 430×932, tablet e paisagem | `app.css` (`.menu`) |
| Zoológico: muitas cartas tampavam a página 22 | **Sem a página 22**: as cartas são os validadores, em qualquer posição (girada, de cabeça para baixo, de lado). O animal ou a letra salta do lugar da carta para o palco do zoológico. A carta usada sai da procura (as duas faces), e com os 10 no zoológico o reconhecimento para (o celular só desenha) | `zoo/zooAR.js`, `zoo/zooConfig.js` |
| Sinalize sem pontos e sem tempo; só certo e errado, com instrução clara | Saíram os pontos, os recordes, as estrelas, a contagem 3-2-1 e o tempo limite. Na vez da criança: "SUA VEZ! FAÇA O SINAL DO **A** PARA A CÂMERA". Outra vogal na câmera: "QUASE! OLHE DE NOVO O SINAL DO A NA CARTA", e ela continua tentando. Certo: "ISSO! VOCÊ FEZ O A!". Fim: "VOCÊ FEZ 4 DE 5 SINAIS", com cada vogal | `sign/signGame.js`, `sign/signState.js`, `sign/signConfig.js` |
| Música do Luigi | Pronta: em laço, baixinha, entra suave no primeiro toque, para em segundo plano, botão MÚSICA (separado dos efeitos). **Falta o arquivo** "oogway morto": pôr o MP3 em `assets/musica/` e o nome em `assets/musica/musica.json` | `ui/music.js`, `assets/musica/` |
| Tela cheia na página inicial | Botão **TELA CHEIA** (vira "SAIR DA TELA CHEIA"). Aparece só onde o navegador deixa (o Safari do iPhone não deixa). Instalado como aplicativo, ele já abre em tela cheia | `ui/fullscreen.js`, `manifest.webmanifest` |

**Medidor para o teste no celular:** abra o app com `?debug=1` no endereço (ex.:
`…/inclusiapp/?debug=1`). No canto aparece "desenho X/s · rastreio Y/s":
- "desenho" baixo (bem menos que 60): o aparelho está pesado;
- só "rastreio" baixo: o gargalo é o reconhecimento da página.

**Medido nesta rodada:**
- 96 testes de unidade (com os novos do movimento liso e do palco);
- testes ponta a ponta com a câmera falsa e o servidor comprimindo como o GitHub Pages.

O zoológico com os 10 (5 animais e 5 letras) tem 101 mil triângulos e 30 chamadas de desenho, com o reconhecimento parado.

**Pedido de teste no celular** (o computador não mede a câmera de um celular):
1. Livro com `?debug=1`:
   - o animal acompanha a página sem "travar";
   - tirar a câmera da página: ele vai para o meio da tela;
   - girar e aproximar com os dedos;
   - voltar para a página.
2. Zoológico:
   - mostrar as 10 cartas, uma de cada vez, em posições diferentes;
   - ver se continua fluido com todos. Se não ficar, o caminho para arquivar está em `docs/ARQUIVO.md`.
3. Tela inicial sem rolar, no aparelho de cada um, e o botão TELA CHEIA.
4. A música, quando o arquivo chegar.
