// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

/**
 * Um adesivo: plano de lado 1 com o centro estufado 0,2 mm — o bastante
 * para pegar a luz de um jeito diferente da borda, como papel colado sobre
 * uma superfície curva. As UVs apontam para a célula do atlas.
 */
export function geometriaAdesivo(celula, proporcao = 1, escala = 1) {
  const g = new THREE.PlaneGeometry(1, proporcao, 8, 8)
  const pos = g.attributes.position
  const uv = g.attributes.uv
  const bojo = 0.002 / escala
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * 2
    const y = (pos.getY(i) / proporcao) * 2
    pos.setZ(i, bojo * (1 - x * x) * (1 - y * y))
    if (celula) {
      uv.setXY(i,
        celula.u0 + uv.getX(i) * (celula.u1 - celula.u0),
        celula.v0 + uv.getY(i) * (celula.v1 - celula.v0))
    }
  }
  g.computeVertexNormals()
  return g
}

/**
 * Com alphaToCoverage o three não define OPAQUE: o alfa da borda (o mesmo
 * 0..1 que decide quantas amostras do MSAA o adesivo cobre) vai parar no
 * canvas. Numa janela transparente isso furava a borda do adesivo — um
 * anel de 1 px onde o desktop aparecia através do disco, com cor maior
 * que o alfa (pré-multiplicado inválido). Então mistura só o alfa: a cor
 * entra como está (ONE, ZERO) e o alfa soma ao de baixo (ONE, ONE), que é
 * o rótulo, opaco — dá 1. Por isso os adesivos desenham depois do disco
 * (renderOrder 1 na cena).
 */
function alfaColado(m) {
  m.blending = THREE.CustomBlending
  m.blendEquation = THREE.AddEquation
  m.blendSrc = THREE.OneFactor
  m.blendDst = THREE.ZeroFactor
  m.blendEquationAlpha = THREE.AddEquation
  m.blendSrcAlpha = THREE.OneFactor
  m.blendDstAlpha = THREE.OneFactor
  return m
}

const ESPECTRO = /* glsl */ `
vec3 espectroFoil(float t) {
  return clamp(vec3(0.6) + vec3(0.45) * cos(6.28318 * (vec3(t) + vec3(0.0, 0.33, 0.67))), 0.0, 1.0);
}
`

/**
 * Material compartilhado pelos adesivos do atlas.
 *
 * Por cima da arte, onde a máscara de foil acende, entra um arco-íris
 * que depende do ângulo de vista — o adesivo holográfico. `uPulso` é o
 * brilho rápido da troca de linha da letra.
 */
export function criarMaterialAdesivos(atlas) {
  const uniforms = {
    uFoil: { value: atlas.mascara },
    uPulso: { value: 0 },
  }
  const m = new THREE.MeshPhysicalMaterial({
    map: atlas.mapa,
    // corte no meio da linha de corte; alphaToCoverage alisa a borda com o
    // MSAA que já está ligado (de graça) e o adesivo continua opaco,
    // escrevendo profundidade — nenhuma camada nova de ordenação
    alphaTest: 0.5,
    alphaToCoverage: true,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.6,
    clearcoatRoughness: 0.18,
    side: THREE.DoubleSide,
  })
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform sampler2D uFoil;
uniform float uPulso;
${ESPECTRO}`)
      .replace('#include <opaque_fragment>', `
{
  float foil = texture2D(uFoil, vMapUv).r;
  vec3 olhar = normalize(vViewPosition);
  float hue = fract(dot(olhar, normal) * 1.8 + vMapUv.x * 6.0 + vMapUv.y * 3.0);
  outgoingLight = mix(outgoingLight, outgoingLight * 0.45 + espectroFoil(hue) * 0.85, foil * 0.8);
  outgoingLight += diffuseColor.rgb * uPulso * 0.55;
}
#include <opaque_fragment>`)
  }
  m.customProgramCacheKey = () => 'noise-stickers'
  return { material: alfaColado(m), uniforms }
}

/** A etiqueta é papel: sem foil, mas acende junto no pulso. */
export function criarMaterialEtiqueta(textura) {
  return alfaColado(new THREE.MeshPhysicalMaterial({
    map: textura,
    emissiveMap: textura,
    emissive: new THREE.Color('#ffffff'),
    emissiveIntensity: 0,
    alphaTest: 0.5,
    alphaToCoverage: true,
    roughness: 0.62,
    clearcoat: 0.2,
    side: THREE.DoubleSide,
  }))
}
