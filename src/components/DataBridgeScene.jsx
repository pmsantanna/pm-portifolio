import { useEffect, useRef, useState } from 'react'
import useReveal from '../hooks/useReveal'

// ───────────────────────── helpers ─────────────────────────
function fmt(n) { return n.toLocaleString('en-US') }
function pad(v, n) { return String(v).padEnd(n) }
function ts() { return new Date().toTimeString().slice(0, 8) }
function wait(ms) { return new Promise(r => setTimeout(r, ms)) }
function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ───────────────────────── migrate ─────────────────────────
// páginas de 10k: mesmos totais na tela, mas ~23 linhas/re-renders
// em vez de ~416 (payroll sozinho gerava 365 setState)
const ROUTINES = [
  { name: 'employees',       total: 25000,  pageMs: 240 },
  { name: 'payroll_entries', total: 182400, pageMs: 140 },
  { name: 'departments',     total: 312,    pageMs: 260 },
]
const PAGE_SIZE = 10000

// ───────────────────────── psql ─────────────────────────
const Q_VALIDATE = [
  `SELECT t.relname            AS "table",`,
  `       s.n_rows             AS source,`,
  `       t.n_rows             AS target,`,
  `       s.n_rows - t.n_rows  AS diff`,
  `FROM   migration.row_counts s`,
  `JOIN   migration.row_counts t USING (relname)`,
  `ORDER  BY 1;`,
]
const R_VALIDATE = [
  `<span class="pq-d">      table       | source  | target  | diff</span>`,
  `<span class="pq-d">------------------+---------+---------+------</span>`,
  ` departments      |     312 |     312 | <span class="tc-g">   0</span>`,
  ` employees        |  25,000 |  25,000 | <span class="tc-g">   0</span>`,
  ` payroll_entries  | 182,400 | 182,387 | <span class="tc-y">  13</span>`,
  `<span class="pq-d">(3 rows)</span>`,
]
const Q_SKIPS = [
  `SELECT reason, count(*)`,
  `FROM   migration.skip_log`,
  `WHERE  run_id = (SELECT max(run_id) FROM migration.runs)`,
  `GROUP  BY reason;`,
]
const R_SKIPS = [
  `<span class="pq-d">       reason        | count</span>`,
  `<span class="pq-d">---------------------+-------</span>`,
  ` duplicate_key       | <span class="tc-y">    9</span>`,
  ` null_employee_ref   | <span class="tc-y">    4</span>`,
  `<span class="pq-d">(2 rows)</span>`,
]
const Q_CHECKPOINT = [
  `SELECT routine, last_offset, status, updated_at::time(0)`,
  `FROM   migration.checkpoints`,
  `ORDER  BY updated_at DESC;`,
]
const R_CHECKPOINT = [
  `<span class="pq-d">     routine      | last_offset |  status  | updated_at</span>`,
  `<span class="pq-d">------------------+-------------+----------+------------</span>`,
  ` payroll_entries  |     182,400 | <span class="tc-g">done</span>     | 03:47:12`,
  ` employees        |      25,000 | <span class="tc-g">done</span>     | 03:42:40`,
  ` departments      |         312 | <span class="tc-g">done</span>     | 03:42:31`,
  `<span class="pq-d">(3 rows)</span>`,
]

export default function DataBridgeScene({ lang = 'en', t }) {
  const [ref, visible] = useReveal(0.25)
  const [tab, setTab] = useState('migrate')

  // ── migrate state ──
  const [mLines, setMLines] = useState([])
  const [mRunning, setMRunning] = useState(false)
  const [mStarted, setMStarted] = useState(false)

  // ── psql state ──
  const [pLines, setPLines] = useState([])
  const [pTyped, setPTyped] = useState('')
  const [pRunning, setPRunning] = useState(false)
  const [pStarted, setPStarted] = useState(false)

  const bodyRef = useRef(null)
  const stickRef = useRef(true)

  const pushM = (html) => setMLines(prev => [...prev, html])
  const pushP = (html) => setPLines(prev => [...prev, html])

  // auto-scroll SÓ dentro do terminal, respeitando o scroll do usuário
  useEffect(() => {
    const el = bodyRef.current
    if (el && stickRef.current) el.scrollTop = el.scrollHeight
  }, [mLines, pLines, pTyped, tab])

  const handleBodyScroll = () => {
    const el = bodyRef.current
    if (!el) return
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40
  }

  // inicia a migração quando a cena entra em vista
  useEffect(() => {
    if (visible && !mStarted) {
      setMStarted(true)
      runMigration(false)
    }
  }, [visible])

  // inicia o psql na primeira vez que a aba é aberta
  useEffect(() => {
    if (tab === 'psql' && !pStarted) {
      setPStarted(true)
      bootPsql()
    }
    stickRef.current = true
  }, [tab])

  // ───────────── migrate ─────────────
  async function runMigration(fail) {
    if (mRunning) return
    setMRunning(true)
    stickRef.current = true
    setMLines([])

    await wait(100)
    pushM(`<span class="tc-g">pedro@macbook</span><span class="tc-w"> databridge </span><span class="tc-g">%</span> <span class="tc-w">java -jar target/databridge.jar migrate \\</span>`)
    await wait(60)
    pushM(`<span class="tc-d">  --src-url  "jdbc:postgresql://localhost:5433/source_db" \\</span>`)
    pushM(`<span class="tc-d">  --tgt-url  "jdbc:postgresql://localhost:5434/target_db" \\</span>`)
    pushM(`<span class="tc-d">  --page-size ${PAGE_SIZE}</span>`)
    await wait(400)
    pushM(``)
    pushM(`<span class="tc-b">▶ DataBridge</span> <span class="tc-d">v1.0.0</span>`)
    await wait(120)
    pushM(`<span class="tc-d">  src  </span><span class="tc-m">jdbc:postgresql://localhost:5433/source_db</span>`)
    pushM(`<span class="tc-d">  tgt  </span><span class="tc-m">jdbc:postgresql://localhost:5434/target_db</span>`)
    pushM(`<span class="tc-d">  page </span><span class="tc-m">${PAGE_SIZE} records</span>`)
    await wait(350)
    pushM(``)

    const failAt = fail ? 1 : -1
    let grand = 0

    for (let ri = 0; ri < ROUTINES.length; ri++) {
      const { name, total, pageMs } = ROUTINES[ri]
      const pages = Math.ceil(total / PAGE_SIZE)

      pushM(`<span class="tc-d">──────────────────────────────────────────</span>`)
      pushM(`<span class="tc-b">${name}</span>`)
      await wait(160)

      if (ri === failAt) {
        const stopAt = 3
        for (let p = 1; p <= stopAt; p++) {
          await wait(pageMs)
          pushM(`<span class="tc-d">${ts()}</span>  <span class="tc-m">${pad(name, 18)}</span>  page=<span class="tc-w">${pad(p, 4)}</span>  total=<span class="tc-g">${fmt(p * PAGE_SIZE)}</span>`)
        }
        await wait(600)
        pushM(``)
        pushM(`<span class="tc-r">ERROR</span> <span class="tc-w">Connection reset by peer</span>`)
        pushM(`<span class="tc-d">       jdbc:postgresql://localhost:5434/target_db</span>`)
        pushM(``)
        pushM(`<span class="tc-y">  checkpoint saved</span>  <span class="tc-d">→</span>  <span class="tc-w">${name}.lastOffset = ${fmt(stopAt * PAGE_SIZE)}</span>`)
        pushM(`<span class="tc-d">  re-run to resume from page ${stopAt + 1} of ${pages}</span>`)
        pushM(``)
        pushM(`<span class="tc-r">✘</span> <span class="tc-w">Migration interrupted.</span>  <span class="tc-d">exit 1</span>`)
        pushM(``)
        pushM(`<span class="tc-g">pedro@macbook</span><span class="tc-w"> databridge </span><span class="tc-g">%</span> `)
        break
      }

      for (let p = 1; p <= pages; p++) {
        await wait(pageMs)
        const done = Math.min(p * PAGE_SIZE, total)
        const tick = p === pages ? `  <span class="tc-g">✓</span>` : ''
        pushM(`<span class="tc-d">${ts()}</span>  <span class="tc-m">${pad(name, 18)}</span>  page=<span class="tc-w">${pad(p, 4)}</span>  total=<span class="tc-g">${fmt(done)}</span>${tick}`)
      }
      grand += total
      await wait(100)
      pushM(``)
    }

    if (!fail) {
      await wait(200)
      pushM(`<span class="tc-d">──────────────────────────────────────────</span>`)
      pushM(`<span class="tc-g">✔ Done!</span>`)
      pushM(`<span class="tc-d">  fetched  </span><span class="tc-w">${fmt(grand)}</span>`)
      pushM(`<span class="tc-d">  inserted </span><span class="tc-w">${fmt(grand - 13)}</span>`)
      pushM(`<span class="tc-d">  skipped  </span><span class="tc-y">13</span>`)
      pushM(`<span class="tc-d">  elapsed  4m 32s  ·  exit 0</span>`)
      pushM(``)
      pushM(`<span class="tc-g">pedro@macbook</span><span class="tc-w"> databridge </span><span class="tc-g">%</span> `)
    }

    setMRunning(false)
  }

  // ───────────── psql ─────────────
  async function bootPsql() {
    setPRunning(true)
    await wait(150)
    pushP(`<span class="tc-g">pedro@macbook</span><span class="tc-w"> databridge </span><span class="tc-g">%</span> <span class="tc-w">psql -h localhost -p 5434 -d target_db</span>`)
    await wait(350)
    pushP(`<span class="pq-d">psql (16.3)</span>`)
    pushP(`<span class="pq-d">Type "help" for help.</span>`)
    pushP(``)
    await wait(250)
    setPRunning(false)
    await runQuery(Q_VALIDATE, R_VALIDATE)
  }

  async function typeLine(prefix, text) {
    for (let i = 1; i <= text.length; i++) {
      setPTyped(prefix + escapeHtml(text.slice(0, i)))
      await wait(10 + Math.random() * 18)
    }
    setPTyped('')
    pushP(prefix + `<span class="pq-c">${escapeHtml(text)}</span>`)
  }

  async function runQuery(query, result) {
    if (pRunning) return
    setPRunning(true)

    const p1 = `<span class="tc-b">target_db=#</span> `
    const p2 = `<span class="tc-b">target_db-#</span> `

    for (let i = 0; i < query.length; i++) {
      await typeLine(i === 0 ? p1 : p2, query[i])
      await wait(60)
    }

    await wait(420)
    for (const row of result) {
      pushP(row)
      await wait(55)
    }
    pushP(``)
    setPRunning(false)
  }

  // ───────────── labels ─────────────
  const L = lang === 'pt'
    ? {
        again: 'Rodar novamente', fail: 'Simular falha',
        validate: 'Validar migração', skips: 'Investigar os 13', ckpt: 'Checkpoints',
      }
    : {
        again: 'Run again', fail: 'Simulate failure',
        validate: 'Validate migration', skips: 'Investigate the 13', ckpt: 'Checkpoints',
      }

  const running = tab === 'migrate' ? mRunning : pRunning

  return (
    <section className="scene db-scene">
      <div ref={ref} className={`scene-inner db-wrap ${visible ? 'on' : ''}`}>

        <div className="slug">
          {t.scene2.slug.split('·')[0].trim()} · <b>{t.scene2.slug.split('·').slice(1).join('·').trim()}</b>
        </div>

        <div className="db-dock">

          {/* ── esquerda: janela com abas ── */}
          <div className="db-term">
            {/* barra de título com abas */}
            <div className="db-titlebar">
              <div className="db-lights">
                <span style={{ background: '#ff5f57' }} />
                <span style={{ background: '#ffbd2e' }} />
                <span style={{ background: '#28c840' }} />
              </div>
              <div className="db-tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={tab === 'migrate'}
                  className={tab === 'migrate' ? 'active' : ''}
                  onClick={() => setTab('migrate')}
                >
                  databridge — migrate
                </button>
                <button
                  role="tab"
                  aria-selected={tab === 'psql'}
                  className={tab === 'psql' ? 'active' : ''}
                  onClick={() => setTab('psql')}
                >
                  psql — target_db
                </button>
              </div>
            </div>

            {/* corpo (scroll contido, nunca empurra a página) */}
            <div className="db-body" ref={bodyRef} onScroll={handleBodyScroll}>
              <div style={{ display: tab === 'migrate' ? 'block' : 'none' }}>
                {mLines.map((html, i) => (
                  <span key={i} className="tc-line" dangerouslySetInnerHTML={{ __html: html }} />
                ))}
                {mRunning && <span className="tc-cursor" />}
              </div>
              <div style={{ display: tab === 'psql' ? 'block' : 'none' }}>
                {pLines.map((html, i) => (
                  <span key={i} className="tc-line" dangerouslySetInnerHTML={{ __html: html }} />
                ))}
                {pTyped && (
                  <span className="tc-line">
                    <span dangerouslySetInnerHTML={{ __html: pTyped }} />
                    <span className="tc-cursor" />
                  </span>
                )}
                {!pTyped && pRunning && <span className="tc-cursor" />}
              </div>
            </div>

            {/* rodapé contextual */}
            <div className="db-footer">
              {tab === 'migrate' ? (
                <>
                  <button disabled={running} onClick={() => runMigration(false)}>{L.again}</button>
                  <button disabled={running} onClick={() => runMigration(true)}>{L.fail}</button>
                </>
              ) : (
                <>
                  <button disabled={running} onClick={() => runQuery(Q_VALIDATE, R_VALIDATE)}>{L.validate}</button>
                  <button disabled={running} onClick={() => runQuery(Q_SKIPS, R_SKIPS)}>{L.skips}</button>
                  <button disabled={running} onClick={() => runQuery(Q_CHECKPOINT, R_CHECKPOINT)}>{L.ckpt}</button>
                </>
              )}
              <span className="db-shell">{tab === 'migrate' ? 'zsh' : 'psql'}</span>
            </div>
          </div>

          {/* ── direita: o card do projeto ── */}
          <div className="db-rail">
            <article className="still db-card">
              <span className="take">{t.scene2.take}</span>
              <h3>DataBridge</h3>
              <p>{t.scene2.projectDesc}</p>
              <div className="tags">
                <span>Java</span>
                <span>Spring JDBC</span>
                <span>PostgreSQL</span>
                <span>Docker</span>
              </div>
            </article>
          </div>

        </div>
      </div>
    </section>
  )
}
