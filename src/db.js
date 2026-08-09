// ═══════════════════════════════════════════════════════════════════════════════
// db.js — sql-asm.js (pure JS, no WASM). /data persistence.
// Auction history, searcher registry, MRS tracking, snapshot migration.
// ═══════════════════════════════════════════════════════════════════════════════
import { createRequire }                          from 'module'
import { existsSync, mkdirSync, writeFileSync,
         readFileSync, unlinkSync }               from 'fs'
import { fileURLToPath }                          from 'url'
import path                                       from 'path'

const __dir  = path.dirname(fileURLToPath(import.meta.url))
const _req   = createRequire(import.meta.url)
const SQL    = await _req(path.join(__dir,'../node_modules/sql.js/dist/sql-asm.js'))()
const DIR    = existsSync('/data')?'/data':(mkdirSync('./data',{recursive:true}),'./data')
const BIN    = `${DIR}/xalican.db.bin`
let db=null, dirty=false

const flush=()=>{if(db)try{writeFileSync(BIN,Buffer.from(db.export()))}catch{}}
setInterval(()=>{if(dirty){flush();dirty=false}},10000)
process.on('exit',flush); process.on('SIGTERM',()=>{flush();process.exit(0)})

export async function initDB(){
  db=existsSync(BIN)?
    (()=>{try{return new SQL.Database(readFileSync(BIN))}catch{return new SQL.Database()}})()):
    new SQL.Database()

  db.run(`
    CREATE TABLE IF NOT EXISTS auctions(
      id TEXT PRIMARY KEY, ts INTEGER, bundle_type TEXT,
      swap_usd REAL, apparent_profit REAL, real_profit REAL,
      auction_price REAL, buyers INTEGER, successful_execs INTEGER,
      mrs1_rev REAL, mrs2_rev REAL, status TEXT DEFAULT 'complete'
    );
    CREATE TABLE IF NOT EXISTS searchers(
      addr TEXT PRIMARY KEY, stake REAL, purchases INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0, roi REAL DEFAULT 0, xc_balance REAL DEFAULT 0,
      tier INTEGER DEFAULT 1, registered INTEGER, priority INTEGER DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS transfers(
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER,
      type TEXT, amount REAL, bridge TEXT, recipient TEXT,
      status TEXT, reference TEXT
    );
    CREATE TABLE IF NOT EXISTS xc_transactions(
      id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER,
      from_addr TEXT, to_addr TEXT, amount REAL,
      fee REAL, type TEXT, tx_hash TEXT
    );
    CREATE TABLE IF NOT EXISTS config(key TEXT PRIMARY KEY, val TEXT);
    CREATE TABLE IF NOT EXISTS mrs_daily(
      date TEXT PRIMARY KEY,
      mrs1 REAL DEFAULT 0, mrs2 REAL DEFAULT 0, mrs3 REAL DEFAULT 0,
      mrs4 REAL DEFAULT 0, mrs5 REAL DEFAULT 0, mrs6 REAL DEFAULT 0,
      mrs7 REAL DEFAULT 0, total REAL DEFAULT 0
    );
  `)

  for(const p of['./snapshot.json',`${DIR}/snapshot.json`]){
    if(!existsSync(p))continue
    try{const s=JSON.parse(readFileSync(p,'utf8'));_imp(s);unlinkSync(p);console.log('[DB] Snapshot imported')}catch{}
    break
  }
  flush(); console.log(`[DB] ${BIN}`)
}

function _imp(snap){
  for(const[t,rows]of Object.entries(snap?.tables??{})){
    if(!Array.isArray(rows)||!rows.length)continue
    const cols=Object.keys(rows[0]).filter(c=>c!=='id'),ph=cols.map(()=>'?').join(',')
    for(const row of rows){try{db.run(`INSERT OR REPLACE INTO ${t}(${cols.join(',')})VALUES(${ph})`,cols.map(c=>row[c]))}catch{}}
  }
}

export function exportSnapshot(){
  const tables=['auctions','searchers','transfers','xc_transactions','config','mrs_daily'],result={}
  for(const t of tables){
    try{const r=db.exec(`SELECT * FROM ${t} ORDER BY rowid DESC LIMIT 5000`);result[t]=r[0]?r[0].values.map(row=>Object.fromEntries(r[0].columns.map((c,i)=>[c,row[i]]))):[];}catch{result[t]=[]}
  }
  const snap={version:'1.0',exportedAt:Date.now(),tables:result},out=`${DIR}/snapshot.json`
  writeFileSync(out,JSON.stringify(snap)); flush()
  return{path:out,sizeKB:Math.round(JSON.stringify(snap).length/1024)}
}

export const getDB=()=>db
export function setConfig(k,v){db.run('INSERT OR REPLACE INTO config VALUES(?,?)',[k,String(v)]);dirty=true}
export function getConfig(k,def=null){try{const r=db.exec('SELECT val FROM config WHERE key=?',[k]);return r[0]?.values[0]?.[0]??def}catch{return def}}

export function recAuction(d){
  try{db.run('INSERT OR REPLACE INTO auctions(id,ts,bundle_type,swap_usd,apparent_profit,real_profit,auction_price,buyers,successful_execs,mrs1_rev,mrs2_rev,status)VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',
    [d.id,Date.now(),d.type||'',d.swapUSD||0,d.apparent||0,d.real||0,d.price||0,d.buyers||0,d.execs||0,d.mrs1||0,d.mrs2||0,d.status||'complete']);dirty=true}catch{}
}
export function getAuctions(n=100){try{const r=db.exec(`SELECT * FROM auctions ORDER BY rowid DESC LIMIT ${+n|0}`);return r[0]?r[0].values.map(row=>Object.fromEntries(r[0].columns.map((c,i)=>[c,row[i]]))):[];}catch{return[]}}
export function recTransfer(d){try{db.run('INSERT INTO transfers(ts,type,amount,bridge,recipient,status,reference)VALUES(?,?,?,?,?,?,?)',[Date.now(),d.type||'',d.amount||0,d.bridge||'',d.recipient||'',d.status||'',d.reference||'']);dirty=true}catch{}}
export function getTransfers(n=50){try{const r=db.exec(`SELECT * FROM transfers ORDER BY rowid DESC LIMIT ${+n|0}`);return r[0]?r[0].values.map(row=>Object.fromEntries(r[0].columns.map((c,i)=>[c,row[i]]))):[];}catch{return[]}}
export function recXC(d){try{db.run('INSERT INTO xc_transactions(ts,from_addr,to_addr,amount,fee,type,tx_hash)VALUES(?,?,?,?,?,?,?)',[Date.now(),d.from||'',d.to||'',d.amount||0,d.fee||0,d.type||'transfer',d.hash||'']);dirty=true}catch{}}
export function getXCTx(n=100){try{const r=db.exec(`SELECT * FROM xc_transactions ORDER BY rowid DESC LIMIT ${+n|0}`);return r[0]?r[0].values.map(row=>Object.fromEntries(r[0].columns.map((c,i)=>[c,row[i]]))):[];}catch{return[]}}
