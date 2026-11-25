/*
 * voz.js — Os ouvidos e a boca do robô, usando o próprio Chrome (grátis).
 *
 *  Ouvido: transforma a sua fala em texto (reconhecimento de voz do Chrome).
 *          Precisa de internet e da permissão do microfone.
 *  Voz:    lê a resposta em voz alta (síntese de voz do celular).
 */

class Ouvido {
  constructor() {
    this.SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    this.suportado = !!this.SR;
    this.ativo = false;
    this.rec = null;
  }

  /**
   * Ouve uma frase. Devolve o texto falado ('' se não ouviu nada).
   * aoParcial(texto) é chamado enquanto você ainda está falando.
   */
  ouvir({ aoParcial } = {}) {
    return new Promise((resolve, reject) => {
      if (!this.suportado) {
        reject(new ErroRobo('sem-voz', 'Este navegador não consegue ouvir. Use o Chrome.'));
        return;
      }
      const rec = new this.SR();
      rec.lang = 'pt-BR';
      rec.interimResults = true;   // mostra o texto enquanto você fala
      rec.continuous = false;      // para sozinho quando você para de falar
      rec.maxAlternatives = 1;

      let final = '';
      let parcial = '';
      let erro = null;

      rec.onresult = (e) => {
        parcial = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const trecho = e.results[i][0].transcript;
          if (e.results[i].isFinal) final += trecho;
          else parcial += trecho;
        }
        if (aoParcial) aoParcial((final + parcial).trim());
      };
      rec.onerror = (e) => { erro = e.error; };
      rec.onend = () => {
        this.ativo = false;
        this.rec = null;
        const texto = (final || parcial).trim();
        if (texto) return resolve(texto);
        if (erro === 'not-allowed' || erro === 'service-not-allowed') {
          return reject(new ErroRobo('mic-bloqueado', 'O microfone está bloqueado. Libere nas permissões do site (cadeado ao lado do endereço).'));
        }
        if (erro === 'network') {
          return reject(new ErroRobo('sem-internet', 'Para ouvir, eu preciso de internet.'));
        }
        resolve('');   // não ouviu nada (silêncio ou cancelado)
      };

      this.rec = rec;
      this.ativo = true;
      try {
        rec.start();
      } catch (e) {
        this.ativo = false;
        this.rec = null;
        reject(new ErroRobo('mic', 'Não consegui ligar o microfone.'));
      }
    });
  }

  /** Para de ouvir e usa o que já ouviu */
  parar() {
    if (this.rec) this.rec.stop();
  }
}

class Voz {
  constructor() {
    this.suportado = 'speechSynthesis' in window;
    this.voz = null;
    this.falando = false;
    if (this.suportado) {
      this._escolherVoz();
      // No Android as vozes chegam um pouco depois
      speechSynthesis.addEventListener?.('voiceschanged', () => this._escolherVoz());
    }
  }

  _escolherVoz() {
    const vozes = speechSynthesis.getVoices();
    this.voz =
      vozes.find((v) => /pt[-_]BR/i.test(v.lang)) ||
      vozes.find((v) => /^pt/i.test(v.lang)) ||
      null;
  }

  /** Fala o texto. Devolve uma promessa que termina quando acabar de falar. */
  falar(texto, { aoComecar, aoTerminar } = {}) {
    return new Promise((resolve) => {
      if (!this.suportado || !texto) { resolve(); return; }
      speechSynthesis.cancel();

      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      if (this.voz) u.voice = this.voz;
      u.rate = 1.05;    // velocidade
      u.pitch = 1.3;    // voz um pouco mais fina, jeitinho de robozinho

      let acabou = false;
      const fim = () => {
        if (acabou) return;
        acabou = true;
        this.falando = false;
        clearTimeout(seguranca);
        if (aoTerminar) aoTerminar();
        resolve();
      };
      u.onstart = () => { this.falando = true; if (aoComecar) aoComecar(); };
      u.onend = fim;
      u.onerror = fim;
      // Às vezes o celular não avisa que terminou; isto garante que não trava
      const seguranca = setTimeout(fim, 4000 + texto.length * 120);

      speechSynthesis.speak(u);
    });
  }

  /** Para de falar na hora */
  calar() {
    if (this.suportado) speechSynthesis.cancel();
  }
}
