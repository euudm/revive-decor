// Studios: a fachada de um prédio à noite. Cada janela acesa é um studio do PDF.
// Clicar numa janela abre o interior: as fotos daquele studio em profundidade,
// percorridas com a rolagem, o arrasto ou as setas. Só transform e opacity.
import { gsap } from 'gsap';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function grade() {
  const w = window.innerWidth;
  if (w <= 700) return { cols: 4, rows: 9 };
  if (w <= 1100) return { cols: 7, rows: 7 };
  return { cols: 9, rows: 6 };
}

// posições espalhadas e estáveis para as janelas acesas
function posicoesAcesas(total, n, cols) {
  const usadas = new Set();
  const lista = [];
  for (let i = 0; i < n; i++) {
    let idx = Math.floor(((i + 0.5) / n) * total);
    const col = idx % cols;
    const desvio = [0, 2, -1, 1, -2, 1, 0, -1, 2][i % 9];
    idx = idx - col + clamp(col + desvio, 0, cols - 1);
    while (usadas.has(idx)) idx = (idx + 1) % total;
    usadas.add(idx);
    lista.push(idx);
  }
  return lista;
}

const srcset = (f) => `/studios/${f.id}-p.webp ${f.pw}w${f.gw ? `, /studios/${f.id}-g.webp ${f.gw}w` : ''}`;

export function montarFachada({ studios, predio, lenis, onToggle }) {
  let acesas = [];
  let carregadas = false;

  function desenhar() {
    const { cols, rows } = grade();
    const total = cols * rows;
    const pos = posicoesAcesas(total, studios.length, cols);
    predio.style.setProperty('--cols', cols);
    const mapa = new Map(pos.map((p, i) => [p, i]));
    let html = '';
    for (let k = 0; k < total; k++) {
      if (mapa.has(k)) {
        const i = mapa.get(k);
        const s = studios[i];
        html += `<button type="button" class="jan acesa" data-i="${i}" data-bairro="${s.bairro}" aria-label="Entrar no ${s.nome}, ${s.bairro}">
          <span class="jan-dentro"><img alt="" decoding="async" data-src="/studios/${s.fotos[0].id}-m.webp" ${carregadas ? `src="/studios/${s.fotos[0].id}-m.webp"` : ''} /></span>
          <span class="jan-luz"></span><span class="jan-vidro"></span>
          <span class="jan-rot">${s.bairro}</span>
        </button>`;
      } else {
        html += `<span class="jan${(k * 7) % 11 === 3 ? ' jan-cortina' : ''}"><span class="jan-vidro"></span></span>`;
      }
    }
    predio.innerHTML = html;
    acesas = [...predio.querySelectorAll('.jan.acesa')];
    acesas.forEach((b) => b.addEventListener('click', () => abrir(Number(b.dataset.i), b)));
  }
  desenhar();
  let ultimaGrade = JSON.stringify(grade());
  window.addEventListener('resize', () => {
    const g = JSON.stringify(grade());
    if (g !== ultimaGrade) { ultimaGrade = g; desenhar(); if (acesoJa) predio.classList.add('ligado'); }
  });

  // miniaturas só baixam quando a fachada chega perto da tela
  new IntersectionObserver(([en], obs) => {
    if (!en.isIntersecting) return;
    carregadas = true;
    predio.querySelectorAll('img[data-src]').forEach((img) => { img.src = img.dataset.src; });
    obs.disconnect();
  }, { rootMargin: '600px' }).observe(predio);

  let acesoJa = false;
  function acender() {
    if (acesoJa) return;
    acesoJa = true;
    predio.classList.add('ligado');
    gsap.fromTo(predio.querySelectorAll('.jan.acesa .jan-luz, .jan.acesa .jan-dentro'),
      { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out', stagger: { each: 0.09, from: 'random' } });
  }

  function destacarBairro(bairro) {
    acesas.forEach((b) => b.classList.toggle('destaque', b.dataset.bairro === bairro));
    clearTimeout(destacarBairro.t);
    destacarBairro.t = setTimeout(() => acesas.forEach((b) => b.classList.remove('destaque')), 2200);
  }

  // ---------- interior ----------
  const box = $('#interior');
  const portal = $('.int-portal', box);
  const mundo = $('.int-mundo', box);
  const elBairro = $('.int-bairro', box), elNome = $('.int-nome', box), elCont = $('.int-cont', box);
  const btFechar = $('.int-fechar', box), btAnt = $('.int-ant', box), btProx = $('.int-prox', box), btOutro = $('.int-outro', box);
  const D = 1100;
  const OFFS = [[0, 0], [0.42, -0.08], [-0.42, 0.06], [0.38, 0.08], [-0.4, -0.07], [0.36, 0.04]];
  let figs = [], atual = 0, alvo = 0, raf = 0, aberto = false, studioAtual = 0, origem = null, ultimo = 0;

  function montarFotos(i) {
    const s = studios[i];
    studioAtual = i;
    elBairro.textContent = s.bairro;
    elNome.textContent = s.nome;
    mundo.innerHTML = s.fotos.map((f, k) => `<figure class="int-foto" style="z-index:${100 - k}">
        <img alt="${s.nome}, ${s.bairro}, foto ${k + 1}" srcset="${srcset(f)}" sizes="(max-width: 700px) 92vw, 70vw"
          src="/studios/${f.id}-p.webp" decoding="async" style="max-width:min(84vw, ${f.w}px);max-height:min(64vh, ${f.h}px);aspect-ratio:${f.w}/${f.h}" />
      </figure>`).join('');
    figs = [...mundo.children];
    atual = -0.9; alvo = 0;
    btOutro.hidden = true;
  }

  function quadro(agora) {
    const dt = Math.min(0.05, (agora - (ultimo || agora)) / 1000);
    ultimo = agora;
    atual += (alvo - atual) * Math.min(1, dt * 7);
    const W = window.innerWidth, H = window.innerHeight;
    figs.forEach((f, i) => {
      const rel = i - atual;
      const o = OFFS[i % OFFS.length];
      const k = clamp(rel, -1, 1);
      const x = o[0] * W * k;
      const y = o[1] * H * Math.abs(k);
      const z = -rel * D;
      // a foto atual inteira; as próximas aparecem ao fundo, mais apagadas
      let op = rel < 0 ? 1 + rel * 1.9 : 1 - Math.min(rel, 1) * 0.45 - Math.max(0, rel - 1.2) * 0.5;
      op = clamp(op, 0, 1);
      f.style.opacity = op;
      f.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      f.style.transform = `translate3d(${x}px, ${y}px, ${z}px)`;
    });
    const n = figs.length;
    const idx = clamp(Math.round(atual), 0, n - 1);
    elCont.textContent = `${String(idx + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
    btOutro.hidden = idx < n - 1;
    btAnt.disabled = idx <= 0;
    btProx.disabled = idx >= n - 1;
    if (Math.abs(alvo - atual) > 0.0005) raf = requestAnimationFrame(quadro);
    else raf = 0;
  }
  const mover = () => { if (!raf) { ultimo = 0; raf = requestAnimationFrame(quadro); } };
  let snapT = 0;
  const ir = (v, snap = true) => {
    alvo = clamp(v, -0.15, figs.length - 1 + 0.15);
    clearTimeout(snapT);
    if (snap) snapT = setTimeout(() => { alvo = clamp(Math.round(alvo), 0, figs.length - 1); mover(); }, 160);
    mover();
  };

  function abrir(i, de) {
    if (aberto) return;
    aberto = true;
    origem = de;
    montarFotos(i);
    lenis?.stop();
    document.documentElement.classList.add('travado');
    box.setAttribute('aria-hidden', 'false');
    box.classList.add('aberto');
    onToggle?.(true);
    const r = de.getBoundingClientRect();
    gsap.set(['.int-tunel', '.int-topo', '.int-rodape', '.int-dica'], { opacity: 0 });
    gsap.timeline()
      .fromTo(portal, { x: r.left, y: r.top, scaleX: r.width / window.innerWidth, scaleY: r.height / window.innerHeight, opacity: 1 },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.85, ease: 'expo.inOut' })
      .to('.int-tunel', { opacity: 1, duration: 0.5 }, 0.55)
      .add(() => { mover(); }, 0.55)
      .to(['.int-topo', '.int-rodape', '.int-dica'], { opacity: 1, duration: 0.5, stagger: 0.06 }, 0.75);
    setTimeout(() => btFechar.focus({ preventScroll: true }), 60);
  }

  function fechar() {
    if (!aberto) return;
    aberto = false;
    const r = origem?.getBoundingClientRect();
    gsap.timeline({
      onComplete: () => {
        box.classList.remove('aberto');
        box.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('travado');
        mundo.innerHTML = '';
        figs = [];
        lenis?.start();
        onToggle?.(false);
        origem?.focus({ preventScroll: true });
      },
    })
      .to(['.int-tunel', '.int-topo', '.int-rodape', '.int-dica'], { opacity: 0, duration: 0.3 })
      .to(portal, r ? { x: r.left, y: r.top, scaleX: r.width / window.innerWidth, scaleY: r.height / window.innerHeight, duration: 0.7, ease: 'expo.inOut' } : { opacity: 0, duration: 0.4 }, 0.15)
      .to(portal, { opacity: 0, duration: 0.25 }, '>-0.1');
  }

  function outroStudio() {
    const prox = (studioAtual + 1) % studios.length;
    origem = acesas.find((b) => Number(b.dataset.i) === prox) || origem;
    gsap.to('.int-tunel', {
      opacity: 0, duration: 0.3,
      onComplete: () => { montarFotos(prox); mover(); gsap.to('.int-tunel', { opacity: 1, duration: 0.4 }); },
    });
  }

  btFechar.addEventListener('click', fechar);
  btAnt.addEventListener('click', () => ir(Math.round(atual) - 1, false));
  btProx.addEventListener('click', () => ir(Math.round(atual) + 1, false));
  btOutro.addEventListener('click', outroStudio);
  box.addEventListener('wheel', (e) => { if (!aberto) return; e.preventDefault(); ir(alvo + e.deltaY * 0.0016); }, { passive: false });
  let toqueY = null, toqueX = null, alvo0 = 0;
  box.addEventListener('touchstart', (e) => { if (e.target.closest('button')) return; toqueY = e.touches[0].clientY; toqueX = e.touches[0].clientX; alvo0 = alvo; }, { passive: true });
  box.addEventListener('touchmove', (e) => {
    if (toqueY === null) return;
    e.preventDefault();
    const dy = toqueY - e.touches[0].clientY, dx = toqueX - e.touches[0].clientX;
    const d = Math.abs(dy) > Math.abs(dx) ? dy : dx;
    alvo = clamp(alvo0 + d / 240, -0.3, figs.length - 0.7);
    mover();
  }, { passive: false });
  box.addEventListener('touchend', () => {
    if (toqueY === null) return;
    toqueY = null;
    const base = Math.round(alvo0);
    const d = alvo - alvo0;
    ir(base + (d > 0.15 ? 1 : d < -0.15 ? -1 : 0), false);
  });
  window.addEventListener('keydown', (e) => {
    if (!aberto) return;
    if (e.key === 'Escape') fechar();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); ir(Math.round(atual) + 1, false); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); ir(Math.round(atual) - 1, false); }
  });

  return { acender, destacarBairro, abrir: (i) => abrir(i, acesas.find((b) => Number(b.dataset.i) === i)) };
}
