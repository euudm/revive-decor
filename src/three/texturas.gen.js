// Geradores de textura procedural (rodam no Web Worker; fallback na thread principal).
// Cada um devolve um canvas 2D pintado pixel a pixel. Nada de imagem baixada.

function hash(x, y, s) {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const lisa = (t) => t * t * (3 - 2 * t);
// ruído de valor com repetição (tileable) no período p
function ruido(x, y, p, s) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = lisa(x - xi), fy = lisa(y - yi);
  const a = hash(((xi % p) + p) % p, ((yi % p) + p) % p, s);
  const b = hash((((xi + 1) % p) + p) % p, ((yi % p) + p) % p, s);
  const c = hash(((xi % p) + p) % p, (((yi + 1) % p) + p) % p, s);
  const d = hash((((xi + 1) % p) + p) % p, (((yi + 1) % p) + p) % p, s);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}
function fbm(x, y, p, s, oit = 4) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let o = 0; o < oit; o++) {
    v += ruido(x * f, y * f, p * f, s + o * 17) * amp;
    tot += amp; amp *= 0.5; f *= 2;
  }
  return v / tot;
}

function pintar(w, h, fn, criar) {
  const cv = criar(w, h);
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;
  const cor = [0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      fn(x, y, cor);
      const i = (y * w + x) * 4;
      d[i] = cor[0]; d[i + 1] = cor[1]; d[i + 2] = cor[2]; d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

const GERADORES = {
  // concreto aparente: manchas grandes + poros + marca de fôrma
  concreto(w, h, criar) {
    return pintar(w, h, (x, y, c) => {
      const u = x / w, v = y / h;
      const m = fbm(u * 6, v * 6, 6, 3, 5);
      const f = fbm(u * 40, v * 40, 40, 9, 2);
      let g = 150 + (m - 0.5) * 42 + (f - 0.5) * 16;
      if (hash(x, y, 5) > 0.9965) g -= 45; // poro
      if (y % (h / 4) < 1.5) g -= 8; // junta da fôrma
      c[0] = g * 1.0; c[1] = g * 0.99; c[2] = g * 0.96;
    }, criar);
  },
  // cal: branco quente quase liso
  cal(w, h, criar) {
    return pintar(w, h, (x, y, c) => {
      const u = x / w, v = y / h;
      const g = 236 + (fbm(u * 8, v * 8, 8, 4, 4) - 0.5) * 12;
      c[0] = g; c[1] = g - 4; c[2] = g - 11;
    }, criar);
  },
  // piso vinílico/madeira: réguas com tom próprio e veio
  piso(w, h, criar) {
    const reguas = 8;
    const alt = h / reguas;
    return pintar(w, h, (x, y, c) => {
      const r = Math.floor(y / alt);
      const desloc = hash(r, 1, 21) * w;
      const xr = (x + desloc) % w;
      const tabua = Math.floor(xr / (w / 2));
      const tom = hash(r, tabua, 31);
      const v = (y % alt) / alt;
      const veio = Math.sin((xr / w) * 60 + fbm(xr / w * 4, v * 2 + r, 4, 7, 3) * 9) * 0.5 + 0.5;
      let R = 168 + tom * 30 - veio * 22, G = 124 + tom * 22 - veio * 18, B = 84 + tom * 14 - veio * 12;
      const borda = (y % alt) < 1.6 || (xr % (w / 2)) < 1.6;
      if (borda) { R *= 0.62; G *= 0.6; B *= 0.58; }
      c[0] = R; c[1] = G; c[2] = B;
    }, criar);
  },
  // freijó: lâmina de madeira com veio vertical longo
  freijo(w, h, criar) {
    return pintar(w, h, (x, y, c) => {
      const u = x / w, v = y / h;
      const t = fbm(u * 3, v * 0.6, 3, 11, 3);
      const veio = Math.sin(u * 90 + t * 14) * 0.5 + 0.5;
      const fino = fbm(u * 120, v * 4, 120, 13, 2);
      const k = veio * 0.65 + fino * 0.35;
      c[0] = 176 - k * 46; c[1] = 128 - k * 38; c[2] = 86 - k * 30;
    }, criar);
  },
  // granito preto com cristais
  granito(w, h, criar) {
    return pintar(w, h, (x, y, c) => {
      const u = x / w, v = y / h;
      const m = fbm(u * 18, v * 18, 18, 41, 3);
      let g = 22 + m * 26;
      const cristal = hash(x >> 1, y >> 1, 43);
      if (cristal > 0.985) g += 120 * (cristal - 0.985) / 0.015;
      else if (cristal > 0.95) g += 18;
      c[0] = g; c[1] = g * 0.98; c[2] = g * 0.95;
    }, criar);
  },
};

export function gerarCanvas(tipo, w, h, criar) {
  return GERADORES[tipo](w, h, criar);
}
export const TIPOS = Object.keys(GERADORES);
