/*
 * config.js — Guarda as configurações do robô NESTE aparelho (localStorage).
 *
 * ⚠️ As chaves das IAs ficam só no navegador do aparelho onde você digitou.
 *    Elas NUNCA vão para o GitHub, porque não estão escritas em nenhum arquivo.
 */

const CONFIG_CHAVE_ARMAZENAMENTO = 'robo.config';

// "Quem pensa" pelo robô. O primeiro é o padrão.
const PROVEDORES = {
  groq:   { nome: 'Groq — grátis (Llama)',          prefixo: 'gsk_',    site: 'console.groq.com' },
  claude: { nome: 'Claude — pago (centavos por mês)', prefixo: 'sk-ant-', site: 'console.anthropic.com' },
};

// Modelos do Claude (pagos)
const MODELOS_CLAUDE = [
  { id: 'claude-haiku-5-5',  nome: 'Haiku — rápido e barato (recomendado)' },
  { id: 'claude-sonnet-5-5', nome: 'Sonnet — mais esperto' },
  { id: 'claude-opus-5-5',   nome: 'Opus — o mais inteligente (mais caro)' },
];

// Modelos do Groq que o robô prefere, em ordem (a lista real vem do Groq,
// porque eles trocam os modelos de vez em quando)
const MODELOS_GROQ_PREFERIDOS = [
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'openai/gpt-oss-120b',
];

const CONFIG_PADRAO = {
  nome: 'Robô',
  provedor: 'groq',
  chaves: { groq: '', claude: '' },
  modelos: { groq: MODELOS_GROQ_PREFERIDOS[0], claude: MODELOS_CLAUDE[0].id },
  falarRespostas: true,    // o robô lê as respostas em voz alta
  modoConversa: false,     // depois de falar, já volta a ouvir sozinho
  camera: 'user',          // 'user' = câmera da frente | 'environment' = de trás
};

function carregarConfig() {
  try {
    const salvo = JSON.parse(localStorage.getItem(CONFIG_CHAVE_ARMAZENAMENTO) || '{}');
    const config = {
      ...CONFIG_PADRAO,
      ...salvo,
      chaves: { ...CONFIG_PADRAO.chaves, ...(salvo.chaves || {}) },
      modelos: { ...CONFIG_PADRAO.modelos, ...(salvo.modelos || {}) },
    };
    // Versão antiga (etapa 2) guardava só a chave do Claude
    if (salvo.chave && !config.chaves.claude) {
      config.chaves.claude = salvo.chave;
      if (salvo.modelo) config.modelos.claude = salvo.modelo;
      config.provedor = 'claude';
    }
    delete config.chave;
    delete config.modelo;
    if (!PROVEDORES[config.provedor]) config.provedor = 'groq';
    return config;
  } catch (e) {
    console.warn('Não consegui ler as configurações:', e);
    return structuredClone(CONFIG_PADRAO);
  }
}

function salvarConfig(config) {
  try {
    localStorage.setItem(CONFIG_CHAVE_ARMAZENAMENTO, JSON.stringify(config));
    return true;
  } catch (e) {
    console.warn('Não consegui salvar as configurações:', e);
    return false;
  }
}
