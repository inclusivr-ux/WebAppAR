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
