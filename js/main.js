/*
 * main.js — Programa principal do cérebro do robô.
 *
 * Etapa 1: olhos ✅
 * Etapa 2: conversa por texto com a IA (Groq grátis ou Claude) ✅
 * Etapa 3: voz (ouvir e falar) e câmera ✅
 * Próximas: memória e Bluetooth (ESP32).
 */

// ---------------------------------------------------------------------------
// Peças da tela
// ---------------------------------------------------------------------------
const canvas = document.getElementById('rosto');
const legenda = document.getElementById('legenda');
const fala = document.getElementById('fala');
const dica = document.getElementById('dica');
const barra = document.getElementById('barra');
const campoMensagem = document.getElementById('mensagem');
const botaoEnviar = document.getElementById('enviar');
const botaoMic = document.getElementById('microfone');
const botaoCamera = document.getElementById('botaoCamera');
const previa = document.getElementById('previa');

const painel = document.getElementById('painel');
const cfgNome = document.getElementById('cfgNome');
const cfgChave = document.getElementById('cfgChave');
const cfgModelo = document.getElementById('cfgModelo');
const cfgProvedor = document.getElementById('cfgProvedor');
const cfgDicaChave = document.getElementById('cfgDicaChave');
const cfgStatus = document.getElementById('cfgStatus');
const cfgFalar = document.getElementById('cfgFalar');
const cfgModoConversa = document.getElementById('cfgModoConversa');
const cfgCamera = document.getElementById('cfgCamera');

// ---------------------------------------------------------------------------
// Olhos e cérebro
// ---------------------------------------------------------------------------
const olhos = new Olhos(canvas, { cor: '#5ff3ff' });

let config = carregarConfig();
const cerebro = new Cerebro(() => config);
const ouvido = new Ouvido();
const voz = new Voz();
const camera = new Camera(previa);

const ordem = Object.keys(EMOCOES);

// ---------------------------------------------------------------------------
// Emoção, legenda e fala
// ---------------------------------------------------------------------------
let timerLegenda = null;
function mostrarLegenda(texto) {
  legenda.textContent = texto;
  legenda.classList.add('visivel');
  clearTimeout(timerLegenda);
  timerLegenda = setTimeout(() => legenda.classList.remove('visivel'), 1200);
}

function mudarEmocao(nome, comLegenda = true) {
  olhos.setEmocao(nome);
  if (comLegenda) mostrarLegenda(NOMES_EMOCOES[nome] || nome);
}

// Depois de um tempo sem conversa, a emoção volta para "neutro"
let timerVoltarNeutro = null;
function voltarAoNeutroDepois(segundos) {
  clearTimeout(timerVoltarNeutro);
  timerVoltarNeutro = setTimeout(() => {
    olhos.setEmocao('neutro');
    olhos.olharLivremente();
  }, segundos * 1000);
}

let timerFala = null;
function mostrarFala(texto, ehErro = false) {
  fala.textContent = texto;
  fala.classList.toggle('erro', ehErro);
  fala.classList.add('visivel');
  // Quanto maior o texto, mais tempo ele fica na tela
  const segundos = 5 + texto.length * 0.06;
  clearTimeout(timerFala);
  timerFala = setTimeout(() => fala.classList.remove('visivel'), segundos * 1000);
}

// ---------------------------------------------------------------------------
// Conversa com a IA
// ---------------------------------------------------------------------------
let ocupado = false;

// Frases que fazem o robô usar a câmera mesmo se ela estiver desligada
const PEDIU_PARA_VER = /(?<!\p{L})(v[eê]|vendo|enxerga\p{L}*|olha (isso|aqui|s[oó]|pra)|olhe|veja|repara|c[aâ]mera|foto|aparecendo|na minha m[aã]o|segurando)(?!\p{L})/iu;

function atualizarBotoes() {
  botaoEnviar.disabled = ocupado;
  botaoMic.classList.toggle('ativo', ouvido.ativo);
  botaoCamera.classList.toggle('ativo', camera.ligada);
  previa.hidden = !camera.ligada;
}

/**
 * Manda uma mensagem para a IA.
 * veioDaVoz = true quando a mensagem foi falada (aí, no modo conversa, ele volta a ouvir)
 */
async function enviarMensagem(texto, { veioDaVoz = false } = {}) {
  texto = texto.trim();
  if (!texto || ocupado) return;

  if (!config.chaves[config.provedor]) {
    mostrarFala('Primeiro coloque a chave da IA na engrenagem ⚙', true);
    abrirPainel();
    return;
  }

  ocupado = true;
  atualizarBotoes();
  clearTimeout(timerVoltarNeutro);
  voz.calar();

  // Enquanto espera a resposta: cara de quem está pensando
  mudarEmocao('pensando', false);
  mostrarFala('...');

  let resposta = null;
  try {
    // Se pediu para ver e a câmera está desligada, liga agora
    if (!camera.ligada && PEDIU_PARA_VER.test(texto)) {
      await ligarCamera();
    }
    const foto = camera.ligada ? camera.foto() : null;

    const r = await cerebro.conversar(texto, foto);
    resposta = r.texto;
    olhos.olharLivremente();
    mudarEmocao(r.emocao, false);
    mostrarFala(resposta);
  } catch (erro) {
    console.warn(erro);
    mudarEmocao('triste', false);
    mostrarFala(erro.message || 'Deu algum problema.', true);
    voltarAoNeutroDepois(5);
    if (['sem-chave', 'chave-invalida', 'modelo'].includes(erro.codigo)) abrirPainel();
  } finally {
    ocupado = false;
    atualizarBotoes();
  }

  if (!resposta) return;

  // Fala a resposta em voz alta, com os olhos "pulando" no ritmo
  if (config.falarRespostas && voz.suportado) {
    await voz.falar(resposta, {
      aoComecar: () => olhos.setFalando(true),
      aoTerminar: () => olhos.setFalando(false),
    });
  }
  voltarAoNeutroDepois(6);

  // Modo conversa: se você falou com ele, ele já volta a ouvir
  const despediu = /(?<!\p{L})(tchau|at[eé] (logo|mais|amanh[aã])|boa noite|pode parar|chega)(?!\p{L})/iu.test(texto);
  if (config.modoConversa && veioDaVoz && !despediu && !ocupado) {
    setTimeout(() => comecarAOuvir(), 300);
  }
}

// ---------------------------------------------------------------------------
// Ouvir (microfone)
// ---------------------------------------------------------------------------
async function comecarAOuvir() {
  // Tocar de novo enquanto ele ouve = "terminei de falar"
  if (ouvido.ativo) { ouvido.parar(); return; }
  if (ocupado) return;
  if (!ouvido.suportado) {
    mostrarFala('Este navegador não consegue ouvir. Use o Chrome no celular.', true);
    return;
  }

  voz.calar();
  olhos.setFalando(false);
  clearTimeout(timerVoltarNeutro);
  mudarEmocao('ouvindo', false);
  mostrarFala('Estou ouvindo...');

  let texto = '';
  const promessa = ouvido.ouvir({ aoParcial: (t) => { if (t) mostrarFala(t); } });
  atualizarBotoes();
  try {
    texto = await promessa;
  } catch (erro) {
    mudarEmocao('triste', false);
    mostrarFala(erro.message, true);
    voltarAoNeutroDepois(4);
    return;
  } finally {
    atualizarBotoes();
  }

  if (texto) {
    enviarMensagem(texto, { veioDaVoz: true });
  } else {
    mudarEmocao('neutro', false);
    mostrarFala('Não ouvi nada. Toque no 🎤 e fale comigo.');
  }
}

botaoMic.addEventListener('click', comecarAOuvir);

// ---------------------------------------------------------------------------
// Câmera
// ---------------------------------------------------------------------------
async function ligarCamera() {
  await camera.ligar(config.camera);
  atualizarBotoes();
}

botaoCamera.addEventListener('click', async () => {
  if (camera.ligada) {
    camera.desligar();
    atualizarBotoes();
    mostrarFala('Câmera desligada.');
    return;
  }
  try {
    await ligarCamera();
    mudarEmocao('surpreso', false);
    mostrarFala('Agora eu consigo ver! Me pergunte o que estou vendo.');
    voltarAoNeutroDepois(3);
  } catch (erro) {
    mudarEmocao('triste', false);
    mostrarFala(erro.message, true);
    voltarAoNeutroDepois(4);
  }
});

barra.addEventListener('submit', (e) => {
  e.preventDefault();
  const texto = campoMensagem.value;
  campoMensagem.value = '';
  enviarMensagem(texto);
});

// Enquanto você digita, o robô fica "ouvindo"
campoMensagem.addEventListener('input', () => {
  if (ocupado) return;
  if (campoMensagem.value.length > 0 && olhos.emocao !== 'ouvindo') {
    clearTimeout(timerVoltarNeutro);
    mudarEmocao('ouvindo', false);
  }
});
campoMensagem.addEventListener('blur', () => {
  if (!ocupado && olhos.emocao === 'ouvindo') voltarAoNeutroDepois(1);
});

// ---------------------------------------------------------------------------
// Painel de configurações
// ---------------------------------------------------------------------------
for (const [id, p] of Object.entries(PROVEDORES)) {
  const opcao = document.createElement('option');
  opcao.value = id;
  opcao.textContent = p.nome;
  cfgProvedor.appendChild(opcao);
}

// O painel trabalha numa cópia; só vale depois de "Salvar"
let rascunho = null;

function preencherModelos(lista, selecionado) {
  cfgModelo.innerHTML = '';
  for (const m of lista) {
    const opcao = document.createElement('option');
    opcao.value = m.id;
    opcao.textContent = m.nome || m.id;
    cfgModelo.appendChild(opcao);
  }
  if (selecionado && lista.some((m) => m.id === selecionado)) cfgModelo.value = selecionado;
}

let pedidoModelos = 0;
async function atualizarModelosGroq() {
  const chave = cfgChave.value.trim();
  const atual = rascunho.modelos.groq;
  // Enquanto não busca a lista real, mostra o modelo atual
  preencherModelos([{ id: atual }], atual);
  if (!chave.startsWith('gsk_')) return;
  const meu = ++pedidoModelos;
  cfgStatus.textContent = 'Buscando os modelos do Groq...';
  try {
    const ids = await listarModelosGroq(chave);
    if (meu !== pedidoModelos || cfgProvedor.value !== 'groq') return;
    if (!ids.length) { cfgStatus.textContent = 'O Groq não devolveu nenhum modelo.'; return; }
    const escolhido = ids.includes(atual) ? atual : ids[0];
    preencherModelos(ids.map((id) => ({ id })), escolhido);
    cfgStatus.textContent = `Chave ok ✔ (${ids.length} modelos disponíveis)`;
  } catch (e) {
    if (meu !== pedidoModelos) return;
    cfgStatus.textContent = '⚠ ' + (e.message || 'Não consegui buscar os modelos.');
  }
}

let provedorMostrado = null;
function mostrarProvedor() {
  const id = cfgProvedor.value;
  provedorMostrado = id;
  const p = PROVEDORES[id];
  cfgChave.value = rascunho.chaves[id] || '';
  cfgChave.placeholder = p.prefixo + '...';
  cfgDicaChave.textContent = `Pegue a chave em ${p.site}. Ela começa com "${p.prefixo}".`;
  cfgStatus.textContent = cfgChave.value ? 'Chave salva ✔' : 'Nenhuma chave salva ainda.';
  if (id === 'groq') {
    atualizarModelosGroq();
  } else {
    preencherModelos(MODELOS_CLAUDE, rascunho.modelos.claude);
  }
}

function guardarCamposNoRascunho() {
  const id = cfgProvedor.value;
  rascunho.chaves[id] = cfgChave.value.trim();
  if (cfgModelo.value) rascunho.modelos[id] = cfgModelo.value;
}

function abrirPainel() {
  rascunho = structuredClone(config);
  cfgNome.value = config.nome;
  cfgProvedor.value = config.provedor;
  cfgFalar.checked = config.falarRespostas;
  cfgModoConversa.checked = config.modoConversa;
  cfgCamera.value = config.camera;
  mostrarProvedor();
  painel.hidden = false;
}

function fecharPainel() {
  painel.hidden = true;
  rascunho = null;
}

cfgProvedor.addEventListener('change', () => {
  // guarda o que estava digitado no provedor anterior antes de trocar
  rascunho.chaves[provedorMostrado] = cfgChave.value.trim();
  if (cfgModelo.value) rascunho.modelos[provedorMostrado] = cfgModelo.value;
  mostrarProvedor();
});

// Quando colar a chave do Groq, já busca os modelos
cfgChave.addEventListener('change', () => {
  if (cfgProvedor.value === 'groq') atualizarModelosGroq();
});

document.getElementById('engrenagem').addEventListener('click', abrirPainel);
document.getElementById('cfgFechar').addEventListener('click', fecharPainel);

document.getElementById('cfgSalvar').addEventListener('click', () => {
  const id = cfgProvedor.value;
  const chave = cfgChave.value.trim();
  const prefixo = PROVEDORES[id].prefixo;
  if (chave && !chave.startsWith(prefixo)) {
    cfgStatus.textContent = `⚠ A chave deveria começar com "${prefixo}". Confira se copiou certo.`;
    return;
  }
  guardarCamposNoRascunho();
  rascunho.nome = cfgNome.value.trim() || CONFIG_PADRAO.nome;
  rascunho.provedor = id;
  rascunho.falarRespostas = cfgFalar.checked;
  rascunho.modoConversa = cfgModoConversa.checked;
  const trocouCamera = rascunho.camera !== cfgCamera.value;
  rascunho.camera = cfgCamera.value;
  const trocouProvedor = config.provedor !== id;
  config = rascunho;
  if (salvarConfig(config)) {
    if (trocouProvedor) cerebro.limpar();
    if (!config.falarRespostas) voz.calar();
    if (trocouCamera && camera.ligada) ligarCamera().catch(() => {});
    fecharPainel();
    mudarEmocao('feliz', false);
    mostrarFala(chave ? `Pronto! Agora eu sou ${config.nome}. Fala comigo!` : 'Configurações salvas.');
    voltarAoNeutroDepois(4);
  } else {
    cfgStatus.textContent = '⚠ Não consegui salvar neste navegador.';
  }
});

document.getElementById('cfgApagarChave').addEventListener('click', () => {
  const id = cfgProvedor.value;
  rascunho.chaves[id] = '';
  config.chaves[id] = '';
  salvarConfig(config);
  cfgChave.value = '';
  cfgStatus.textContent = 'Chave apagada deste aparelho.';
});

document.getElementById('cfgNovaConversa').addEventListener('click', () => {
  cerebro.limpar();
  cfgStatus.textContent = 'Conversa apagada. O robô começou do zero.';
});

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
  } catch (e) {
    console.warn('Tela cheia não disponível:', e);
  }
}

// Primeiro toque em qualquer lugar: tela cheia e tela sempre ligada
let primeiroToque = true;
document.addEventListener('pointerdown', async () => {
  if (!primeiroToque) return;
  primeiroToque = false;
  dica.classList.add('oculta');
  await entrarTelaCheia();
  await manterTelaLigada();
}, { capture: true });

// Toque nos olhos = "carinho": ele fica feliz por um instante
canvas.addEventListener('pointerdown', () => {
  if (ocupado) return;
  olhos.piscar();
  mudarEmocao('feliz', false);
  voltarAoNeutroDepois(2.5);
});

// ---------------------------------------------------------------------------
// Teclado (para testar no PC): teclas 1 a 9 escolhem a emoção,
// setas fazem olhar, espaço pisca, 0 volta a olhar livremente.
// (Não funciona enquanto você está digitando na caixa de mensagem.)
// ---------------------------------------------------------------------------
window.addEventListener('keydown', (e) => {
  const alvo = e.target;
  if (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'SELECT' || alvo.tagName === 'TEXTAREA')) return;
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
// "Painel de controle" do robô, para as próximas etapas e para testes:
//   robo.emocao('feliz')   robo.olhar(1, 0)   robo.falar('Oi!')
// ---------------------------------------------------------------------------
window.robo = {
  emocao: (nome) => mudarEmocao(nome),
  olhar: (x, y) => olhos.olhar(x, y),
  olharLivre: () => olhos.olharLivremente(),
  piscar: () => olhos.piscar(),
  falar: (texto) => enviarMensagem(texto),
  ouvir: () => comecarAOuvir(),
  dizer: (texto) => voz.falar(texto, { aoComecar: () => olhos.setFalando(true), aoTerminar: () => olhos.setFalando(false) }),
  emocoes: ordem,
};

// Se ainda não tem chave, avisa logo de cara
if (!config.chaves[config.provedor]) {
  setTimeout(() => mostrarFala('Oi! Toque na engrenagem ⚙ para colocar a chave da IA.'), 800);
}
