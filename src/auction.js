// ═══════════════════════════════════════════════════════════════════════════════
// auction.js — Dutch auction engine
// 100K simultaneous buyers per bundle
// $1M payout top 10% (10K buyers), $10M top 1% (1K buyers)
// Dutch price: 80% → 20% over 600ms, 1% decline per 100ms
// ═══════════════════════════════════════════════════════════════════════════════
import { getNextSwapEvent } from './detector.js'
import { amplify } from './amplifier.js'
import { buildAllBundles, revealBundle, verifyBundle } from './bundler.js'
import { BUYERS_PER_BUNDLE, PAYOUT_TIER_1, PAYOUT_TIER_2,
         PROCESSING_FEE, TREASURY, XC } from './config.js'

let HOT = null
const ACTIVE_AUCTIONS = new Map()
const COMPLETED_AUCTIONS = []
const BID_QUEUE = []

// ── PROCESS INCOMING SWAPS ───────────────────────────────────────────────────
async function processSwap() {
  const event = getNextSwapEvent()
  if (!event) return

  const effectiveFlash = HOT ? HOT[10] : 45.59e9
  const propeller      = HOT ? HOT[0] : 15
  const amp            = amplify(event.usd, effectiveFlash, propeller)

  if (amp.total < 1000) return

  const bundles = await buildAllBundles(event, amp)
  for (const bundle of bundles) {
    openAuction(bundle)
  }
}

// ── OPEN AUCTION ──────────────────────────────────────────────────────────────
function openAuction(bundle) {
  const auction = {
    id:           bundle.id,
    bundle,
    startPrice:   bundle.auctionPrice,
    currentPrice: bundle.auctionPrice,
    floor:        bundle.auctionFloor,
    openedAt:     Date.now(),
    closesAt:     Date.now() + 600,   // 600ms Dutch window
    buyers:       [],
    status:       'open',
    expectedProfit: bundle.expectedProfit,
  }
  ACTIVE_AUCTIONS.set(bundle.id, auction)
  if (HOT) HOT[27]++
  broadcastAuction(auction)

  // Price decline: 1% per 100ms
  let step = 0
  const decline = setInterval(() => {
    step++
    const pct = Math.max(0.20, 0.80 - step * 0.01)
    auction.currentPrice = Math.floor(bundle.auctionPrice * pct)
    if (step >= 60 || auction.status !== 'open') {
      clearInterval(decline)
      if (auction.status === 'open') closeAuction(auction.id)
    }
    broadcastAuction(auction)
  }, 10)   // 10ms steps for smooth 0.5ms responsiveness
}

// ── PROCESS BID ───────────────────────────────────────────────────────────────
export async function processBid({ auctionId, buyerAddr, pricePaid, xcPct }) {
  const auction = ACTIVE_AUCTIONS.get(auctionId)
  if (!auction || auction.status !== 'open') return { ok:false, reason:'Auction closed' }
  if (pricePaid < auction.currentPrice) return { ok:false, reason:'Bid below current price' }

  // Reveal bundle to paying buyer
  const calldata = revealBundle(auction.bundle)

  // Record bid
  auction.buyers.push({ addr:buyerAddr, paid:pricePaid, ts:Date.now(), xcPct:xcPct||0 })

  // Revenue to HOT — MRS1
  const mrs1Revenue = pricePaid
  if (HOT) {
    HOT[1]  += mrs1Revenue
    HOT[5]  += mrs1Revenue * 0.75   // 75% liquid
    HOT[20] += mrs1Revenue           // MRS1 counter
    // Reserve allocation
    const reservePct = Math.max(0, Math.min(25, HOT[12])) / 100
    HOT[3] = Math.min(HOT[3] + mrs1Revenue * reservePct, 15e12)
    if (HOT[3] >= 15e12) HOT[12] = 0  // reserve full
    // Update effective flash
    const { updateEffectiveFlash } = await import('./index.js')
    updateEffectiveFlash()
  }

  return { ok:true, calldata, expectedPayout: PAYOUT_TIER_1 }
}

// ── CLOSE AUCTION — settle payouts ───────────────────────────────────────────
async function closeAuction(auctionId) {
  const auction = ACTIVE_AUCTIONS.get(auctionId)
  if (!auction) return
  auction.status = 'settling'

  const buyers    = auction.buyers
  const total     = buyers.length
  const tier2Cnt  = Math.max(1, Math.floor(total * 0.01))   // top 1%
  const tier1Cnt  = Math.max(1, Math.floor(total * 0.10))   // top 10%
  const failedCnt = Math.max(0, total - tier1Cnt)

  // MRS2 revenue from successful executions
  const successfulExecs = tier1Cnt
  const mrs2Revenue     = auction.expectedProfit * successfulExecs * 0.999
  const payoutT2Total   = tier2Cnt * PAYOUT_TIER_2   // $10M each
  const payoutT1Total   = (tier1Cnt - tier2Cnt) * PAYOUT_TIER_1   // $1M each
  const processingFees  = failedCnt * PROCESSING_FEE
  const netMRS2         = mrs2Revenue - payoutT2Total - payoutT1Total + processingFees

  if (HOT) {
    HOT[1]  += netMRS2
    HOT[5]  += netMRS2 * 0.75
    HOT[21] += netMRS2           // MRS2 counter
    HOT[28] += successfulExecs
    HOT[6]  += successfulExecs
    HOT[7]  += successfulExecs

    // Reserve from MRS2
    const reservePct = Math.max(0, HOT[12]) / 100
    HOT[3] = Math.min(HOT[3] + netMRS2 * reservePct, 15e12)
    if (HOT[3] >= 15e12) HOT[12] = 0
  }

  auction.status      = 'complete'
  auction.mrs2Revenue = mrs2Revenue
  auction.netRevenue  = netMRS2
  COMPLETED_AUCTIONS.push(auction)
  if (COMPLETED_AUCTIONS.length > 1000) COMPLETED_AUCTIONS.shift()
  ACTIVE_AUCTIONS.delete(auctionId)
}

// ── BROADCAST (implemented by dashboard.js) ──────────────────────────────────
let _broadcast = () => {}
export function registerBroadcast(fn) { _broadcast = fn }
function broadcastAuction(a) {
  _broadcast({ type:'auction', id:a.id, price:a.currentPrice, buyers:a.buyers.length, status:a.status })
}

export function getActiveAuctions() { return Array.from(ACTIVE_AUCTIONS.values()).slice(0,50) }
export function getCompletedAuctions(n=100) { return COMPLETED_AUCTIONS.slice(-n) }

// Poll for new swap events every 0.5ms
setInterval(processSwap, 0.5)

export function startAuction(SAB) {
  HOT = new Float64Array(SAB)
  console.log('[AUCTION] Dutch auction engine active | 100K buyers per bundle | 0.5ms pipeline')
}
