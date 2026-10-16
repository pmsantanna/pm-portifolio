# Cena 003 — Noise no navegador

A demo web do Noise, seguindo a spec "Noise — Spec: Demo web no portfólio Serra". As respostas completas da Fase 0 (os dois repositórios) estão no `NOTES.md` da mesma branch no repositório do Noise; aqui fica o que é do Serra.

## Onde está cada coisa

```
src/vendor/noise-core/        cópia do núcleo do Noise — não editar aqui
  COMMIT                      commit do Noise de onde veio (também na 1ª linha de cada .js)
src/scenes/NoiseScene/
  NoiseScene.jsx              moldura do widget, controles, i18n, reveal, ciclo de vida do orbe
  useDemoAudio.js             AudioContext, faixa demo, arquivo, microfone
  useLyrics.js                parser de .lrc + linha ativa
  styles.js                   CSS da cena (vai no chunk lazy)
  assets/                     faixa demo (.mp3 + .ogg), .lrc, metadados, capa
scripts/
  sync-noise-core.sh          copia o noise-core de um checkout do Noise e carimba o commit
  make-demo-track.mjs         gera áudio, .lrc e .json da mesma partitura (precisa de ffmpeg)
```

`Serra.jsx` só ganhou o `NoiseSlot`: uma `<section>` vazia que carrega a cena com `React.lazy` quando a página chega a uma altura de tela dela (`useReveal(0, '100% 0px')`). `useReveal` ganhou o segundo parâmetro, `rootMargin`, opcional; os usos antigos não mudam.

## Diferenças em relação à spec

- **Não existe `TerminalScene`.** A cena de terminal é `DataBridgeScene` (CENA 002). A do Noise entra logo depois, como CENA 003.
- **`setTheme({ deep, bright })`** em vez de `{ base, glow, seam }`: o orbe não desenha costura entre células, e as duas pontas do degradê são o tema inteiro. Noir: cinza claro → branco quente, sem saturação. Holo: as duas pontas percorrem o foil do site (`#8fa6ff → #ff9ddb → #7fe9c3 → #a894ff`) a cada 22 s, o período do `holo-shift`.
- **A tela é escura nos dois temas.** É um monitor, não a página; no Holo ela ganha o fio de foil no topo, como os cards.
- **Pele** aparece como um seletor desabilitado com "em breve" (a Fase 3 não foi feita).
- **"Baixar para Windows"** aparece desabilitado com "em breve": não há instalador publicado. Quando houver, é só preencher `DOWNLOAD_URL` no topo de `NoiseScene.jsx`.
- **"Ver código"** aponta para `github.com/pmsantanna/noise`, que hoje é privado. O link dá 404 para visitantes até o repositório virar público.
- **Reduced motion:** o núcleo já usa os valores reduzidos do app (sem rotação); a cena passa `amplitude: 0.5` em cima disso, o que dá entre 20% e 32% do deslocamento normal conforme o uniform — a spec pede 30%. Em idle a esfera fica parada e o loop deixa de desenhar.
- **Letras com arquivo do visitante ou microfone** somem; o card mostra o nome do arquivo (ou "Microfone") e um botão para voltar à demo.
- **Navegador sem WebGL:** a cena não cai — som, letra e controles continuam e a capa ocupa o lugar do orbe.

## A faixa demo

*Drunken Sailor*: melodia e letra tradicionais, domínio público. O arranjo — bumbo reto a 118 BPM, baixo no contratempo, pad, melodia sintetizada, eco e uma reverb pequena — é gerado por `scripts/make-demo-track.mjs`, sem amostra de ninguém, e dedicado ao domínio público (CC0 1.0). 83 s, mp3 de 128 kbps mono (1,33 MB) e ogg de fallback (0,7 MB). O crédito está no rodapé da cena.

O `.lrc` sai da mesma partitura que toca: cada linha é o instante da primeira nota da frase. A melodia foi conferida no espectrograma, não de ouvido — vale uma escuta antes de publicar.

## Critérios de aceite da Fase 2

Conferidos em Chromium headless (Playwright, WebGL por SwiftShader):

| Critério | Resultado |
|---|---|
| Idle visível logo após o reveal, sem som | Chunk e orbe já existem quando o reveal dispara (o chunk baixa uma tela antes); nada toca antes do clique |
| Play toca; orbe e 64 barras no mesmo quadro | A barra é desenhada no `onFrame` do orbe, com os mesmos números |
| Letra no tempo do LRC, erro ≤ 100 ms | 1–9 ms com a lógica isolada; na cena completa o erro fica limitado pelo intervalo de quadro (a ~5 fps do WebGL por software deu 100–400 ms; a 60 fps o teto é ~17–33 ms) |
| Arquivo troca a fonte e esconde a letra | ok |
| Microfone só pede permissão no clique | ok; vai só para o analisador, nunca para os alto-falantes |
| PT/EN troca todos os textos | ok, dentro do fade de 300 ms do site |
| Noir/Holo muda as cores sem recriar a cena | ok — o mesmo `<canvas>` antes e depois da troca |
| Sair pausa áudio e render; 5 s fora libera o WebGL | ok — pausa ao sair; após 5 s o canvas é removido e `forceContextLoss()` solta o contexto |
| Chunk lazy ≤ 60 KB gzip | 22,6 KB |
| Áudio ≤ 1,5 MB, só no Play | 1,33 MB; nenhum pedido de `demo-track` antes do Play |
| Layout mobile (< 768 px) | widget de 280 px centralizado, letra embaixo, texto depois; sem rolagem horizontal a 390 px |

**Não conferido aqui** e pendente antes de publicar:

- **FPS** (≥ 60 desktop, ≥ 30 mobile) em Chrome, Firefox e Safari iOS — o container só tem WebGL por software. A queda automática para o perfil leve abaixo de 40 fps por 2 s está ligada no desktop.
- **Lighthouse ≤ 3 pontos de queda** — no container o mesmo build base deu 58, 63 e 89 em três rodadas; o número não significa nada aqui. O que muda no carregamento inicial é só o bundle principal: +3,2 KB gzip (as chaves de i18n da cena e o `NoiseSlot`). A cena e a faixa não são baixadas sem rolagem.
- **`Range` no host**: `curl -I -H 'Range: bytes=0-1' <url do mp3>` tem que responder `206`.

## Atualizar o núcleo

```sh
scripts/sync-noise-core.sh ../noise    # recusa se o noise-core tiver mudança não commitada
```
