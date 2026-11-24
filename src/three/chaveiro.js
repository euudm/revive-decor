// Contato: chaveiro com a tag "rd" pendurado num gancho. Balança com física simples
// de pêndulo duplo; o mouse empurra, o toque dá um peteleco, a rolagem chacoalha.
// Luz direta + Phong no metal (sem mapa de ambiente: nada de PMREM).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

function texturaTag(img) {
  const c = Object.assign(document.createElement('canvas'), { width: 512, height: 704 });
  const g = c.getContext('2d');
  g.fillStyle = '#a5825c';
  g.fillRect(0, 0, 512, 704);
  // poros do couro
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(${Math.random() > 0.5 ? '60,40,24' : '210,180,140'},${Math.random() * 0.08})`;
    g.fillRect(Math.random() * 512, Math.random() * 704, 2, 2);
  }
  // pesponto
  g.strokeStyle = 'rgba(240,222,190,0.55)';
  g.setLineDash([14, 10]);
  g.lineWidth = 4;
  g.strokeRect(30, 30, 452, 644);
  g.setLineDash([]);
  // monograma gravado (tingido de marrom escuro)
  if (img) {
    const t = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height });
    const tg = t.getContext('2d');
    tg.drawImage(img, 0, 0);
    tg.globalCompositeOperation = 'source-in';
    tg.fillStyle = '#4a3220';
    tg.fillRect(0, 0, t.width, t.height);
    const lado = 270;
    g.globalAlpha = 0.9;
    g.drawImage(t, 256 - lado / 2, 380 - lado / 2, lado, lado);
    g.globalAlpha = 1;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function formaChave() {
  const arco = new THREE.Shape();
  arco.absarc(0, 0, 0.15, 0, Math.PI * 2, false);
  const furo = new THREE.Path();
  furo.absarc(0, 0.02, 0.055, 0, Math.PI * 2, true);
  arco.holes.push(furo);
  const haste = new THREE.Shape();
  const w = 0.036;
  haste.moveTo(-w, -0.1);
  haste.lineTo(-w, -0.68);
  haste.lineTo(0, -0.72);
  haste.lineTo(w, -0.68);
  haste.lineTo(w, -0.6); haste.lineTo(w + 0.05, -0.6); haste.lineTo(w + 0.05, -0.55); haste.lineTo(w, -0.55);
  haste.lineTo(w, -0.5); haste.lineTo(w + 0.07, -0.48); haste.lineTo(w + 0.07, -0.42); haste.lineTo(w, -0.42);
  haste.lineTo(w, -0.36); haste.lineTo(w + 0.04, -0.36); haste.lineTo(w + 0.04, -0.31); haste.lineTo(w, -0.31);
  haste.lineTo(w, -0.1);
  haste.lineTo(-w, -0.1);
  const g = new THREE.ExtrudeGeometry([arco, haste], { depth: 0.022, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 28 });
  g.translate(0, 0, -0.011);
  return g;
}

// cede a vez ao navegador entre as etapas pesadas (nada de uma tarefa longa só)
const ceder = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(() => ok(), { timeout: 250 }) : setTimeout(ok, 30)));

export async function criarChaveiro(canvas, { leve = false } = {}) {
  await ceder();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  await ceder();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, leve ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.setClearColor(0, 0);

  const cena = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 30);
  camera.position.set(0, -0.55, 5.2);
  camera.lookAt(0, -0.75, 0);

  cena.add(new THREE.HemisphereLight(0xfff4e6, 0x6b5a48, 1.1));
  const chave = new THREE.DirectionalLight(0xffffff, 2.4);
  chave.position.set(-2, 3, 4);
  cena.add(chave);
  const quente = new THREE.PointLight(0xffb36b, 6, 8, 1.5);
  quente.position.set(1.8, -0.4, 2.2);
  cena.add(quente);

  const latao = new THREE.MeshPhongMaterial({ color: 0xb8945c, specular: 0xffe9c2, shininess: 90 });
  const latao2 = new THREE.MeshPhongMaterial({ color: 0x8f7650, specular: 0xffe0b0, shininess: 70 });
  const matTag = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78 });

  // gancho
  const gancho = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 16), latao2);
  gancho.rotation.x = Math.PI / 2;
  gancho.position.set(0, 0.05, -0.1);
  cena.add(gancho);

  // pivô 1: argola
  const piv1 = new THREE.Group();
  cena.add(piv1);
  const R = 0.3;
  const argola = new THREE.Mesh(new THREE.TorusGeometry(R, 0.022, 14, 64), latao);
  argola.position.y = -R + 0.02;
  argola.rotation.y = 0.35;
  piv1.add(argola);

  // pivô 2: chave e tag penduradas na base da argola
  const piv2 = new THREE.Group();
  piv2.position.y = -2 * R + 0.04;
  piv1.add(piv2);

  await ceder();
  const chaveM = new THREE.Mesh(formaChave(), latao);
  chaveM.position.set(-0.12, -0.12, 0.05);
  chaveM.rotation.z = 0.32;
  piv2.add(chaveM);

  const tag = new THREE.Group();
  const corpoTag = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.86, 0.045, 4, 0.06), [matTag, matTag, matTag, matTag, matTag, matTag]);
  corpoTag.position.y = -0.56;
  tag.add(corpoTag);
  const ilhos = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.016, 10, 28), latao);
  ilhos.position.set(0, -0.2, 0.03);
  tag.add(ilhos);
  const elo = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 10, 28), latao);
  elo.position.set(0, -0.12, 0);
  elo.rotation.y = Math.PI / 2;
  tag.add(elo);
  tag.position.set(0.1, 0.02, 0.0);
  piv2.add(tag);

  // a textura do couro já nasce com o monograma (o mesmo shader do começo ao fim)
  const img = new Image();
  img.src = '/marca/monograma.png';
  await img.decode().catch(() => {});
  await ceder();
  matTag.map = texturaTag(img.naturalWidth ? img : null);
  await ceder();

  // ---------- física ----------
  const s1 = { ax: 0, az: 0, vx: 0, vz: 0 };
  const s2 = { ax: 0, az: 0, vx: 0, vz: 0 };
  function passo(dt) {
    const k1 = 14, c1 = 1.6, k2 = 22, c2 = 2.2;
    const a1x = -k1 * s1.ax - c1 * s1.vx, a1z = -k1 * s1.az - c1 * s1.vz;
    s1.vx += a1x * dt; s1.vz += a1z * dt;
    s1.ax += s1.vx * dt; s1.az += s1.vz * dt;
    // o segundo pêndulo reage à aceleração do primeiro
    const a2x = -k2 * s2.ax - c2 * s2.vx - a1x * 0.9, a2z = -k2 * s2.az - c2 * s2.vz - a1z * 0.9;
    s2.vx += a2x * dt; s2.vz += a2z * dt;
    s2.ax += s2.vx * dt; s2.az += s2.vz * dt;
  }
  function empurrar(fx, fz = 0) {
    s1.vz += fx; s1.vx += fz;
  }

  // ---------- interação ----------
  let ultimoX = null, ultimoT = 0;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const agora = performance.now();
    if (ultimoX !== null) {
      const v = (e.clientX - ultimoX) / Math.max(8, agora - ultimoT);
      empurrar(-v * 1.1, (Math.random() - 0.5) * Math.abs(v) * 0.6);
    }
    ultimoX = e.clientX; ultimoT = agora;
  });
  canvas.addEventListener('pointerleave', () => { ultimoX = null; });
  // toque: só no click (encostar o dedo para rolar não pode disparar)
  canvas.addEventListener('click', (e) => {
    const r = canvas.getBoundingClientRect();
    const lado = (e.clientX - r.left) / r.width - 0.5;
    empurrar(-Math.sign(lado || 1) * 2.4, (Math.random() - 0.5) * 1.4);
  });

  // ---------- loop ----------
  let ativo = false, raf = 0, ultimo = performance.now(), tempo = 0;
  function redimensionar() {
    const w = canvas.clientWidth || 300, h = canvas.clientHeight || 300;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  function quadro(agora) {
    raf = requestAnimationFrame(quadro);
    const dt = Math.min(0.033, (agora - ultimo) / 1000);
    ultimo = agora;
    if (!ativo) return;
    tempo += dt;
    // brisa leve quando parado
    s1.vz += Math.sin(tempo * 0.9) * 0.012;
    passo(dt / 2); passo(dt / 2);
    piv1.rotation.set(s1.ax, Math.sin(tempo * 0.4) * 0.12, s1.az);
    piv2.rotation.set(s2.ax * 1.2, Math.sin(tempo * 0.6 + 1) * 0.25 + s2.az * 0.6, s2.az);
    renderer.render(cena, camera);
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);
  await renderer.compileAsync(cena, camera).catch(() => renderer.compile(cena, camera));
  await ceder();
  renderer.initTexture(matTag.map);
  // primeiro quadro já desenhado no loader: o primeiro "present" do canvas não cai na rolagem
  renderer.render(cena, camera);
  raf = requestAnimationFrame(quadro);

  return {
    set ativo(v) { ativo = v; if (v) ultimo = performance.now(); },
    empurrar,
    destruir() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
