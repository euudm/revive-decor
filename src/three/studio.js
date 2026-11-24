// Hero: um studio em corte que começa em concreto cru e revive etapa por etapa,
// guiado pelo progresso (0..1) da rolagem.
//   01 projeto        linhas da planta desenhadas no piso
//   02 execução       demolição da parede antiga + conduítes elétricos acendendo
//   03 pisos e forros a "frente de renovação" atravessa o ambiente: concreto vira cal, oliva e madeira; o forro desce e o LED acende
//   04 móveis         marcenaria entra no lugar
//   05 marmoraria     bancada de granito com recorte do cooktop e da cuba
//   06 vidraçaria     vidro da janela e porta espelhada do roupeiro
//   07 decoração      cama arrumada, tapete, planta, pendentes; a poeira vira aroma subindo do difusor
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { texturas, encerrarWorker } from './texturas.js';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const faixa = (p, a, b) => clamp01((p - a) / (b - a));
const suave = (t) => t * t * (3 - 2 * t);
const suave2 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const saidaBack = (t) => { const c = 1.6; return t <= 0 ? 0 : 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const v3 = (x, y, z) => new THREE.Vector3(x, y, z);

// sala: x -2.2..2.2 | z -1.7..1.7 | y 0..2.7
const SX = 2.2, SZ = 1.7, SH = 2.7, EP = 0.15;
const JAN = { x0: 0.6, x1: 2.05, y0: 0.75, y1: 2.35 };

// UV em coordenadas de mundo: a textura continua entre peças vizinhas
function uvMundo(geo, origem, escala) {
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) + origem.x, y = pos.getY(i) + origem.y, z = pos.getZ(i) + origem.z;
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    if (ny >= nx && ny >= nz) uv.setXY(i, x * escala, z * escala);
    else if (nx >= nz) uv.setXY(i, z * escala, y * escala);
    else uv.setXY(i, x * escala, y * escala);
  }
  uv.needsUpdate = true;
  return geo;
}

function canvasCeu() {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 320 });
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 320);
  gr.addColorStop(0, '#93a7b8'); gr.addColorStop(0.55, '#d9cbb8'); gr.addColorStop(1, '#f0c79a');
  g.fillStyle = gr; g.fillRect(0, 0, 512, 320);
  let r = 11;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let x = -10; x < 512; x += 22 + rnd() * 40) {
    const w = 26 + rnd() * 46, h = 70 + rnd() * 180;
    g.fillStyle = `rgba(${52 + rnd() * 20},${56 + rnd() * 18},${66 + rnd() * 16},${0.55 + rnd() * 0.3})`;
    g.fillRect(x, 320 - h, w, h);
    g.fillStyle = 'rgba(255,214,160,0.75)';
    for (let yy = 320 - h + 8; yy < 316; yy += 11) for (let xx = x + 4; xx < x + w - 4; xx += 8) if (rnd() > 0.82) g.fillRect(xx, yy, 3, 4);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function canvasReflexo() {
  const c = Object.assign(document.createElement('canvas'), { width: 256, height: 512 });
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#f6e3c8'); gr.addColorStop(0.3, '#cfc5b8'); gr.addColorStop(0.75, '#9c8c7a'); gr.addColorStop(1, '#6f6457');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 512);
  g.fillStyle = 'rgba(80,66,52,0.35)'; g.fillRect(120, 300, 140, 120); // cama refletida
  g.fillStyle = 'rgba(255,236,205,0.5)'; g.fillRect(0, 40, 256, 10); // fita de LED refletida
  const s = g.createLinearGradient(0, 0, 256, 512);
  s.addColorStop(0.35, 'rgba(255,255,255,0)'); s.addColorStop(0.45, 'rgba(255,255,255,0.35)'); s.addColorStop(0.5, 'rgba(255,255,255,0)');
  g.fillStyle = s; g.fillRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- partículas: poeira que vira aroma ----------
const PART_VS = /* glsl */ `
  uniform float uTime, uWarm, uRise, uSize, uPR;
  uniform vec3 uFonte;
  attribute vec4 aRand;
  varying float vA;
  varying float vAroma;
  void main() {
    vec3 p = position;
    float s = aRand.x * 6.2831;
    p += vec3(sin(uTime * 0.23 + s), sin(uTime * 0.31 + s * 1.7) * 0.6, cos(uTime * 0.19 + s * 1.3)) * 0.12;
    float sub = fract(aRand.y + uTime * 0.05 * (0.6 + aRand.z));
    vec3 aroma = uFonte + vec3(sin(sub * 9.0 + s) * 0.28 * sub + (aRand.z - 0.5) * 0.06,
                               sub * 2.0,
                               cos(sub * 7.0 + s) * 0.28 * sub + (aRand.x - 0.5) * 0.06);
    float ehAroma = step(aRand.w, 0.5) * uRise;
    p = mix(p, aroma, ehAroma);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.45 + aRand.z) * uPR * (6.0 / -mv.z) * (1.0 + ehAroma * 0.6);
    float pisca = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * 1.3 + s * 5.0), 3.0);
    vA = pisca * mix(0.6, (1.0 - sub) * 1.1, ehAroma);
    vAroma = ehAroma;
  }
`;
const PART_FS = /* glsl */ `
  uniform float uWarm, uOp;
  varying float vA;
  varying float vAroma;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.0, d);
    vec3 poeira = vec3(0.47, 0.46, 0.44);
    vec3 quente = vec3(1.0, 0.76, 0.46);
    vec3 cor = mix(poeira, quente, uWarm);
    gl_FragColor = vec4(cor, a * a * vA * uOp);
  }
`;

// ---------- frente de renovação ----------
const FRENTE_VS = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const FRENTE_FS = /* glsl */ `
  uniform float uTime, uOp;
  varying vec2 vUv;
  void main() {
    float borda = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
    float vert = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    float brilho = 0.85 + 0.15 * sin(vUv.y * 9.0 - uTime * 2.0 + vUv.x * 4.0);
    vec3 cor = mix(vec3(1.0, 0.68, 0.36), vec3(1.0, 0.9, 0.74), vUv.y);
    gl_FragColor = vec4(cor, borda * vert * brilho * uOp * 0.5);
  }
`;

export async function criarStudio(canvas, { leve = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !leve, alpha: true, powerPreference: 'high-performance' });
  let pr = Math.min(window.devicePixelRatio, leve ? 1.25 : 1.75);
  renderer.setPixelRatio(pr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(0x000000, 0);
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = !leve;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const tx = await texturas([
    ['concreto', 512, 512], ['cal', 256, 256], ['piso', 1024, 1024], ['freijo', 512, 512], ['granito', 512, 512],
  ], leve);
  encerrarWorker();

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 80);

  // ---------- luzes (quantidade fixa desde o início: nada de recompilar shader no meio) ----------
  const hemi = new THREE.HemisphereLight(0xd6dde3, 0x5f5a54, 1.35);
  cena.add(hemi);
  const sol = new THREE.DirectionalLight(0xffffff, 1.6);
  sol.position.set(3.5, 6.5, 5.5);
  sol.castShadow = !leve;
  sol.shadow.mapSize.set(2048, 2048);
  Object.assign(sol.shadow.camera, { left: -4, right: 4, top: 4, bottom: -3, near: 1, far: 20 });
  sol.shadow.bias = -0.0004;
  sol.shadow.normalBias = 0.02;
  cena.add(sol);
  const luzForro = new THREE.PointLight(0xffc98a, 0, 6, 1.6);
  luzForro.position.set(-1.2, 2.3, -1.0);
  cena.add(luzForro);
  const luzPendente = new THREE.PointLight(0xffb870, 0, 3.5, 1.8);
  luzPendente.position.set(1.3, 1.7, -1.3);
  cena.add(luzPendente);
  const luzFrente = new THREE.PointLight(0xffb066, 0, 4.5, 1.6);
  cena.add(luzFrente);

  // ---------- planos de corte da frente de renovação ----------
  const N = v3(1, 0, 1).normalize();
  const planoFin = new THREE.Plane(N.clone().negate(), -3);

  // ---------- materiais ----------
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const M = {
    concreto: std({ map: tx.concreto, roughness: 0.95 }),
    corte: std({ color: 0x2b2c28, roughness: 0.9 }),
    cal: std({ map: tx.cal, roughness: 0.92, clippingPlanes: [planoFin] }),
    oliva: std({ map: tx.cal, color: 0x95a06f, roughness: 0.92, clippingPlanes: [planoFin] }),
    piso: std({ map: tx.piso, roughness: 0.55, clippingPlanes: [planoFin] }),
    freijo: std({ map: tx.freijo, roughness: 0.55 }),
    laca: std({ color: 0xe8e3da, roughness: 0.42 }),
    grafite: std({ color: 0x2f302d, roughness: 0.4 }),
    metal: std({ color: 0x1b1b1a, metalness: 0.55, roughness: 0.35 }),
    granito: std({ map: tx.granito, roughness: 0.18 }),
    vitro: std({ color: 0x0c0c0d, roughness: 0.08 }),
    inox: std({ color: 0x8d8f91, metalness: 0.7, roughness: 0.3 }),
    tecido: std({ color: 0xe9e5dc, roughness: 1 }),
    cinzaTecido: std({ color: 0xa9a49b, roughness: 1 }),
    manta: std({ color: 0xb6603c, roughness: 1 }),
    almofada: std({ color: 0xd8cdb9, roughness: 1 }),
    verde: std({ color: 0x4f6a3a, roughness: 0.85 }),
    vaso: std({ color: 0xd8d0c2, roughness: 0.7 }),
    tapete: std({ color: 0xcdbfa6, roughness: 1 }),
    tijolo: std({ map: tx.concreto, color: 0xc9b8a6, roughness: 0.95 }),
    entulho: std({ map: tx.concreto, color: 0x9a948c, roughness: 1 }),
    led: new THREE.MeshBasicMaterial({ color: 0x3a342c }),
    lampada: new THREE.MeshBasicMaterial({ color: 0x3a342c }),
    conduite: new THREE.MeshBasicMaterial({ color: 0xff9a48, transparent: true, opacity: 1 }),
    espelho: new THREE.MeshBasicMaterial({ map: canvasReflexo() }),
    vidro: new THREE.MeshBasicMaterial({ color: 0xd2e4e6, transparent: true, opacity: 0.2, depthWrite: false }),
    brilho: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    ceu: new THREE.MeshBasicMaterial({ map: canvasCeu(), color: 0x8f969c }),
    planta: new THREE.LineBasicMaterial({ color: 0xfbf6ea, transparent: true, opacity: 0 }),
    demolir: new THREE.LineBasicMaterial({ color: 0xc4652e, transparent: true, opacity: 0 }),
  };

  const sombra = (m, c = true, r = true) => { m.castShadow = c && !leve; m.receiveShadow = r && !leve; return m; };
  function caixa(w, h, d, mat, x, y, z, { uv = 0, pai = cena, rot = null } = {}) {
    const geo = new THREE.BoxGeometry(w, h, d);
    if (uv) uvMundo(geo, v3(x, y, z), uv);
    const m = sombra(new THREE.Mesh(geo, mat));
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    pai.add(m);
    return m;
  }
  function arred(w, h, d, r, mat, x, y, z, pai = cena) {
    const m = sombra(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, leve ? 2 : 3, r), mat));
    m.position.set(x, y, z);
    pai.add(m);
    return m;
  }

  // ---------- casca: laje, paredes (concreto cru) e seus revestimentos ----------
  const matLaje = [M.corte, M.corte, M.concreto, M.corte, M.corte, M.corte];
  const geoLaje = uvMundo(new THREE.BoxGeometry(SX * 2 + EP, EP, SZ * 2 + EP), v3(-EP / 2, -EP / 2, -EP / 2), 0.5);
  const laje = sombra(new THREE.Mesh(geoLaje, matLaje), false, true);
  laje.position.set(-EP / 2, -EP / 2, -EP / 2);
  cena.add(laje);

  const matParede = [M.concreto, M.concreto, M.corte, M.corte, M.concreto, M.concreto];
  function parede(w, h, d, x, y, z) {
    const geo = uvMundo(new THREE.BoxGeometry(w, h, d), v3(x, y, z), 0.5);
    const m = sombra(new THREE.Mesh(geo, matParede));
    m.position.set(x, y, z);
    cena.add(m);
  }
  const zF = -SZ - EP / 2, xE = -SX - EP / 2;
  parede(JAN.x0 + SX + EP, SH, EP, (-SX - EP + JAN.x0) / 2, SH / 2, zF);
  parede(SX - JAN.x1, SH, EP, (JAN.x1 + SX) / 2, SH / 2, zF);
  parede(JAN.x1 - JAN.x0, JAN.y0, EP, (JAN.x0 + JAN.x1) / 2, JAN.y0 / 2, zF);
  parede(JAN.x1 - JAN.x0, SH - JAN.y1, EP, (JAN.x0 + JAN.x1) / 2, (SH + JAN.y1) / 2, zF);
  parede(EP, SH, SZ * 2, xE, SH / 2, 0);

  // revestimento final (recortado pela frente de renovação)
  const formaFundo = new THREE.Shape();
  formaFundo.moveTo(-SX, 0); formaFundo.lineTo(SX, 0); formaFundo.lineTo(SX, SH); formaFundo.lineTo(-SX, SH); formaFundo.lineTo(-SX, 0);
  const furo = new THREE.Path();
  furo.moveTo(JAN.x0, JAN.y0); furo.lineTo(JAN.x0, JAN.y1); furo.lineTo(JAN.x1, JAN.y1); furo.lineTo(JAN.x1, JAN.y0); furo.lineTo(JAN.x0, JAN.y0);
  formaFundo.holes.push(furo);
  const geoFundo = new THREE.ShapeGeometry(formaFundo);
  { const uv = geoFundo.attributes.uv, pos = geoFundo.attributes.position; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.5, pos.getY(i) * 0.5); }
  const revFundo = sombra(new THREE.Mesh(geoFundo, M.cal), false, true);
  revFundo.position.z = -SZ + 0.004;
  cena.add(revFundo);
  const revEsq = sombra(new THREE.Mesh(uvMundo(new THREE.PlaneGeometry(SZ * 2, SH), v3(0, 0, 0), 0.5), M.oliva), false, true);
  revEsq.rotation.y = Math.PI / 2;
  revEsq.position.set(-SX + 0.004, SH / 2, 0);
  cena.add(revEsq);
  const geoPiso = new THREE.PlaneGeometry(SX * 2, SZ * 2);
  geoPiso.rotateX(-Math.PI / 2);
  uvMundo(geoPiso, v3(0, 0, 0), 1 / 1.6);
  const piso = sombra(new THREE.Mesh(geoPiso, M.piso), false, true);
  piso.position.y = 0.003;
  cena.add(piso);

  // céu e cidade pela janela
  // vista da cidade: colada atrás da parede e só um pouco maior que a abertura,
  // então nunca escapa pela lateral do prédio
  const ceu = new THREE.Mesh(new THREE.PlaneGeometry(JAN.x1 - JAN.x0 + 0.16, JAN.y1 - JAN.y0 + 0.16), M.ceu);
  ceu.position.set((JAN.x0 + JAN.x1) / 2, (JAN.y0 + JAN.y1) / 2, -SZ - EP - 0.02);

  // caixilho de alumínio preto e peitoril: lê como janela desde a obra
  const mJ = M.metal;
  const xc = (JAN.x0 + JAN.x1) / 2, yc = (JAN.y0 + JAN.y1) / 2, wj = JAN.x1 - JAN.x0, hj = JAN.y1 - JAN.y0, zj = -SZ - EP / 2;
  caixa(wj + 0.08, 0.05, EP + 0.02, mJ, xc, JAN.y1 + 0.005, zj);
  caixa(0.05, hj + 0.08, EP + 0.02, mJ, JAN.x0 - 0.005, yc, zj);
  caixa(0.05, hj + 0.08, EP + 0.02, mJ, JAN.x1 + 0.005, yc, zj);
  caixa(wj + 0.16, 0.035, EP + 0.12, M.granito, xc, JAN.y0 - 0.01, zj + 0.05, { uv: 1 / 0.8 }); // peitoril
  cena.add(ceu);

  // ---------- 01 projeto: planta desenhada no piso ----------
  function linhasRet(lista, y = 0.008) {
    const pts = [];
    for (const [x0, z0, x1, z1] of lista) {
      pts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }
  const geoPlanta = linhasRet([
    [-2.2, -1.7, -1.6, -0.5], // roupeiro
    [-2.2, -0.3, -1.6, 1.3], // cozinha
    [-1.3, -1.66, 0.3, 0.34], // cama
    [-1.35, -1.7, 0.35, -1.6], // cabeceira
    [0.6, -1.7, 2.1, -1.2], // bancada
    [-1.0, 0.45, 0.9, 1.4], // tapete
    [0.95, 0.55, 1.05, 0.65], // poste da TV
    [-2.2, 1.95, 2.2, 1.95], [-2.2, 1.88, -2.2, 2.02], [2.2, 1.88, 2.2, 2.02], // cota frontal
    [2.45, -1.7, 2.45, 1.7], [2.38, -1.7, 2.52, -1.7], [2.38, 1.7, 2.52, 1.7], // cota lateral
  ]);
  const planta = new THREE.LineSegments(geoPlanta, M.planta);
  planta.material.clippingPlanes = [];
  cena.add(planta);
  const totalPlanta = geoPlanta.attributes.position.count;
  const demolirLinhas = new THREE.LineSegments(linhasRet([[0.38, -1.1, 0.52, 0.95]], 0.009), M.demolir);
  cena.add(demolirLinhas);

  // ---------- 02 execução: parede antiga para demolir + entulho ----------
  const BL = { nx: 7, ny: 9, w: 0.29, h: 0.26, d: 0.12 };
  const nBlocos = BL.nx * BL.ny;
  const blocos = new THREE.InstancedMesh(new THREE.BoxGeometry(BL.d, BL.h - 0.012, BL.w - 0.012), M.tijolo, nBlocos);
  sombra(blocos);
  const blocoBase = [];
  let rr = 5;
  const rnd = () => ((rr = (rr * 16807) % 2147483647) / 2147483647);
  for (let j = 0; j < BL.ny; j++) for (let i = 0; i < BL.nx; i++) {
    const z = -1.05 + i * BL.w + (j % 2 ? BL.w / 2 : 0) - 0.02;
    blocoBase.push({
      p: v3(0.45, BL.h / 2 + j * BL.h, Math.min(z, 0.92)),
      v: v3((rnd() - 0.2) * 1.6, rnd() * 0.8, (rnd() - 0.5) * 1.4),
      r: v3((rnd() - 0.5) * 6, (rnd() - 0.5) * 6, (rnd() - 0.5) * 6),
      atraso: (BL.ny - 1 - j) / BL.ny * 0.45 + rnd() * 0.15,
    });
  }
  cena.add(blocos);
  const entulho = new THREE.Group();
  for (let k = 0; k < 9; k++) caixa(0.12 + rnd() * 0.2, 0.06 + rnd() * 0.1, 0.12 + rnd() * 0.2, M.entulho, 0.9 + rnd() * 1.1, 0.05, 0.4 + rnd() * 1.1, { pai: entulho, rot: [0, rnd() * 3, 0] });
  cena.add(entulho);

  // conduítes elétricos (crescem ao longo do caminho)
  function conduite(pontos) {
    const curva = new THREE.CatmullRomCurve3(pontos.map((p) => v3(...p)), false, 'catmullrom', 0.02);
    const g = new THREE.TubeGeometry(curva, pontos.length * 24, 0.016, 6, false);
    const m = new THREE.Mesh(g, M.conduite);
    cena.add(m);
    return m;
  }
  const conduites = [
    conduite([[-0.5, 0.05, -1.68], [-0.5, 1.2, -1.68], [-0.5, 2.5, -1.68], [0.4, 2.5, -1.68], [1.3, 2.5, -1.68], [1.3, 2.5, -1.4]]),
    conduite([[-2.18, 0.3, 1.5], [-2.18, 0.3, 0.6], [-2.18, 0.3, -0.25], [-2.18, 1.45, -0.25], [-2.18, 2.5, -0.25], [-2.18, 2.5, -1.2]]),
    conduite([[1.8, 0.05, -1.68], [1.8, 0.4, -1.68], [2.15, 0.4, -1.68]]),
  ];
  conduites.forEach((c) => { c.userData.total = c.geometry.index.count; });

  // frente de renovação
  const uFrente = { uTime: { value: 0 }, uOp: { value: 0 } };
  const frente = new THREE.Mesh(new THREE.PlaneGeometry(6.4, SH + 0.3), new THREE.ShaderMaterial({
    vertexShader: FRENTE_VS, fragmentShader: FRENTE_FS, uniforms: uFrente,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  }));
  frente.rotation.y = Math.PI / 4;
  cena.add(frente);

  // forro com sanca e LED
  const forro = new THREE.Group();
  caixa(SX * 2, 0.14, 0.38, M.laca, 0, 2.55, -SZ + 0.19, { pai: forro });
  caixa(0.38, 0.14, SZ * 2 - 0.38, M.laca, -SX + 0.19, 2.55, 0.19, { pai: forro });
  const ledF1 = caixa(SX * 2 - 0.4, 0.012, 0.02, M.led, 0.2, 2.475, -SZ + 0.4, { pai: forro });
  const ledF2 = caixa(0.02, 0.012, SZ * 2 - 0.4, M.led, -SX + 0.4, 2.475, 0.2, { pai: forro });
  ledF1.castShadow = ledF2.castShadow = false;
  cena.add(forro);

  // ---------- 04 móveis planejados ----------
  const itens = []; // { obj, a, b, tipo, de }
  function entra(obj, a, b, tipo = 'desce', de = 2.2) {
    if (!obj.parent) cena.add(obj);
    itens.push({ obj, a, b, tipo, de, base: obj.position.clone(), esc: obj.scale.clone() }); return obj; }

  // roupeiro
  const roupeiro = new THREE.Group();
  caixa(0.6, 2.4, 1.2, M.laca, -1.9, 1.2, -1.1, { pai: roupeiro });
  caixa(0.02, 2.36, 0.592, M.laca, -1.59, 1.2, -1.398, { pai: roupeiro });
  caixa(0.02, 2.36, 0.592, M.laca, -1.59, 1.2, -0.802, { pai: roupeiro });
  caixa(0.025, 0.5, 0.02, M.metal, -1.575, 1.2, -1.13, { pai: roupeiro });
  caixa(0.025, 0.5, 0.02, M.metal, -1.575, 1.2, -1.07, { pai: roupeiro });
  entra(roupeiro, 0.49, 0.55, 'desce', 3);

  // cabeceira ripada com nicho e LED
  const cabeceira = new THREE.Group();
  caixa(1.7, 1.55, 0.03, M.freijo, -0.5, 0.775, -SZ + 0.02, { uv: 1 / 1.2, pai: cabeceira });
  for (let k = 0; k < 15; k++) caixa(0.045, 1.55, 0.03, M.freijo, -1.3 + k * 0.115, 0.775, -SZ + 0.05, { uv: 1 / 1.2, pai: cabeceira });
  caixa(1.7, 0.03, 0.18, M.freijo, -0.5, 1.56, -SZ + 0.1, { uv: 1 / 1.2, pai: cabeceira });
  const ledCab = caixa(1.6, 0.01, 0.015, M.led, -0.5, 1.54, -SZ + 0.17, { pai: cabeceira });
  ledCab.castShadow = false;
  entra(cabeceira, 0.51, 0.57, 'desce', 2.6);

  // cozinha: corpo inferior, frentes em freijó, aéreos em laca
  const cozinhaB = new THREE.Group();
  caixa(0.58, 0.1, 1.58, M.grafite, -1.92, 0.05, 0.5, { pai: cozinhaB });
  caixa(0.6, 0.78, 1.6, M.laca, -1.9, 0.49, 0.5, { pai: cozinhaB });
  for (let k = 0; k < 4; k++) {
    caixa(0.02, 0.76, 0.395, M.freijo, -1.59, 0.49, -0.3 + 0.2 + k * 0.4, { uv: 1 / 1.2, pai: cozinhaB });
    caixa(0.025, 0.012, 0.22, M.metal, -1.575, 0.82, -0.3 + 0.2 + k * 0.4, { pai: cozinhaB });
  }
  entra(cozinhaB, 0.53, 0.59, 'lado', 2.6);
  const cozinhaA = new THREE.Group();
  caixa(0.35, 0.7, 1.6, M.laca, -2.025, 1.85, 0.5, { pai: cozinhaA });
  for (let k = 0; k < 4; k++) caixa(0.02, 0.68, 0.395, M.laca, -1.84, 1.85, 0.1 + k * 0.4, { pai: cozinhaA });
  const ledCoz = caixa(0.02, 0.01, 1.5, M.led, -1.9, 1.495, 0.5, { pai: cozinhaA });
  ledCoz.castShadow = false;
  entra(cozinhaA, 0.55, 0.61, 'desce', 2);

  // bancada sob a janela
  const bancada = new THREE.Group();
  caixa(1.5, 0.04, 0.5, M.freijo, 1.35, 0.75, -1.45, { uv: 1 / 1.2, pai: bancada });
  caixa(0.04, 0.73, 0.46, M.freijo, 2.08, 0.365, -1.45, { uv: 1 / 1.2, pai: bancada });
  caixa(0.04, 0.73, 0.46, M.freijo, 0.62, 0.365, -1.45, { uv: 1 / 1.2, pai: bancada });
  entra(bancada, 0.56, 0.62, 'frente', 2.4);

  // poste giratório da TV (cresce do piso) + painel
  const gPoste = new THREE.CylinderGeometry(0.025, 0.025, SH, 12);
  gPoste.translate(0, SH / 2, 0);
  const poste = sombra(new THREE.Mesh(gPoste, M.metal));
  poste.position.set(1.0, 0, 0.6);
  cena.add(poste);
  entra(poste, 0.57, 0.61, 'cresce');
  const tv = new THREE.Group();
  caixa(0.05, 0.62, 1.05, M.grafite, 0, 0, 0, { pai: tv });
  caixa(0.004, 0.58, 1.01, M.vitro, -0.027, 0, 0, { pai: tv });
  tv.position.set(0.96, 1.2, 0.6);
  tv.rotation.y = -0.45;
  cena.add(tv);
  entra(tv, 0.6, 0.64, 'sobe', 1.0);

  // base da cama (marcenaria)
  const baseCama = caixa(1.62, 0.32, 2.0, M.freijo, -0.5, 0.16, -0.66, { uv: 1 / 1.2 });
  entra(baseCama, 0.52, 0.58, 'desce', 2.2);

  // ---------- 05 marmoraria ----------
  const pedra = new THREE.Group();
  const tampo = caixa(0.66, 0.03, 1.64, M.granito, -1.89, 0.895, 0.5, { uv: 1 / 0.8, pai: pedra });
  caixa(0.02, 0.5, 1.64, M.granito, -2.19, 1.16, 0.5, { uv: 1 / 0.8, pai: pedra }); // frontão
  entra(pedra, 0.65, 0.7, 'desce', 1.3);
  const cooktop = caixa(0.5, 0.012, 0.56, M.vitro, -1.9, 0.913, 0.95);
  entra(cooktop, 0.69, 0.72, 'desce', 0.5);
  const cuba = caixa(0.38, 0.012, 0.44, M.inox, -1.9, 0.912, 0.0);
  entra(cuba, 0.69, 0.72, 'desce', 0.5);
  const torneira = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([v3(-2.12, 0.91, 0), v3(-2.12, 1.2, 0), v3(-2.0, 1.27, 0), v3(-1.92, 1.18, 0)]), 20, 0.012, 6), M.metal);
  sombra(torneira);
  cena.add(torneira);
  entra(torneira, 0.7, 0.725, 'escala');
  void tampo;

  // ---------- 06 vidraçaria ----------
  const espelho = caixa(0.01, 2.3, 0.56, M.espelho, -1.576, 1.2, -1.398);
  espelho.castShadow = false;
  entra(espelho, 0.745, 0.785, 'frente', 1.2);
  const vidros = [];
  for (let k = 0; k < 2; k++) {
    const w = (JAN.x1 - JAN.x0) / 2;
    const v = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.01, JAN.y1 - JAN.y0 - 0.02), M.vidro);
    v.position.set(JAN.x0 + w * (k + 0.5), (JAN.y0 + JAN.y1) / 2, -SZ - EP / 2 + (k ? 0.02 : -0.02));
    cena.add(v);
    vidros.push(entra(v, 0.75 + k * 0.015, 0.79 + k * 0.015, 'corre', 1.6));
    const caixilho = caixa(0.025, JAN.y1 - JAN.y0, 0.04, M.metal, JAN.x0 + w * k + (k ? 0 : 0.012), (JAN.y0 + JAN.y1) / 2, -SZ - EP / 2);
    entra(caixilho, 0.75, 0.78, 'desce', 1.2);
  }
  const brilho = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 3.2), M.brilho);
  brilho.rotation.z = 0.5;
  cena.add(brilho);

  // ---------- 07 decoração e aroma ----------
  const colchao = arred(1.58, 0.26, 1.96, 0.06, M.tecido, -0.5, 0.45, -0.66);
  entra(colchao, 0.83, 0.87, 'escala');
  const manta = arred(1.64, 0.05, 0.62, 0.02, M.manta, -0.5, 0.6, -0.05);
  entra(manta, 0.85, 0.89, 'desce', 0.8);
  const travesseiros = new THREE.Group();
  arred(0.68, 0.16, 0.38, 0.07, M.almofada, -0.88, 0.66, -1.4, travesseiros);
  arred(0.68, 0.16, 0.38, 0.07, M.almofada, -0.12, 0.66, -1.4, travesseiros);
  arred(0.5, 0.14, 0.3, 0.06, M.cinzaTecido, -0.5, 0.74, -1.18, travesseiros);
  entra(travesseiros, 0.86, 0.9, 'escala');
  const tapete = caixa(1.9, 0.012, 0.95, M.tapete, -0.05, 0.01, 0.92);
  tapete.castShadow = false;
  entra(tapete, 0.83, 0.88, 'estende');
  // cadeiras
  for (const x of [1.0, 1.65]) {
    const cad = new THREE.Group();
    caixa(0.42, 0.04, 0.42, M.laca, 0, 0.45, 0, { pai: cad });
    caixa(0.42, 0.42, 0.04, M.laca, 0, 0.68, 0.2, { pai: cad });
    for (const [a, b] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) caixa(0.03, 0.45, 0.03, M.freijo, a, 0.225, b, { pai: cad });
    cad.position.set(x, 0, -0.95);
    cena.add(cad);
    entra(cad, 0.86 + (x > 1.2 ? 0.015 : 0), 0.9 + (x > 1.2 ? 0.015 : 0), 'desce', 1.4);
  }
  // pendentes
  const pendentes = [];
  for (const x of [1.0, 1.7]) {
    const pd = new THREE.Group();
    const fio = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.75, 4), M.metal);
    fio.position.y = 0.375;
    const cup = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.18, 20, 1, true), M.metal);
    cup.material.side = THREE.DoubleSide;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), M.lampada);
    lamp.position.y = -0.07;
    pd.add(fio, cup, lamp);
    pd.position.set(x, 1.95, -1.45);
    cena.add(pd);
    pendentes.push(pd);
    entra(pd, 0.86, 0.9, 'desce', 0.9);
  }
  // planta no canto
  const planta3d = new THREE.Group();
  const vaso = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.36, 18), M.vaso);
  vaso.position.y = 0.18;
  planta3d.add(sombra(vaso));
  for (let k = 0; k < 7; k++) {
    const f = sombra(new THREE.Mesh(new THREE.SphereGeometry(0.16 + rnd() * 0.08, 10, 8), M.verde));
    f.scale.set(1, 1.5, 0.6);
    f.position.set((rnd() - 0.5) * 0.3, 0.6 + rnd() * 0.55, (rnd() - 0.5) * 0.3);
    f.rotation.set(rnd(), rnd() * 3, rnd());
    planta3d.add(f);
  }
  planta3d.position.set(1.95, 0, 0.0);
  cena.add(planta3d);
  entra(planta3d, 0.87, 0.92, 'escala');
  // difusor de aroma na bancada da cozinha
  const difusor = new THREE.Group();
  const frasco = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.12, 14), M.vidro);
  frasco.position.y = 0.06;
  difusor.add(frasco);
  for (let k = 0; k < 6; k++) {
    const vareta = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.36, 4), M.freijo);
    vareta.position.set(Math.cos(k) * 0.015, 0.25, Math.sin(k) * 0.015);
    vareta.rotation.set(Math.sin(k * 2) * 0.25, 0, Math.cos(k * 2) * 0.25);
    difusor.add(vareta);
  }
  difusor.position.set(-1.95, 0.91, 1.15);
  cena.add(difusor);
  entra(difusor, 0.88, 0.91, 'escala');

  // ---------- partículas ----------
  const NP = leve ? 260 : 620;
  const pPos = new Float32Array(NP * 3), pRand = new Float32Array(NP * 4);
  for (let i = 0; i < NP; i++) {
    pPos[i * 3] = (Math.random() * 2 - 1) * SX * 0.95;
    pPos[i * 3 + 1] = 0.1 + Math.random() * (SH - 0.2);
    pPos[i * 3 + 2] = (Math.random() * 2 - 1) * SZ * 0.95;
    for (let k = 0; k < 4; k++) pRand[i * 4 + k] = Math.random();
  }
  const gPart = new THREE.BufferGeometry();
  gPart.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  gPart.setAttribute('aRand', new THREE.BufferAttribute(pRand, 4));
  const uPart = {
    uTime: { value: 0 }, uWarm: { value: 0 }, uRise: { value: 0 }, uSize: { value: leve ? 9 : 8 }, uPR: { value: pr },
    uOp: { value: 1 }, uFonte: { value: v3(-1.95, 1.2, 1.15) },
  };
  const particulas = new THREE.Points(gPart, new THREE.ShaderMaterial({
    vertexShader: PART_VS, fragmentShader: PART_FS, uniforms: uPart, transparent: true, depthWrite: false,
  }));
  particulas.frustumCulled = false;
  cena.add(particulas);

  // ---------- câmera ----------
  const K = [
    { p: 0.0, pos: v3(6.4, 5.6, 7.8), olho: v3(-0.1, 0.9, -0.2) },
    { p: 0.13, pos: v3(0.8, 12.6, 4.9), olho: v3(0.2, 0, -0.6) },
    { p: 0.27, pos: v3(5.8, 3.7, 6.9), olho: v3(-0.4, 1.1, -0.5) },
    { p: 0.41, pos: v3(6.8, 5.2, 7.2), olho: v3(-0.2, 0.8, -0.3) },
    { p: 0.56, pos: v3(5.5, 3.5, 6.8), olho: v3(-0.6, 1.0, -0.5) },
    { p: 0.685, pos: v3(1.9, 2.9, 4.4), olho: v3(-1.8, 0.95, 0.45) },
    { p: 0.775, pos: v3(3.3, 2.9, 3.8), olho: v3(-0.4, 1.25, -1.0) },
    { p: 0.88, pos: v3(5.0, 2.8, 5.8), olho: v3(-0.3, 0.9, -0.5) },
    { p: 1.0, pos: v3(6.2, 3.9, 7.2), olho: v3(-0.2, 0.9, -0.3) },
  ];
  const camPos = v3(), camOlho = v3(), tmp = v3();
  function chaveCamera(p) {
    for (let i = 0; i < K.length - 1; i++) {
      const a = K[i], b = K[i + 1];
      if (p <= b.p || i === K.length - 2) {
        const t = suave2(clamp01((p - a.p) / (b.p - a.p)));
        camPos.lerpVectors(a.pos, b.pos, t);
        camOlho.lerpVectors(a.olho, b.olho, t);
        return;
      }
    }
  }

  // ---------- estado por progresso ----------
  const corHemiCeu = new THREE.Color(), corHemiChao = new THREE.Color(), corTmp = new THREE.Color();
  const FRIO_CEU = new THREE.Color(0xd6dde3), QUENTE_CEU = new THREE.Color(0xffe9d2);
  const FRIO_CHAO = new THREE.Color(0x5f5a54), QUENTE_CHAO = new THREE.Color(0x7a5f46);
  const LED_OFF = new THREE.Color(0x3a342c), LED_ON = new THREE.Color(0xffe2b0);
  const CEU_FRIO = new THREE.Color(0x8f969c), CEU_QUENTE = new THREE.Color(0xffe6cc);
  const mtx = new THREE.Matrix4(), qt = new THREE.Quaternion(), eul = new THREE.Euler(), escV = v3(1, 1, 1);

  function aplicar(p, tempo) {
    // 01 planta
    const desenha = faixa(p, 0.075, 0.17);
    const nP = Math.floor(desenha * totalPlanta / 2) * 2;
    geoPlanta.setDrawRange(0, nP);
    M.planta.opacity = (desenha > 0 ? 0.95 : 0) * (1 - faixa(p, 0.36, 0.44));
    planta.visible = M.planta.opacity > 0.01;
    M.demolir.opacity = faixa(p, 0.12, 0.16) * (1 - faixa(p, 0.2, 0.24));
    demolirLinhas.visible = M.demolir.opacity > 0.01;

    // 02 demolição
    const dem = faixa(p, 0.2, 0.275);
    blocos.visible = dem < 1;
    if (blocos.visible) {
      for (let i = 0; i < nBlocos; i++) {
        const b = blocoBase[i];
        const t = clamp01((dem - b.atraso) / 0.4);
        tmp.copy(b.p).addScaledVector(b.v, t);
        tmp.y = Math.max(BL.h * 0.3, b.p.y + b.v.y * t - 4.5 * t * t);
        eul.set(b.r.x * t, b.r.y * t, b.r.z * t);
        qt.setFromEuler(eul);
        const e = 1 - suave(clamp01((t - 0.55) / 0.45));
        escV.set(e, e, e);
        mtx.compose(tmp, qt, escV);
        blocos.setMatrixAt(i, mtx);
      }
      blocos.instanceMatrix.needsUpdate = true;
    }
    const ent = suave(faixa(p, 0.27, 0.33));
    entulho.visible = ent < 1;
    entulho.position.y = -ent * 0.25;
    entulho.scale.setScalar(1 - ent * 0.6);

    // conduítes
    const cresc = faixa(p, 0.235, 0.31);
    const apaga = faixa(p, 0.42, 0.47);
    conduites.forEach((c, k) => {
      const t = clamp01(cresc * 1.25 - k * 0.12);
      c.geometry.setDrawRange(0, Math.floor(t * c.userData.total / 3) * 3);
      c.visible = t > 0 && apaga < 1;
    });
    M.conduite.opacity = 1 - apaga;
    M.conduite.color.setRGB(1, 0.6 + 0.15 * Math.sin(tempo * 4), 0.28);

    // 03 frente de renovação (diagonal, do fundo à frente)
    const fr = faixa(p, 0.335, 0.445);
    const f = -3.0 + suave(fr) * 6.0;
    planoFin.constant = f; // mantém onde N·x < f
    const visFin = fr > 0;
    revFundo.visible = revEsq.visible = piso.visible = visFin;
    frente.visible = fr > 0 && fr < 1;
    frente.position.set(N.x * f, SH / 2, N.z * f);
    uFrente.uOp.value = Math.sin(fr * Math.PI);
    luzFrente.position.set(N.x * f, 1.3, N.z * f);
    luzFrente.intensity = Math.sin(fr * Math.PI) * 3;

    const fo = suave2(faixa(p, 0.42, 0.47));
    forro.visible = fo > 0;
    forro.position.y = (1 - fo) * 1.4;
    const led = suave(faixa(p, 0.46, 0.49));
    M.led.color.lerpColors(LED_OFF, LED_ON, led);
    luzForro.intensity = led * 5 + suave(faixa(p, 0.85, 0.95)) * 3;

    // 04 a 07: itens que entram
    for (const it of itens) {
      const t = faixa(p, it.a, it.b);
      const o = it.obj;
      o.visible = t > 0;
      if (!o.visible) continue;
      const e = suave2(t);
      o.position.copy(it.base);
      o.scale.copy(it.esc);
      switch (it.tipo) {
        case 'desce': o.position.y += (1 - e) * it.de; break;
        case 'sobe': o.position.y -= (1 - e) * it.de; break;
        case 'lado': o.position.x += (1 - e) * it.de; break;
        case 'frente': o.position.z += (1 - e) * it.de; break;
        case 'corre': o.position.x -= (1 - e) * it.de; break;
        case 'cresce': o.scale.y = Math.max(0.001, e); break;
        case 'estende': o.scale.z = Math.max(0.001, e); break;
        case 'escala': { const s = Math.max(0.001, saidaBack(t)); o.scale.multiplyScalar(s); break; }
      }
    }

    // 06 brilho no vidro e no espelho
    const br = faixa(p, 0.79, 0.83);
    brilho.visible = br > 0 && br < 1;
    M.brilho.opacity = Math.sin(br * Math.PI) * 0.55;
    brilho.position.set(JAN.x0 - 0.6 + br * 2.4, 1.5, -SZ + 0.03);

    // 07 luz quente, aroma
    const quente = suave(faixa(p, 0.83, 0.95));
    corHemiCeu.lerpColors(FRIO_CEU, QUENTE_CEU, quente);
    corHemiChao.lerpColors(FRIO_CHAO, QUENTE_CHAO, quente);
    hemi.color.copy(corHemiCeu);
    hemi.groundColor.copy(corHemiChao);
    hemi.intensity = 1.35 - quente * 0.25;
    sol.intensity = 1.6 - quente * 0.45;
    sol.color.copy(corTmp.setRGB(1, 1 - quente * 0.1, 1 - quente * 0.22));
    luzPendente.intensity = suave(faixa(p, 0.89, 0.93)) * 4;
    M.lampada.color.lerpColors(LED_OFF, LED_ON, faixa(p, 0.89, 0.93));
    M.ceu.color.lerpColors(CEU_FRIO, CEU_QUENTE, suave(faixa(p, 0.3, 0.95)));
    uPart.uWarm.value = suave(faixa(p, 0.4, 0.92));
    uPart.uRise.value = suave(faixa(p, 0.87, 0.97));
    uPart.uOp.value = 1 - faixa(p, 0.3, 0.42) * 0.5 + faixa(p, 0.85, 0.95) * 0.5;
  }

  // ---------- tamanho e enquadramento ----------
  let largura = 1, altura = 1, aspecto = 1;
  function redimensionar() {
    largura = canvas.clientWidth || window.innerWidth;
    altura = canvas.clientHeight || window.innerHeight;
    aspecto = largura / altura;
    renderer.setSize(largura, altura, false);
    camera.aspect = aspecto;
    camera.fov = aspecto < 1 ? 40 : 32;
    // texto à esquerda no desktop; embaixo no celular: o studio desloca pro espaço livre
    if (aspecto >= 1) camera.setViewOffset(largura, altura, -largura * 0.16, 0, largura, altura);
    else camera.setViewOffset(largura, altura, 0, altura * 0.17, largura, altura);
    camera.updateProjectionMatrix();
  }

  // ---------- loop ----------
  let alvoP = 0, p = 0, ativo = true, raf = 0, ultimo = performance.now(), tempo = 0;
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  // vigia de FPS: se o aparelho sofrer, baixa a resolução uma vez
  let quadros = 0, janelaFps = 0, rebaixado = false;

  function quadro(agora) {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.05, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!ativo) return;
    tempo += dt;

    p += (alvoP - p) * Math.min(1, dt * 6);
    if (Math.abs(alvoP - p) < 0.0003) p = alvoP;

    aplicar(p, tempo);
    uPart.uTime.value = tempo;
    uFrente.uTime.value = tempo;

    chaveCamera(p);
    if (aspecto < 1) {
      tmp.copy(camPos).sub(camOlho).multiplyScalar(1 + (1 / aspecto - 1) * 0.55);
      camPos.copy(camOlho).add(tmp);
    }
    mouse.sx += (mouse.x - mouse.sx) * Math.min(1, dt * 2.5);
    mouse.sy += (mouse.y - mouse.sy) * Math.min(1, dt * 2.5);
    camera.position.set(camPos.x + mouse.sx * 0.35, camPos.y - mouse.sy * 0.2, camPos.z - mouse.sx * 0.2);
    camera.lookAt(camOlho);
    renderer.render(cena, camera);

    if (!rebaixado) {
      quadros++; janelaFps += dt;
      if (janelaFps > 3) {
        if (quadros / janelaFps < 30 && pr > 1) {
          pr = 1;
          renderer.setPixelRatio(pr);
          uPart.uPR.value = pr;
          redimensionar();
          rebaixado = true;
        }
        quadros = 0; janelaFps = 0;
      }
    }
  }

  redimensionar();
  window.addEventListener('resize', redimensionar);
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  // compila tudo antes de mostrar: com todos os objetos visíveis, para que nenhum
  // shader seja compilado no meio da rolagem
  const todos = [];
  cena.traverse((o) => { todos.push([o, o.visible]); o.visible = true; });
  planoFin.constant = 10;
  chaveCamera(0);
  camera.position.copy(camPos);
  camera.lookAt(camOlho);
  await renderer.compileAsync(cena, camera).catch(() => renderer.compile(cena, camera));
  // quadro de aquecimento com tudo à mostra: sobe as texturas (com mipmaps) e compila
  // os shaders de sombra agora, durante o loader, e não quando o móvel aparecer
  Object.values(tx).forEach((t) => renderer.initTexture(t));
  renderer.render(cena, camera);
  todos.forEach(([o, v]) => { o.visible = v; });
  aplicar(0, 0);
  renderer.render(cena, camera);
  raf = requestAnimationFrame(quadro);

  return {
    set progresso(v) { alvoP = clamp01(v); },
    get progresso() { return p; },
    set ativo(v) { ativo = v; if (v) ultimo = performance.now(); },
    get ativo() { return ativo; },
    destruir() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
