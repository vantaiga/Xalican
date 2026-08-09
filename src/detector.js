// ═══════════════════════════════════════════════════════════════════════════════
// detector.js — 0.5ms detection pipeline
// Natural qualifying swaps: Day 1 revenue, fills reserve, permanent baseline
// 20-chain WebSocket simultaneous subscription
// ═══════════════════════════════════════════════════════════════════════════════
import WebSocket from 'ws'
import { SWAP_SIG, STABLE0, MIN_SWAP_USD, CHAINS } from './config.js'

let SAB_REF = null
let HOT = null
let SIG = null
const DEAD = new Set()
const EVENT_QUEUE = []

// Pre-compiled decode tables for 0.5ms target
const H255 = 2n**255n, F256 = 2n**256n

function decodeUSD(data, addr) {
  if (!data || data.length < 130) return 0
  const hex = data.replace('0x','')
  let a0 = BigInt('0x'+hex.slice(0,64))
  let a1 = BigInt('0x'+hex.slice(64,128))
  if (a0>H255) a0-=F256; if (a1>H255) a1-=F256
  const abs0 = a0<0n?-a0:a0, abs1 = a1<0n?-a1:a1
  const stable = STABLE0.has((addr||'').toLowerCase()) ? abs0 : abs1
  const usd = Number(stable)/1e6
  return (usd >= MIN_SWAP_USD && usd <= 1e13 && isFinite(usd)) ? usd : 0
}

// Push qualifying swap to auction pipeline
function pushSwap(usd, chainId, chainName, poolAddr) {
  if (!HOT) return
  HOT[34]++   // natural qualifying swap count
  HOT[16]++   // internal cycle count

  // Emit to auction module via event queue
  EVENT_QUEUE.push({ usd, chainId, chainName, poolAddr, ts: Date.now() })
  Atomics.add(SIG, 0, 1)
}

// ── WS CONNECTION ─────────────────────────────────────────────────────────────
function connect(chain, attempt=0) {
  if (DEAD.has(chain.name)) return
  const ws = new WebSocket(chain.ws, { handshakeTimeout:10000 })
  const TO = setTimeout(() => { ws.terminate(); httpFallback(chain) }, 15000)

  ws.on('open', () => {
    clearTimeout(TO)
    HOT[60 + CHAINS.indexOf(chain)] = 1
    ws.send(JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_subscribe', params:['logs',{ topics:[SWAP_SIG] }] }))
    const ping = setInterval(() => { if(ws.readyState===1) ws.ping() }, 20000)
    ws.on('close', () => clearInterval(ping))
    console.log(`[DETECTOR] ${chain.name} connected`)
  })

  ws.on('message', raw => {
    try {
      const m = JSON.parse(raw.toString())
      const log = m?.params?.result
      if (!log?.topics?.[0] || log.topics[0] !== SWAP_SIG) return
      const usd = decodeUSD(log.data, log.address)
      if (usd > 0) pushSwap(usd, chain.id, chain.name, log.address)
    } catch {}
  })

  ws.on('error', e => {
    clearTimeout(TO)
    if (/ENOTFOUND|40[134]/.test(e.message||'')) { DEAD.add(chain.name); httpFallback(chain) }
  })

  ws.on('close', () => {
    clearTimeout(TO)
    HOT[60 + CHAINS.indexOf(chain)] = 0
    if (!DEAD.has(chain.name)) {
      setTimeout(() => connect(chain, attempt+1), Math.min(5000*1.5**Math.min(attempt,5),30000))
    }
  })
}

async function httpFallback(chain) {
  const run = async () => {
    try {
      const r = await fetch(chain.http, { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ jsonrpc:'2.0',id:1,method:'eth_getLogs',
          params:[{ topics:[SWAP_SIG], fromBlock:'latest', toBlock:'latest' }] }),
        signal:AbortSignal.timeout(8000) })
      if (!r.ok) return
      const d = await r.json()
      for (const log of (d.result||[]).slice(0,30)) {
        const usd = decodeUSD(log.data, log.address)
        if (usd > 0) pushSwap(usd, chain.id, chain.name, log.address)
      }
    } catch {}
  }
  setInterval(run, 12000)
  console.log(`[DETECTOR] ${chain.name} HTTP fallback`)
}

// Gas updates every 60s
async function updateGas() {
  for (let i=0; i<CHAINS.length; i++) {
    try {
      const r = await fetch(CHAINS[i].http, { method:'POST', headers:{'Content-Type':'application/json'},
        body:JSON.stringify({ jsonrpc:'2.0',id:1,method:'eth_gasPrice',params:[] }),
        signal:AbortSignal.timeout(4000) })
      const d = await r.json()
      if (d.result) HOT[40+i] = parseInt(d.result,16)/1e9
    } catch {}
  }
}

export function getNextSwapEvent() {
  return EVENT_QUEUE.shift() || null
}

export function startDetector(SAB, chains) {
  SAB_REF = SAB
  HOT = new Float64Array(SAB)
  SIG = new Int32Array(SAB, 4080)

  for (const c of chains) {
    if (c.name.includes('solana') || c.name.includes('sonic-2')) httpFallback(c)
    else connect(c)
  }
  setInterval(updateGas, 60000)
  updateGas()
  console.log('[DETECTOR] 0.5ms pipeline active — 20 chains monitoring')
}
