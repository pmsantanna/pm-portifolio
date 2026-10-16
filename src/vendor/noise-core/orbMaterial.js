// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

/* Shaders, uniformes e materiais do orbe.
 *
 * Saíram do Orb.jsx sem mudar uma linha de GLSL: o app desktop e a demo
 * web desenham com estas mesmas strings, e é isso que garante que os dois
 * mostram o mesmo objeto. Nada aqui conhece React, Electron ou a página
 * que hospeda o canvas.
 */

/* Ashima simplex noise 3D — só para a respiração de fundo */
export const SNOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`

export const VERT = `
uniform float     uTime;
uniform sampler2D uBands;
uniform float     uCells;
uniform float     uReact;   // quanto a faixa empurra a superfície para fora
uniform float     uPeak;    // reforço que só acorda nos picos
uniform float     uBreath;  // noise de fundo, para o desenho não se repetir
uniform float     uLive;    // 0 no silêncio, 1 tocando — porta do noise

attribute vec4 aCells;
attribute vec4 aCellsB;
attribute vec4 aWeights;
attribute vec4 aWeightsB;

varying float vFacing;
varying float vAmp;
varying vec2  vNdc;

${SNOISE}

float bandAt(float i) {
  return texture2D(uBands, vec2((i + 0.5) / uCells, 0.5)).r;
}

void main() {
  float radius = length(position);
  vec3  n = position / radius;

  // média ponderada das seis faixas mais próximas: campo contínuo, sem
  // fronteira de célula para virar vinco na superfície
  float amp = dot(aWeights,  vec4(bandAt(aCells.x),  bandAt(aCells.y),
                                  bandAt(aCells.z),  bandAt(aCells.w)))
            + dot(aWeightsB, vec4(bandAt(aCellsB.x), bandAt(aCellsB.y),
                                  bandAt(aCellsB.z), bandAt(aCellsB.w)));

  /* Noise de fundo, mas só enquanto há som.
   *
   * Ele existe para o desenho não se repetir: sem isso, duas passagens da
   * mesma faixa dão exatamente a mesma forma. Deixá-lo ligado o tempo todo
   * é o que fazia o orbe ondular sozinho no silêncio, quando ele deveria
   * ser só uma esfera. uLive vem do pico das faixas, então é zero sem
   * áudio e a superfície fecha numa esfera limpa.
   *
   * As oitavas altas são o que enruga: entram mais graves e com menos peso
   * do que as largas, senão a superfície ganha textura de casca.
   */
  float n1 = snoise(position * 0.90 + vec3(0.0, uTime * 0.22, uTime * 0.10));
  float n2 = snoise(position * 1.75 + vec3(uTime * 0.16, 0.0, -uTime * 0.24));
  float n3 = snoise(position * 3.10 + vec3(-uTime * 0.30, uTime * 0.12, 0.0));
  float breath = (n1 * 0.78 + n2 * 0.18 + n3 * 0.04) * uLive;

  // o termo cúbico só sai do chão quando a faixa está mesmo forte: o
  // repouso fica mais liso e o pico sobe bem mais alto que antes
  float push = amp * uReact + amp * amp * amp * uPeak;

  vec3 pos = n * (radius + breath * uBreath + push);

  vAmp = amp;

  // Facing calculado aqui, não com gl_FrontFacing no fragment.
  //
  // Com wireframe o Three desenha gl.LINES, e em GLES o culling só vale para
  // triângulos: as arestas do hemisfério de trás são rasterizadas de todo
  // jeito, e gl_FrontFacing é sempre true fora de triângulos. Era por isso
  // que a malha de trás vinha com brilho cheio por cima da da frente,
  // dobrando cada aresta. Com o produto escalar entre a direção da câmera e
  // a normal, o lado oposto fica identificável em qualquer primitiva.
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vFacing = dot(normalize(-mv.xyz), normalize(normalMatrix * n));

  gl_Position = projectionMatrix * mv;
  vNdc = gl_Position.xy / gl_Position.w;
}
`

export const FRAG = `
uniform vec3  uDeep;
uniform vec3  uBright;
uniform float uAlpha;
uniform float uBack;    // quanto do brilho sobra na malha de trás
uniform float uPower;

varying float vFacing;
varying float vAmp;
varying vec2  vNdc;

void main() {
  // abs() porque a silhueta é onde a normal fica perpendicular à visão,
  // dos dois lados do orbe
  float fres = pow(1.0 - abs(vFacing), uPower);

  // gradiente diagonal fixo na tela: ciano no alto à esquerda, violeta
  // embaixo à direita — não gira junto com o orbe, como na referência
  float g = clamp(0.5 + vNdc.y * 0.52 - vNdc.x * 0.18, 0.0, 1.0);
  vec3 tint = mix(uDeep, uBright, g);

  float glow = 0.34 + fres * 0.66 + vAmp * 1.1;

  // a malha de trás aparece mais tênue, dando profundidade ao volume.
  // a transição é suave na silhueta, senão a borda do orbe ganha um degrau
  float front = smoothstep(-0.12, 0.12, vFacing);
  float alpha = uAlpha * mix(uBack, 1.0, front);

  gl_FragColor = vec4(tint * glow, clamp(glow, 0.0, 1.0) * alpha);
}
`

/* ---------------------------------------------------------------------
 * Pele Hexcore: uma casca só, furada.
 *
 * A primeira versão eram placas soltas flutuando. Errado: na referência a
 * estrutura é contínua, e é justamente por ser contínua que se enxerga a
 * face interna do outro lado através dos furos. Placas separadas não têm
 * "outro lado".
 *
 * Então nada de recortar geometria. A casca é a mesma malha fechada, e o
 * buraco é aberto no fragment: cada célula descarta os pixels em volta da
 * sua semente. O que sobra entre os furos são as traves, e elas continuam
 * ligadas porque nunca foram separadas.
 *
 * O teste do furo é feito por ângulo até o centro da célula, calculado por
 * pixel — não por um valor interpolado nos vértices. É a diferença entre
 * uma borda redonda e um polígono denteado com o número de lados que a
 * subdivisão der.
 * ------------------------------------------------------------------- */

/** Quantos espinhos. Precisa casar com o tamanho do array de uniformes. */
export const SPIKES = 18

export const HEX_VERT = `
#define SPIKES ${SPIKES}
uniform float     uTime;
uniform sampler2D uBands;
uniform float     uCells;
uniform float     uReact;
uniform float     uPeak;
uniform float     uBreath;
uniform float     uLive;
uniform vec3      uSpike[SPIKES];
uniform float     uSpikeAmp[SPIKES];  // estado da mola de cada ponta
uniform float     uSpikeLen;   // altura da ponta
uniform float     uSpikeW;     // meia-largura angular da ponta
uniform float     uArmLen;     // altura da puxada larga que forma o braço
uniform float     uArmW;       // meia-largura angular do braço
uniform float     uShrink;     // o quanto a casca encolhe conforme as pontas sobem
uniform float     uSpikeMean;  // média das pontas: quanto foi puxado no total

attribute vec4  aCells;
attribute vec4  aCellsB;
attribute vec4  aWeights;
attribute vec4  aWeightsB;
attribute float aPlate;
attribute vec3  aCenter;
attribute float aRoom;

varying vec3  vDir;      // direção do vértice na esfera
varying vec3  vCenter;   // direção da semente dona
varying float vBand;     // campo suave das seis faixas — sombreamento
varying float vCellBand; // faixa dura da célula — só o tamanho do furo
varying float vHoleScale;// tamanho próprio do furo desta célula
varying float vRoom;     // até onde esta célula pode abrir sem romper
varying float vPhase;    // orientação própria dos lóbulos
varying float vSpike;    // proximidade da base de um espinho
varying vec3  vNrm;
varying vec3  vView;

${SNOISE}

float bandAt(float i) {
  return texture2D(uBands, vec2((i + 0.5) / uCells, 0.5)).r;
}

void main() {
  float radius = length(position);
  vec3  n = position / radius;

  // a casca se deforma como no arame: campo suave de seis faixas, para o
  // volume não ganhar vinco entre células vizinhas
  float amp = dot(aWeights,  vec4(bandAt(aCells.x),  bandAt(aCells.y),
                                  bandAt(aCells.z),  bandAt(aCells.w)))
            + dot(aWeightsB, vec4(bandAt(aCellsB.x), bandAt(aCellsB.y),
                                  bandAt(aCellsB.z), bandAt(aCellsB.w)));

  float n1 = snoise(position * 0.90 + vec3(0.0, uTime * 0.22, uTime * 0.10));
  float n2 = snoise(position * 1.75 + vec3(uTime * 0.16, 0.0, -uTime * 0.24));
  float breath = (n1 * 0.80 + n2 * 0.20) * uLive;

  float push = amp * uReact + amp * amp * amp * uPeak;

  /* Espinhos.
   *
   * Dois raios de influência a partir do mesmo ponto. O estreito, elevado
   * ao cubo, é o que levanta o bico: com queda cúbica a ponta fecha em
   * cúspide em vez de cúpula. O largo é uma máscara passada ao fragment
   * para encolher os furos em volta — sem ela, o furo da célula vizinha
   * comeria a lateral do espinho e ele nasceria rasgado.
   */
  /* Membrana, não esfera com pregos.
   *
   * Duas influências por ponta. A larga forma o braço: alcança quase até
   * a ponta vizinha, então a casca inteira é puxada, não só a vizinhança
   * imediata. A estreita, ao cubo, fecha o bico.
   *
   * E o volume tem de sair de algum lugar. uShrink encolhe a casca toda na
   * proporção do que as pontas estão puxando, então a superfície entre
   * dois braços afunda em vez de continuar esférica. É essa concavidade
   * que faz a silhueta virar estrela em vez de bola espetada — na
   * referência não há um único trecho convexo entre as pontas.
   */
  float braco = 0.0;
  float bico = 0.0;
  float base = 0.0;
  for (int i = 0; i < SPIKES; i++) {
    vec3  s = uSpike[i];
    float amp = uSpikeAmp[i];
    float a = acos(clamp(dot(n, s), -1.0, 1.0));

    float l = max(0.0, 1.0 - a / uArmW);
    braco = max(braco, l * l * amp);

    // esticando, afina; recolhendo, engrossa. É o que separa um jato de
    // líquido de um cone de borracha crescendo
    float w = uSpikeW * (1.0 - 0.34 * clamp(amp, 0.0, 1.0));
    float t = max(0.0, 1.0 - a / w);
    bico = max(bico, t * t * t * amp);

    base = max(base, max(0.0, 1.0 - a / (uSpikeW * 1.9)));
  }

  float alturaBico = braco * uArmLen + bico * uSpikeLen - uShrink * uSpikeMean;

  vec3  pos = n * (radius + breath * uBreath + push + alturaBico);

  vSpike  = base;
  vDir    = n;
  vCenter = aCenter;
  vNrm    = normalize(normalMatrix * n);

  /* Duas leituras da mesma música, e elas não podem ser a mesma varying.
   *
   * O tamanho do furo é por célula, então vem da faixa dura — furo é uma
   * coisa só, não tem gradiente por dentro.
   *
   * O sombreamento tem que vir do campo suave. aCenter é constante no
   * triângulo, então a faixa dura salta de valor na divisa entre células;
   * usada no brilho, ela desenha um degrau serrilhado atravessando a
   * esfera, exatamente onde uma célula alta encosta numa baixa.
   */
  vCellBand = bandAt(aPlate);
  vBand     = amp;
  vRoom     = aRoom;

  /* Tamanho do furo, por célula.
   *
   * Furos todos do mesmo tamanho leem como padrão industrial. Na
   * referência há regiões de furo grande e regiões de furo miúdo, então
   * são dois termos: um noise de frequência baixa, que agrupa células
   * vizinhas num mesmo regime, e um sorteio por célula, que quebra a
   * regularidade dentro do grupo. Só noise daria manchas suaves demais;
   * só sorteio, sal e pimenta.
   *
   * Calculado aqui e não no fragment porque aCenter é constante no
   * triângulo: o valor atravessa a interpolação intacto e sai de graça,
   * em vez de custar um noise por pixel.
   */
  vec3  c = normalize(aCenter);
  float sorteio = fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
  float agrupa  = snoise(c * 1.35);

  /* Tamanho do furo: um só por célula, variando de forma contínua.
   *
   * Houve uma versão em que algumas células viravam "cacho" — um furo
   * miúdo com três satélites em volta. Lia como um trevo repetido, e pior
   * ainda porque as células de cacho batiam todas no piso do raio e saíam
   * do mesmo tamanho: um motivo carimbado sobre a casca em vez de
   * variação. A variação contínua abaixo, sem casos especiais, é mais
   * parecida com a referência do que o desenho que eu tinha imposto.
   */
  vHoleScale = 0.66 + 0.28 * smoothstep(-0.7, 0.7, agrupa) + 0.14 * sorteio;
  vPhase     = sorteio * 6.2831853;

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

export const HEX_FRAG = `
uniform vec3  uDeep;
uniform vec3  uBright;
uniform float uLive;
uniform float uHole;     // raio do furo em repouso, em radianos
uniform float uHoleAmp;  // o quanto a faixa abre mais
uniform float uHoleMin;  // piso, para o furo não degenerar
uniform float uStrut;    // meia-espessura da trave entre dois furos

varying vec3  vDir;
varying vec3  vCenter;
varying float vBand;
varying float vCellBand;
varying float vHoleScale;
varying float vRoom;
varying float vSpike;
varying float vPhase;
varying vec3  vNrm;
varying vec3  vView;

void main() {
  vec3 c = normalize(vCenter);
  vec3 d = normalize(vDir);

  // ângulo até o centro da célula, por pixel: é o que dá a borda redonda
  float ang = acos(clamp(dot(d, c), -1.0, 1.0));

  /* Ângulo em volta do centro da célula, para deformar o furo.
   *
   * A base tangente vira de repente perto dos polos, mas cada furo é
   * independente: virar só gira os lóbulos daquele furo, não deixa
   * costura como deixaria num campo contínuo.
   */
  vec3  cima = abs(c.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3  e1 = normalize(cross(cima, c));
  vec3  e2 = cross(c, e1);
  vec3  t  = d - c * dot(d, c);
  float phi = atan(dot(t, e2), dot(t, e1));

  /* Deformação do furo.
   *
   * Praticamente só o harmônico de 2, que é uma elipse: sempre convexa,
   * sempre redonda. Os de 3 e 5 é que davam as formas quadriculares — um
   * harmônico de ordem k desenha um polígono arredondado de k lados, e em
   * amplitude alta o polígono aparece antes do círculo. Ficam só como um
   * traço, para tirar a perfeição sem impor forma.
   */
  float lobo = 1.0
    + 0.115 * cos(2.0 * (phi - vPhase))
    + 0.028 * sin(3.0 * phi + vPhase * 1.7);

  // cada faixa abre o seu próprio furo, sobre o tamanho sorteado da célula
  float raio = (uHole * (0.30 + 0.70 * uLive) + vCellBand * uHoleAmp) * vHoleScale * lobo;

  /* Piso e teto no raio.
   *
   * O piso porque os lóbulos são multiplicativos: num furo pequeno o
   * harmônico pesa mais que o próprio raio e a forma degenera — deixa de
   * ser um círculo deformado e vira um respingo. Ele acompanha uLive para
   * o silêncio continuar fechando a casca.
   *
   * O teto é vRoom, calculado por célula: metade da distância até a
   * vizinha mais próxima, menos a margem da trave. Um teto único para
   * todas rompia a malha, porque a espiral de Fibonacci não espaça as
   * sementes uniformemente e os pares mais apertados se encontravam.
   */
  // vRoom é o limite absoluto — onde dois furos vizinhos se encostam.
  // uStrut recua dali para deixar a trave da espessura que a pele quer.
  float teto = max(0.045, vRoom - uStrut);

  float piso = uHoleMin * (0.45 + 0.55 * uLive);
  raio = clamp(raio, piso, teto);

  // o furo recua na base do espinho, senão a célula vizinha o rasgaria
  raio *= 1.0 - 0.95 * vSpike;

  // distância com sinal até a borda do furo: negativo é dentro
  float sinal = ang - raio;

  if (sinal < 0.0) discard;

  // gl_FrontFacing vale aqui: isto são triângulos, não linhas
  vec3  nrm = normalize(vNrm) * (gl_FrontFacing ? 1.0 : -1.0);
  float fres = pow(1.0 - abs(dot(normalize(vView), nrm)), 2.2);

  /* 1 na beirada de qualquer um dos furos, caindo para dentro da trave.
   *
   * A largura encolhe junto com a trave. Fixa, ela vazaria a divisa quando
   * o furo é grande, e o brilho saltaria contra a célula vizinha, que tem
   * outro raio — de novo o degrau serrilhado.
   */
  // a folga até a trave é o que sobra de vRoom; o halo cabe nela
  float rimW = clamp((teto - raio) * 0.60 + 0.006, 0.006, 0.045);
  float rim = 1.0 - smoothstep(0.0, rimW, sinal);

  float luz = max(0.0, dot(nrm, normalize(vec3(0.42, 0.78, 0.55))));
  vec3  pedra = vec3(0.052, 0.046, 0.062) * (0.35 + luz * 1.05);

  // a irisação da referência: a cor vira ao longo do ângulo de visada
  vec3 iris = mix(uDeep, uBright, fres);

  vec3 cor = pedra
           + iris * (fres * 0.42 + rim * (0.45 + uLive * 0.40) + vBand * 0.55)
           + uBright * vSpike * vSpike * (0.10 + uLive * 0.22);   // o bico acende

  // a face interna, vista pelos furos, recebe a luz do núcleo. Fica mais
  // clara que a trave — é isso que dá o contraste da referência, casca
  // escura com luz atravessando
  if (!gl_FrontFacing) cor += uBright * (0.10 + vBand * 0.30);

  gl_FragColor = vec4(cor, 1.0);
}
`

/* ---------------------------------------------------------------------
 * Pele Sigil: cybersigilismo, cromo líquido.
 *
 * A estrutura é a mesma da Hexcore — o palpite do pedido estava certo. O
 * que muda são dois limiares e o material.
 *
 * A trave recua quase até o limite absoluto, então sobram nervuras finas
 * em vez de casca perfurada; e as pontas ficam bem mais longas e bem mais
 * estreitas, que é a agulha do cybersigilismo em vez do espinho de ouriço.
 *
 * O material não tem cor própria. Cromo é quase todo reflexo, então em vez
 * de iluminar a superfície, reflete-se um ambiente inventado: claro em
 * cima, escuro embaixo, com uma banda dura no horizonte. É essa banda que
 * dá a leitura de metal polido — sem ela o material lê como plástico
 * cinzento, por mais especular que esteja.
 * ------------------------------------------------------------------- */

/* O ambiente refletido, dividido entre a casca e o líquido.
 *
 * Um ambiente parado só se mexe no reflexo se a normal se mexer — e numa
 * esfera girando, a normal em cada ponto da tela é sempre a mesma. Era
 * metade do porquê de o cromo parecer estático: o orbe girava e a imagem
 * não. Então o horizonte ondula e deriva com o tempo, e o som agita a
 * deriva. O reflexo escorre pelo metal até com tudo parado.
 */
export const CHROME = `
float chrome(vec3 r, float fres, float tempo, float agita) {
  float onda = ( 0.11 * sin(r.x * 2.7 + tempo * 0.50)
               + 0.07 * sin(r.z * 4.1 - tempo * 0.34)
               + 0.05 * sin((r.x + r.z) * 6.3 + tempo * 0.73)) * (0.45 + 0.9 * agita);
  float ry = r.y + onda;

  float ceu = smoothstep(-0.25, 0.70, ry);
  float alto = pow(max(0.0, ry), 6.0);
  float horizonte = 1.0 - smoothstep(0.0, 0.075, abs(ry));

  float metal = 0.045 + ceu * 0.62 + alto * 0.45 + horizonte * 0.75;

  // duas luzes duras, como num estúdio
  metal += pow(max(0.0, dot(r, normalize(vec3( 0.45, 0.72, 0.52)))), 90.0) * 1.5;
  metal += pow(max(0.0, dot(r, normalize(vec3(-0.60, 0.20, 0.40)))), 60.0) * 0.8;

  return metal + fres * 0.55;
}
`

export const SIGIL_FRAG = `
uniform vec3  uDeep;
uniform vec3  uBright;
uniform float uTime;
uniform float uLive;
uniform float uHole;
uniform float uHoleAmp;
uniform float uHoleMin;
uniform float uStrut;
uniform float uTint;     // quanto do tema entra no cromo

varying vec3  vDir;
varying vec3  vCenter;
varying float vBand;
varying float vCellBand;
varying float vHoleScale;
varying float vRoom;
varying float vSpike;
varying float vPhase;
varying vec3  vNrm;
varying vec3  vView;

${CHROME}

void main() {
  vec3 c = normalize(vCenter);
  vec3 d = normalize(vDir);

  float ang = acos(clamp(dot(d, c), -1.0, 1.0));

  vec3  cima = abs(c.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
  vec3  e1 = normalize(cross(cima, c));
  vec3  e2 = cross(c, e1);
  vec3  t  = d - c * dot(d, c);
  float phi = atan(dot(t, e2), dot(t, e1));

  float lobo = 1.0
    + 0.115 * cos(2.0 * (phi - vPhase))
    + 0.028 * sin(3.0 * phi + vPhase * 1.7);

  float raio = (uHole * (0.30 + 0.70 * uLive) + vCellBand * uHoleAmp) * vHoleScale * lobo;
  float teto = max(0.045, vRoom - uStrut);
  float piso = uHoleMin * (0.45 + 0.55 * uLive);
  raio = clamp(raio, piso, teto);
  raio *= 1.0 - 0.95 * vSpike;

  if (ang < raio) discard;

  /* A nervura tem corpo, não é só um recorte.
   *
   * A casca é uma superfície de espessura zero e a normal dela é a da
   * esfera lisa. Cromo sobre essa normal é um decalque — o reflexo
   * atravessa a treliça reto, como se ela fosse uma máscara pintada na
   * bola. Aqui a normal rola na travessia da nervura, da borda deste furo
   * à do vizinho, como se cada nervura fosse um tubo: no meio aponta para
   * fora, nas beiradas deita para dentro do furo. É essa curvatura que
   * dobra a linha do horizonte em cada nervura — e, como os furos giram
   * com o orbe, o reflexo enfim gira junto.
   */
  vec3  nrm = normalize(vNrm) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3  lateral = dot(t, t) > 1.0e-8 ? normalize(t) : vec3(0.0);
  float divisa = max(vRoom, raio + 0.01);
  float u01 = clamp((ang - raio) / (2.0 * (divisa - raio)), 0.0, 1.0);
  float rolagem = cos(u01 * 3.14159265);   // +1 nesta borda, -1 na do vizinho
  nrm = normalize(nrm - lateral * rolagem * 0.85 * (1.0 - vSpike));

  /* A agulha usa a normal da geometria de verdade.
   *
   * O tubo acima é um anel em volta do furo e não vale na ponta; e a
   * normal da esfera erra mais justamente ali, onde a superfície mais se
   * afasta dela. As derivadas de tela dão a normal do triângulo como ele
   * está, agulha esticada e tudo. Sai facetada, mas numa ponta estreita a
   * faceta lê como quina de metal lapidado, não como defeito.
   */
  vec3 vis = normalize(vView);
  vec3 gN = normalize(cross(dFdx(vView), dFdy(vView)));
  if (dot(gN, vis) < 0.0) gN = -gN;
  nrm = normalize(mix(nrm, gN, smoothstep(0.15, 0.65, vSpike)));

  vec3  r = reflect(-vis, nrm);
  float fres = pow(1.0 - abs(dot(vis, nrm)), 2.6);

  float metal = chrome(r, fres, uTime, uLive);

  // a nervura acende na aresta do furo: é a quina viva do metal
  float rimW = clamp((teto - raio) * 0.60 + 0.006, 0.006, 0.045);
  float rim = 1.0 - smoothstep(0.0, rimW, ang - raio);
  metal += rim * 0.55;

  // o interior visto pelos furos é o mesmo metal, só mais fundo
  if (!gl_FrontFacing) metal *= 0.42;

  // cromo é acromático; o tema entra só como um véu, para os temas ainda
  // significarem algo sem virar plástico colorido
  vec3 cor = mix(vec3(metal), mix(uDeep, uBright, clamp(metal, 0.0, 1.0)) * metal, uTint);

  gl_FragColor = vec4(cor, 1.0);
}
`

/* O preenchimento: cromo líquido.
 *
 * Pelos furos da Hexcore se vê um núcleo de luz; pelos da Sigil se via só
 * o verso da própria casca, parado. Nas referências o interior é cheio —
 * metal atrás do metal. Este é um blob que ondula por noise no vértice e
 * é sombreado com o mesmo ambiente da casca, um degrau mais fundo. É a
 * parte que nunca para de se mexer, mesmo com a treliça quieta.
 */
export const LIQ_VERT = `
uniform float uTime;
uniform float uLive;
uniform float uPulse;

varying vec3 vNrm;
varying vec3 vView;
varying vec3 vDir;

${SNOISE}

void main() {
  vec3  n = normalize(position);
  float t = uTime * 0.55;

  // duas oitavas bastam: o blob é visto por frestas, detalhe fino se perde
  float w = snoise(n * 2.3 + vec3(0.0, t, t * 0.6)) * 0.65
          + snoise(n * 4.6 + vec3(-t * 0.8, 0.0, t)) * 0.35;

  // a amplitude nunca zera: líquido parado de verdade voltaria a ler bola
  float amp = 0.05 + 0.11 * uLive + 0.09 * uPulse;

  vec3 pos = position * (1.0 + w * amp);

  vDir = n;
  vNrm = normalize(normalMatrix * n);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

export const LIQ_FRAG = `
uniform float uTime;
uniform float uLive;
uniform vec3  uDeep;
uniform vec3  uBright;
uniform float uTint;

varying vec3 vNrm;
varying vec3 vView;
varying vec3 vDir;

${SNOISE}
${CHROME}

void main() {
  /* A malha ondula no vértice, mas a normal que chega é a da esfera lisa —
   * recalculá-la exigiria as derivadas analíticas do noise. Um bump no
   * fragment resolve: o gradiente do mesmo campo, por diferença finita,
   * inclina a normal na direção da ondulação e o reflexo quebra como em
   * água. Quatro noises por pixel, num objeto que ocupa pouca tela.
   */
  vec3  p = vDir * 3.2 + vec3(0.0, uTime * 0.42, uTime * 0.26);
  float e = 0.15;
  float b = snoise(p);
  vec3  grad = vec3(snoise(p + vec3(e, 0.0, 0.0)) - b,
                    snoise(p + vec3(0.0, e, 0.0)) - b,
                    snoise(p + vec3(0.0, 0.0, e)) - b) / e;

  vec3 n0 = normalize(vNrm);
  grad -= n0 * dot(grad, n0);   // só a parte tangente inclina

  vec3 nrm = normalize(n0 - grad * (0.16 + 0.18 * uLive));
  vec3 vis = normalize(vView);
  vec3 r = reflect(-vis, nrm);
  float fres = pow(1.0 - abs(dot(vis, nrm)), 2.6);

  // um degrau mais fundo que a casca: é o que ordena as camadas para o olho
  float metal = chrome(r, fres, uTime, uLive) * 0.72;

  vec3 cor = mix(vec3(metal), mix(uDeep, uBright, clamp(metal, 0.0, 1.0)) * metal, uTint);
  gl_FragColor = vec4(cor, 1.0);
}
`

/* Aura: a energia em volta.
 *
 * Não é geometria com brilho, é um quadro chapado atrás do orbe. Um halo
 * feito de casca luminosa teria que ser maior que o orbe e apareceria por
 * dentro dos furos, denunciando a esfera falsa; chapado e desenhado antes
 * de tudo, ele só emoldura.
 *
 * Fica fora do grupo que gira. Preso ao grupo, a irregularidade da borda
 * giraria junto e a aura viraria um objeto sólido girando, em vez de um
 * campo parado em volta.
 */
export const AURA_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

export const AURA_FRAG = `
uniform vec3  uDeep;
uniform vec3  uBright;
uniform float uLive;
uniform float uPulse;
uniform float uTime;
uniform float uAura;

varying vec2 vUv;

void main() {
  vec2  p = (vUv - 0.5) * 2.0;
  float d = length(p);
  float a = atan(p.y, p.x);

  // a borda respira em harmônicos lentos: disco perfeito lê como lente
  // suja, não como energia
  float franja = 0.055 * sin(a * 3.0 + uTime * 0.35)
               + 0.035 * sin(a * 5.0 - uTime * 0.23)
               + 0.020 * sin(a * 9.0 + uTime * 0.51);

  // borda do orbe em coordenada do quadro; o alcance abre com o som
  float borda = 0.66;
  float alcance = 0.30 + 0.16 * uLive + 0.10 * uPulse;

  float f = smoothstep(borda + alcance + franja, borda - 0.10, d);
  f *= f;                       // cai rápido, senão vira névoa chapada

  // e some para dentro: quem preenche o miolo é o orbe
  f *= smoothstep(borda - 0.34, borda - 0.02, d);

  float i = uAura * (0.30 + uPulse * 0.75 + uLive * 0.45) * f;
  vec3  cor = mix(uBright, uDeep, smoothstep(borda - 0.05, borda + 0.34, d));

  gl_FragColor = vec4(cor, i);
}
`

/* Núcleo: a luz que aparece pelos furos. Aditivo e sem escrever
 * profundidade, então a casca o esconde e as aberturas o revelam. */
export const CORE_VERT = `
varying vec3 vNrm;
varying vec3 vView;
void main() {
  vNrm = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`

export const CORE_FRAG = `
uniform vec3  uBright;
uniform vec3  uDeep;
uniform float uPulse;
varying vec3 vNrm;
varying vec3 vView;
void main() {
  float face = abs(dot(normalize(vView), normalize(vNrm)));
  // mais aceso de frente: lê como uma bola de luz, não como uma casca
  float i = pow(face, 1.6) * (0.30 + uPulse * 0.85);
  gl_FragColor = vec4(mix(uDeep, uBright, face) * i, 1.0);
}
`

/**
 * Os uniformes, compartilhados por todos os materiais.
 *
 * Um objeto só: trocar de pele é reescrever alguns números aqui, não
 * recompilar nada.
 */
export function createUniforms({ tex, count, spikes, reduced }) {
  return {
    uTime:   { value: 0 },
    uBands:  { value: tex },
    uCells:  { value: count },
    uReact:  { value: reduced ? 0.12 : 0.19 },
    uPeak:   { value: reduced ? 0.08 : 0.17 },
    uBreath: { value: reduced ? 0.04 : 0.10 },
    uLive:   { value: 0 },
    uDeep:   { value: new THREE.Color() },  // ponta de baixo, dos graves
    uBright: { value: new THREE.Color() },  // ponta de cima, dos agudos
    // uAlpha subiu de 0.62: a malha de trás não soma mais brilho por cima
    // da da frente, então o orbe inteiro ficaria mais apagado sem isso
    uAlpha:  { value: 0.82 },
    uBack:   { value: 0.18 },
    uPower:  { value: 2.6 },

    // pele Hexcore
    uHole:    { value: 0.225 },
    uHoleAmp: { value: 0.050 },
    uHoleMin: { value: 0.125 },
    uStrut:   { value: 0.026 },
    uTint:    { value: 0.0 },
    uSpike:    { value: spikes },
    uSpikeAmp: { value: new Array(SPIKES).fill(0) },
    uSpikeLen:  { value: reduced ? 0.40 : 0.78 },
    uSpikeW:    { value: 0.165 },
    uArmLen:    { value: reduced ? 0.24 : 0.50 },
    uArmW:      { value: 0.66 },
    uShrink:    { value: reduced ? 0.18 : 0.38 },
    uSpikeMean: { value: 0 },
    uAura:    { value: reduced ? 0.55 : 1.0 },
    uPulse:   { value: 0 },
  }
}

/** Os uniformes que medem deslocamento — os que `amplitude` escala. */
export const MOTION_UNIFORMS = ['uReact', 'uPeak', 'uBreath', 'uSpikeLen', 'uArmLen', 'uShrink']

/* As três peles dividem geometria, vertex shader e uniformes.
 *
 * Trocar é ligar e desligar objetos e reescrever alguns números — nada
 * de reconstruir cena nem remalhar. Os ajustes ficam aqui em vez de
 * espalhados porque a diferença entre Hexcore e Sigil é literalmente
 * esta tabela: mesma estrutura, outros limiares.
 */
export function skinTuning(reduced) {
  return {
    hexcore: {
      uStrut: 0.026, uHole: 0.225, uHoleAmp: 0.050, uHoleMin: 0.125,
      uSpikeLen: reduced ? 0.40 : 0.78, uSpikeW: 0.165,
      uArmLen: reduced ? 0.24 : 0.50, uArmW: 0.66,
      uShrink: reduced ? 0.18 : 0.38, uTint: 0.0,
    },
    sigil: {
      /* Trave quase no limite absoluto: sobra nervura, não casca furada.
       *
       * E o piso do furo sobe muito, quase até o teto. Na Hexcore o
       * tamanho do furo é o que responde à música; aqui não pode ser —
       * uma faixa quieta deixaria a nervura grossa e o desenho perderia
       * a assinatura. A treliça fica fina o tempo todo e quem responde
       * ao som são as agulhas.
       */
      uStrut: 0.006, uHole: 0.300, uHoleAmp: 0.025, uHoleMin: 0.190,
      // agulha, não espinho: bem mais longa, no limite do que a
      // subdivisão consegue resolver de estreita
      uSpikeLen: reduced ? 0.80 : 1.60, uSpikeW: 0.082,
      uArmLen: reduced ? 0.28 : 0.58, uArmW: 0.72,
      uShrink: reduced ? 0.20 : 0.42, uTint: 0.18,
    },
  }
}

/** Todos os materiais do orbe, sobre o mesmo objeto de uniformes. */
export function createMaterials(u) {
  // `side` não faz diferença aqui: em wireframe a malha vira gl.LINES e
  // linhas nunca são culled. Quem separa frente de trás é o vFacing do
  // vertex shader, ponderado por uBack.
  const shell = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VERT,
    fragmentShader: FRAG,
    wireframe: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  })

  /**
   * Passagem só de profundidade, a mesma malha sólida e invisível.
   *
   * Sem ela não há nada que decida qual aresta está na frente: as linhas
   * são finas e não preenchem o buffer de profundidade, então quando uma
   * saliência passa por cima de outra parte da superfície as duas
   * desenham por igual e o cruzamento vira aquele emaranhado de
   * triângulos. Preenchendo a profundidade com a superfície fechada
   * antes, o que está atrás simplesmente não passa.
   *
   * O polygonOffset empurra essa superfície um tico para longe, senão ela
   * disputa a profundidade com as próprias arestas que deveria deixar
   * passar e o wireframe pisca.
   */
  const depth = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: VERT,
    fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }',
    colorWrite: false,
    depthWrite: true,
    depthTest: true,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
  })

  // placas opacas: escrevem profundidade, então elas próprias escondem o
  // que está atrás e o núcleo só aparece pelas frestas
  const hex = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: HEX_VERT,
    fragmentShader: HEX_FRAG,
    side: THREE.DoubleSide,   // as placas têm espessura zero: sem isso, sumem de costas
    depthWrite: true,
    depthTest: true,
  })

  const core = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: CORE_VERT,
    fragmentShader: CORE_FRAG,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: true,
  })

  const sigil = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: HEX_VERT,
    fragmentShader: SIGIL_FRAG,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
  })

  const liquid = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: LIQ_VERT,
    fragmentShader: LIQ_FRAG,
    depthWrite: true,
    depthTest: true,
  })

  /* transparent: false de propósito, apesar de a aura ser translúcida.
   *
   * O three separa a cena em fila opaca e fila transparente, e desenha a
   * transparente inteira depois da opaca — entre filas, renderOrder não
   * decide nada. Marcada como transparente, a aura saía por cima do orbe
   * e somava sobre ele, lavando a casca de branco. Na fila opaca, com
   * renderOrder -1, ela pinta o fundo antes e o orbe a cobre.
   */
  const aura = new THREE.ShaderMaterial({
    uniforms: u,
    vertexShader: AURA_VERT,
    fragmentShader: AURA_FRAG,
    transparent: false,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  })

  return { shell, depth, hex, core, sigil, liquid, aura }
}
