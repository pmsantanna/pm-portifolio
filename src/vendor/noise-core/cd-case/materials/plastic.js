// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { mulberry32 } from '../stickers/layout'

/**
 * Riscos de plástico usado, como normal map desenhado em canvas.
 *
 * Linhas finas e aleatórias com semente fixa — o mesmo estojo em toda
 * execução. Cada risco é um par de traços um pouco acima e um pouco
 * abaixo do azul neutro do normal map (128, 128, 255), o que vira um sulco
 * que pega a luz só de alguns ângulos. Intensidade baixa: é para se sentir,
 * não para se ver.
 */
export function texturaRiscos(seed = 1997, tamanho = 512) {
  const c = document.createElement('canvas')
  c.width = c.height = tamanho
  const ctx = c.getContext('2d')
  ctx.fillStyle = 'rgb(128,128,255)'
  ctx.fillRect(0, 0, tamanho, tamanho)

  const rnd = mulberry32(seed)
  for (let i = 0; i < 140; i++) {
    const x = rnd() * tamanho
    const y = rnd() * tamanho
    const a = rnd() * Math.PI
    const len = 20 + rnd() * 160
    const dx = Math.cos(a) * len
    const dy = Math.sin(a) * len
    const nx = -Math.sin(a)
    const ny = Math.cos(a)
    const forca = 6 + rnd() * 18
    ctx.lineWidth = 0.6 + rnd() * 0.8
    ctx.strokeStyle = `rgba(${128 + nx * forca}, ${128 + ny * forca}, 255, 0.85)`
    ctx.beginPath()
    ctx.moveTo(x + nx * 0.6, y + ny * 0.6)
    ctx.lineTo(x + dx + nx * 0.6, y + dy + ny * 0.6)
    ctx.stroke()
    ctx.strokeStyle = `rgba(${128 - nx * forca}, ${128 - ny * forca}, 255, 0.85)`
    ctx.beginPath()
    ctx.moveTo(x - nx * 0.6, y - ny * 0.6)
    ctx.lineTo(x + dx - nx * 0.6, y + dy - ny * 0.6)
    ctx.stroke()
  }

  const t = new THREE.CanvasTexture(c)
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(1.5, 1.5)
  return t
}

/* A leitura do plástico, por orientação e não só por ângulo de vista.
 *
 * A versão anterior sombreava só por |N·V|: todo topo de nervura de frente
 * para a câmera saía com alfa ~0,015 e sumia, e o estojo lia chato mesmo
 * com a geometria lá. Aqui, como no estojo de verdade visto contra a luz:
 * - parte grossa vista de frente ganha corpo CINZA (os ressaltos cheios
 *   da referência, sRGB 150–200), mais claro do lado da luz principal;
 * - do lado de costas para a luz, linhas escuras de refração (~sRGB 40)
 *   onde a superfície começa a fugir da vista;
 * - na borda mesmo, branco: o Fresnel que desenha cada degrau;
 * - faixas brilhantes analíticas no reflexo (a faixa de luz de cima e a da
 *   esquerda), nítidas em qualquer resolução do cubemap;
 * - faces de lado (normal do objeto quase sem Z) ganham sulcos em Z: as
 *   linhas paralelas das bandas da parede;
 * - aresta menor que um pixel (normal mudando muito entre pixels vizinhos)
 *   vira a média da faixa em vez de tracejar.
 *
 * A luz é fixa em espaço de vista; a câmera não gira, então é o mesmo que
 * espaço do mundo: de cima e da esquerda, o lado da luz direcional e o
 * oposto da sombra projetada.
 *
 * O texto do GLSL é UM SÓ para todos os plásticos (chave de cache fixa):
 * o que muda de peça para peça vai só por uniform. Uma constante de peça
 * interpolada aqui seria ignorada em silêncio — vale o fonte do primeiro
 * material que compilou com a chave. */
const VERTICE = /* glsl */ `#include <common>
varying vec3 vPosObj;
varying vec3 vNrmObj;`

const VERTICE_POS = /* glsl */ `#include <begin_vertex>
vPosObj = position;
vNrmObj = normal;`

const FRAGMENTO = /* glsl */ `#include <common>
uniform float uPiso;
uniform float uCorpo;
uniform float uSulco;
uniform float uBordaGrossa;
uniform float uBrilhoTampa;
uniform float uDeslocZ;
uniform float uPlano;
uniform vec2 uMeia;
uniform vec3 uLuz;
uniform vec3 uClaro;
uniform vec3 uMedio;
uniform vec3 uLinha;
varying vec3 vPosObj;
varying vec3 vNrmObj;`

const LEITURA = /* glsl */ `
{
  vec3 V = normalize(vViewPosition);
  vec3 N = normal;
  float rim = 1.0 - clamp(abs(dot(N, V)), 0.0, 1.0);
  // largura das transições acompanha a derivada: nem serrilha nem borra
  float aw = fwidth(rim) * 0.75 + 0.02;
  float k = smoothstep(-0.6, 0.7, dot(N, uLuz));
  float lateral = smoothstep(0.55, 0.9, 1.0 - abs(normalize(vNrmObj).z));

  float ombro = smoothstep(0.22 - aw, 0.45 + aw, rim);
  float linha = smoothstep(0.55 - aw, 0.63 + aw, rim) * (1.0 - smoothstep(0.78 - aw, 0.86 + aw, rim));
  float borda = smoothstep(0.88 - aw, 0.97, rim);
  float nitidez = 1.0 - smoothstep(0.35, 0.9, length(fwidth(N)));
  borda = mix(0.3, borda, nitidez);
  // faces planas de lado não têm linha de vista: só os sulcos
  linha = mix(0.25, linha, nitidez) * step(0.02, rim) * (1.0 - lateral);

  // sulcos em Z do estojo (uDeslocZ traz a tampa, que mora no espaço do
  // pivô, de volta para o Z do estojo)
  float zc = vPosObj.z + uDeslocZ;
  float fz = fwidth(zc) + 1e-5;
  float dz = abs(fract(zc / 0.026) - 0.5) * 0.026;
  float sulco = (1.0 - smoothstep(0.0008, 0.0008 + 1.5 * fz, dz)) * lateral * uSulco;

  vec3 R = reflect(-V, N);
  float tiraCima = smoothstep(0.50, 0.58, R.y) * (1.0 - smoothstep(0.70, 0.78, R.y)) * smoothstep(-0.4, 0.1, R.z);
  float tiraEsq = smoothstep(-0.80, -0.72, R.x) * (1.0 - smoothstep(-0.60, -0.52, R.x)) * (1.0 - smoothstep(0.45, 0.75, abs(R.y)));
  float tira = max(tiraCima, tiraEsq * 0.8) * mix(0.35, 1.0, nitidez);

  // chapa grande e lisa (a da tampa, a do fundo): vista de lado, o que ela
  // mostra é reflexo, não espessura — com ombro e linha, a tampa aberta
  // virava uma tábua cinza. E a faixa de luz, que numa quina vira um
  // filete, numa área plana vira um véu branco por cima do disco. Só onde
  // a normal não muda: os biséis da chapa continuam com as linhas
  float plano = uPlano * (1.0 - smoothstep(0.02, 0.2, length(fwidth(N))));
  ombro *= 1.0 - plano;
  linha *= 1.0 - plano;
  tira *= 1.0 - 0.85 * plano;

  vec3 corpo = mix(uMedio, uClaro, 0.15 + 0.35 * k);
  corpo = mix(corpo, mix(uMedio * 0.85, uClaro, 0.7 * k), lateral);
  vec3 cor = mix(corpo, uMedio * 0.8, ombro * (1.0 - k) * (1.0 - lateral));
  cor = mix(cor, uLinha, linha * mix(1.0, 0.55, k));
  cor = mix(cor, uLinha, sulco * 0.7);
  // o brilho da tampa: uma faixa diagonal larga na chapa, mais forte do lado da luz
  float brilho = uBrilhoTampa * (1.0 - smoothstep(0.0, 0.18, abs(dot(vPosObj.xy, vec2(0.7071)) - 0.30))) * (0.5 + 0.5 * k);
  cor = mix(cor, vec3(1.0), max(max(borda * 0.85, tira), min(1.0, brilho * 4.0)));

  // o fundo engrossa perto da borda: a placa vista pela espessura
  float dBorda = min(uMeia.x - abs(vPosObj.x), uMeia.y - abs(vPosObj.y));
  float a = uPiso
    + uCorpo * (1.0 - lateral)
    + ombro * 0.30 * (1.0 - lateral)
    + lateral * 0.45
    + linha * 0.85
    + sulco * 0.40
    + borda * 0.80
    + tira * 0.85
    + brilho
    + uBordaGrossa * (1.0 - smoothstep(0.0, 0.035, dBorda));

  // reflexo forte do ambiente aparece por cima; reflexo fraco não suja o cinza
  float reflexo = smoothstep(0.25, 0.8, dot(outgoingLight, vec3(0.299, 0.587, 0.114)));
  outgoingLight = mix(cor, max(cor, outgoingLight), reflexo);
  diffuseColor.a = max(clamp(a, 0.0, 0.95), reflexo * 0.6);
}
#include <opaque_fragment>`

// de cima e da esquerda, em espaço de vista
const LUZ = new THREE.Vector3(-0.45, 0.80, 0.40).normalize()

/**
 * O plástico do estojo (acrílico/policarbonato), estilizado para ler
 * sobre qualquer fundo — inclusive a área de trabalho, onde o acrílico de
 * verdade (4% de reflexo de frente) sumiria.
 *
 * Todo plástico é transparente e sem escrita de profundidade, para cada
 * camada aparecer através das outras: o hub pelo furo do disco, a
 * estrutura de dentro pela tampa. A cor do material é preta: quem pinta é
 * a LEITURA; do PBR sobram só os reflexos do ambiente.
 *
 * Sem `transmission` na tampa: o passe de transmissão renderizava a cena
 * inteira de novo a cada quadro, o OPAQUE dele jogava fora o alfa do
 * shader (e as linhas da tampa) e objetos transmissivos ignoram o
 * renderOrder — a sombra projetada da tampa não teria como vir antes.
 *
 * Por peça (só uniforms — ver acima):
 * - `lado`: Front, Back ou Double;
 * - `piso`: o alfa mínimo do corpo;
 * - `corpo`: o cinza das partes grossas vistas de frente;
 * - `sulco`: liga os sulcos em Z nas faces de lado;
 * - `bordaGrossa` e `meia` (meias medidas da peça): engrossa o alfa perto
 *   da borda — o fundo da bandeja;
 * - `brilhoTampa`: a faixa diagonal da chapa da tampa;
 * - `deslocZ`: soma ao Z do objeto para os sulcos caírem no Z do estojo;
 * - `plano`: chapa grande e lisa — nas partes sem curvatura, sem as
 *   linhas de espessura e com a faixa de luz bem mais fraca.
 * Os riscos (clearcoat normal map) só na Média e na Alta: na Baixa não há
 * clearcoat.
 */
export function criarPlastico({
  qualidade,
  riscos = null,
  lado = THREE.DoubleSide,
  piso = 0.02,
  corpo = 0,
  sulco = 0,
  bordaGrossa = 0,
  meia = [1e3, 1e3],
  brilhoTampa = 0,
  deslocZ = 0,
  plano = 0,
}) {
  const comRiscos = Boolean(riscos) && qualidade !== 'low'
  const m = new THREE.MeshPhysicalMaterial({
    color: '#000000',
    roughness: 0.06,
    metalness: 0,
    ior: 1.49,
    clearcoat: qualidade === 'low' ? 0 : 1,
    clearcoatRoughness: 0.05,
    specularIntensity: 1,
    envMapIntensity: 1.5,
    transparent: true,
    opacity: 0.001,   // o alfa real sai do shader (LEITURA)
    depthWrite: false,
    toneMapped: false,
    side: lado,
    ...(comRiscos ? { clearcoatNormalMap: riscos, clearcoatNormalScale: new THREE.Vector2(0.18, 0.18) } : {}),
  })

  const u = {
    uPiso: { value: piso },
    uCorpo: { value: corpo },
    uSulco: { value: sulco },
    uBordaGrossa: { value: bordaGrossa },
    uBrilhoTampa: { value: brilhoTampa },
    uDeslocZ: { value: deslocZ },
    uPlano: { value: plano },
    uMeia: { value: new THREE.Vector2(meia[0], meia[1]) },
    uLuz: { value: LUZ.clone() },
    uClaro: { value: new THREE.Color('#eef1f5') },
    uMedio: { value: new THREE.Color('#9ea3ab') },
    uLinha: { value: new THREE.Color('#26282e') },
  }
  m.userData.u = u
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, u)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', VERTICE)
      .replace('#include <begin_vertex>', VERTICE_POS)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', FRAGMENTO)
      .replace('#include <opaque_fragment>', LEITURA)
  }
  // a mesma para todos: o three ainda separa programas por lado e pelas
  // defines do clearcoat, mas não por peça (~3 compilações em vez de ~6)
  m.customProgramCacheKey = () => 'noise-plastic-v2'
  return m
}
