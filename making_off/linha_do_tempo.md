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
