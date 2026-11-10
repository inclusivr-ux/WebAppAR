# Bibliotecas de terceiros (vendorizadas)

Copiadas localmente para o app não depender de CDN (escolas e redes móveis
às vezes bloqueiam CDNs) e para fixar versões testadas.

| Biblioteca | Versão | Origem (npm) | Licença |
|---|---|---|---|
| MindAR (image tracking) | 1.2.5 | `mind-ar/dist/mindar-image.prod.js` + chunks `controller-*.js`, `ui-*.js` | MIT |
| Three.js | r160 (0.160.0) | `three/build/three.module.min.js` | MIT |
| GLTFLoader / BufferGeometryUtils | r160 | `three/examples/jsm/...` | MIT |
| MediaPipe Tasks Vision (Hand Landmarker) | 1.0.1 | `@mediapipe/tasks-vision/vision_bundle.mjs` + `wasm/vision_wasm_internal.*` e `wasm/vision_wasm_nosimd_internal.*` | Apache-2.0 (`mediapipe/LICENSE`) |
| Modelo `hand_landmarker.task` (float16) | 1 | `storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/` | Apache-2.0 |
| MeshoptDecoder, SkeletonUtils | r160 | `three/examples/jsm/...` | MIT |

## Ajustes feitos nas cópias

- `three/addons/*.js`: `from 'three'` foi trocado por `from '../three.module.min.js'`
  e os imports entre eles (`BufferGeometryUtils`) apontam para a mesma pasta.
  Assim os módulos funcionam sem *import maps* (iOS < 16.4).

## Animais

- Os animais (`assets/models/*.glb`) vêm com malha e animações comprimidas
  (`EXT_meshopt_compression`): o app usa o `MeshoptDecoder`.
- A Maga Aia e o Seu Zé em 3D foram arquivados na versão 2.2, junto com o
  three-vrm 2.1.0 e o KTX2Loader/Basis que só eles usavam. Estão no commit
  `a6eba3a` (ver `docs/ARQUIVO.md`).

## MediaPipe (✋ Sinalize e Conte)

Usado só pelo Jogo 3 para encontrar os 21 pontos da mão na imagem da câmera
(`src/sign/handTracker.js`). Os arquivos ficam aqui sem modificações:

- `vision_bundle.mjs` — API JavaScript (`FilesetResolver`, `HandLandmarker`);
- `wasm/` — o motor em WebAssembly. O navegador baixa **só uma** das versões:
  `vision_wasm_internal` (com SIMD, aparelhos atuais) ou
  `vision_wasm_nosimd_internal` (aparelhos antigos, ex.: iOS < 16.4);
- `hand_landmarker.task` — o modelo treinado (detector de palma + pontos da mão).

Tudo é carregado sob demanda, quando a pessoa abre o jogo (≈ 8 MB de modelo
+ ≈ 11 MB de WebAssembly), e o service worker guarda os arquivos para as
próximas vezes. Nenhuma imagem da câmera sai do aparelho.

## Por que Three.js r160?

O MindAR 1.2.5 foi publicado e testado com o Three.js r160 (é a versão usada na
documentação oficial). O app usa apenas o `Controller` de baixo nível do MindAR
(`MINDAR.IMAGE.Controller`), com integração própria ao Three.js em
`src/ar/arSession.js`.
