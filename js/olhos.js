/*
 * olhos.js — Desenha e anima os olhos do robô num <canvas>.
 *
 * Como funciona, em resumo:
 *  - Cada emoção é um conjunto de números (tamanho do olho, pálpebras, inclinação...).
 *  - O programa guarda o "estado atual" e o "estado alvo". A cada quadro (60 vezes
 *    por segundo) o atual anda um pouquinho em direção ao alvo, por isso a troca
 *    de emoção é suave.
 *  - Por cima disso rodam duas animações automáticas: piscar e olhar em volta.
 */

// ---------------------------------------------------------------------------
// EMOÇÕES
// Cada número vai de 0 a 1 (mais ou menos). Para criar uma emoção nova,
// copie uma das linhas e mude os valores.
//
//  escalaL / escalaA : largura / altura do olho (1 = normal)
//  palpSup           : pálpebra de cima cobrindo o olho (0 = aberto, 1 = fechado)
//  inclinacao        : inclina a pálpebra de cima
//                      (+ = canto de dentro mais baixo = bravo,
//                       - = canto de fora mais baixo = triste)
//  palpInf           : pálpebra de baixo em curva (olho "sorrindo")
//  olharX / olharY   : para onde olha (-1 a 1). null = livre (olha em volta sozinho)
// ---------------------------------------------------------------------------
const EMOCOES = {
  neutro:      { escalaL: 1.00, escalaA: 1.00, palpSup: 0.00, inclinacao:  0.00, palpInf: 0.00, olharX: null, olharY: null },
  feliz:       { escalaL: 1.05, escalaA: 1.00, palpSup: 0.00, inclinacao:  0.00, palpInf: 0.50, olharX: 0,    olharY: -0.1 },
  triste:      { escalaL: 0.95, escalaA: 0.90, palpSup: 0.25, inclinacao: -0.32, palpInf: 0.00, olharX: 0,    olharY: 0.5 },
  bravo:       { escalaL: 1.00, escalaA: 0.90, palpSup: 0.30, inclinacao:  0.55, palpInf: 0.10, olharX: 0,    olharY: 0.1 },
  surpreso:    { escalaL: 1.15, escalaA: 1.25, palpSup: 0.00, inclinacao:  0.00, palpInf: 0.00, olharX: 0,    olharY: -0.15 },
  sono:        { escalaL: 1.05, escalaA: 1.00, palpSup: 0.62, inclinacao: -0.10, palpInf: 0.12, olharX: 0,    olharY: 0.4 },
  desconfiado: { escalaL: 1.05, escalaA: 1.00, palpSup: 0.42, inclinacao:  0.10, palpInf: 0.28, olharX: 0.6,  olharY: 0 },
  pensando:    { escalaL: 0.95, escalaA: 1.00, palpSup: 0.15, inclinacao: -0.10, palpInf: 0.00, olharX: 0.6,  olharY: -0.7 },
  ouvindo:     { escalaL: 1.08, escalaA: 1.10, palpSup: 0.00, inclinacao:  0.00, palpInf: 0.08, olharX: 0,    olharY: 0 },
};

// Nomes bonitos para mostrar na tela
const NOMES_EMOCOES = {
  neutro: 'Neutro', feliz: 'Feliz', triste: 'Triste', bravo: 'Bravo',
  surpreso: 'Surpreso', sono: 'Sono', desconfiado: 'Desconfiado',
  pensando: 'Pensando', ouvindo: 'Ouvindo',
};

class Olhos {
  constructor(canvas, opcoes = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Canvas "escondido" onde montamos os olhos antes de aplicar o brilho
    this.buffer = document.createElement('canvas');
    this.bctx = this.buffer.getContext('2d');

    this.cor = opcoes.cor || '#5ff3ff';      // ciano, estilo robô
    this.brilho = opcoes.brilho ?? 0.35;      // tamanho do brilho em volta do olho

    this.emocao = 'neutro';
    this.alvo = { ...EMOCOES.neutro };
    this.atual = { ...EMOCOES.neutro, olharX: 0, olharY: 0 };

    // Olhar automático (quando a emoção deixa o olhar livre)
    this.olharLivre = { x: 0, y: 0 };
    this.proximoOlhar = 1.5;

    // Piscar
    this.piscada = 0;            // 0 = aberto, 1 = fechado
    this.piscando = false;
    this.tempoPiscada = 0;
    this.proximaPiscada = 2 + Math.random() * 3;
    this.piscadaDupla = false;

    // "Respiração": o olho pulsa bem de leve, para parecer vivo
    this.tempo = 0;

    // Falando: os olhos "pulam" de leve no ritmo da fala
    this.falando = false;
    this._fala = 0;

    this._redimensionar = this._redimensionar.bind(this);
    window.addEventListener('resize', this._redimensionar);
    // Também redimensiona quando só a área do canvas muda (ex.: teclado do celular abrindo)
    if ('ResizeObserver' in window) {
      new ResizeObserver(this._redimensionar).observe(canvas);
    }
    this._redimensionar();

    this._ultimo = performance.now();
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  // ---------------- Comandos que o resto do programa pode usar ----------------

  /** Muda a emoção. Ex.: olhos.setEmocao('feliz') */
  setEmocao(nome) {
    if (!EMOCOES[nome]) {
      console.warn('Emoção desconhecida:', nome);
      return;
    }
    this.emocao = nome;
    this.alvo = { ...EMOCOES[nome] };
    // Surpresa dá uma piscadinha rápida antes, fica mais natural
    if (nome === 'surpreso') this.piscar();
  }

  /** Faz os olhos olharem para um ponto (-1 a 1). Ex.: olhos.olhar(1, 0) = direita */
  olhar(x, y) {
    this.alvo.olharX = Math.max(-1, Math.min(1, x));
    this.alvo.olharY = Math.max(-1, Math.min(1, y));
  }

  /** Volta a olhar em volta sozinho */
  olharLivremente() {
    this.alvo.olharX = null;
    this.alvo.olharY = null;
  }

  /** Liga/desliga o balanço dos olhos enquanto o robô fala */
  setFalando(ligado) {
    this.falando = !!ligado;
  }

  /** Pisca uma vez agora */
  piscar() {
    if (!this.piscando) {
      this.piscando = true;
      this.tempoPiscada = 0;
    }
  }

  // ---------------- Funcionamento interno ----------------

  _redimensionar() {
    // Em telas de alta resolução, limita a 2x para não pesar no celular
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Usa o tamanho real do canvas na tela (não da janela inteira),
    // porque agora existe a barra de mensagem embaixo
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    for (const c of [this.canvas, this.buffer]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    this.dpr = dpr;
    this.W = w;
    this.H = h;
  }

  _loop(agora) {
    // dt = tempo desde o último quadro, em segundos
    const dt = Math.min((agora - this._ultimo) / 1000, 0.05);
    this._ultimo = agora;
    this.tempo += dt;

    this._atualizarPiscada(dt);
    this._atualizarOlharLivre(dt);
    this._suavizar(dt);
    this._desenhar();

    requestAnimationFrame(this._loop);
  }

  _atualizarPiscada(dt) {
    if (this.piscando) {
      // Uma piscada dura ~0,18 s: fecha rápido e abre um pouco mais devagar
      this.tempoPiscada += dt;
      const t = this.tempoPiscada / 0.18;
      if (t < 0.4) this.piscada = t / 0.4;
      else if (t < 1) this.piscada = 1 - (t - 0.4) / 0.6;
      else {
        this.piscada = 0;
        this.piscando = false;
        if (this.piscadaDupla) {
          this.piscadaDupla = false;
          this.proximaPiscada = 0.12;
        }
      }
    } else {
      this.proximaPiscada -= dt;
      if (this.proximaPiscada <= 0) {
        this.piscar();
        // Às vezes pisca duas vezes seguidas
        this.piscadaDupla = Math.random() < 0.2;
        // Com sono pisca mais devagar e mais vezes
        const base = this.emocao === 'sono' ? 1.2 : 2.5;
        this.proximaPiscada = base + Math.random() * 3.5;
      }
    }
  }

  _atualizarOlharLivre(dt) {
    this.proximoOlhar -= dt;
    if (this.proximoOlhar <= 0) {
      // Na maior parte das vezes olha perto do centro; de vez em quando, para o lado
      const longe = Math.random() < 0.3;
      const alcance = longe ? 0.9 : 0.35;
      this.olharLivre.x = (Math.random() * 2 - 1) * alcance;
      this.olharLivre.y = (Math.random() * 2 - 1) * alcance * 0.6;
      this.proximoOlhar = 1.2 + Math.random() * 3;
    }
  }

  _suavizar(dt) {
    // Quanto maior a velocidade, mais rápido chega no alvo
    const vel = 1 - Math.exp(-dt * 10);
    const velOlhar = 1 - Math.exp(-dt * 14);   // o olhar se move mais rápido

    for (const k of ['escalaL', 'escalaA', 'palpSup', 'inclinacao', 'palpInf']) {
      this.atual[k] += (this.alvo[k] - this.atual[k]) * vel;
    }
    const alvoX = this.alvo.olharX ?? this.olharLivre.x;
    const alvoY = this.alvo.olharY ?? this.olharLivre.y;
    this.atual.olharX += (alvoX - this.atual.olharX) * velOlhar;
    this.atual.olharY += (alvoY - this.atual.olharY) * velOlhar;
  }

  _desenhar() {
    const { ctx, bctx, dpr, W, H } = this;
    const a = this.atual;

    // Unidade de tamanho: cabe tanto com o celular deitado quanto em pé
    const u = Math.min(W / 4.4, H / 2.3);
    const larguraBase = u * 0.95;
    const alturaBase = u * 1.15;
    const distancia = u * 1.2;       // distância do centro até cada olho

    // Pulsar bem de leve ("respirando")
    const respira = 1 + Math.sin(this.tempo * 1.6) * 0.012;

    // Balanço da fala (suave para começar e parar)
    const alvoFala = this.falando ? Math.abs(Math.sin(this.tempo * 9)) * 0.08 : 0;
    this._fala += (alvoFala - this._fala) * 0.35;

    // Deslocamento do olhar
    const dx = a.olharX * u * 0.45;
    const dy = a.olharY * u * 0.3;

    // Limpa o buffer
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bctx.clearRect(0, 0, W, H);

    for (const lado of [-1, 1]) {           // -1 = olho esquerdo, 1 = olho direito
      // Perspectiva: o olho do lado para onde ele olha fica um pouco maior
      const perspectiva = 1 + 0.08 * a.olharX * lado;

      const w = larguraBase * a.escalaL * respira * perspectiva;
      // Piscar achata o olho na altura
      const hCheio = alturaBase * a.escalaA * respira * perspectiva * (1 + this._fala);
      const h = Math.max(hCheio * (1 - this.piscada * 0.92), 2);

      const cx = W / 2 + lado * distancia + dx;
      const cy = H / 2 + dy;

      this._desenharOlho(bctx, cx, cy, w, h, lado, a);
    }

    // Passa o buffer para a tela, com brilho em volta
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.shadowColor = this.cor;
    ctx.shadowBlur = u * this.brilho * dpr;
    ctx.drawImage(this.buffer, 0, 0);
    ctx.shadowBlur = 0;
  }

  _desenharOlho(c, cx, cy, w, h, lado, a) {
    c.save();
    c.translate(cx, cy);

    // 1) O olho: retângulo de cantos bem arredondados
    const raio = Math.min(w, h) * 0.3;
    c.fillStyle = this.cor;
    this._retanguloArredondado(c, -w / 2, -h / 2, w, h, raio);
    c.fill();

    // 2) As pálpebras "apagam" partes do olho
    c.globalCompositeOperation = 'destination-out';
    c.fillStyle = '#000';

    // Pálpebra de cima, com inclinação.
    // "Canto de dentro" é o lado virado para o nariz:
    // no olho esquerdo é o lado direito; no olho direito, o lado esquerdo.
    const limitar = (v) => Math.max(-0.5, Math.min(1.1, v));
    const yDentro = -h / 2 + h * limitar(a.palpSup + a.inclinacao * 0.5);
    const yFora   = -h / 2 + h * limitar(a.palpSup - a.inclinacao * 0.5);
    const yEsq = lado === -1 ? yFora : yDentro;
    const yDir = lado === -1 ? yDentro : yFora;
    const m = 4; // margem para não sobrar fiapo nas bordas
    c.beginPath();
    c.moveTo(-w / 2 - m, -h / 2 - m);
    c.lineTo(w / 2 + m, -h / 2 - m);
    c.lineTo(w / 2 + m, yDir);
    c.lineTo(-w / 2 - m, yEsq);
    c.closePath();
    c.fill();

    // Pálpebra de baixo em curva (deixa o olho com formato de "sorriso" ^ ^)
    if (a.palpInf > 0.005) {
      const rx = w * 0.72;
      const ry = h * 0.55;
      const centroY = h / 2 + ry - h * a.palpInf;
      c.beginPath();
      c.ellipse(0, centroY, rx, ry, 0, 0, Math.PI * 2);
      c.fill();
    }

    c.restore();
  }

  _retanguloArredondado(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
}
