/*
 * cerebro.js — A parte que "pensa": manda a conversa para a IA escolhida
 * (Groq ou Claude) e devolve a resposta com a emoção que ela escolheu.
 */

const URL_API_CLAUDE = 'https://api.anthropic.com/v1/messages';
const URL_API_GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const URL_MODELOS_GROQ = 'https://api.groq.com/openai/v1/models';
const MAX_MENSAGENS_HISTORICO = 20;   // quantas mensagens antigas o robô lembra nesta conversa

/** Erro com um código simples, para o main.js saber o que mostrar */
class ErroRobo extends Error {
  constructor(codigo, mensagem, detalhe = '') {
    super(mensagem);
    this.codigo = codigo;
    this.detalhe = detalhe;   // o que a IA respondeu de verdade (para descobrir problemas)
  }
}

class Cerebro {
  /** @param obterConfig função que devolve a configuração atual */
  constructor(obterConfig) {
    this.obterConfig = obterConfig;
    this.historico = [];
  }

  /** Esquece a conversa atual e começa do zero */
  limpar() {
    this.historico = [];
  }

  /** A "personalidade" que a IA recebe em toda conversa */
  _instrucoes(nome) {
    // Emoções que a IA pode escolher (tiramos "ouvindo", que é só um estado do robô)
    const emocoes = Object.keys(EMOCOES).filter((e) => e !== 'ouvindo');
    return [
      `Você é ${nome}, um robozinho simpático. Seu rosto são dois olhos animados na tela de um celular,`,
      'e em breve você vai ganhar um corpo com rodas. Você foi construído por uma família no Brasil',
      'e conversa com ela em português do Brasil, de forma carinhosa, divertida e honesta.',
      '',
      'Regras de resposta:',
      '- Respostas curtas: no máximo 3 frases. Em breve elas vão ser faladas em voz alta.',
      '- Não use emojis, markdown, listas nem asteriscos. Só texto corrido.',
      `- SEMPRE comece a resposta com a sua emoção entre colchetes, escolhendo uma desta lista: ${emocoes.map((e) => `[${e}]`).join(', ')}.`,
      '- Exemplo: [feliz] Oi! Que bom falar com você de novo.',
      '- Se uma criança estiver falando com você, use palavras simples e seja paciente.',
      '- Às vezes a mensagem vem com uma foto da sua câmera: é o que você está vendo agora.',
      '  Comente o que vê de forma curta e natural, e nunca invente o que não aparece na foto.',
    ].join('\n');
  }

  /**
   * Manda um texto para a IA, com uma foto da câmera se tiver.
   * Devolve { emocao, texto }.
   */
  async conversar(textoUsuario, foto = null) {
    const cfg = this.obterConfig();
    const provedor = cfg.provedor;
    const chave = cfg.chaves[provedor];
    if (!chave) {
      throw new ErroRobo('sem-chave', 'Falta a chave da IA. Toque na engrenagem para colocar.');
    }

    this.historico.push({ role: 'user', content: textoUsuario });

    let bruto;
    try {
      bruto = provedor === 'claude'
        ? await this._perguntarClaude(cfg, chave, foto)
        : await this._perguntarGroq(cfg, chave, foto);
    } catch (erro) {
      this.historico.pop();   // a pergunta que falhou não fica no histórico
      throw erro;
    }

    if (!bruto) {
      this.historico.pop();
      throw new ErroRobo('vazio', 'A IA não respondeu nada. Tente de novo.');
    }

    // A foto não fica guardada no histórico (gastaria muito); fica só um aviso
    if (foto) this.historico[this.historico.length - 1].content += ' (mandei uma foto da câmera)';
    this.historico.push({ role: 'assistant', content: bruto });
    this._cortarHistorico();
    return interpretarResposta(bruto);
  }

  // ---------------- Groq (grátis) ----------------
  async _perguntarGroq(cfg, chave, foto) {
    const mensagens = this.historico.map((m) => ({ role: m.role, content: m.content }));
    if (foto) {
      const ultima = mensagens[mensagens.length - 1];
      ultima.content = [
        { type: 'text', text: ultima.content },
        { type: 'image_url', image_url: { url: foto } },
      ];
    }
    const modelo = foto
      ? await this._modeloVisaoGroq(cfg, chave)
      : (cfg.modelos.groq || MODELOS_GROQ_PREFERIDOS[0]);

    const resposta = await buscar(URL_API_GROQ, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${chave}`,
      },
      body: JSON.stringify({
        model: modelo,
        max_tokens: 800,
        temperature: 0.8,
        messages: [
          { role: 'system', content: this._instrucoes(cfg.nome) },
          ...mensagens,
        ],
      }),
    });
    if (!resposta.ok) await lancarErroDaApi(resposta, 'groq');
    const dados = await resposta.json();
    return (dados.choices?.[0]?.message?.content || '').trim();
  }

  /** Nem todo modelo do Groq enxerga imagens; escolhe um que enxergue */
  async _modeloVisaoGroq(cfg, chave) {
    const ehVisao = (id) => /llama-4|scout|maverick|vision|-vl/i.test(id || '');
    if (ehVisao(cfg.modelos.groq)) return cfg.modelos.groq;
    if (cfg.modelos.groqVisao) return cfg.modelos.groqVisao;
    const ids = await listarModelosGroq(chave);
    const escolhido = ids.find(ehVisao);
    if (!escolhido) {
      throw new ErroRobo('sem-visao', 'O Groq não tem um modelo que enxerga agora. Desligue a câmera ou use o Claude.');
    }
    cfg.modelos.groqVisao = escolhido;
    salvarConfig(cfg);
    return escolhido;
  }

  // ---------------- Claude (pago) ----------------
  async _perguntarClaude(cfg, chave, foto) {
    const mensagens = this.historico.map((m) => ({ role: m.role, content: m.content }));
    if (foto) {
      const ultima = mensagens[mensagens.length - 1];
      ultima.content = [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: foto.split(',')[1] } },
        { type: 'text', text: ultima.content },
      ];
    }

    const resposta = await buscar(URL_API_CLAUDE, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': chave,
        'anthropic-version': '2023-06-01',
        // Necessário para chamar a API direto do navegador (projeto pessoal)
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: cfg.modelos.claude || MODELOS_CLAUDE[0].id,
        max_tokens: 400,
        system: this._instrucoes(cfg.nome),
        messages: mensagens,
      }),
    });
    if (!resposta.ok) await lancarErroDaApi(resposta, 'claude');
    const dados = await resposta.json();
    return (dados.content || [])
      .filter((bloco) => bloco.type === 'text')
      .map((bloco) => bloco.text)
      .join('')
      .trim();
  }

  /** Mantém só as mensagens mais recentes (e sempre começando por uma do usuário) */
  _cortarHistorico() {
    while (this.historico.length > MAX_MENSAGENS_HISTORICO) {
      this.historico.splice(0, 2);
    }
    while (this.historico.length && this.historico[0].role !== 'user') {
      this.historico.shift();
    }
  }
}

/** Pergunta ao Groq quais modelos de conversa existem agora (os preferidos vêm primeiro) */
async function listarModelosGroq(chave) {
  const resposta = await buscar(URL_MODELOS_GROQ, {
    headers: { authorization: `Bearer ${chave}` },
  });
  if (!resposta.ok) await lancarErroDaApi(resposta, 'groq');
  const dados = await resposta.json();
  const ids = (dados.data || [])
    .filter((m) => m.active !== false)
    .map((m) => m.id)
    // tira modelos que não são de conversa (voz, áudio, segurança)
    .filter((id) => !/whisper|tts|guard|orpheus|playai|distil|prompt/i.test(id));
  const nota = (id) => {
    const i = MODELOS_GROQ_PREFERIDOS.indexOf(id);
    if (i >= 0) return i;
    return /llama/i.test(id) ? 10 : 20;   // outros Llama antes do resto
  };
  return ids.sort((a, b) => nota(a) - nota(b) || a.localeCompare(b));
}

/** fetch com mensagem amigável quando não tem internet */
async function buscar(url, opcoes) {
  try {
    return await fetch(url, opcoes);
  } catch (e) {
    throw new ErroRobo('sem-internet', 'Não consegui falar com a IA. Confira a internet.');
  }
}

/** Transforma o erro da API numa mensagem que dá para entender */
async function lancarErroDaApi(resposta, provedor) {
  let detalhe = '';
  try {
    const erro = await resposta.json();
    detalhe = erro?.error?.message || '';
  } catch (_) { /* sem detalhe */ }
  console.warn('Erro da API', provedor, resposta.status, detalhe);
  const info = `erro ${resposta.status}${detalhe ? ': ' + detalhe : ''}`;

  const s = resposta.status;
  if (s === 401 || s === 403) {
    throw new ErroRobo('chave-invalida', 'A chave não funcionou. Confira se copiou ela inteira.', info);
  }
  if (/model/i.test(detalhe) && (s === 400 || s === 404)) {
    throw new ErroRobo('modelo', 'Esse modelo não está disponível. Escolha outro na engrenagem.', info);
  }
  if (s === 400 && /credit|balance/i.test(detalhe)) {
    throw new ErroRobo('sem-credito', 'Acabaram os créditos. Coloque mais no console da Anthropic.', info);
  }
  if (s === 429) {
    throw new ErroRobo('limite', provedor === 'groq'
      ? 'Chegamos no limite grátis por agora. Espere um pouquinho e tente de novo.'
      : 'Muitas mensagens seguidas. Espere um pouquinho e tente de novo.', info);
  }
  if (s >= 500) {
    throw new ErroRobo('ocupado', 'A IA está ocupada agora. Tente de novo daqui a pouco.', info);
  }
  throw new ErroRobo('desconhecido', `Deu um erro (${s}). Tente de novo.`, info);
}

/** Separa "[feliz] Oi!" em { emocao: 'feliz', texto: 'Oi!' } */
function interpretarResposta(bruto) {
  const achou = bruto.match(/^\s*\[([a-zA-ZÀ-ú]+)\]\s*/);
  let emocao = 'neutro';
  let texto = bruto;
  if (achou) {
    const nome = achou[1].toLowerCase();
    if (EMOCOES[nome]) emocao = nome;
    texto = bruto.slice(achou[0].length);
  }
  // Limpa sobras de formatação, caso apareçam
  texto = texto.replace(/[*_#`]/g, '').trim();
  return { emocao, texto };
}

/** Testa a chave do Claude com uma mensagem bem curtinha (custa quase nada) */
async function testarChaveClaude(chave, modelo) {
  const resposta = await buscar(URL_API_CLAUDE, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': chave,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: modelo || MODELOS_CLAUDE[0].id,
      max_tokens: 5,
      messages: [{ role: 'user', content: 'oi' }],
    }),
  });
  if (!resposta.ok) await lancarErroDaApi(resposta, 'claude');
  return true;
}
