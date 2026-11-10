# Lições

1. **Física de VRM em AR: rode as molas no espaço do personagem.** No AR o mundo
   tem a escala da imagem rastreada (centenas de unidades), não metros. Sem o
   "centro" das molas, o cabelo e a roupa se desmancham e tremem com o
   rastreamento. Os raios das colisões também precisam da escala. (Capítulo 1)
2. **Ao esmaecer um modelo, guarde o estado original de cada material.**
   Materiais já transparentes (íris, brilho dos olhos) não podem virar opacos
   na volta. (Capítulo 1)
3. **No MindAR, cada alvo tem a sua escala.** Para saber onde uma imagem está em
   cima de outra, use a tela (o ponto na câmera e o raio até o plano), não a
   posição 3D. (Capítulo 1)
4. **Cronômetro de tentativa é por tentativa.** O tempo limite de uma nova
   tentativa começa do zero; só o bônus soma as tentativas. (Capítulo 1)
5. **Trecho de vídeo de uma letra termina enquanto a mão está parada nela**,
   nunca no meio da passagem para a próxima letra. Meça quadro a quadro.
   (Capítulo 1)
6. **Nada de DOM por cima de vídeo de LIBRAS.** Uma sombra "decorativa" na
   frente do intérprete esconde as mãos. (Capítulo 1)
7. **Nenhum nome da equipe nos aplicativos**: a função ("intérprete de LIBRAS")
   é o que importa para quem usa. Vale para todos os produtos. (Capítulo 1)
8. **Teste como o site de verdade entrega os arquivos.** O GitHub Pages
   comprime (gzip) modelos, alvos e código, e o tamanho anunciado é o
   comprimido. Nunca reserve memória pelo `Content-Length`; e o servidor de
   teste precisa comprimir igual, senão o erro só aparece no celular. (Capítulo 2)
