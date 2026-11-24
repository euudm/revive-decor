# revivè decor

Site one-page de uma empresa de reforma completa de studios em São Paulo. O conceito é **"O espaço revive"**: o visitante pega um studio cinza, de concreto cru, e acompanha cada etapa da reforma até a luz quente acender.

## Problema

O material da empresa era um PDF de 23 páginas. O diferencial deles (gerenciar todas as etapas da reforma, do projeto ao aroma) aparecia como uma lista de serviços, cada um num bloco de texto com uma foto de banco de imagem.

## Solução

Cada etapa virou uma interação:

| No PDF | No site |
| --- | --- |
| Projeto, execução, pisos e forros, móveis, marmoraria, vidraçaria, decoração e aroma | Cena 3D guiada pela rolagem: o studio começa em obra, a planta é desenhada no piso, a parede antiga é demolida, os conduítes acendem, uma frente de luz transforma o concreto em cal, oliva e madeira, e os móveis, a pedra, os vidros e a decoração entram no lugar. A poeira vira aroma subindo do difusor. |
| "Gerenciar todas as etapas" | Pilha de camadas em 3D (CSS): projeto, infraestrutura, marcenaria, pedra e vidro se separam com a rolagem; cada uma abre o seu texto |
| "Conheça alguns dos nossos studios" | Studios revividos: seção presa na rolagem, uma foto real grande por vez. Ela entra cinza e uma frente de luz atravessa devolvendo a cor, o mesmo gesto do hero. Clicar abre todas as fotos daquele studio em profundidade |
| "Contate-nos" | Chaveiro 3D com a tag gravada com o monograma, que balança com o mouse, o toque e a rolagem |

Só foram usadas as 35 fotos reais de obra que estavam no PDF. Fotos de banco de imagem, renders, recortes e imagens de 736 px (Pinterest) ficaram de fora.

## Stack

- Vite e JavaScript puro
- Three.js: geometria procedural, planos de corte (clipping) para a frente de renovação, InstancedMesh na demolição, partículas em shader
- GSAP + ScrollTrigger; Lenis só no desktop
- Texturas de concreto, piso, freijó, granito e cal geradas num Web Worker (nenhuma imagem de textura baixada)
- Python (PyMuPDF + Pillow) para extrair, classificar e converter as fotos do PDF

## Decisões de performance

- **Three.js sob demanda:** pacote inicial de cerca de 57 KB gzip; o 3D chega por import dinâmico enquanto o loader roda.
- **Nada compila no meio da rolagem:** luzes em número fixo desde o início, `compileAsync` e um quadro de aquecimento com todos os objetos visíveis, que sobe as texturas e os shaders de sombra durante o loader. Medido com PerformanceObserver (longtask): a soma das tarefas longas na rolagem do desktop caiu de 3,3 s para 0,4 s.
- **Texturas no Web Worker:** pixels crus transferidos para `DataTexture` (o `ImageBitmap` de OffscreenCanvas falhou no upload em alguns drivers).
- **Seções presas animam só transform e opacity.** Os loops 3D pausam fora da tela.
- **Studios revividos:** a cor é revelada por uma máscara que só se move com translate (nada de clip-path por quadro), e cada foto é dimensionada em px para nunca passar da resolução real. A seção roda sem nenhuma tarefa longa.
- **Segundo contexto WebGL (chaveiro):** criado e desenhado uma vez durante o loader. Criado no meio da rolagem, travava a página por mais de um segundo.
- **Fotos:** miniaturas da fachada só baixam perto da tela, as fotos do studio só ao abrir, e nenhuma é esticada acima da resolução real.
- **Celular:** a mesma sequência 3D com câmera para tela em pé, sem sombras e com resolução menor. Toque age só no `click`. Sem WebGL (ou com `?lite=1`), o hero vira uma foto real saindo do cinza para a cor.

## Como rodar

```bash
npm install
npm run dev     # http://localhost:5203
npm run build   # gera dist/
```

## Estrutura

```
src/
  main.js                orquestração (loader, rolagem, seções)
  three/studio.js        cena do hero: o studio que revive
  three/chaveiro.js      chaveiro do contato
  three/texturas*.js     texturas procedurais (worker + geradores)
  modules/revividos.js   studios revividos (cinza para cor)
  modules/interior.js    fotos de um studio em profundidade
  data/studios.json      fotos por studio e bairro
public/studios/          fotos em WebP
```
