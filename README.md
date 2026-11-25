# 🤖 Robô com IA — Cérebro

Cérebro do robô rodando no celular (moto g05), com a IA pela nuvem (Groq grátis ou Claude) e um ESP32 como corpo.

**Etapa atual: 3 — Voz e câmera ✅**

## Arquivos

```
robo-cerebro/
├── index.html      → a página que abre no celular
├── css/style.css   → visual (fundo preto, tela cheia)
├── js/olhos.js     → desenho e animação dos olhos + lista de emoções
├── js/config.js    → guarda nome, chaves e modelos SÓ no aparelho
├── js/cerebro.js   → conversa com a IA (Groq ou Claude), com foto quando a câmera está ligada
├── js/voz.js       → ouvir (microfone) e falar (voz do celular)
├── js/camera.js    → câmera do celular e foto para a IA
├── js/main.js      → programa principal (conversa, toques, tela cheia, configurações)
└── README.md       → este arquivo
```

## O que já funciona

- Dois olhos que **piscam sozinhos**, **olham em volta** e "respiram" (pulsam de leve)
- 9 emoções: neutro, feliz, triste, bravo, surpreso, sono, desconfiado, pensando, ouvindo
- **Primeiro toque**: entra em tela cheia e impede que a tela apague
- **Toque nos olhos**: "carinho", ele fica feliz por um instante
- **Conversa**: digite na barra de baixo; a IA responde e os olhos mostram a emoção da resposta
- Enquanto você digita ele fica **ouvindo**; enquanto espera a resposta fica **pensando**
- **🎤 Microfone**: toque e fale. Ele mostra o que entendeu, responde e **fala a resposta em voz alta** (os olhos "pulam" enquanto ele fala). Tocar de novo enquanto ele ouve = "terminei de falar".
- **📷 Câmera**: liga a câmera da frente. Aparece uma miniatura no canto. Com ela ligada, cada mensagem leva uma foto e a IA comenta o que vê.
  Se você perguntar "o que você está vendo?" com a câmera desligada, ele liga sozinho.
- **Modo conversa** (na engrenagem): depois de responder, ele já volta a ouvir. Diga "tchau" para parar.
- **Engrenagem ⚙**: nome do robô, quem pensa (Groq ou Claude), chave, modelo, falar em voz alta, modo conversa, câmera da frente/de trás, conversa nova, apagar chave

### Permissões no celular
Na primeira vez, o Chrome pergunta se o site pode usar o **microfone** e a **câmera** → toque em **Permitir**.
Se negou sem querer: toque no **cadeado** ao lado do endereço → **Permissões** → libere microfone e câmera.

### Privacidade
- A voz é transformada em texto pelo Chrome (serviço do Google).
- A foto só é tirada quando a câmera está ligada (miniatura no canto) ou quando você pede para ele ver. Ela vai para a IA escolhida (Groq ou Claude) e **não fica guardada** no histórico do robô.

## Chave da IA

**Groq — grátis (padrão)**
1. Crie uma conta em **console.groq.com** (não pede cartão).
2. Em **API Keys → Create API Key**, copie a chave (começa com `gsk_`).
3. No robô: **engrenagem ⚙ → Quem pensa: Groq** → cole a chave. A lista de modelos aparece sozinha. Toque em **Salvar**.
- Tem limite diário grátis. Se passar, o robô avisa e é só esperar; não há cobrança.

**Claude — pago (opcional)**
1. Conta em **console.anthropic.com** (separada da assinatura do app do Claude).
2. Em **Billing**, coloque um crédito pequeno (ex.: US$ 5). Em **Limits**, defina um limite mensal.
3. Em **API Keys → Create Key**, copie a chave (começa com `sk-ant-`).
4. No robô: **engrenagem ⚙ → Quem pensa: Claude** → cole a chave → **Salvar**. Haiku é o mais barato.

> 🔒 As chaves ficam só no navegador do aparelho. Elas não estão em nenhum arquivo, por isso nunca vão para o GitHub.
> Se achar que alguém viu uma chave, apague ela no site do Groq/Anthropic e crie outra.

## Testar no PC (VS Code)

1. Abra a pasta `robo-cerebro` no VS Code (**Arquivo → Abrir Pasta**).
2. Dê dois cliques no `index.html` pelo Explorador de Arquivos do Windows: abre no Chrome.
   - Ou instale a extensão **Live Server** no VS Code, clique com o botão direito no `index.html` → **Open with Live Server** (atualiza sozinho quando você salva).
3. Teclas para testar:
   - `1` a `9` → emoções
   - setas → olhar para os lados
   - `espaço` → piscar
   - `0` → volta a olhar livremente

## Colocar no GitHub e abrir no celular

1. Entre em **github.com** e crie uma conta (se ainda não tiver).
2. Clique em **New repository** → nome: `robo-cerebro` → **Public** → **Create repository**.
3. Clique em **uploading an existing file** e arraste **o conteúdo da pasta** (index.html, README.md e as pastas css e js) → **Commit changes**.
4. No repositório: **Settings → Pages** → em *Branch* escolha `main` e `/ (root)` → **Save**.
5. Espere 1 ou 2 minutos. O endereço aparece nessa mesma tela, parecido com:
   `https://SEU-USUARIO.github.io/robo-cerebro/`
6. Abra esse endereço no **Chrome do Moto g05**.
7. Dica: menu ⋮ → **Adicionar à tela inicial**. Vira um ícone, como se fosse um app.

> ⚠️ **Nunca** coloque uma chave de IA nos arquivos do GitHub. A chave é digitada na engrenagem do robô e fica guardada só no aparelho.

## Atualizar o site depois de mudar o código

1. No GitHub, abra o repositório `robo-cerebro` → **Add file → Upload files**.
2. Arraste de novo **css**, **js**, **index.html** e **README.md** (os arquivos com o mesmo nome são substituídos).
3. **Commit changes**. Em 1 ou 2 minutos o site atualiza.
4. No celular, recarregue a página. Se continuar a versão antiga, feche a aba e abra de novo.

## Comandos do robô (para as próximas etapas)

Abrindo o console do navegador (F12 no PC), dá para controlar os olhos:

```js
robo.emocao('feliz')   // muda a emoção
robo.olhar(1, 0)       // olha para a direita (x e y de -1 a 1)
robo.olharLivre()      // volta a olhar em volta sozinho
robo.piscar()          // pisca
robo.falar('Oi!')      // manda uma mensagem para a IA
robo.ouvir()           // liga o microfone
robo.dizer('Olá')      // fala em voz alta, sem perguntar à IA
```

## Criar uma emoção nova

Em `js/olhos.js`, na lista `EMOCOES`, copie uma linha, dê um nome novo e mude os números.
Depois coloque o nome bonito em `NOMES_EMOCOES`.

## Próximas etapas

- [x] 1. Olhos animados
- [x] 2. Conversa por texto com a IA (Groq ou Claude)
- [x] 3. Voz (ouvir e falar) e câmera
- [ ] 4. Memória do robô
- [ ] 5. ESP32 + Bluetooth (olhos reagem ao sensor)
- [ ] 6. Mecânica
