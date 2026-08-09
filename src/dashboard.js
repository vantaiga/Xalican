// ═══════════════════════════════════════════════════════════════════════════════
// dashboard.js — XALICAN
// 31 vertical tabs. HOT-only broadcast. WS open (no PIN on upgrade).
// Serves xalican.html at /
// ═══════════════════════════════════════════════════════════════════════════════
import { createRequire }    from 'module'
import { createServer }     from 'http'
import { existsSync }       from 'fs'
import { fileURLToPath }    from 'url'
import path                 from 'path'

const __dir = path.dirname(fileURLToPath(import.meta.url))
const _req  = createRequire(import.meta.url)
const express             = _req(path.join(__dir,'../node_modules/express'))
const { WebSocketServer } = _req(path.join(__dir,'../node_modules/ws'))

import { getAuctions, getTransfers, getXCTx, exportSnapshot, getConfig } from './db.js'
import { getActiveAuctions, getCompletedAuctions, processBid, registerBroadcast } from './auction.js'
import { getMRS7Status }    from './mrs7.js'
import { getPublicROI, getAllSearchers, getTrackRecord } from './verifier.js'
import { sendTransfer, transferReserveToLiquid, transferLiquidToReserve, vaultAddFunds, vaultRestore, verifyVaultPin } from './treasury.js'
import { send as settlementSend, getBridges, getBridgeMode } from './settlement.js'
import { CHAINS, PIN, PORT, SYSTEM, OPERATOR, TREASURY, EXECUTOR,
         TOTAL_FLASH, XC, getPropTarget, VAULT_PIN } from './config.js'

let SAB_REF    = null
let CHAINS_REF = []
const WS_CLIENTS = new Set()
const cleanPin = s => String(s||'').replace(/[^0-9a-zA-Z]/g,'')

const app  = express()
const srv  = createServer(app)
const wss  = new WebSocketServer({ server:srv, perMessageDeflate:false })
app.use(express.json({ limit:'2mb' }))
app.use(express.static(path.join(__dir,'../dashboard')))

app.get('/', (_, res) => {
  const p = path.join(__dir,'../dashboard/xalican.html')
  existsSync(p) ? res.sendFile(p) : res.status(404).send('xalican.html not found in /dashboard/')
})

// ── NO-AUTH ───────────────────────────────────────────────────────────────────
app.get('/ping', (_, res) => {
  const H = SAB_REF ? new Float64Array(SAB_REF) : null
  res.json({ ok:true, system:SYSTEM, ts:Date.now(),
    wsClients:WS_CLIENTS.size, uptime:H?H[8]|0:0,
    propeller:H?H[0]:15, rev:H?H[1]:0, reserve:H?H[3]:0 })
})

// ── AUTH ──────────────────────────────────────────────────────────────────────
const auth = (req,res,next) => {
  const p = cleanPin(req.headers['x-pin']||req.query.pin||req.body?.pin||'')
  if (p !== cleanPin(PIN)) return res.status(401).json({ error:'Invalid PIN' })
  next()
}

// ── HOT STATE ─────────────────────────────────────────────────────────────────
function fullState() {
  if (!SAB_REF) return { type:'state', ts:Date.now(), booting:true }
  const H = new Float64Array(SAB_REF)
  const propeller = H[0], target = propeller >= 100 ? H[18] : (getPropTarget(propeller)||10e15)
  const chains    = CHAINS_REF.map((c,i) => ({ name:c.name, id:c.id, active:H[60+i]>0, gas:H[40+i]?.toFixed(1)||'0' }))
  return {
    type:'state', ts:Date.now(),
    propeller, target, dailyRevenue:H[1], revPct:target>0?Math.min(H[1]/target*100,100):0,
    flashBase:H[2], reserve:H[3], liquidTreasury:H[5], effectiveFlash:H[10],
    flashBoost:H[10]-H[2], reserveFull:H[3]>=15e12,
    uptime:H[8]|0, execToday:H[6]|0, execTotal:H[7]|0, etaMins:H[17],
    p100Target:H[18], yieldToday:H[19],
    mrs1:H[20], mrs2:H[21], mrs3:H[22], mrs4:H[23], mrs5:H[24], mrs6:H[25], mrs7:H[26],
    bundlesSold:H[27]|0, successfulExecs:H[28]|0, avgPayout:H[29],
    searcherCount:H[30]|0, stakeTotal:H[31], mrs7Deployed:H[32],
    syntheticToday:H[33]|0, naturalToday:H[34]|0,
    darkPool:H[35]>0, cloakActive:H[36]>0, backupOnline:H[37]|0,
    oracleDetections:H[38]|0,
    chainCount:CHAINS_REF.length, activeWS:chains.filter(c=>c.active).length, chains,
    memMB:process.memoryUsage().heapUsed/1024/1024|0,
    xcPayoutPct:XC.payoutPct, reserveMax:15e12,
    p30Target:500e18, p100Min:500e18, p100Max:3.575e24,
  }
}

// ── BROADCAST ─────────────────────────────────────────────────────────────────
function broadcast(data) {
  const p = JSON.stringify(data)
  for (const ws of WS_CLIENTS) {
    if (ws.readyState===1) try { ws.send(p) } catch { WS_CLIENTS.delete(ws) }
  }
}
registerBroadcast(broadcast)
setInterval(() => { if (WS_CLIENTS.size>0) broadcast(fullState()) }, 500)

// ── WS ────────────────────────────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  WS_CLIENTS.add(ws)
  ws.send(JSON.stringify(fullState()))
  ws.on('close', () => WS_CLIENTS.delete(ws))
  ws.on('error', () => WS_CLIENTS.delete(ws))
  ws.on('message', raw => {
    try {
      const m = JSON.parse(raw.toString()), H = new Float64Array(SAB_REF)
      if (m.type==='propeller'&&typeof m.level==='number') { H[0]=m.level; broadcast({type:'propeller',level:m.level}) }
      if (m.type==='p100'&&typeof m.target==='number')     { H[18]=m.target; H[0]=100 }
      if (m.type==='mrs7-pct'&&typeof m.pct==='number')    { H[14]=Math.max(0,Math.min(100,m.pct)) }
      if (m.type==='mrs7-val'&&typeof m.val==='number')    { H[15]=m.val }
      if (m.type==='reserve-pct'&&typeof m.pct==='number') { H[12]=Math.max(0,Math.min(25,m.pct)) }
    } catch {}
  })
  console.log(`[DASHBOARD] WS connected | clients:${WS_CLIENTS.size}`)
})

// ── API ───────────────────────────────────────────────────────────────────────
app.get('/api/state',    auth, (_,res) => res.json(fullState()))
app.get('/api/auctions', auth, (req,res) => res.json(getCompletedAuctions(parseInt(req.query.limit)||100)))
app.get('/api/live',     auth, (_,res)  => res.json(getActiveAuctions()))
app.get('/api/searchers',auth, (_,res)  => res.json(getAllSearchers()))
app.get('/api/roi',      auth, (_,res)  => res.json(getPublicROI()))
app.get('/api/track',    auth, (_,res)  => res.json(getTrackRecord()))
app.get('/api/mrs7',     auth, (_,res)  => res.json(getMRS7Status()))
app.get('/api/bridges',  auth, (_,res)  => res.json({bridges:getBridges(),modes:Object.fromEntries(getBridges().map(b=>[b,getBridgeMode(b)]))}))
app.get('/api/transfers',auth, (_,res)  => res.json(getTransfers()))
app.get('/api/xc/tx',    auth, (_,res)  => res.json(getXCTx()))

app.post('/api/propeller', auth, (req,res) => {
  const{level}=req.body; if(typeof level!=='number')return res.status(400).json({error:'level required'})
  const H=new Float64Array(SAB_REF); H[0]=level
  const target=level>=100?H[18]:getPropTarget(level)
  broadcast({type:'propeller',level,target})
  res.json({ok:true,level,target})
})

app.post('/api/p100', auth, (req,res) => {
  const{target}=req.body; if(!target||target<=0)return res.status(400).json({error:'target required'})
  const H=new Float64Array(SAB_REF); H[18]=target; H[0]=100
  res.json({ok:true,target,label:`$${(target/1e24).toFixed(4)} SEP/day`})
})

app.post('/api/mrs7', auth, (req,res) => {
  const{syntheticPct,swapValue,reservePct}=req.body
  const H=new Float64Array(SAB_REF)
  if(typeof syntheticPct==='number') H[14]=Math.max(0,Math.min(100,syntheticPct))
  if(typeof swapValue==='number')    H[15]=Math.max(1e4,swapValue)
  if(typeof reservePct==='number')   H[12]=Math.max(0,Math.min(25,reservePct))
  broadcast({type:'mrs7',syntheticPct:H[14],swapValue:H[15]})
  res.json({ok:true,syntheticPct:H[14],swapValue:H[15],reservePct:H[12]})
})

app.post('/api/reserve/to-liquid', auth, (req,res) => {
  const r=transferReserveToLiquid(req.body.amount); res.json(r)
})
app.post('/api/reserve/to-reserve', auth, (req,res) => {
  const r=transferLiquidToReserve(req.body.amount); res.json(r)
})

app.post('/api/cloak', auth, (req,res) => {
  const H=new Float64Array(SAB_REF)
  if(typeof req.body.darkPool==='boolean') H[35]=req.body.darkPool?1:0
  if(typeof req.body.active==='boolean')   H[36]=req.body.active?1:0
  res.json({ok:true,darkPool:H[35]>0,active:H[36]>0})
})

app.post('/api/vault/add', auth, (req,res) => {
  const r=vaultAddFunds(req.body.amount,req.body.pin); res.json(r)
})
app.post('/api/vault/restore', auth, (req,res) => {
  const r=vaultRestore(req.body.amount,req.body.pin); res.json(r)
})

app.post('/api/transfer', auth, async (req,res) => {
  try { res.json(await sendTransfer(req.body)) } catch(e) { res.status(500).json({error:e.message}) }
})

app.post('/api/xc/convert', auth, (req,res) => {
  const{amount,direction,pin}=req.body
  const v=verifyVaultPin(pin); if(!v.ok)return res.status(403).json(v)
  const H=new Float64Array(SAB_REF)
  if(direction==='usdc_to_xc'){
    if(amount>H[5])return res.status(400).json({error:'Insufficient liquid treasury'})
    H[5]-=amount
    res.json({ok:true,converted:amount,direction:'USDC→XC',xcRate:1/0.001,note:'XC tokens minted from treasury'})
  }else{
    H[5]+=amount
    res.json({ok:true,converted:amount,direction:'XC→USDC',note:'XC burned, USDC restored to treasury'})
  }
})

app.post('/api/xc/payout-pct', auth, (req,res) => {
  const{pct}=req.body; if(typeof pct!=='number')return res.status(400).json({error:'pct required'})
  XC.payoutPct=Math.max(0,Math.min(100,pct))
  broadcast({type:'xc-payout',pct:XC.payoutPct})
  res.json({ok:true,pct:XC.payoutPct})
})

app.post('/api/searcher/register', auth, (req,res) => {
  const{addr,stake}=req.body
  const{registerSearcher}=require('./verifier.js')
  res.json(registerSearcher(addr,stake||10000))
})

app.post('/api/halt', auth, (_,res) => {
  new Float64Array(SAB_REF)[0]=0; broadcast({type:'halt'}); res.json({ok:true})
})

app.post('/api/target-timeframe', auth, (req,res) => {
  const{targetValue,minutes}=req.body; if(!targetValue||!minutes)return res.status(400).json({error:'targetValue and minutes required'})
  const H=new Float64Array(SAB_REF)
  const flash=H[10]||TOTAL_FLASH
  const profitPerCycle=flash*0.01
  const cyclesToHit=Math.ceil(targetValue/profitPerCycle)
  const minutesNeeded=cyclesToHit/(8e6/1440)
  res.json({ok:true,targetValue,minutes,cyclesToHit,minutesNeeded:minutesNeeded.toFixed(1),achievable:minutesNeeded<=minutes,suggestion:minutesNeeded>minutes?`Increase reserve. Need $${((targetValue/minutes*minutesNeeded-flash)/1e12).toFixed(1)}T more reserve`:null})
})

app.post('/api/snapshot', auth, (_,res) => { try{res.json({ok:true,...exportSnapshot()})}catch(e){res.status(500).json({error:e.message})} })
app.get('/api/snapshot/download', auth, (_,res) => { const p=['/data/snapshot.json','./data/snapshot.json'].find(existsSync); if(!p)return res.status(404).json({error:'POST /api/snapshot first'}); res.download(p,'snapshot.json') })

export function startDashboard(SAB, chains) {
  SAB_REF    = SAB
  CHAINS_REF = chains || []
  srv.listen(PORT, () => {
    console.log(`[DASHBOARD] XALICAN :${PORT}`)
    console.log(`[DASHBOARD] 31 tabs | Test: GET /ping`)
  })
}
