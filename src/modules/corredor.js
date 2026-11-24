// Studios: um corredor de prédio em CSS 3D. A rolagem anda pelo corredor; em cada
// porta a câmera vira, a porta abre para dentro e a câmera entra até o studio
// ocupar a tela. Depois volta e segue. Fotos reais em <img>, nítidas, baixadas
// só quando a porta está perto. Por quadro muda só transform (e opacidade em 2D).
import { gsap } from 'gsap';

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const faixa = (p, a, b) => clamp01((p - a) / (b - a));
const suave = (t) => t * t * (3 - 2 * t);
const suave2 = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

// mundo em px
const P = 600; // distância do olho (perspectiva)
const W = 450; // meia largura do corredor
const PISO = 380, TETO = -320, ALT = PISO - TETO;
const L = 900; // comprimento de cada trecho (um por porta)
const PL = 400, PA = 600; // porta: largura e altura
const R = 460; // profundidade do studio atrás da porta
const FOTO_A = 680; // altura da foto dentro do studio
const zc = (b) => -(400 + b * L);
const lado = (i) => (i % 2 === 0 ? -1 : 1);

export function montarCorredor({ studios, secao, interior, toque }) {
  const N = studios.length;
  const cena = secao.querySelector('.cor-cena');
  const escala = secao.querySelector('.cor-escala');
  const mundo = secao.querySelector('.cor-mundo');
  const intro = secao.querySelector('.cor-intro');
  const veu = secao.querySelector('.cor-veu');
  const fim = secao.querySelector('.cor-fim');
  const info = secao.querySelector('.cor-info');
  const elNum = info.querySelector('.cor-num'), elBairro = info.querySelector('.cor-bairro'), elNome = info.querySelector('.cor-nome');
  const btVer = info.querySelector('.cor-ver');
  const marcas = secao.querySelector('.cor-marcas');

  // ---------- construção ----------
  const trechos = new Map(); // bay -> elementos
  const portas = [], fotos = [];
  function el(cls, w, h, tr, bay, html = '', tag = 'div') {
    const e = document.createElement(tag);
    e.className = `cor-el ${cls}`;
    e.style.width = `${w}px`;
    e.style.height = `${h}px`;
    e.style.transform = `${tr} translate(-50%, -50%)`;
    if (html) e.innerHTML = html;
    mundo.appendChild(e);
    if (!trechos.has(bay)) trechos.set(bay, []);
    trechos.get(bay).push(e);
    return e;
  }
  const yParede = (PISO + TETO) / 2;
  const rotLado = (s) => `rotateY(${s < 0 ? 90 : -90}deg)`;

  for (let b = -1; b <= N; b++) {
    const z = zc(b);
    el('cor-piso', W * 2, L, `translate3d(0, ${PISO}px, ${z}px) rotateX(90deg)`, b);
    el('cor-teto', W * 2, L, `translate3d(0, ${TETO}px, ${z}px) rotateX(-90deg)`, b);
    const temPorta = b >= 0 && b < N;
    for (const s of [-1, 1]) {
      const x = s * W;
      if (temPorta && s === lado(b)) {
        const lp = (L - PL) / 2;
        el('cor-parede', lp, ALT, `translate3d(${x}px, ${yParede}px, ${z + (L + PL) / 4}px) ${rotLado(s)}`, b);
        el('cor-parede', lp, ALT, `translate3d(${x}px, ${yParede}px, ${z - (L + PL) / 4}px) ${rotLado(s)}`, b);
        const hBand = PA - ALT;
        el('cor-parede cor-bandeira', PL, -hBand, `translate3d(${x}px, ${TETO + -hBand / 2}px, ${z}px) ${rotLado(s)}`, b);
      } else {
        el(`cor-parede${b === N ? '' : ' cor-arandela'}`, L, ALT, `translate3d(${x}px, ${yParede}px, ${z}px) ${rotLado(s)}`, b);
      }
    }
    if (temPorta) {
      const s = lado(b), st = studios[b];
      const yP = PISO - PA / 2;
      // studio atrás da porta: fundo escuro + foto real
      el('cor-fundo', 1900, 1100, `translate3d(${s * (W + R + 6)}px, ${yP}px, ${z}px) ${rotLado(s)}`, b);
      const f = st.fotos[0];
      const fw = Math.round(FOTO_A * f.w / f.h);
      const foto = el('cor-foto', fw, FOTO_A, `translate3d(${s * (W + R)}px, ${yP - 20}px, ${z}px) ${rotLado(s)}`, b,
        `<img alt="${st.nome}, ${st.bairro}" decoding="async" data-src="/studios/${f.id}-${f.gw ? 'g' : 'p'}.webp" />`, 'button');
      foto.type = 'button';
      foto.setAttribute('aria-label', `Ver as fotos do ${st.nome}, ${st.bairro}`);
      foto.addEventListener('click', () => interior.abrir(b, foto));
      fotos.push(foto);
      // porta com batente, folha de freijó, número e bairro
      const porta = el('cor-porta', PL, PA, `translate3d(${s * (W - 1)}px, ${yP}px, ${z}px) ${rotLado(s)}`, b,
        `<span class="cor-batente"></span>
         <span class="cor-folha"><i class="cor-placa">${String(b + 1).padStart(2, '0')}</i><i class="cor-macaneta"></i><i class="cor-placa-bairro">${st.bairro}</i></span>`);
      portas.push({ porta, folha: porta.querySelector('.cor-folha'), aberta: -1 });
    }
  }
  // parede do fim com janela
  el('cor-fim-parede', W * 2, ALT, `translate3d(0, ${yParede}px, ${zc(N) - L / 2}px)`, N, '<span class="cor-janela"></span>');

  marcas.innerHTML = studios.map((s, i) => `<i title="${s.bairro}">${String(i + 1).padStart(2, '0')}</i>`).join('');
  const marcasEls = [...marcas.children];

  // ---------- trecho visível, neblina e carregamento das fotos ----------
  let trechoAtual = null;
  function atualizarTrechos(i) {
    if (i === trechoAtual) return;
    trechoAtual = i;
    trechos.forEach((lista, b) => {
      const d = b - i;
      const vis = d >= -1 && d <= 3;
      const nevoa = d <= 1 ? 0 : d - 1; // 0, 1, 2
      lista.forEach((e) => {
        e.style.visibility = vis ? 'visible' : 'hidden';
        e.dataset.n = vis ? nevoa : 0;
      });
    });
    // fotos: só as portas próximas
    for (let k = Math.max(0, i - 1); k <= Math.min(N - 1, i + 2); k++) {
      const img = fotos[k].querySelector('img');
      if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
    }
    marcasEls.forEach((m, k) => { m.classList.toggle('feita', k < i); m.classList.toggle('atual', k === i); });
    if (i >= 0 && i < N) {
      const st = studios[i];
      elNum.textContent = String(i + 1).padStart(2, '0');
      elBairro.textContent = st.bairro;
      elNome.textContent = st.nome;
      btVer.textContent = `Ver as ${st.fotos.length} fotos`;
    }
  }

  // ---------- câmera ----------
  const paradas = (i) => (i < 0 ? zc(-1) + 150 : i >= N ? zc(N) - L / 2 + 700 : zc(i));
  let alvoT = -0.6, t = -0.6, ativo = false, k = 1;
  const mouse = { x: 0, sx: 0 };
  function redimensionar() {
    k = Math.min(1.25, Math.max(0.55, Math.min(window.innerHeight / 820, Math.max(window.innerWidth / 1150, 0.6))));
    cena.style.perspective = `${P * k}px`;
    escala.style.transform = `scale3d(${k}, ${k}, ${k})`;
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);
  if (!toque) window.addEventListener('pointermove', (e) => { mouse.x = (e.clientX / window.innerWidth) * 2 - 1; }, { passive: true });

  let infoVis = false;
  function render() {
    const i = Math.floor(t), u = t - i;
    let cz, cx = 0, yaw = 0, anda = 0;
    let infoOp = 0;
    if (i < 0) {
      cz = paradas(-1);
    } else if (i >= N) {
      const e = suave2(faixa(u, 0, 0.7));
      cz = lerp(paradas(N - 1), paradas(N), e);
      anda = Math.sin(e * Math.PI);
    } else {
      const s = lado(i);
      const e = suave2(faixa(u, 0, 0.28));
      cz = lerp(paradas(i - 1), paradas(i), e);
      anda = Math.sin(e * Math.PI);
      const vira = suave2(faixa(u, 0.28, 0.42)) * (1 - suave2(faixa(u, 0.86, 1)));
      yaw = s * 90 * vira;
      const entra = suave2(faixa(u, 0.5, 0.62)) * (1 - suave2(faixa(u, 0.8, 0.9)));
      cx = s * (W - 150) * entra;
      infoOp = faixa(u, 0.58, 0.64) * (1 - faixa(u, 0.82, 0.87));
    }
    atualizarTrechos(Math.max(-1, Math.min(N, i)));

    // portas: abertas atrás, fechadas à frente
    portas.forEach((pt, j) => {
      if (Math.abs(j - i) > 1 && pt.aberta === (j < i ? 1 : 0)) return;
      const a = j < i ? 1 : j > i ? 0 : suave(faixa(u, 0.36, 0.52));
      if (Math.abs(a - pt.aberta) < 0.001) return;
      pt.aberta = a;
      pt.folha.style.transform = `rotateY(${a * 105}deg)`;
    });

    mouse.sx += (mouse.x - mouse.sx) * 0.06;
    const bob = Math.sin(cz * 0.018) * 5 * anda;
    mundo.style.transform = `translate3d(0, ${bob}px, ${P}px) rotateY(${yaw + mouse.sx * 3}deg) translate3d(${-cx}px, 0, ${-cz}px)`;

    intro.style.opacity = 1 - faixa(t, -0.35, -0.05);
    intro.style.visibility = t > -0.05 ? 'hidden' : 'visible';
    const fimOp = faixa(t, N + 0.15, N + 0.4);
    fim.style.opacity = fimOp;
    fim.style.visibility = fimOp < 0.01 ? 'hidden' : 'visible';
    veu.style.opacity = Math.max(1 - faixa(t, -0.35, -0.05), fimOp);
    info.style.opacity = infoOp;
    const vis = infoOp > 0.3;
    if (vis !== infoVis) { infoVis = vis; info.classList.toggle('on', vis); }
    info.style.transform = `translate3d(0, ${(1 - infoOp) * 24}px, 0)`;
  }

  const st = { ultimo: -9 };
  gsap.ticker.add(() => {
    if (!ativo) return;
    t += (alvoT - t) * 0.14;
    if (Math.abs(alvoT - t) < 0.0004) t = alvoT;
    if (Math.abs(t - st.ultimo) < 0.0002 && Math.abs(mouse.x - mouse.sx) < 0.002) return;
    st.ultimo = t;
    render();
  });
  render();

  btVer.addEventListener('click', () => {
    const i = Math.floor(t);
    if (i >= 0 && i < N) interior.abrir(i, fotos[i]);
  });

  return {
    set progresso(s) { alvoT = -0.6 + s * (N + 1.0); },
    set ativo(v) { ativo = v; },
    // posição de rolagem (0..1) em que o studio i está aberto na tela
    progressoDe: (i) => (i + 0.7 + 0.6) / (N + 1.0),
  };
}
