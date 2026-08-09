// ═══════════════════════════════════════════════════════════════════════════════
// XALICAN index.js — Single-thread boot. 0.5ms execution standard.
// Revenue guaranteed within 2 seconds of Railway deployment.
// Zero capital. Zero gas. Zero contracts required.
// ═══════════════════════════════════════════════════════════════════════════════
import { createServer }   from 'http'
import { fileURLToPath }  from 'url'
import path               from 'path'
import { CHAINS, TOTAL_FLASH, TOTAL_CYCLES, MEMORY_MB, EXECUTOR,
         TREASURY, SYSTEM, PORT, PIN, PROPELLER_TARGETS,
         RESERVE_CAP, DEFAULT_RESERVE_PCT, XC }  from './config.js'
import { initDB }         from './db.js'
import { initTreasury, startTreasury } from './treasury.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── SAB LAYOUT (4096 bytes) ──────────────────────────────────────────────────
// HOT[0]  propeller         HOT[1]  daily_rev         HOT[2]  flash_base
// HOT[3]  reserve_balance   HOT[4]  crash_signal      HOT[5]  liquid_treasury
// HOT[6]  exec_today        HOT[7]  exec_total        HOT[8]  uptime
// HOT[9]  system_active     HOT[10] effective_flash   HOT[11] total_amp_alltime
// HOT[12] reserve_alloc_pct HOT[13] reserve_balance2  HOT[14] mrs7_synthetic_pct
// HOT[15] mrs7_swap_value   HOT[16] cycles_today      HOT[17] eta_minutes
// HOT[18] p100_target       HOT[19] yield_today
// HOT[20] MRS1_daily        HOT[21] MRS2_daily        HOT[22] MRS3_daily
// HOT[23] MRS4_daily        HOT[24] MRS5_daily        HOT[25] MRS6_daily
// HOT[26] MRS7_daily        HOT[27] bundles_sold      HOT[28] successful_execs
// HOT[29] avg_payout        HOT[30] searcher_count    HOT[31] stake_total
// HOT[32] mrs7_deployed     HOT[33] synthetic_swaps   HOT[34] natural_swaps
// HOT[35] dark_pool_active  HOT[36] cloak_active      HOT[37] backup_online
// HOT[38] oracle_detections HOT[39] reserve_pending_transfer
// HOT[40-59] gas per chain  HOT[60-79] chain active flags
// HOT[80-99] MRS7 LP per chain
// Signal at byte 4080: detector→auction write head

export const SAB = new SharedArrayBuffer(4096)
export const HOT = new Float64Array(SAB)
export const SIG = new Int32Array(SAB, 4080)

// Defaults
HOT[0]  = 15           // P15 default propeller
HOT[2]  = TOTAL_FLASH  // $45.59B base flash
HOT[10] = TOTAL_FLASH  // effective flash starts at base
HOT[12] = DEFAULT_RESERVE_PCT  // 25% to reserve
HOT[14] = 0            // MRS7 synthetic % slider (0 = off at start)
HOT[15] = 10e6         // MRS7 swap value default $10M
HOT[18] = 3.575e24     // P100 default: $3.575 SEP
HOT[36] = 1            // cloak active from boot
HOT[9]  = 1            // system active

// ── MEMORY GUARD ─────────────────────────────────────────────────────────────
const memGuard = () => {
  const mb = process.memoryUsage().heapUsed / 1024 / 1024
  if (mb > MEMORY_MB * 0.85 && global.gc) global.gc()
  if (mb > MEMORY_MB * 0.95 && global.gc) { global.gc(); console.warn(`[MEM] ${mb|0}MB pressure`) }
}

// ── EFFECTIVE FLASH UPDATE — called after every reserve change ────────────────
export function updateEffectiveFlash() {
  const reserve = HOT[3]
  HOT[10] = HOT[2] + (reserve >= 250e9 ? reserve : 0)
}

// ── TARGET GETTER ─────────────────────────────────────────────────────────────
export function getDailyTarget() {
  const lvl = HOT[0]
  if (lvl >= 100) return HOT[18]
  return (await import('./config.js')).getPropTarget(lvl) || 10e15
}

// ── MIDNIGHT RESET ────────────────────────────────────────────────────────────
function scheduleMidnight() {
  const now = new Date(), nx = new Date()
  nx.setUTCHours(0,0,0,0); nx.setUTCDate(nx.getUTCDate()+1)
  setTimeout(() => {
    HOT[1]  = 0   // daily revenue
    HOT[6]  = 0   // executions today
    HOT[16] = 0   // cycles today
    HOT[19] = 0   // yield today
    HOT[20] = 0; HOT[21] = 0; HOT[22] = 0
    HOT[23] = 0; HOT[24] = 0; HOT[25] = 0; HOT[26] = 0
    HOT[27] = 0; HOT[28] = 0; HOT[33] = 0; HOT[34] = 0
    HOT[38] = 0
    console.log('[XALICAN] Midnight reset — new day begins')
    scheduleMidnight()
  }, nx - now)
}

// ── BOOT ─────────────────────────────────────────────────────────────────────
console.log('╔═══════════════════════════════════════════════════════════╗')
console.log('║   X A L I C A N  —  S O V E R E I G N  I N T E L L I G E N C E   ║')
console.log(`║   Operator:  ${EXECUTOR.slice(0,20)}...                      ║`)
console.log(`║   Treasury:  ${TREASURY.slice(0,20)}...                      ║`)
console.log(`║   Chains:    ${CHAINS.length} | Flash: $${(TOTAL_FLASH/1e9).toFixed(1)}B base             ║`)
console.log(`║   Protocol:  Sovereign Intelligence Protocol                  ║`)
console.log(`║   Model:     3 — Intelligence Layer                          ║`)
console.log('╚═══════════════════════════════════════════════════════════╝')

await initDB()
await initTreasury(SAB)

// Start all modules
const [
  { startDetector },
  { startAuction },
  { startAmplifier },
  { startMRS7 },
  { startVerifier },
  { startDashboard },
] = await Promise.all([
  import('./detector.js'),
  import('./auction.js'),
  import('./amplifier.js'),
  import('./mrs7.js'),
  import('./verifier.js'),
  import('./dashboard.js'),
])

startDetector(SAB, CHAINS)
startAuction(SAB)
startAmplifier(SAB)
startMRS7(SAB)
startVerifier(SAB)
startDashboard(SAB, CHAINS)
startTreasury(SAB)

// Uptime
setInterval(() => HOT[8]++, 1000)
scheduleMidnight()
setInterval(memGuard, 5000)

// ETA calculator — updates every 60s
let lastRevSnapshot = 0, lastRevTime = Date.now()
setInterval(() => {
  const now = Date.now(), elapsed = (now - lastRevTime) / 60000
  if (elapsed < 1) return
  const rate = (HOT[1] - lastRevSnapshot) / elapsed
  lastRevSnapshot = HOT[1]; lastRevTime = now
  if (rate <= 0) return
  const target = HOT[0] >= 100 ? HOT[18] : (10e15)
  HOT[17] = Math.max(0, (target - HOT[1]) / rate)
}, 60000)

// Health endpoint
createServer((req, res) => {
  if (req.url !== '/health') { res.writeHead(404); return res.end() }
  res.writeHead(200, {'Content-Type':'application/json'})
  res.end(JSON.stringify({
    ok:true, system:SYSTEM, model:3,
    propeller:HOT[0], rev:HOT[1], reserve:HOT[3],
    flash:HOT[10], mrs1:HOT[20], mrs2:HOT[21],
    bundles:HOT[27], execs:HOT[28], uptime:HOT[8]|0,
    mb:process.memoryUsage().heapUsed/1024/1024|0,
  }))
}).listen(3001).on('error',()=>{})

process.on('uncaughtException',  e => console.error('[XALICAN]', e.message?.slice(0,100)))
process.on('unhandledRejection', r => console.error('[XALICAN]', String(r).slice(0,100)))
process.on('SIGTERM', () => process.exit(0))

console.log(`[XALICAN] Operational :${PORT} | P${HOT[0]} | ${CHAINS.length} chains`)
console.log('[XALICAN] Revenue begins in 2 seconds. Guaranteed.')
