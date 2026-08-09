// ═══════════════════════════════════════════════════════════════════════════════
// settlement.js — Universal bridge router
// Detects NAME_SECRET_KEY from env vars automatically
// Each bridge = 30-50 LoC adapter in ./adapters/name.js
// Generic REST fallback for any bridge without an adapter
// Reference: Xalican Operator: Bun Omar SECKA
// ═══════════════════════════════════════════════════════════════════════════════
import { fileURLToPath }  from 'url'
import { createRequire }  from 'module'
import path               from 'path'
import { REF }            from './config.js'

const __dir = path.dirname(fileURLToPath(import.meta.url))

// ── BRIDGE DETECTION ─────────────────────────────────────────────────────────
const BRIDGES = {}
function loadBridges() {
  for (const [k,v] of Object.entries(process.env)) {
    const m = k.match(/^([A-Z][A-Z0-9]+)_SECRET_KEY$/)
    if (m && v) BRIDGES[m[1].toLowerCase()] = v.trim().replace(/['"]/g,'')
  }
  if (Object.keys(BRIDGES).length > 0) {
    console.log(`[SETTLEMENT] Bridges: ${Object.keys(BRIDGES).join(', ')}`)
  }
}
loadBridges()

// ── ADAPTER CACHE ─────────────────────────────────────────────────────────────
const adapterCache = {}

async function loadAdapter(name) {
  if (adapterCache[name]) return adapterCache[name]
  const candidates = [
    path.join(__dir, 'adapters', `${name}.js`),
    path.join(__dir, `${name}.js`),
  ]
  for (const p of candidates) {
    try { const a = await import(p); adapterCache[name]=a; return a } catch {}
  }
  // Generic REST fallback
  const baseUrl = process.env[`${name.toUpperCase()}_BASE_URL`]
  if (baseUrl) {
    const generic = {
      send: async (key, params) => {
        const r = await fetch(`${baseUrl}/transfers`, {
          method:'POST',
          headers:{ Authorization:`Bearer ${key}`, 'Content-Type':'application/json' },
          body:JSON.stringify({ ...params, description:REF }),
          signal:AbortSignal.timeout(60000),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.message||`${r.status}`)
        return d
      },
      calcFee: amount => ({ fee:+(amount*0.015).toFixed(2), net:+(amount*0.985).toFixed(2) })
    }
    adapterCache[name] = generic
    return generic
  }
  throw new Error(`No adapter for '${name}'. Create adapters/${name}.js or set ${name.toUpperCase()}_BASE_URL`)
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────
export async function send(bridge, params) {
  const name = (bridge||'modempay').toLowerCase()
  const key  = BRIDGES[name]
  if (!key) throw new Error(`Bridge '${name}' not configured. Add ${name.toUpperCase()}_SECRET_KEY to Railway Variables.`)
  const adapter = await loadAdapter(name)
  return adapter.send(key, params)
}

export function calcFee(bridge, amount, network='wave') {
  const FEES = { wave:.015, afrimoney:.015, qmoney:.015, bank:.0125, international:.0125, crypto:.01 }
  const rate = FEES[network] || 0.015
  return { amount, fee:+(amount*rate).toFixed(2), net:+(amount*(1-rate)).toFixed(2), rate:`${(rate*100).toFixed(2)}%` }
}

export const getBridges      = () => Object.keys(BRIDGES)
export const getBridgeMode   = n  => { const k=BRIDGES[(n||'modempay').toLowerCase()]||''; return k.startsWith('sk_live_')?'LIVE':k?'TEST':'UNCONFIGURED' }
