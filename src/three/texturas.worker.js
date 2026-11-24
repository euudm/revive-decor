import { gerarCanvas } from './texturas.gen.js';

// Devolve os pixels crus (ArrayBuffer transferido, sem cópia). ImageBitmap vindo de
// OffscreenCanvas falha no upload em alguns drivers; buffer de pixels funciona em todos.
self.onmessage = ({ data }) => {
  const { id, tipo, w, h } = data;
  const cv = gerarCanvas(tipo, w, h, (a, b) => new OffscreenCanvas(a, b));
  const px = cv.getContext('2d').getImageData(0, 0, w, h).data;
  self.postMessage({ id, w, h, buf: px.buffer }, [px.buffer]);
};
