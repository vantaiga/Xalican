// ═══════════════════════════════════════════════════════════════════════════════
// XALICAN — SOVEREIGN INTELLIGENCE PROTOCOL
// Operator: Bun Omar SECKA
// Model 3 — The Intelligence Layer
// Revenue from knowledge. Zero capital. Zero gas. Zero risk.
// ═══════════════════════════════════════════════════════════════════════════════

export const SYSTEM      = 'XALICAN'
export const VERSION     = '1.0'
export const MODEL       = 3
export const PROTOCOL    = 'Sovereign Intelligence Protocol'
export const OPERATOR    = 'Bun Omar SECKA'
export const REF         = 'Xalican Operator: Bun Omar SECKA'
export const EXECUTOR    = '0xEc92EF0C897b48A3525Df011D08011c5eB2D6D39'
export const TREASURY    = '0xCCCF1C9A2154750A0D7CceeD51fE0f9b4c1906e8'
export const VAULT_PIN   = '3530588'
export const MEMORY_MB   = 200
export const PORT        = parseInt(process.env.PORT || '3000')
export const PIN         = (s => String(s||'').replace(/[^0-9a-zA-Z]/g,''))(process.env.DASHBOARD_PASSKEY || '3530588')

// ── XC CURRENCY ──────────────────────────────────────────────────────────────
export const XC = {
  name:         'XC',
  fullName:     'Xalican Sovereign Currency',
  acronym:      'XC',
  tagline:      'Prestige. Power. Proliferation.',
  totalSupply:  1_000_000_000n,                    // 1 billion XC fixed supply
  txFeePct:     0.001 / 100,                       // 0.001% per transaction
  goldPegGrams: 0.001,                             // 1 XC = 0.001 grams of gold
  goldOracle:   '0xAb5c49580294Aff77670F839ea425f5b78ab3Ae7', // Chainlink XAU/USD
  contracts: {
    polygon:   process.env.XC_POLYGON   || '',
    ethereum:  process.env.XC_ETHEREUM  || '',
    arbitrum:  process.env.XC_ARBITRUM  || '',
    base:      process.env.XC_BASE      || '',
  },
  payoutPct:    10,   // % of buyer payouts in XC (0 = all USDC, 100 = all XC)
}

// ── 20 ALCHEMY ENDPOINTS — HARDCODED ─────────────────────────────────────────
export const CHAINS = [
  { name:'arb-mainnet',        id:42161,  http:'https://arb-mainnet.g.alchemy.com/v2/X0nWXU_gGc2Q7P_FrF_tM',       fl:2100,  blocks:345600 },
  { name:'eth-mainnet',        id:1,      http:'https://eth-mainnet.g.alchemy.com/v2/jKhd0hz6ZYWaDlacqh_dx',       fl:8200,  blocks:7200   },
  { name:'base-mainnet',       id:8453,   http:'https://base-mainnet.g.alchemy.com/v2/3aotTt1Kv1x-fWDF7_kab',      fl:1400,  blocks:43200  },
  { name:'polygon-mainnet',    id:137,    http:'https://polygon-mainnet.g.alchemy.com/v2/CfWwmhym4lH5r7_T7_oU0',   fl:1800,  blocks:40754  },
  { name:'opt-mainnet',        id:10,     http:'https://opt-mainnet.g.alchemy.com/v2/sGjcCN-W3Ls8XQNNqSsNn',       fl:1100,  blocks:43200  },
  { name:'bnb-mainnet',        id:56,     http:'https://bnb-mainnet.g.alchemy.com/v2/6iqYCCQwSTR6b-tJKucS-',       fl:1500,  blocks:28328  },
  { name:'avax-mainnet',       id:43114,  http:'https://avax-mainnet.g.alchemy.com/v2/qbhq33J1d5gA1fa2F9oTc',      fl:1200,  blocks:42146  },
  { name:'blast-mainnet',      id:81457,  http:'https://blast-mainnet.g.alchemy.com/v2/0zddkzYwBs_J7lTLPQJAr',     fl:800,   blocks:43200  },
  { name:'zksync-mainnet',     id:324,    http:'https://zksync-mainnet.g.alchemy.com/v2/-2hgPK_0yIugOtz8gd2bN',    fl:900,   blocks:43200  },
  { name:'scroll-mainnet',     id:534352, http:'https://scroll-mainnet.g.alchemy.com/v2/2Hfl39Jdr3cIONf6P6evX',    fl:600,   blocks:28800  },
  { name:'linea-mainnet',      id:59144,  http:'https://linea-mainnet.g.alchemy.com/v2/1orEe9d1Y0Z6pcu0YsUPH',     fl:700,   blocks:43200  },
  { name:'mantle-mainnet',     id:5000,   http:'https://mantle-mainnet.g.alchemy.com/v2/TjtdcQ2UzexinqajRW1AX',    fl:500,   blocks:43200  },
  { name:'gnosis-mainnet',     id:100,    http:'https://gnosis-mainnet.g.alchemy.com/v2/rcXlHBD_ATzcywKP_3yOv',    fl:400,   blocks:16941  },
  { name:'worldchain-mainnet', id:480,    http:'https://worldchain-mainnet.g.alchemy.com/v2/KYeP7PjTazpg9y1cESm3h',fl:300,   blocks:43200  },
  { name:'berachain-mainnet',  id:80094,  http:'https://berachain-mainnet.g.alchemy.com/v2/2dJONPcgoCkGLFULJ1ugZ', fl:600,   blocks:43200  },
  { name:'unichain-mainnet',   id:1301,   http:'https://unichain-mainnet.g.alchemy.com/v2/oFFJFW-FxwGOnCaNx21LO',  fl:500,   blocks:43200  },
  { name:'sei-mainnet',        id:1329,   http:'https://sei-mainnet.g.alchemy.com/v2/-vnNUoR-xYBdJc-EVAEtr',       fl:800,   blocks:345600 },
  { name:'sonic-mainnet',      id:146,    http:'https://sonic-mainnet.g.alchemy.com/v2/bvVHqI4zTiNSN8Hkx9vqj',     fl:700,   blocks:172800 },
  { name:'sonic-mainnet-2',    id:146,    http:'https://sonic-mainnet.g.alchemy.com/v2/OwN_yxTn0r3jg4KxlqkYJ',     fl:700,   blocks:172800 },
  { name:'solana-mainnet',     id:0,      http:'https://solana-mainnet.g.alchemy.com/v2/FOimj4oVe521S4xNZC9FO',     fl:1200,  blocks:172800 },
].map(c => ({ ...c, ws: c.http.replace('https://','wss://') }))

export const TOTAL_FLASH  = CHAINS.reduce((s,c) => s+c.fl, 0) * 1e6   // ~$45.59B base
export const TOTAL_CYCLES = 8_000_000   // effective cycles/day

// ── SWAP DETECTION ────────────────────────────────────────────────────────────
export const SWAP_SIG = '0xc42079f94a6350d7e6235f29174924f928cc2ac818eb64fed8004e115fbcca67'
export const MIN_SWAP_USD   = 10_000         // $10K minimum for detection
export const BUYERS_PER_BUNDLE = 100_000     // simultaneous buyers per bundle
export const BUNDLES_PER_SWAP  = 11          // bundle types generated per qualifying swap
export const PAYOUT_TIER_1     = 1_000_000   // $1M — top 10% (10K buyers)
export const PAYOUT_TIER_2     = 10_000_000  // $10M — top 1%  (1K buyers)
export const PROCESSING_FEE    = 500         // $500 for failed execution refund
export const STAKE_PER_BUYER   = 10_000      // $10K stake per registered buyer

// ── TREASURY RESERVE ─────────────────────────────────────────────────────────
export const RESERVE_CAP     = 15e12        // $15T maximum reserve
export const RESERVE_FLOOR   = 250e9        // $250B minimum before flash amplification
export const MRS7_POOL_ALLOC = 3e12         // $3T for MRS7 synthetic swap manufacturing
export const MRS7_BUFFER     = 2e12         // $2T buffer zone
export const DEFAULT_RESERVE_PCT = 25       // 25% of revenue → reserve by default

// ── AMPLIFIER ─────────────────────────────────────────────────────────────────
export const EXTRACTION_RATE = 0.01          // 1% (vs naive 0.045%) — 1% Uniswap fee tier
export const AMP_LAYERS = {
  L1: { name:'JIT Full Flash',      rate:0.01,  desc:'Full flash × 1% Uniswap fee tier' },
  L2: { name:'Cascade Compound',    rate:0.01,  desc:'50% L1 × 80 Aave × 1%' },
  L3: { name:'Cross-Chain Echo',    rate:0.70,  desc:'4 chains × 70% efficiency' },
  L4: { name:'Recursive Depth-3',   rate:null,  desc:'3 inner flash cycles' },
  L5: { name:'Oracle Deviation',    rate:null,  desc:'Chainlink lag × $14.49B Aave TVL' },
  L6: { name:'MRS7 Pool Amp',       rate:0.20,  desc:'+20% from deployed reserve pools' },
  L7: { name:'Parallel Execution',  rate:null,  desc:'100K buyers simultaneous' },
  L8: { name:'Synthetic Volume',    rate:null,  desc:'MRS7 manufactured swap amplification' },
}

// ── PROPELLER TABLE ───────────────────────────────────────────────────────────
// Values in USD. QUD=Quadrillion QUI=Quintillion SEP=Septillion
export const PROPELLER_TARGETS = {
  // SSP Range
  'SSP1': 1e5, 'SSP2': 2.5e5, 'SSP3': 5e5, 'SSP4': 7.5e5, 'SSP5': 1e6,
  // SP Range
  'SP1': 5e6, 'SP2': 15e6, 'SP3': 50e6, 'SP4': 150e6, 'SP5': 500e6,
  // P Range
  'P1':  5e8,   'P2':  1e9,   'P3':  5e9,   'P4':  50e9,   'P5':  500e9,
  'P6':  2e12,  'P7':  5e12,  'P8':  10e12, 'P9':  50e12,  'P10': 100e12,
  'P11': 500e12,'P12': 1e15,  'P13': 2e15,  'P14': 5e15,   'P15': 10e15,   // P15 DEFAULT
  'P16': 20e15, 'P17': 50e15, 'P18': 100e15,'P19': 500e15, 'P20': 1e18,
  'P21': 5e18,  'P22': 10e18, 'P23': 50e18, 'P24': 100e18, 'P25': 200e18,
  'P26': 300e18,'P27': 400e18,'P28': 450e18,'P29': 490e18, 'P30': 500e18,  // P30: 500 QUI
  // P100: 500 QUI → 3.575 SEP (operator sets custom value)
}

export function getPropTarget(level) {
  if (level >= 100)    return null    // P100: operator-set custom value (HOT[18])
  if (level >= 30)     return PROPELLER_TARGETS['P30']
  if (level >= 15)     return PROPELLER_TARGETS[`P${Math.round(level)}`] || PROPELLER_TARGETS['P15']
  if (level >= 10.5)   return PROPELLER_TARGETS['SP5']
  if (level >= 10.2)   return PROPELLER_TARGETS['SP4']
  if (level >= 10.1)   return PROPELLER_TARGETS['SP3']
  if (level >= 10.05)  return PROPELLER_TARGETS['SP2']
  if (level >= 10)     return PROPELLER_TARGETS['SP1']
  const key = level < 1 ? `SSP${Math.max(1,Math.round(level*10))}` : `P${Math.round(level)}`
  return PROPELLER_TARGETS[key] || PROPELLER_TARGETS['P15']
}

// ── USDC ADDRESSES ────────────────────────────────────────────────────────────
export const USDC = {
  137:   '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  1:     '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  8453:  '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  10:    '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
}

export const BALANCER   = '0xBA12222222228d8Ba445958a75a0704d566BF2C8'
export const STABLE0 = new Set([
  '0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640',
  '0x45dda9cb7c25131df268515131f647d726f50608',
  '0x4c36388be6f416a29c8d8eee81c771ce6be14b5',
  '0xc6962004f452be9203591991d15f6b388e09e8d0',
  '0x1fb3cf6e48f1e7b10213e7b6d87d4c073c7fdb7',
])
