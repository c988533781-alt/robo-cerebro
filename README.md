# 🤖 Robô com IA — Cérebro

Cérebro do robô rodando no celular (Moto g05), com o Claude pela nuvem e um ESP32 como corpo.

**Etapa atual: 1 — Olhos animados ✅**

## Arquivos

```
robo-cerebro/
├── index.html      → a página que abre no celular
├── css/style.css   → visual (fundo preto, tela cheia)
├── js/olhos.js     → desenho e animação dos olhos + lista de emoções
├── js/main.js      → programa principal (toques, tela cheia, comandos do robô)
└── README.md       → este arquivo
```

## O que já funciona

- Dois olhos que **piscam sozinhos**, **olham em volta** e "respiram" (pulsam de leve)
- 9 emoções: neutro, feliz, triste, bravo, surpreso, sono, desconfiado, pensando, ouvindo
- **Primeiro toque**: entra em tela cheia, deita a tela e impede que ela apague
- **Cada toque depois**: muda a emoção

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

> ⚠️ **Nunca** coloque a chave da API do Claude nos arquivos do GitHub. Na etapa 2 a chave vai ser digitada no próprio celular e guardada só nele.

## Comandos do robô (para as próximas etapas)

Abrindo o console do navegador (F12 no PC), dá para controlar os olhos:

```js
robo.emocao('feliz')   // muda a emoção
robo.olhar(1, 0)       // olha para a direita (x e y de -1 a 1)
robo.olharLivre()      // volta a olhar em volta sozinho
robo.piscar()          // pisca
```

## Criar uma emoção nova

Em `js/olhos.js`, na lista `EMOCOES`, copie uma linha, dê um nome novo e mude os números.
Depois coloque o nome bonito em `NOMES_EMOCOES`.

## Próximas etapas

- [x] 1. Olhos animados
- [ ] 2. Conversa por texto com o Claude
- [ ] 3. Voz: ouvir e falar
- [ ] 4. Memória do robô
- [ ] 5. ESP32 + Bluetooth (olhos reagem ao sensor)
- [ ] 6. Mecânica
