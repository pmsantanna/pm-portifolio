// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

/* --------------------------------------------------------------------
 * Iluminação: ambiente sem HDRI nenhum.
 *
 * Só retângulos, renderizados uma vez num cubemap: uma chave grande em
 * cima à esquerda, duas faixas finas (em cima e à esquerda) que fazem os
 * reflexos lineares nas quinas do plástico — o brilho típico de estojo de
 * CD —, preenchimentos fracos à direita, de frente e de trás. Sem o anel
 * de antes: era ele que pintava o círculo de reflexo atravessando o disco
 * e os adesivos, o "plane com reflexo".
 *
 * A chave e a luz direcional vêm do mesmo lado que a luz da LEITURA do
 * plástico (de cima, da esquerda), e a sombra cai para baixo e para a
 * direita: tudo conta a mesma história.
 *
 * É o que o <Environment> + <Lightformer> do drei faziam, em three puro:
 * cada retângulo é um plano de MeshBasicMaterial sem tone mapping, com a
 * cor multiplicada pela intensidade e virado para a origem; o conjunto é
 * fotografado uma vez por uma CubeCamera num alvo HalfFloat. Sem o drei, a
 * demo web não arrasta React Three Fiber junto.
 * ------------------------------------------------------------------ */

/** Resolução do cubemap por nível de qualidade. */
export const AMBIENTE = { low: 64, medium: 128, high: 256 }

function retangulos(qualidade) {
  // na Baixa o cubemap tem 64 px: faixa mais fina que um texel some
  const fina = qualidade === 'low' ? 0.3 : null
  return [
    // chave
    { intensidade: 2.2, posicao: [-1.9, 1.9, 3.4], escala: [2.4, 1.6] },
    // faixa de cima e faixa da esquerda
    { intensidade: 6, posicao: [0, 4.2, 1.2], escala: [10, fina || 0.18] },
    { intensidade: 4, posicao: [-4.6, 0.3, 1.0], escala: [fina || 0.16, 8] },
    // preenchimentos: direita, frente e trás
    { intensidade: 1.2, posicao: [4.4, -0.6, 1.6], escala: [0.5, 6], cor: '#dfe6ff' },
    { intensidade: 0.5, posicao: [0.8, 0.6, 6], escala: [6, 4] },
    { intensidade: 0.6, posicao: [0, -3, -2], escala: [6, 2], cor: '#b9c6ff' },
  ]
}

/**
 * O mapa de ambiente do estojo, já renderizado. `textura` vai em
 * `scene.environment`; `dispose()` libera o alvo e os retângulos.
 */
export function criarAmbiente(renderer, qualidade = 'medium') {
  const cena = new THREE.Scene()
  const plano = new THREE.PlaneGeometry(1, 1)
  const materiais = []

  for (const r of retangulos(qualidade)) {
    const m = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide })
    m.color.set(r.cor || 'white').multiplyScalar(r.intensidade)
    materiais.push(m)
    const mesh = new THREE.Mesh(plano, m)
    mesh.position.set(...r.posicao)
    mesh.scale.set(r.escala[0], r.escala[1], 1)
    mesh.quaternion.identity()
    mesh.lookAt(0, 0, 0)
    cena.add(mesh)
  }

  const alvo = new THREE.WebGLCubeRenderTarget(AMBIENTE[qualidade] || AMBIENTE.medium)
  alvo.texture.type = THREE.HalfFloatType
  const camera = new THREE.CubeCamera(0.1, 1000, alvo)
  cena.add(camera)

  const autoClear = renderer.autoClear
  renderer.autoClear = true
  camera.update(renderer, cena)
  renderer.autoClear = autoClear

  return {
    textura: alvo.texture,
    dispose() {
      alvo.dispose()
      plano.dispose()
      materiais.forEach((m) => m.dispose())
    },
  }
}

/** As duas luzes de verdade da cena: o resto da luz vem do ambiente. */
export function criarLuzes() {
  const ambiente = new THREE.AmbientLight(0xffffff, 0.15)
  const direcional = new THREE.DirectionalLight(0xffffff, 0.9)
  direcional.position.set(-1.8, 2.6, 3.2)
  return [ambiente, direcional]
}
