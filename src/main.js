import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import studios from './data/studios.json';
import { montarInterior } from './modules/interior.js';
import { montarRevividos } from './modules/revividos.js';

gsap.registerPlugin(ScrollTrigger);
// no celular a barra de endereço muda a altura da tela ao rolar: não recalcular por isso
ScrollTrigger.config({ ignoreMobileResize: true });
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

// Número do PDF: "(11) 9 97555-0461" tem um dígito a mais; este é o único formato que abre no WhatsApp.
const WHATS = '5511997550461';
const MSG = 'Olá! Vim pelo site da revivè decor e quero conversar sobre a minha reforma.';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const faixa = (p, a, b) => clamp01((p - a) / (b - a));

const mmMobile = window.matchMedia('(max-width: 900px)');
const toque = window.matchMedia('(pointer: coarse)').matches;
const reduzido = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const leve = mmMobile.matches || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;

$$('.js-whats').forEach((a) => { a.href = `https://wa.me/${WHATS}?text=${encodeURIComponent(MSG)}`; });

// ---------- rolagem suave (só desktop com mouse) ----------
let lenis = null;
if (!toque && !reduzido) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
const rolarPara = (y) => {
  if (lenis) lenis.scrollTo(y, { duration: 1.6 });
  else window.scrollTo({ top: typeof y === 'number' ? y : y.getBoundingClientRect().top + window.scrollY, behavior: reduzido ? 'auto' : 'smooth' });
};
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const alvo = $(a.getAttribute('href'));
  if (!alvo) return;
  e.preventDefault();
  rolarPara(alvo.id === 'inicio' ? 0 : alvo);
}));

// ---------- WebGL disponível? ----------
function temWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}
const comGL = temWebGL() && !new URLSearchParams(location.search).has('lite');
const semGL = () => document.body.classList.add('sem-webgl');
if (!comGL) semGL();

// ---------- cena do hero (Three.js só chega por import dinâmico) ----------
let cena = null;
const cenaPronta = comGL
  ? import('./three/studio.js')
    .then(({ criarStudio }) => criarStudio($('#cena'), { leve }))
    .then((c) => { cena = c; })
    .catch((err) => { console.warn('[revive] 3D indisponível', err); semGL(); })
  : Promise.resolve();

// ---------- loader ----------
const loader = $('#loader');
gsap.set('.titulo-hero .linha > span', { yPercent: 110 });
gsap.set(['.batida-intro .eyebrow', '.hero-sub', '.rolar', '.topo'], { opacity: 0, y: 18 });
const revelaLogo = gsap.timeline()
  .to('.ld-mascara', { xPercent: 100, duration: 1.5, ease: 'power2.inOut' }, 0.2)
  .to('.ld-mascara-in', { xPercent: -100, duration: 1.5, ease: 'power2.inOut' }, 0.2);

// O chaveiro (segundo contexto WebGL) nasce durante o loader: criá-lo no meio da
// rolagem travava a página por mais de um segundo.
let chaveiro = null;
const chaveiroPronto = comGL
  ? cenaPronta.then(() => import('./three/chaveiro.js'))
    .then(({ criarChaveiro }) => criarChaveiro(document.querySelector('#chave-canvas'), { leve }))
    .then((c) => { chaveiro = c; })
    .catch((err) => { console.warn('[revive] chaveiro indisponível', err); })
  : Promise.resolve();

Promise.all([
  Promise.race([document.fonts.ready, new Promise((ok) => setTimeout(ok, 3000))]),
  cenaPronta,
  Promise.race([chaveiroPronto, new Promise((ok) => setTimeout(ok, 2500))]),
  new Promise((ok) => setTimeout(ok, 1500)),
]).then(() => revelaLogo.then()).then(abrir);
setTimeout(abrir, 9000);

let aberto = false;
function abrir() {
  if (aberto) return;
  aberto = true;
  revelaLogo.progress(1);
  const tl = gsap.timeline({ onComplete: () => { loader.remove(); lenis?.start(); ScrollTrigger.refresh(); } });
  tl.to('.ld-txt', { opacity: 0, duration: 0.3 }, 0)
    .to('.ld-logo', { scale: 0.92, opacity: 0, duration: 0.6, ease: 'power2.in' }, 0.1)
    .to(loader, { opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.45)
    .to('.titulo-hero .linha > span', { yPercent: 0, duration: 1.3, ease: 'expo.out', stagger: 0.12 }, 0.6)
    .to(['.batida-intro .eyebrow', '.hero-sub', '.rolar', '.topo'], { opacity: 1, y: 0, duration: 1, ease: 'power3.out', stagger: 0.08 }, 0.85);
}

// ---------- hero: progresso da rolagem ----------
let pScroll = 0;
ScrollTrigger.create({
  trigger: '.revive', start: 'top top', end: 'bottom bottom',
  onUpdate: (s) => { pScroll = s.progress; if (cena) cena.progresso = s.progress; },
});
new IntersectionObserver(([en]) => { if (cena) cena.ativo = en.isIntersecting; }).observe($('.revive'));
cenaPronta.then(() => { if (cena) cena.progresso = pScroll; });

const batidas = [
  { el: $('.batida-intro'), i: [-1, 0], o: [0.03, 0.06], intro: true },
  { el: $('[data-etapa="1"]'), i: [0.075, 0.095], o: [0.185, 0.2] },
  { el: $('[data-etapa="2"]'), i: [0.21, 0.23], o: [0.315, 0.33] },
  { el: $('[data-etapa="3"]'), i: [0.345, 0.365], o: [0.465, 0.48] },
  { el: $('[data-etapa="4"]'), i: [0.49, 0.51], o: [0.625, 0.64] },
  { el: $('[data-etapa="5"]'), i: [0.65, 0.665], o: [0.72, 0.733] },
  { el: $('[data-etapa="6"]'), i: [0.742, 0.757], o: [0.81, 0.823] },
  { el: $('[data-etapa="7"]'), i: [0.832, 0.847], o: [0.91, 0.925] },
  { el: $('.batida-fim'), i: [0.935, 0.955], o: [2, 3] },
];
const ETAPAS = [
  [0.07, 'projeto'], [0.2, 'demolição e elétrica'], [0.335, 'pisos, forros e iluminação'], [0.48, 'móveis planejados'],
  [0.645, 'marmoraria'], [0.735, 'vidraçaria'], [0.825, 'decoração e aroma'],
];
const hud = $('.hud'), hudN = $('#hud-n'), hudNome = $('#hud-nome'), hudBarra = $('.hud-barra span');
const quente = $('.revive-quente'), liteCor = $('.lite-cor');
let ultimoP = -1, ultimaEtapa = -1;
gsap.ticker.add(() => {
  const p = cena ? cena.progresso : pScroll;
  if (Math.abs(p - ultimoP) < 0.0002) return;
  ultimoP = p;
  const cel = mmMobile.matches;
  batidas.forEach(({ el, i, o, intro }) => {
    const a = faixa(p, i[0], i[1]), b = faixa(p, o[0], o[1]);
    const op = a * (1 - b);
    el.style.opacity = op;
    el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
    const y = (1 - a) * 30 - b * 30;
    el.style.transform = intro || cel ? `translate3d(0, ${y}px, 0)` : `translate3d(0, calc(-50% + ${y}px), 0)`;
  });
  let e = -1;
  ETAPAS.forEach(([ini], k) => { if (p >= ini) e = k; });
  hud.classList.toggle('on', p > 0.07 && p < 0.93);
  if (e !== ultimaEtapa && e >= 0) {
    ultimaEtapa = e;
    hudN.textContent = String(e + 1).padStart(2, '0');
    hudNome.textContent = ETAPAS[e][1];
  }
  hudBarra.style.transform = `scaleX(${faixa(p, 0.07, 0.93)})`;
  quente.style.opacity = faixa(p, 0.33, 0.95);
  if (liteCor) liteCor.style.opacity = faixa(p, 0.2, 0.92);
});

// ---------- manifesto: o texto revive palavra por palavra ----------
const manifesto = $('#manifesto');
const FORTES = new Set(['revivè?', 'renovação', 'transmutada', 'mãos.']);
manifesto.innerHTML = manifesto.textContent.trim().split(/\s+/).map((w) =>
  `<span class="w${FORTES.has(w) ? ' forte' : ''}">${w}<span class="c" aria-hidden="true">${w}</span></span>`).join(' ');
const palavras = $$('.c', manifesto);
let ultimoM = -1;
ScrollTrigger.create({
  trigger: manifesto, start: 'top 78%', end: 'bottom 50%',
  onUpdate: (s) => {
    const n = palavras.length;
    const pos = s.progress * (n + 4);
    if (Math.abs(pos - ultimoM) < 0.05) return;
    ultimoM = pos;
    palavras.forEach((c, i) => { c.style.opacity = clamp01(pos - i); });
  },
});
if (reduzido) palavras.forEach((c) => { c.style.opacity = 1; });

// ---------- camadas ----------
const placas = $$('.placa');
const botoesCam = $$('.cam-lista button');
const detalhes = $$('.cam-det');
const qz = placas.map((pl) => gsap.quickTo(pl, 'z', { duration: 0.6, ease: 'power3.out' }));
const qx = placas.map((pl) => gsap.quickTo(pl, 'x', { duration: 0.7, ease: 'power3.out' }));
let camAtiva = -1;
function atualizarCamadas(p) {
  const cel = mmMobile.matches;
  const exp = gsap.parseEase('power2.out')(faixa(p, 0, 0.14));
  const gap = 8 + exp * (cel ? 16 : 46);
  const abre = exp * (cel ? 34 : 96);
  const ativa = Math.min(4, Math.max(0, Math.floor(faixa(p, 0.1, 1) * 5 - 1e-6)));
  placas.forEach((pl, i) => {
    qz[i](i * gap + (i > ativa ? abre : 0) + (i === ativa ? abre * 0.35 : 0));
    qx[i](i === ativa ? exp * (cel ? 30 : 60) : 0);
  });
  if (ativa !== camAtiva) {
    camAtiva = ativa;
    placas.forEach((pl, i) => pl.classList.toggle('ativa', i === ativa));
    botoesCam.forEach((b, i) => b.setAttribute('aria-selected', String(i === ativa)));
    detalhes.forEach((d, i) => d.classList.toggle('ativo', i === ativa));
  }
}
const stCam = ScrollTrigger.create({
  trigger: '.camadas', start: 'top top', end: 'bottom bottom',
  onUpdate: (s) => atualizarCamadas(s.progress),
  onRefresh: (s) => atualizarCamadas(s.progress),
});
atualizarCamadas(0);
botoesCam.forEach((b, i) => b.addEventListener('click', () => {
  const p = 0.1 + ((i + 0.5) / 5) * 0.9;
  rolarPara(stCam.start + (stCam.end - stCam.start) * p);
}));

// ---------- studios revividos ----------
const flut = $('.whats-flutuante');
let interiorAberto = false, noPalco = false, flutOn = false;
const atualizarFlut = () => flut.classList.toggle('on', flutOn && !interiorAberto && !noPalco);
const interior = montarInterior({
  studios, lenis,
  onToggle: (v) => { interiorAberto = v; atualizarFlut(); },
});
// Bela Vista 1 fica fora da rolagem (foto principal panorâmica); continua na grade final
const sequencia = studios.map((s, i) => i).filter((i) => studios[i].id !== 'bela-vista-1');
const revividos = montarRevividos({ studios, sequencia, secao: $('.revividos'), interior });
ScrollTrigger.create({
  trigger: '.revividos', start: 'top top', end: 'bottom bottom',
  onUpdate: (s) => revividos.seguir(s.progress),
  onRefresh: (s) => revividos.seguir(s.progress),
  onToggle: (s) => { noPalco = s.isActive; atualizarFlut(); },
});
new IntersectionObserver(([en]) => { revividos.ligado = en.isIntersecting; }).observe($('.revividos'));

// ---------- contato: chaveiro ----------
const chaveCanvas = $('#chave-canvas');
if (comGL) {
  let visivel = false, empurrado = false;
  // o loop só roda quando o chaveiro está na tela
  const ligar = () => {
    if (!chaveiro) return;
    chaveiro.ativo = visivel;
    if (visivel && !empurrado) { empurrado = true; chaveiro.empurrar(1.6, 0.4); }
  };
  new IntersectionObserver(([en]) => { visivel = en.isIntersecting; ligar(); }).observe(chaveCanvas);
  chaveiroPronto.then(() => { if (!chaveiro) semGL(); ligar(); });
  // a rolagem chacoalha as chaves
  ScrollTrigger.create({
    trigger: '#contato', start: 'top bottom', end: 'bottom top',
    onUpdate: (s) => { if (chaveiro) chaveiro.empurrar(gsap.utils.clamp(-0.25, 0.25, s.getVelocity() * 0.00008)); },
  });
}
if (toque) $('.chave-dica').textContent = 'toque no chaveiro';

// ---------- revelações de texto ----------
$$('.titulo-sec, .manifesto-pe > *, .titulo-contato, .contato-sub, .btn-whats').forEach((el) => {
  if (el.closest('.camadas')) return;
  gsap.from(el, { y: 40, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
});

// ---------- topo e botão flutuante ----------
const topo = $('.topo');
ScrollTrigger.create({ start: 60, end: 'max', onToggle: (s) => topo.classList.toggle('solido', s.isActive) });
ScrollTrigger.create({ trigger: '#studios', start: 'top 60px', end: 'bottom 60px', onToggle: (s) => topo.classList.toggle('noite', s.isActive) });
ScrollTrigger.create({
  trigger: '#quem', start: 'top center', endTrigger: '#contato', end: 'top 80%',
  onToggle: (s) => { flutOn = s.isActive; atualizarFlut(); },
});

// recalcula posições quando fontes e imagens terminam de carregar
window.addEventListener('load', () => ScrollTrigger.refresh());
