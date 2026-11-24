// Interior de um studio: as fotos em profundidade, percorridas com a rolagem,
// o arrasto ou as setas. Abre "de dentro" do elemento clicado. Só transform e opacity.
import { gsap } from 'gsap';

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const srcset = (f) => `/studios/${f.id}-p.webp ${f.pw}w${f.gw ? `, /studios/${f.id}-g.webp ${f.gw}w` : ''}`;

export function montarInterior({ studios, lenis, onToggle }) {
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
      // a foto atual inteira; as próximas aparecem ao fundo, mais apagadas
      let op = rel < 0 ? 1 + rel * 1.9 : 1 - Math.min(rel, 1) * 0.45 - Math.max(0, rel - 1.2) * 0.5;
      op = clamp(op, 0, 1);
      f.style.opacity = op;
      f.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      f.style.transform = `translate3d(${o[0] * W * k}px, ${o[1] * H * Math.abs(k)}px, ${-rel * D}px)`;
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

  const retDe = (el) => {
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 2) return { left: window.innerWidth * 0.3, top: window.innerHeight * 0.2, width: window.innerWidth * 0.4, height: window.innerHeight * 0.6 };
    return r;
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
    const r = retDe(de);
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
    const r = retDe(origem);
    gsap.timeline({
      onComplete: () => {
        box.classList.remove('aberto');
        box.setAttribute('aria-hidden', 'true');
        document.documentElement.classList.remove('travado');
        mundo.innerHTML = '';
        figs = [];
        lenis?.start();
        onToggle?.(false);
        origem?.focus?.({ preventScroll: true });
      },
    })
      .to(['.int-tunel', '.int-topo', '.int-rodape', '.int-dica'], { opacity: 0, duration: 0.3 })
      .to(portal, { x: r.left, y: r.top, scaleX: r.width / window.innerWidth, scaleY: r.height / window.innerHeight, duration: 0.7, ease: 'expo.inOut' }, 0.15)
      .to(portal, { opacity: 0, duration: 0.25 }, '>-0.1');
  }

  function outroStudio() {
    const prox = (studioAtual + 1) % studios.length;
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
    const d = alvo - alvo0;
    ir(Math.round(alvo0) + (d > 0.15 ? 1 : d < -0.15 ? -1 : 0), false);
  });
  window.addEventListener('keydown', (e) => {
    if (!aberto) return;
    if (e.key === 'Escape') fechar();
    else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); ir(Math.round(atual) + 1, false); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); ir(Math.round(atual) - 1, false); }
  });

  return { abrir, get aberto() { return aberto; } };
}
