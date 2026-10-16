// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * Todas as medidas do estojo num lugar só.
 *
 * Unidade: 1 = 100 mm. O disco é o de verdade (120 mm, furo de 15 mm); o
 * estojo é estilizado: quadrado, 142 × 142, com o disco no meio. Na
 * referência, estojo/disco dá 1,19 nos dois eixos — o jewel case real
 * (142 × 125) deixava o disco quase encostado em cima e embaixo, sem
 * espaço para a estrutura de dentro (nervuras, abas, dedos). Ajustar a
 * proporção é mexer aqui, não caçar constante pela cena.
 *
 * Eixos: o estojo fica de frente para a câmera, no plano XY, com a
 * espessura em Z (+Z aponta para quem olha). A dobradiça fica na lateral
 * esquerda; a tampa é a face da frente.
 */
export const CASE_DIMENSIONS = {
  largura: 1.42,
  altura: 1.42,
  espessura: 0.104,
  // >= o maior recuo dos perfis varridos (0,048, na tampa): com menos, os
  // cantos de dentro da varredura se dobram e o canto sai rasgado
  raioCanto: 0.05,

  base: 0.014,            // placa do fundo da bandeja
  tampa: 0.016,           // placa da tampa

  disco: {
    raio: 0.6,            // 120 mm
    furo: 0.075,          // 15 mm
    espessura: 0.020,     // 2 mm (o real é 1,2: de lado, a parede sumia; acima disso vira bolacha de chope)
    quina: 0.005,         // raio do arredondado da borda de fora
    centroX: 0,           // centrado: na referência, a 1–2 px do meio
    empilhar: { centro: 0.163, largura: 0.008, altura: 0.0015 },
    metal: { dentro: 0.172, fora: 0.588 },
    trilhas: { dentro: 0.23, fora: 0.582 },
    rotulo: { dentro: 0.185, fora: 0.57, espessura: 0.0025, bisel: 0.0006 },
    miolo: 0.172,
  },

  // a roseta: até 0,165 ela mora dentro da parte clara do disco
  // (0,075–0,172), onde aparece; mais para fora o metal opaco esconderia
  hub: {
    raio: 0.165,
    altura: 0.012,
    dentes: 12,
  },

  // os nós da dobradiça ficam dentro da silhueta (recuo = raio): para
  // fora, viravam dois calombos na lateral esquerda
  dobradica: {
    raio: 0.014,
    comprimento: 0.10,
    y: 0.40,              // ± a partir do centro
    recuo: 0.014,         // do lado esquerdo até o eixo dos cilindros
  },

  // as abas do encarte, presas na tampa, do lado oposto à dobradiça; em
  // ±0,22 caem no vão entre a parede e os braços direitos dos canais em L
  abas: {
    largura: 0.018,
    altura: 0.13,
    profundidade: 0.03,
    y: [-0.22, 0.22],
  },

  // a arte é quadrada (o 1,30 × 1,17 de antes a esticava); 1,34 cabe
  // dentro do degrau da parede (u = 0,034)
  encarte: { largura: 1.34, altura: 1.34 },

  // os quatro canais em L de nervura dupla nos cantos de dentro da bandeja
  interno: {
    recuo: 0.058,         // do contorno até a quina do L: sobra um vão visível depois da parede
    nervura: 0.010,       // largura de cada nervura (o bisel soma 0,004 de cada lado)
    vao: 0.014,           // entre as duas nervuras do canal
    altura: 0.055,        // do fundo até o topo das nervuras
    braco: 0.32,          // braços de cima, de baixo e da direita
    bracoLombada: 0.44,   // braços da esquerda: param logo acima e abaixo da trava
    raio: 0.03,           // quina de fora do L
  },

  // a trava da tampa, medida na referência: 0,22 × 0,40 com um laço de
  // dentro de 0,11 × 0,26, por cima do disco no meio da esquerda
  trava: {
    largura: 0.22,
    altura: 0.40,
    barra: 0.012,
    raio: 0.03,
    profundidade: 0.007,
    interno: { largura: 0.11, altura: 0.26, raio: 0.03 },
  },

  // abas radiais que seguram a borda do disco (paradas: o disco gira por baixo)
  abasDisco: { angulos: [60, 120, 240, 300], raio: 0.612, comprimento: 0.05, largura: 0.02 },

  // os dedos em J dos dois cantos de baixo
  dedos: { x: 0.48, yBase: -0.612, yTopo: -0.47, largura: 0.018, altura: 0.03 },

  aberturaGraus: 105,
}

/**
 * Alturas em Z derivadas das medidas: quem fica na frente de quem.
 *
 * Com as medidas de hoje (z):
 *   encarte -0,0528 · fundo -0,052 · baseFrente -0,038 · discoFundo -0,0255
 *   discoFrente -0,0055 · rotuloFrente -0,003 · adesivos <= +0,004
 *   ombro +0,008 · topo das nervuras +0,017 · fundo da trava +0,029
 *   tampaFundo +0,036 · dobradicaZ +0,044 · tampaFrente +0,052 · aro da tampa +0,056
 */
export function camadas(D = CASE_DIMENSIONS) {
  const fundo = -D.espessura / 2
  const baseFrente = fundo + D.base
  const tampaFundo = D.espessura / 2 - D.tampa
  // meio milímetro de folga sobre o hub: o disco apoia, não afunda nele
  const discoFundo = baseFrente + D.hub.altura + 0.0005
  return {
    fundo,
    baseFrente,
    // o encarte fica atrás da placa do fundo: visto através de 1,4 mm de
    // plástico, com paralaxe, como o papel de um estojo de verdade
    encarte: fundo - 0.0008,
    hubFundo: baseFrente,
    discoFundo,
    discoFrente: discoFundo + D.disco.espessura,
    rotuloFrente: discoFundo + D.disco.espessura + D.disco.rotulo.espessura,
    // o ombro da parede: onde a saia da tampa encosta, por fora
    ombro: tampaFundo - 0.028,
    tampaFundo,
    tampaFrente: D.espessura / 2,
    dobradicaZ: D.espessura / 2 - D.tampa / 2,
  }
}
