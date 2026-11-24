// Studios revividos: seção presa na rolagem, uma foto real grande por vez.
// A foto entra cinza e uma frente de luz atravessa devolvendo a cor (mesmo gesto do hero).
// Revelação feita com máscara por translate (só transform e opacity, nada de clip-path por quadro).
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const faixa = (p, a, b) => clamp01((p - a) / (b - a));
const suave = (t) => t * t * (3 - 2 * t);

// sequencia: índices (em studios) que entram na rolagem; a grade final mostra todos
export function montarRevividos({ studios: todos, sequencia, secao, interior }) {
  const studios = sequencia.map((k) => todos[k]);
  const N = studios.length;
  // 1,5 tela de rolagem por studio: rolagem rápida não pula fotos
  secao.style.height = `${N * 150 + 100}vh`;
  const palco = secao.querySelector('.rv-fotos');
  const elNum = secao.querySelector('.rv-num'), elBairro = secao.querySelector('.rv-bairro'), elNome = secao.querySelector('.rv-nome');
  const btVer = secao.querySelector('.rv-ver');
  const texto = secao.querySelector('.rv-texto');
  const marcas = secao.querySelector('.rv-marcas');

  const slides = studios.map((s, i) => {
    const f = s.fotos[0];
    const src = `/studios/${f.id}-${f.gw ? 'g' : 'p'}.webp`;
    const larg = f.gw || f.pw;
    const alt = Math.round(larg * f.h / f.w);
    const d = document.createElement('figure');
    d.className = 'rv-slide';
    d.innerHTML = `<button type="button" class="rv-moldura" aria-label="Ver as fotos do ${s.nome}, ${s.bairro}">
        <img class="rv-cinza" alt="" decoding="async" data-src="${src}" />
        <span class="rv-mascara"><span class="rv-mascara-in"><img class="rv-cor" alt="${s.nome}, ${s.bairro}" decoding="async" data-src="${src}" /></span></span>
        <span class="rv-frente"></span>
      </button>`;
    palco.appendChild(d);
    const bt = d.querySelector('.rv-moldura');
    bt.addEventListener('click', () => interior.abrir(sequencia[i], bt));
    return {
      el: d, bt, w: f.w, h: f.h, larg, alt,
      mascara: d.querySelector('.rv-mascara'), dentro: d.querySelector('.rv-mascara-in'), frente: d.querySelector('.rv-frente'),
      imgs: [...d.querySelectorAll('img')], carregada: false,
    };
  });
  // tamanho em px: cabe no espaço livre e nunca passa da resolução real da foto
  function dimensionar() {
    const r = palco.getBoundingClientRect();
    slides.forEach((sl) => {
      const s = Math.min(r.width / sl.w, (r.height * 0.94) / sl.h, sl.larg / sl.w, sl.alt / sl.h);
      sl.bt.style.width = `${Math.round(sl.w * s)}px`;
      sl.bt.style.height = `${Math.round(sl.h * s)}px`;
    });
  }
  dimensionar();
  window.addEventListener('resize', dimensionar);

  marcas.innerHTML = studios.map((s, i) => `<i>${String(i + 1).padStart(2, '0')}</i>`).join('');
  const marcasEls = [...marcas.children];

  let atual = -1, t = 0;
  function trocarTexto(i) {
    const s = studios[i];
    elNum.textContent = String(i + 1).padStart(2, '0');
    elBairro.textContent = s.bairro;
    elNome.textContent = s.nome;
    btVer.textContent = `Ver as ${s.fotos.length} fotos`;
    marcasEls.forEach((m, k) => { m.classList.toggle('feita', k < i); m.classList.toggle('atual', k === i); });
    // só a foto atual e as duas próximas baixam
    for (let k = i; k <= Math.min(N - 1, i + 2); k++) {
      const sl = slides[k];
      if (sl.carregada) continue;
      sl.carregada = true;
      sl.imgs.forEach((im) => { im.src = im.dataset.src; });
    }
  }

  function render(p) {
    t = p * N;
    const i = Math.min(N - 1, Math.floor(t));
    const u = t - i;
    if (i !== atual) { atual = i; trocarTexto(i); }
    slides.forEach((sl, k) => {
      let op = 0, y = 0, rev = 0;
      if (k === i) {
        op = k === 0 ? 1 : faixa(u, 0, 0.12);
        if (k < N - 1) op *= 1 - faixa(u, 0.88, 1);
        y = (1 - suave(faixa(u, 0, 0.14))) * 40;
        rev = suave(faixa(u, 0.12, 0.58));
      } else if (k === i + 1) {
        op = 0;
      } else if (k < i) {
        op = 0; rev = 1;
      }
      sl.el.style.opacity = op;
      sl.el.style.visibility = op < 0.01 ? 'hidden' : 'visible';
      if (op < 0.01) return;
      sl.el.style.transform = `translate3d(0, ${y}px, 0)`;
      // máscara: o lado colorido avança da esquerda pra direita
      sl.mascara.style.transform = `translate3d(${(rev - 1) * 100}%, 0, 0)`;
      sl.dentro.style.transform = `translate3d(${(1 - rev) * 100}%, 0, 0)`;
      sl.frente.style.transform = `translate3d(${rev * 100}%, 0, 0)`;
      sl.frente.style.opacity = Math.sin(rev * Math.PI);
    });
    const ut = u;
    const opT = (i === 0 ? 1 : faixa(ut, 0.06, 0.2)) * (i < N - 1 ? 1 - faixa(ut, 0.86, 0.98) : 1);
    texto.style.opacity = opT;
    texto.style.transform = `translate3d(0, ${(1 - opT) * 20}px, 0)`;
    texto.classList.toggle('on', opT > 0.4);
  }
  render(0);

  btVer.addEventListener('click', () => interior.abrir(sequencia[atual], slides[atual].bt));

  // suavização: a cena persegue a rolagem em vez de pular junto com ela
  let alvo = 0, pAtual = 0, ligado = false, raf = 0;
  function passo() {
    pAtual += (alvo - pAtual) * 0.09;
    if (Math.abs(alvo - pAtual) < 0.00005) pAtual = alvo;
    render(pAtual);
    raf = pAtual !== alvo ? requestAnimationFrame(passo) : 0;
  }
  function seguir(p) {
    alvo = p;
    if (!ligado) { pAtual = p; render(p); return; }
    if (!raf) raf = requestAnimationFrame(passo);
  }

  // grade final com todos
  const grade = secao.parentElement.querySelector('.rv-grade');
  grade.innerHTML = todos.map((s, i) => `<li><button type="button" data-i="${i}" aria-label="Ver as fotos do ${s.nome}, ${s.bairro}">
      <img alt="" loading="lazy" decoding="async" src="/studios/${s.fotos[0].id}-m.webp" />
      <span><b>${String(i + 1).padStart(2, '0')}</b>${s.bairro}</span></button></li>`).join('');
  grade.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => interior.abrir(Number(b.dataset.i), b)));

  return {
    seguir,
    // fora da tela salta direto; dentro, suaviza
    set ligado(v) { ligado = v; },
  };
}
