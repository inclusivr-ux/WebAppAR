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
9. **Modelo preso direto à pose do rastreio anda aos saltinhos.** O rastreio
   atualiza 10 a 20 vezes por segundo, e a tela, 60. Ponha o modelo num grupo
   que segue a pose a cada quadro (amortecimento curto). Calcule o "virar
   para a câmera" na pose já suavizada, senão o tremor do rastreio aumenta.
   (Capítulo 3)
10. **Cada imagem a mais na procura deixa o reconhecimento mais lento.** Procure
    só o que o app usa naquele momento. Arquive o resto. (Capítulo 3)
11. **Em AR para crianças, o alvo valida, e a brincadeira não depende dele.**
    Quando a câmera sai do alvo, leve o objeto para um palco fixo na tela, em
    vez de congelar, piscar ou sumir. (Capítulo 3)
12. **Aviso de "quase" não tapa botões.** Um teste automático que toca nos
    botões acha esse tipo de problema; a faixa do Sinalize tapava PULAR por
    quase três segundos. (Capítulo 3)
13. **A imagem de instrução mostra o que a criança vai ver.** Se o material de
    divulgação usa outro modelo, use o modelo do próprio app, fotografado por
    script. (Capítulo 3)
14. **"O site" tem várias versões: confirme qual antes de copiar material.**
    A publicada, a de teste do plugin e a que está em atualização no artefato
    têm imagens diferentes. Na dúvida, a referência é a versão em atualização.
    (Capítulo 3)
