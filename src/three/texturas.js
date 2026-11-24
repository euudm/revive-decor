// Pede as texturas ao Web Worker (sem travar a rolagem). Se o navegador não tiver
// OffscreenCanvas, gera na thread principal em pedaços, no tempo ocioso.
import * as THREE from 'three';

const temOffscreen = typeof OffscreenCanvas !== 'undefined' && 'transferToImageBitmap' in OffscreenCanvas.prototype;

let worker = null;
let seq = 0;
const pendentes = new Map();
function pedirAoWorker(tipo, w, h) {
  if (!worker) {
    worker = new Worker(new URL('./texturas.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      pendentes.get(data.id)?.({ w: data.w, h: data.h, px: new Uint8Array(data.buf) });
      pendentes.delete(data.id);
    };
  }
  return new Promise((ok) => {
    const id = ++seq;
    pendentes.set(id, ok);
    worker.postMessage({ id, tipo, w, h });
  });
}

const ocioso = () => new Promise((ok) => (window.requestIdleCallback ? requestIdleCallback(ok, { timeout: 300 }) : setTimeout(ok, 16)));

async function fonte(tipo, w, h) {
  if (temOffscreen) {
    try { return await pedirAoWorker(tipo, w, h); } catch { /* cai no fallback */ }
  }
  await ocioso();
  const { gerarCanvas } = await import('./texturas.gen.js');
  return gerarCanvas(tipo, w, h, (a, b) => Object.assign(document.createElement('canvas'), { width: a, height: b }));
}

export async function texturas(lista, leve) {
  const k = leve ? 0.5 : 1;
  const res = await Promise.all(lista.map(async ([tipo, w, h]) => {
    const img = await fonte(tipo, Math.round(w * k), Math.round(h * k));
    const t = img.px ? new THREE.DataTexture(img.px, img.w, img.h, THREE.RGBAFormat) : new THREE.CanvasTexture(img);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = leve ? 2 : 6;
    t.flipY = false;
    t.needsUpdate = true;
    return [tipo, t];
  }));
  return Object.fromEntries(res);
}

export function encerrarWorker() {
  worker?.terminate();
  worker = null;
}
