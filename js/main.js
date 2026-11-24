/*
 * main.js — Programa principal do cérebro do robô.
 *
 * Etapa 1: só os olhos.
 * Nas próximas etapas, este arquivo vai ligar: voz, Claude, memória e Bluetooth (ESP32).
 */

const canvas = document.getElementById('rosto');
const legenda = document.getElementById('legenda');
const dica = document.getElementById('dica');

const olhos = new Olhos(canvas, { cor: '#5ff3ff' });

// Ordem em que as emoções aparecem quando você toca na tela
const ordem = Object.keys(EMOCOES);
let indice = 0;

let timerLegenda = null;
function mostrarLegenda(texto) {
  legenda.textContent = texto;
  legenda.classList.add('visivel');
  clearTimeout(timerLegenda);
  timerLegenda = setTimeout(() => legenda.classList.remove('visivel'), 1200);
}

function mudarEmocao(nome) {
  olhos.setEmocao(nome);
  indice = ordem.indexOf(nome);
  mostrarLegenda(NOMES_EMOCOES[nome] || nome);
}

// ---------------------------------------------------------------------------
// Tela cheia + tela sempre ligada (só funciona depois de um toque do usuário)
// ---------------------------------------------------------------------------
let travaTela = null;

async function manterTelaLigada() {
  try {
    if ('wakeLock' in navigator) {
      travaTela = await navigator.wakeLock.request('screen');
    }
  } catch (e) {
    console.warn('Não consegui manter a tela ligada:', e);
  }
}

// Se o app sair e voltar, pede de novo para a tela não apagar
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && travaTela !== null) {
    manterTelaLigada();
  }
});

async function entrarTelaCheia() {
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    }
    // Tenta deixar deitado (paisagem). Se o celular não deixar, tudo bem.
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape').catch(() => {});
    }
  } catch (e) {
    console.warn('Tela cheia não disponível:', e);
  }
}

// ---------------------------------------------------------------------------
// Toque na tela
// ---------------------------------------------------------------------------
let primeiroToque = true;

canvas.addEventListener('pointerdown', async () => {
  if (primeiroToque) {
    primeiroToque = false;
    dica.classList.add('oculta');
    await entrarTelaCheia();
    await manterTelaLigada();
    olhos.piscar();
    return;
  }
  // Cada toque: próxima emoção
  indice = (indice + 1) % ordem.length;
  mudarEmocao(ordem[indice]);
});

// ---------------------------------------------------------------------------
// Teclado (para testar no PC): teclas 1 a 9 escolhem a emoção,
// setas fazem olhar, espaço pisca, 0 volta a olhar livremente.
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= ordem.length) mudarEmocao(ordem[n - 1]);
  else if (e.key === '0') olhos.olharLivremente();
  else if (e.key === ' ') olhos.piscar();
  else if (e.key === 'ArrowLeft') olhos.olhar(-1, 0);
  else if (e.key === 'ArrowRight') olhos.olhar(1, 0);
  else if (e.key === 'ArrowUp') olhos.olhar(0, -1);
  else if (e.key === 'ArrowDown') olhos.olhar(0, 1);
});

// ---------------------------------------------------------------------------
// "Painel de controle" do robô. As próximas etapas (Claude, Bluetooth...)
// vão usar isto. Você também pode testar pelo console do navegador, ex.:
//   robo.emocao('feliz')
//   robo.olhar(1, 0)
// ---------------------------------------------------------------------------
window.robo = {
  emocao: mudarEmocao,
  olhar: (x, y) => olhos.olhar(x, y),
  olharLivre: () => olhos.olharLivremente(),
  piscar: () => olhos.piscar(),
  emocoes: ordem,
};
