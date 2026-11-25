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
    this.nomePreferido = '';   // voz escolhida na engrenagem
    this.velocidade = 1.05;
    this.tom = 1.3;
    this.aoMudarVozes = null;  // avisa o painel quando o celular termina de carregar as vozes
    this.ultimoErro = '';       // para o diagnóstico
    this.liberada = false;      // o Chrome do celular só deixa falar depois de um toque
    if (this.suportado) {
      this._escolherVoz();
      // No Android as vozes chegam um pouco depois
      speechSynthesis.addEventListener?.('voiceschanged', () => {
        this._escolherVoz();
        if (this.aoMudarVozes) this.aoMudarVozes();
      });
    }
  }

  /** Vozes que dá para escolher: as em português (ou todas, se não tiver nenhuma) */
  listar() {
    if (!this.suportado) return [];
    const vozes = speechSynthesis.getVoices();
    const pt = vozes.filter((v) => /^pt/i.test(v.lang));
    const lista = pt.length ? pt : vozes;
    // Português do Brasil primeiro
    return lista.slice().sort((a, b) => (/BR/i.test(b.lang) - /BR/i.test(a.lang)) || a.name.localeCompare(b.name));
  }

  /** Aplica o que foi escolhido na engrenagem */
  configurar({ nome = '', velocidade = 1.05, tom = 1.3 } = {}) {
    this.nomePreferido = nome;
    this.velocidade = velocidade;
    this.tom = tom;
    this._escolherVoz();
  }

  _escolherVoz() {
    const vozes = speechSynthesis.getVoices();
    this.voz =
      (this.nomePreferido && vozes.find((v) => v.name === this.nomePreferido)) ||
      vozes.find((v) => /pt[-_]BR/i.test(v.lang)) ||
      vozes.find((v) => /^pt/i.test(v.lang)) ||
      null;
  }

  /**
   * "Destrava" a voz. Tem que ser chamado DENTRO de um toque na tela,
   * senão o Chrome do Android fica mudo.
   */
  liberar() {
    if (!this.suportado || this.liberada) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      speechSynthesis.speak(u);
      this.liberada = true;
    } catch (_) { /* tenta de novo no próximo toque */ }
  }

  /** Quantas vozes o aparelho tem, e qual vai ser usada (para o diagnóstico) */
  info() {
    if (!this.suportado) return 'não suportada neste navegador';
    const vozes = speechSynthesis.getVoices();
    this._escolherVoz();
    const pt = vozes.filter((v) => /^pt/i.test(v.lang)).length;
    return `${vozes.length} vozes no aparelho, ${pt} em português` +
      (this.voz ? ` (usando: ${this.voz.name})` : ' (usando a voz padrão)');
  }

  /** Fala o texto. Devolve uma promessa que termina quando acabar de falar. */
  falar(texto, { aoComecar, aoTerminar } = {}) {
    return new Promise((resolve) => {
      if (!this.suportado || !texto) { resolve(); return; }
      // Se estava falando algo, para. (Chamar cancel() à toa trava a voz em alguns Androids.)
      if (speechSynthesis.speaking || speechSynthesis.pending) speechSynthesis.cancel();
      // No Android a voz às vezes fica "pausada" sozinha
      if (speechSynthesis.paused) speechSynthesis.resume();

      const u = new SpeechSynthesisUtterance(texto);
      u.lang = 'pt-BR';
      if (this.voz) u.voice = this.voz;
      u.rate = this.velocidade;   // velocidade
      u.pitch = this.tom;         // tom: mais alto = voz mais fininha, jeitinho de robozinho

      let acabou = false;
      const fim = () => {
        if (acabou) return;
        acabou = true;
        this.falando = false;
        clearTimeout(seguranca);
        if (aoTerminar) aoTerminar();
        resolve();
      };
      u.onstart = () => { this.falando = true; this.ultimoErro = ''; if (aoComecar) aoComecar(); };
      u.onend = fim;
      u.onerror = (e) => {
        this.ultimoErro = e.error || 'erro desconhecido';
        console.warn('Erro na voz:', this.ultimoErro);
        fim();
      };
      // Às vezes o celular não avisa que terminou; isto garante que não trava
      const seguranca = setTimeout(fim, 4000 + texto.length * 120);

      // Pequena espera depois do cancel(), senão o Android às vezes engole a fala
      setTimeout(() => speechSynthesis.speak(u), 80);
    });
  }

  /** Para de falar na hora */
  calar() {
    if (this.suportado) speechSynthesis.cancel();
  }
}
