// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
import * as THREE from 'three'

/**
 * Raycast no estojo a partir de coordenadas de tela.
 *
 * Serve a duas coisas: aos gestos (o que está sob o cursor) e ao
 * click-through da janela — o App pergunta, a cada movimento do mouse, se
 * o cursor está sobre o estojo; fora dele, os cliques atravessam para o
 * app de trás (canal `window:hit-test`).
 *
 * Por isso os alvos são procurações baratas e invisíveis (uma caixa para o
 * estojo, uma para a tampa, um círculo para o disco; ~150 triângulos), não
 * as malhas de verdade, que somam ~25 mil. Cada uma diz o que é em
 * `userData.parte`, e a ordem de prioridade é:
 * - a tampa, se for a primeira coisa no caminho (fechada, ela cobre tudo:
 *   o clique abre);
 * - o disco, se estiver em qualquer ponto do caminho (aberta, a caixa do
 *   estojo vem antes dele, mas quem quer o disco é o scratch e o duplo
 *   clique — e assim o miolo claro também conta como disco);
 * - senão, a bandeja.
 */
export function createPicker({ canvas, camera, alvos }) {
  const raio = new THREE.Raycaster()
  const ndc = new THREE.Vector2()

  return function pick(x, y) {
    const r = canvas().getBoundingClientRect()
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return null
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1)
    raio.setFromCamera(ndc, camera())
    const objetos = alvos().filter(Boolean)
    const hits = raio.intersectObjects(objetos, false)
    if (!hits.length) return null
    if (hits[0].object.userData.parte === 'tampa') return 'tampa'
    return hits.some((h) => h.object.userData.parte === 'disco') ? 'disco' : 'bandeja'
  }
}
