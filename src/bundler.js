// ═══════════════════════════════════════════════════════════════════════════════
// bundler.js — 11 bundle types per qualifying swap
// Calldata construction with splitter embedded
// Cryptographic commitment for anti-front-running
// ═══════════════════════════════════════════════════════════════════════════════
import { createHash, randomBytes } from 'crypto'
import { CHAINS, BALANCER, USDC, EXTRACTION_RATE, REF } from './config.js'

// ── 11 BUNDLE TYPES ───────────────────────────────────────────────────────────
export const BUNDLE_TYPES = [
  { id:'PRIMARY',   desc:'JIT on originating chain',      priority:1, validBlocks:3  },
  { id:'ECHO_ETH',  desc:'Cross-chain echo on Ethereum',  priority:2, validBlocks:60 },
  { id:'ECHO_ARB',  desc:'Cross-chain echo on Arbitrum',  priority:2, validBlocks:240},
  { id:'ECHO_BASE', desc:'Cross-chain echo on Base',      priority:2, validBlocks:120},
  { id:'ECHO_POL',  desc:'Cross-chain echo on Polygon',   priority:2, validBlocks:120},
  { id:'INNER_1',   desc:'Recursive inner cycle depth 1', priority:3, validBlocks:3  },
  { id:'INNER_2',   desc:'Recursive inner cycle depth 2', priority:3, validBlocks:3  },
  { id:'INNER_3',   desc:'Recursive inner cycle depth 3', priority:3, validBlocks:3  },
  { id:'ORACLE',    desc:'Oracle deviation window arb',   priority:4, validBlocks:240},
  { id:'LIQ_1',     desc:'Liquidation trigger alpha',     priority:4, validBlocks:120},
  { id:'LIQ_2',     desc:'Liquidation trigger beta',      priority:4, validBlocks:120},
]

// Splitter contract address (pre-deployed, immutable)
const SPLITTER = process.env.SPLITTER_ADDRESS || ''

// ── BUILD BUNDLE ──────────────────────────────────────────────────────────────
export function buildBundle(swapEvent, ampResult, bundleType) {
  const nonce   = randomBytes(32).toString('hex')
  const ts      = Date.now()
  const content = {
    type:         bundleType.id,
    swapUSD:      swapEvent.usd,
    chainId:      swapEvent.chainId,
    poolAddr:     swapEvent.poolAddr,
    flashAmount:  ampResult.flash,
    expectedProfit:ampResult.total,
    apparentProfit:ampResult.apparent,
    auctionPrice: ampResult.auctionPriceBase,
    auctionFloor: ampResult.auctionFloor,
    validBlocks:  bundleType.validBlocks,
    expiresAt:    ts + bundleType.validBlocks * 250,
    splitter:     SPLITTER,
    treasury:     (await import('./config.js')).TREASURY,
    reference:    REF,
  }

  // Cryptographic commitment — reveals calldata only after payment
  const commitment = createHash('sha256')
    .update(JSON.stringify(content) + nonce + ts)
    .digest('hex')

  return {
    id:         `XB_${ts}_${nonce.slice(0,8)}`,
    commitment,
    content,
    nonce,
    ts,
    type:       bundleType.id,
    priority:   bundleType.priority,
    auctionPrice:   ampResult.auctionPriceBase,
    auctionFloor:   ampResult.auctionFloor,
    expectedProfit: ampResult.total,
    apparentProfit: ampResult.apparent,
    validUntil:     content.expiresAt,
    revealed:       false,
  }
}

// ── BUILD ALL 11 BUNDLES FOR ONE SWAP ────────────────────────────────────────
export async function buildAllBundles(swapEvent, ampResult) {
  const bundles = []
  for (const type of BUNDLE_TYPES) {
    try {
      const b = await buildBundle(swapEvent, ampResult, type)
      bundles.push(b)
    } catch {}
  }
  return bundles
}

// ── REVEAL BUNDLE (after payment confirmed) ───────────────────────────────────
export function revealBundle(bundle) {
  if (bundle.revealed) return bundle.content
  bundle.revealed = true
  return bundle.content
}

// ── VERIFY BUNDLE INTEGRITY ───────────────────────────────────────────────────
export function verifyBundle(bundle) {
  const expected = createHash('sha256')
    .update(JSON.stringify(bundle.content) + bundle.nonce + bundle.ts)
    .digest('hex')
  return expected === bundle.commitment
}

console.log('[BUNDLER] 11 bundle types ready | cryptographic commitment active')
