// noise-core @ 4c681de (pmsantanna/noise) — cópia; mude no Noise e rode scripts/sync-noise-core.sh
/**
 * Os discos da barra: variações de acabamento da mesma skin.
 *
 * `ambiente` é quanto do ambiente o metal reflete: no Holo, pouco — a base
 * escura é o que faz as faixas de arco-íris e os adesivos saltarem.
 * `faixa` é o intervalo de espessura do filme fino da iridescência (nm);
 * o grave estica o teto dele e o arco-íris "respira". `holo` é quanto da
 * difração das trilhas entra por cima.
 */
export const VARIANTES = {
  holo: {
    aro: { cor: '#c4c8d0', metalness: 1, roughness: 0.2, piso: 0.5, iridescence: 0.25, iridescenceIOR: 1.3, faixa: [100, 800], holo: 0.9, ambiente: 1.1 },
    rotulo: { fundo: ['#0c0c11', '#17161f'], tinta: 'rgba(255,255,255,0.55)', onda: 'rgba(200,205,225,0.16)', aspereza: 0.3, verniz: 1, foil: 0.45, foilCapa: 0.12, iridescencia: 0 },
    nome: 'Holo',
    cor: '#141419',          // base quase preta: o arco-íris aparece em faixas
    metalness: 0.9,
    roughness: 0.3,
    iridescence: 0,
    ambiente: 0.45,           // quanto do ambiente o metal reflete
    iridescenceIOR: 1.3,
    faixa: [100, 800],
    holo: 0.9,
    adesivos: true,
    miniatura: 'conic-gradient(from 20deg, #15151c 0 12%, #7a5cff 18%, #15151c 26% 52%, #3ee0c8 60%, #ff7ab8 66%, #15151c 74% 100%)',
  },
  prata: {
    aro: { cor: '#d3d6db', metalness: 1, roughness: 0.08, iridescence: 0.35, iridescenceIOR: 1.3, faixa: [100, 400], holo: 0.75, ambiente: 1.2 },
    rotulo: { fundo: ['#e4e6ea', '#c9ccd2'], tinta: 'rgba(29,27,58,0.7)', onda: 'rgba(62,60,130,0.18)', aspereza: 0.6, verniz: 0.2, foil: 0, foilCapa: 0, iridescencia: 0 },
    nome: 'Prata',
    cor: '#c7cbd1',
    metalness: 1,
    roughness: 0.1,
    iridescence: 0.35,
    iridescenceIOR: 1.3,
    faixa: [100, 400],
    holo: 0.75,
    ambiente: 1.2,
    adesivos: false,
    miniatura: 'conic-gradient(from 60deg, #e9ecef, #9aa1a9, #f4f6f8, #a8aeb5, #e9ecef)',
  },
  rosa: {
    aro: { cor: '#c48b7c', metalness: 1, roughness: 0.16, iridescence: 0.6, iridescenceIOR: 1.22, faixa: [320, 900], holo: 0.8, ambiente: 1 },
    rotulo: { fundo: ['#2c1719', '#5a3533'], tinta: 'rgba(255,214,200,0.6)', onda: 'rgba(230,176,160,0.2)', aspereza: 0.38, verniz: 0.7, foil: 0.25, foilCapa: 0.08, iridescencia: 0 },
    nome: 'Rosa',
    cor: '#7d4a46',
    metalness: 1,
    roughness: 0.2,
    iridescence: 0.85,
    iridescenceIOR: 1.22,
    faixa: [320, 900],
    holo: 0.8,
    ambiente: 0.8,
    adesivos: true,
    miniatura: 'conic-gradient(from 10deg, #6e3f3c, #c98a7a, #5a3533, #e6b0a0, #6e3f3c)',
  },
  opala: {
    aro: { cor: '#e8e5ee', metalness: 0.6, roughness: 0.2, iridescence: 0.9, iridescenceIOR: 1.18, faixa: [150, 450], holo: 0.4, ambiente: 1 },
    rotulo: { fundo: ['#f5f2ec', '#e6e9f2'], tinta: 'rgba(62,60,130,0.6)', onda: 'rgba(62,60,130,0.12)', aspereza: 0.35, verniz: 0.8, foil: 0.08, foilCapa: 0.04, iridescencia: 0.5 },
    nome: 'Opala',
    cor: '#f1eee9',
    metalness: 0.25,
    roughness: 0.32,
    iridescence: 0.9,
    iridescenceIOR: 1.18,
    faixa: [150, 450],
    holo: 0.35,
    ambiente: 1,
    adesivos: true,
    miniatura: 'radial-gradient(circle at 35% 35%, #ffffff, #efe9f6 45%, #e3f1f0 70%, #f4ead9)',
  },
}

export const ORDEM_VARIANTES = ['holo', 'prata', 'rosa', 'opala']
