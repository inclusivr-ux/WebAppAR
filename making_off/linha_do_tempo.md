# Linha do tempo

## Capítulo 1. O teste no celular e as 20 correções (segunda, 10/11/2026)

**O que se queria.** Na semana anterior (06/11), o app ganhou a versão 2.0:
os animais novos saltando da página, a LIBRAS por botão, a Maga Aia e o Seu Zé
em 3D e três jogos. A equipe levou o livro impresso e o celular para a mesa e
testou de verdade. Voltou um documento, "correções do AR", com 9 páginas de
capturas de tela e 20 pedidos. O Claude recebeu o documento e a ordem de
aplicar tudo e fazer o commit.

**O vestido que se desmanchava.** "Aia está com vestido quebrado", dizia o
documento, e a equipe suspeitava que faltava a física do jogo de VR. O Claude
montou uma cena de teste e fotografou a Aia em duas escalas. Na escala normal,
o vestido ficava perfeito. Na escala do AR, com o tremor do rastreamento, as
partes da saia voavam (imagem `01_01`). A física estava lá: 51 molas, 172
juntas. O problema era a régua. No AR, o mundo é medido em pixels da página
(uma página tem perto de 1000 unidades), e as molas do VRM esperam metros. A
gravidade e a rigidez ficavam fracas demais, e cada tremor da câmera sacudia a
saia. A solução foi rodar a física no espaço da própria personagem (o "centro"
das molas) e aumentar os raios das colisões na mesma escala.

**Os olhos que sumiam.** O Seu Zé estava "sem as pupilas". Na foto de perto,
com o código antigo, depois de a página sair da câmera e voltar, os olhos e as
sobrancelhas desapareciam (imagem `01_02`, à direita). O "sumir aos poucos"
deixava tudo transparente e, ao voltar, não lembrava que a íris e o brilho dos
olhos já eram transparentes desde o começo. Agora cada material guarda o
próprio estado. (O olho do Seu Zé é mesmo um oval verde, sem pupila: foi
decidido em 28/10, para ficar como no livro.)

**O "3, 2, 1… QUASE!".** No Sinalize, o urso e a abelha davam QUASE sem dar
tempo de fazer o sinal. O Claude leu o cronômetro: ele somava as tentativas.
Na primeira, a criança tinha 15 segundos; na segunda, o tempo já começava
esgotado. Como os sinais dos animais (com movimento) eram os mais difíceis,
eram eles que chegavam à segunda tentativa. Cada tentativa ganhou o seu tempo.
E, a pedido da equipe, o Sinalize ficou só com as vogais, que a câmera
reconhece em cerca de 90% das vezes.

**O U que virava R.** O U do Sinalize vinha da soletração de URSO e terminava
no meio da passagem para o R. O Claude mediu quadro a quadro, de 0,1 em 0,1
segundo, onde a mão para em cada vogal e onde começa a sair. Um teste
automático achou mais um caso, o E de ELEFANTE, e o corte foi ajustado.

**O zoológico que virou AR.** "Jogo do zoológico não me expliquei direito."
Ele deveria ser com o livro e as cartas. Virou: a página 22 (o zoológico cheio)
é o chão, e cada carta colocada em cima da página traz o seu animal. A carta do
sinal de uma vogal traz a letra do português em 3D, para a criança ver o par
entre a mão e a letra (imagens `01_05` e `01_06`). Dois tropeços no caminho:
- o primeiro urso apareceu longe da carta, porque cada imagem do MindAR tem a
  sua própria escala; a posição passou a ser calculada pela tela;
- a letra aparecia de lado, porque o passeio redefinia a direção dela a cada
  quadro; ela ganhou uma direção só sua e reclina como uma placa.

A lixeira virou uma casinha: "é uma péssima ideia falar que vamos jogar nossos
amados animaizinhos na lixeira".

**O resto da lista.**
- O vídeo do intérprete tinha uma sombra escura **por cima** dele (imagem `01_03`).
- O tracking ficou mais tolerante: o animal espera parado numa falha curta, e o
  MindAR procura primeiro a última página.
- A Aia e o Seu Zé ganharam barra de progresso e pré-carga.
- Os animais ficaram maiores.
- A abertura ganhou a cena do livro com todos no zoológico (imagem `01_07`).
- As instruções ganharam um esquema com a pessoa, a mesa e a distância (imagem `01_08`).
- Os números das páginas foram corrigidos.
- "Fauston" virou "intérprete de LIBRAS" em todo o app, e virou regra: nenhum
  nome da equipe nos aplicativos.
- Os sons ganharam uma versão provisória com cara de Signária, à espera dos
  arquivos do Luigi.

**Números.** 88 testes de unidade e 83 verificações ponta a ponta passando. Os
seis sons foram medidos sem alto-falante (nenhum mudo, nenhum estoura). O
Sinalize cabe numa tela de 360×640 sem rolar. O que só o celular confirma
(tracking ao inclinar, as cartas reais na página) ficou como pedido de teste à
equipe.

## Capítulo 2. O erro que só aparecia no site (segunda, 10/11/2026)

**O que aconteceu.** Com a versão 2.1 no ar, a equipe testou em dois celulares
diferentes. A página do livro era reconhecida, o botão LIBRAS aparecia, mas a
abelha não vinha. No alto da tela: "Não foi possível carregar esta página
agora. Verifique a internet e aponte de novo." A equipe chamou de erro de
rastreio.

**Como se achou a causa.** O Claude perguntou ao próprio site como ele
entregava o arquivo da abelha. A resposta veio comprimida: 65.786 bytes
anunciados, 97.020 bytes de verdade depois de descomprimir. O baixador novo
(feito para mostrar a barra de progresso da Aia e do Seu Zé) reservava só o
tamanho anunciado e desistia quando o arquivo passava disso. Nos testes do
Claude nada aparecia porque o servidor de teste não comprimia.

**O que resolveu.** O baixador passou a juntar os pedaços sem limite, usando o
tamanho anunciado só para a barra. E o servidor de teste aprendeu a comprimir
como o GitHub: com o código antigo, o teste do livro passou a falhar do mesmo
jeito que o celular; com o novo, passa. Versão 2.1.1.

## Capítulo 3. O app simplificado (segunda, 10/11/2026)

**O que se queria.** Com a 2.1.1 no ar, a equipe testou de novo em dois
celulares e gravou vídeos. Mandou nove pedidos, todos na mesma direção: um
app mais simples e mais liso.
- Tirar a Maga Aia e o Seu Zé em 3D.
- Deixar o rastreio fluido como na primeira versão do JLeo.
- A página como validador.
- O zoológico sem a página 22.
- O Sinalize sem pontos e sem tempo.
- Fotos de verdade nas instruções.
- Tela inicial sem rolar e tela cheia.
- A música do Luigi.

Antes de mexer, o Claude fez quatro perguntas. As respostas:
- tentar o zoológico sem a página 22;
- sem a página, o animal vai para o centro;
- as imagens estão na versão do site com o plugin;
- a música é o arquivo "oogway morto", no PC do Luciano.

**A Aia e o Seu Zé arquivados.** "Modelos deles com poses e animações
genéricas." O Claude tirou do app:
- os modelos;
- as bibliotecas que só eles usavam (o leitor de VRM e o de texturas KTX2);
- as 4 páginas deles;
- cada menção nos textos.

Nada se perdeu. O `docs/ARQUIVO.md` explica como trazer tudo de volta a partir
do commit `a6eba3a`.

**Por que o rastreio tinha piorado.** "Na primeira versão feita pelo JLeo [...]
o tracking estava fenomenal." O Claude comparou com a versão do JLeo (commit
`19a1252`). Os dados de reconhecimento das 5 páginas dos animais eram
idênticos, byte a byte, e os ajustes do filtro também. O que tinha mudado:
1. A 2.0 juntou as 4 páginas da Aia e do Seu Zé. O app passou a procurar 9
   imagens em vez de 5, e cada tentativa ficou quase duas vezes mais lenta.
2. Ao perder a página, o animal congelava numa cópia parada, piscava, ficava
   transparente e depois pulava de volta.
3. O app baixava os 8 MB da Aia e do Seu Zé com a câmera aberta.
4. O animal ficava preso à pose do rastreio, que muda 10 a 20 vezes por
   segundo. A tela é desenhada 60 vezes: ele andava "aos saltinhos".

Os vídeos do Drive (47 e 94 MB) não abriram de primeira nas ferramentas do
Claude, e o diagnóstico veio da descrição da equipe e do código. Depois, pelo
link de download direto do Drive, o Claude baixou os dois e olhou quadro a
quadro. Eles confirmaram o diagnóstico:
- no livro, com o celular e a página parados, o elefante dava pulinhos de 2 a
  6 pixels e às vezes ficava parado uns 0,2 segundo antes de pular de novo;
- no zoológico, as cartas cobriam a página 22, e o app dizia "NÃO ENCONTREI A
  PÁGINA 22".

Os vídeos estão na pasta de testes do Drive:
`Screen_Recording_20261110_115316_Brave.mp4` e
`Screen_Recording_20261110_115555_Brave.mp4`.

**O que resolveu.**
- O arquivo de 5 páginas do JLeo voltou.
- O animal passou a morar num grupo que **segue** a página a cada quadro, com
  um amortecimento de 70 milésimos de segundo (`poseFollower.js`).
- Num teste, a página andava 20 unidades a cada atualização do rastreio. O
  maior passo do animal na tela ficou abaixo de 12.

**A página como validador.** "Como se a página fosse um validador, e depois
permitisse a brincadeira continuar mesmo que o tracking se perca."
- Sem a página, o animal desliza, em 0,65 segundo, para um "palco de brincar":
  uma página invisível no meio da tela. Lá ele continua passeando.
- Os gestos voltaram do "Modo Interação" da primeira versão: um dedo gira e
  dois aproximam.
- A mesma página voltou: ele desliza de volta para ela.
- Saíram o pisca-pisca e o "QUERO VOLTAR PARA MINHA PÁGINA!" (imagem `03_01`).

**O zoológico sem a página 22.** "Possivelmente remover a necessidade de
manter a página 22 em vista já resolveria esse problema." As cartas viraram
validadoras: a carta só mostra quem chega, e o animal vai para o palco.
- Nos testes, as cartas apareceram giradas, deitadas, de cabeça para baixo,
  inclinadas e duas juntas. Cada uma foi reconhecida em cerca de um segundo.
- Com os 10 juntos (5 animais e 5 letras), o reconhecimento para e o celular
  só desenha: 101 mil triângulos e 30 chamadas de desenho (imagem `03_04`).
- Se fica fluido num celular comum, só o teste da equipe vai dizer.

**O Sinalize sem relógio.** "O tempo passa a impressão de que tem que fazer
rápido." Saíram os pontos, os recordes, as estrelas, a contagem 3-2-1 e o
tempo limite.
- Na vez da criança, a tela diz: "SUA VEZ! FAÇA O SINAL DO A PARA A CÂMERA".
- Outra vogal na câmera mostra "QUASE!", e a criança continua tentando.

Um tropeço: o teste automático tentou tocar em PULAR e não conseguiu, porque a
faixa do "QUASE!" ficava por cima dos botões durante quase três segundos. O
aviso passou para a instrução e para a câmera (imagem `03_05`).

**As instruções sem a pessoa.** "Ser humano ali está um pouco feio, não combina
com o estilo da InclusiVR." A imagem teve duas versões, e a primeira ficou.
1. Na primeira, a foto do livro aberto e o celular vieram do site com o plugin
   de LIBRAS, junto com a animação do "salto". O elefante do site era um
   elefante cinza genérico, diferente do que a criança vê no app. O Claude
   fotografou o elefante do próprio app, feito do traço do Igor, jogando água
   com a tromba (`tools/render-instrucoes.mjs`).
2. O Luciano lembrou que "o site" é a versão em atualização no artefato, de
   04/11. A primeira tinha vindo da versão de teste do plugin, de 19/10. O
   Claude trocou a imagem pela montagem da versão de 04/11, como está lá, com
   o elefante cinza mexendo a orelha e a tromba. E avisou: aquele elefante não
   é o do Igor.
3. O Luciano comparou as duas: "O elefante do Igor é melhor que esse do site."
   A primeira voltou inteira, com a troca desfeita pelo git (imagens `03_02` e
   `03_06`).

**Tela inicial e tela cheia.**
- A tela inicial passou a ocupar a altura exata do aparelho. Foi conferida sem
  rolar em seis tamanhos de celular e tablet, mais paisagem (imagem `03_03`).
- O botão TELA CHEIA aparece onde o navegador deixa (o Safari do iPhone não deixa).

**A música.** O código ficou pronto antes do arquivo. Com um tom de teste no
lugar, a música entra no primeiro toque e o botão liga e desliga. O arquivo
veio depois:
- O primeiro link do Drive pedia login, porque a música não estava aberta como
  a pasta dos vídeos. O Luciano a pôs na mesma pasta, e o download funcionou.
- O original, "oogoway morrendo", é um WAV de quase 6 minutos e 63 MB: pesado
  demais para um celular.
- O Claude fez um MP3 de 4,3 MB (96 kbps) e tirou os 4,6 segundos de silêncio
  do fim, para o laço não ter um buraco.
- Mediu o volume: −22 LUFS no todo e −29 no começo, que é calmo. Com o volume
  escolhido antes de existir a faixa (0,22), o começo tocaria perto de −42
  LUFS, quase nada num alto-falante de celular. O volume do app passou para
  0,45.

**Números.** 96 testes de unidade e 115 verificações ponta a ponta, todas
passando (112 antes da música; as 3 novas conferem a trilha de verdade e o
botão que some sem ela). O teste no celular de verdade ficou como pedido à
equipe, com um medidor novo: abrir o app com `?debug=1` mostra quantas vezes
por segundo a tela é desenhada e o rastreio roda.

**No ar.** O Luciano pediu o link para testar e deu o OK para publicar. A 2.2
entrou no `main` pelo PR #5 e chegou ao site em cerca de um minuto. O Claude
conferiu o site ao vivo, num navegador sem janela:
- a versão é a 2.2.0;
- a música abre (5 min 55 s);
- as instruções mostram o elefante do Igor;
- os 5 animais e os 2 arquivos de reconhecimento baixam;
- o arquivo da Aia não existe mais no site.

## Capítulo 4. Os detalhes do teste da 2.2 (terça, 11/11/2026)

**O que a equipe viu.** Com a 2.2 no ar, a equipe testou no celular e mandou
três fotos. O rastreio novo agradou: "No zoológico, está funcionando bem o
tracking novo agora". Faltavam três detalhes.

**Os botões da tela inicial.** "Botão de tela cheia e de música estão mal
posicionados nesse layout."
- Na 2.2, os dois ficavam empilhados no canto de cima, por cima da ilustração
  do Igor. Passavam da borda do arco e tinham larguras diferentes: "SAIR DA
  TELA CHEIA" era bem mais larga.
- O Claude levou os dois para baixo, dos lados da marca da InclusiVR, com os
  mesmos botões de ícone dos jogos (o X, o ? e o som). A música desligada
  aparece com a nota cortada (imagem `04_01`).
- Um teste novo confere, em seis tamanhos de tela e em paisagem, que os dois
  ficam na linha da marca, dentro da tela e fora da ilustração.

**O zoológico amontoado.** "Estão todos convergindo para uma única área,
possivelmente um plano." Antes de mexer, o Claude mediu:
- o "chão" do zoológico ocupava só de 28% a 73% da altura da tela;
- cada animal ia visitar alguém a cada 7 a 14 segundos. Com cinco animais, era
  uma visita a cada dois segundos;
- o encontro acontecia a uma distância menor que a soma dos tamanhos: um
  entrava no outro, e nada os separava depois;
- num teste com os 10, a 2.2 tinha de 17 a 24 pares um dentro do outro, de 45
  pares possíveis.

O que resolveu foi um arquivo novo, `zooSpace.js`:
- o chão passou a ocupar a tela entre a barra de cima e a fileira de retratos,
  calculado com a própria câmera do app;
- ninguém entra no outro, e cada um passeia para um lugar vazio;
- os encontros ficaram lado a lado, e as visitas, raras.

Foram três rodadas de ajuste, com fotos:
1. Na primeira, eles ainda ficavam no meio. O lugar de chegada preferia a
   coluna da carta, e um bicho alto tapava quem estava logo atrás. A
   profundidade passou a pedir mais espaço que os lados.
2. Na segunda, com a tela deitada, a fileira de retratos quebrava em duas
   linhas, e as letras "U" e "I" ficavam coladas, como a palavra "UI".
3. Na terceira, eles se espalharam também com a tela deitada.

No fim, nenhum par ficou sobreposto, e eles ocupam de 65% a 77% da altura da
tela (imagem `04_02`).

**O sorteio do Sinalize.** "Só pra não pegar ninguém de surpresa. A primeira
vez pode ser a e i o u normal, depois sorteado sempre."
- A primeira partida no aparelho vem em ordem.
- Depois, cada partida começa com "SORTEANDO AS VOGAIS...": as cinco vogais
  pulam, trocam de lugar e mostram a ordem da partida (imagem `04_03`).
- No primeiro teste, atrás do aviso apareciam restos da partida anterior
  ("OLHE O SINAL DO E", "LETRA U"). O Claude limpou o fundo: durante o sorteio,
  a vogal é um "?".

Das três fotos da equipe, a do Sinalize tem o rosto de uma pessoa e ficou fora
do making off.

**Números.** 111 testes de unidade e 128 verificações ponta a ponta, todas
passando. Versão 2.2.1.

**No ar.** Como estava no plano aprovado, a 2.2.1 entrou no `main` pelo PR #6.
O site mostrou a versão nova cerca de um minuto depois. O Claude conferiu ao
vivo, num navegador sem janela: a versão é a 2.2.1, os dois botões ficam
embaixo, ao lado da marca e fora da ilustração, o arquivo novo do zoológico
está no site, e o "Como jogar" do Sinalize fala da ordem e do sorteio.
