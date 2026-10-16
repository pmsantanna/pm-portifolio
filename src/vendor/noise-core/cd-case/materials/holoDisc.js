// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'
import { CASE_DIMENSIONS } from '../dimensions'

const ESPECTRO = /* glsl */ `
vec3 espectro(float t) {
  vec3 a = vec3(0.55, 0.52, 0.56);
  vec3 b = vec3(0.45, 0.45, 0.45);
  vec3 c = vec3(1.0, 1.0, 1.0);
  vec3 d = vec3(0.0, 0.33, 0.67);
  return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
}
float grao(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}
`

/* A difração das trilhas, como função: o metal e o foil do rótulo usam a mesma. */
const DIFRACAO = /* glsl */ `${ESPECTRO}
vec3 difracao(vec3 trilha, vec3 olhar, float raio, float grave, float largura) {
  vec3 arco = vec3(0.0);
  float k = largura * (1.0 - 0.45 * grave);
  for (int i = 0; i < 2; i++) {
    vec3 luz = i == 0 ? normalize(vec3(-0.55, 0.75, 0.6)) : normalize(vec3(0.7, -0.45, 0.55));
    vec3 h = normalize(luz + olhar);
    float t = dot(trilha, h);
    arco += espectro(fract(t * 2.6 + raio * 2.2 + float(i) * 0.37)) * exp(-t * t * k);
  }
  return arco + espectro(fract(dot(olhar, trilha) * 1.7 + raio * 3.0)) * 0.05;
}
`

const VARYINGS = /* glsl */ `
varying vec3 vTrilha;
varying float vRaioDisco;
varying vec2 vPlano;
varying float vNormalZ;`

const VERT = /* glsl */ `
vRaioDisco = length(position.xy);
vPlano = position.xy;
vNormalZ = normal.z;
vTrilha = normalize((modelViewMatrix * vec4(-position.y, position.x, 0.0, 0.0)).xyz + 1e-6);`

function injetar(m, chave, uniforms, declaracoes, corpo) {
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>${VARYINGS}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>${VERT}`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${VARYINGS}
${declaracoes}
${DIFRACAO}`)
      .replace('#include <opaque_fragment>', `${corpo}
#include <opaque_fragment>`)
  }
  m.customProgramCacheKey = () => chave
  return m
}

/**
 * O metal do disco: faixa espelhada, aro e o lado dos dados.
 *
 * Por cima, o rótulo cobre quase tudo; sobra a faixa espelhada em volta do
 * miolo e o aro depois do papel. Por baixo, o arco-íris inteiro.
 */
export function criarMaterialDisco(aro, D = CASE_DIMENSIONS) {
  const uniforms = {
    uHolo: { value: aro.holo },
    uTreble: { value: 0 },
    uGrave: { value: 0 },
    uTrilhas: { value: new THREE.Vector2(D.disco.trilhas.dentro, D.disco.trilhas.fora) },
    uRotulo: { value: new THREE.Vector2(D.disco.rotulo.dentro, D.disco.rotulo.fora) },
  }
  const m = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(aro.cor),
    metalness: aro.metalness ?? 1,
    roughness: aro.roughness,
    iridescence: aro.iridescence,
    iridescenceIOR: aro.iridescenceIOR ?? 1.3,
    iridescenceThicknessRange: [...aro.faixa],
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    envMapIntensity: aro.ambiente ?? 1.2,
    // o ambiente de Lightformers é quase todo preto: metal puro sairia preto.
    // Um piso de prata emissivo deixa o aro claro em qualquer fundo
    emissive: new THREE.Color(aro.cor),
    emissiveIntensity: aro.piso ?? 0.5,
  })
  injetar(m, 'noise-disc-metal', uniforms, `
uniform float uHolo;
uniform float uTreble;
uniform float uGrave;
uniform vec2 uTrilhas;
uniform vec2 uRotulo;`, `
{
  vec3 olhar = normalize(vViewPosition);
  vec3 trilha = normalize(vTrilha);
  float topo = step(0.5, vNormalZ);
  float trilhas = smoothstep(uTrilhas.x, uTrilhas.x + 0.006, vRaioDisco) * (1.0 - smoothstep(uTrilhas.y - 0.004, uTrilhas.y, vRaioDisco));
  outgoingLight += difracao(trilha, olhar, vRaioDisco, uGrave, 80.0) * uHolo * mix(1.0, 0.6, topo) * trilhas;
  float meio = 0.5 * (uRotulo.x + uRotulo.y);
  float aoFora = 1.0 - 0.55 * (1.0 - smoothstep(uRotulo.y, uRotulo.y + 0.005, vRaioDisco)) * step(meio, vRaioDisco);
  float aoDentro = 1.0 - 0.45 * smoothstep(uRotulo.x - 0.005, uRotulo.x, vRaioDisco) * step(vRaioDisco, meio);
  outgoingLight *= mix(1.0, aoFora * aoDentro, topo);
  // paredes do metal (vistas pela borda clara e pelo miolo): mais escuras, viram a linha da espessura
  outgoingLight *= 1.0 - 0.6 * (1.0 - step(0.5, abs(vNormalZ)));
  float ang = atan(vPlano.y, vPlano.x);
  float g = grao(vec2(floor(vRaioDisco * 700.0), floor(ang * 140.0)));
  outgoingLight += vec3(step(0.996 - uTreble * 0.012, g) * uTreble) * trilhas * 1.6;
}`)
  return { material: m, uniforms }
}

/**
 * O rótulo: papel impresso com a capa (ou o rótulo padrão do Noise), com
 * verniz. No Holo o papel é foil: onde a tinta é escura, a difração das
 * trilhas aparece através — as faixas de arco-íris que correm pelo disco.
 */
export function criarMaterialRotulo(r, mapa, qualidade, D = CASE_DIMENSIONS) {
  const fisico = qualidade !== 'low'
  const uniforms = {
    uFoil: { value: r.foil },
    uGrave: { value: 0 },
    uPulso: { value: 0 },
    uTrilhas: { value: new THREE.Vector2(D.disco.trilhas.dentro, D.disco.trilhas.fora) },
  }
  const m = new THREE.MeshPhysicalMaterial({
    map: mapa,
    roughness: r.aspereza,
    metalness: 0,
    clearcoat: fisico ? r.verniz : 0,
    clearcoatRoughness: 0.1,
    iridescence: fisico ? (r.iridescencia || 0) : 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [180, 520],
    specularIntensity: 0.7,
    envMapIntensity: 1,
  })
  injetar(m, 'noise-disc-label', uniforms, `
uniform float uFoil;
uniform float uGrave;
uniform float uPulso;
uniform vec2 uTrilhas;`, `
{
  vec3 olhar = normalize(vViewPosition);
  float lum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
  float escuro = 1.0 - smoothstep(0.01, 0.22, lum);
  float trilhas = smoothstep(uTrilhas.x, uTrilhas.x + 0.02, vRaioDisco);
  outgoingLight += difracao(normalize(vTrilha), olhar, vRaioDisco, uGrave, 320.0) * uFoil * mix(0.15, 1.0, escuro) * trilhas;
  outgoingLight += diffuseColor.rgb * uPulso * 0.12;
}`)
  return { material: m, uniforms }
}
