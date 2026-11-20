// بديل BankUser بدون MongoDB: نفس واجهة mongoose لكن التخزين في data.json
const fs = require('fs');
const path = require('path');

const FILE = process.env.DATA_FILE || path.join(__dirname, '..', '..', 'data.json');

// ---------- الإعدادات الافتراضية (نفس الـ schema القديم) ----------
const defaults = () => ({
  balance: 10000,
  bank: 0,
  materials: { wood: 0, brick: 0, stone: 0, steel: 0, iron: 0, gold: 0 },
  lands: [], cars: [], tickets: [],
  loan: { amount: 0, takenAt: null },
  marriage: { partnerId: null, marriedAt: null },
  frozen: false,
  protection: { active: false, expiresAt: null },
  stats: { highestEarned: 0, highestLost: 0, totalStolen: 0, totalRobbed: 0, totalInvested: 0, highestStolen: 0 },
  investment: { principal: 0, profit: 0, totalInvested: 0, highestWin: 0, lastTick: null },
  cooldowns: { dice: null, luck: null, fruits: null, gamble: null, trade: null, roulette: null, tip: null, rob: null, salary: null, loan: null },
  visaNumber: undefined,
  level: 1, experience: 0, job: 'عاطل',
});
const subDefaults = {
  lands: () => ({ level: 1, lastCollected: new Date() }),
  cars: () => ({ count: 1, damage: 0 }),
  tickets: () => ({ paid: false, issuedAt: new Date() }),
};
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date);

function fill(target, def) {
  for (const k of Object.keys(def)) {
    const d = def[k];
    if (isObj(d)) {
      if (!isObj(target[k])) target[k] = {};
      fill(target[k], d);
    } else if (target[k] === undefined) {
      target[k] = Array.isArray(d) ? [] : d;
    }
  }
}
function normalize(rec) {
  fill(rec, defaults());
  for (const key of Object.keys(subDefaults)) {
    rec[key] = (rec[key] || []).map((s) => { const o = s || {}; fill(o, subDefaults[key]()); return o; });
  }
  if (!rec.createdAt) rec.createdAt = new Date();
  if (!rec.updatedAt) rec.updatedAt = new Date();
  return rec;
}
const toDate = (v) => (typeof v === 'string' && v ? new Date(v) : v);
function reviveDates(r) {
  for (const k of ['createdAt', 'updatedAt']) r[k] = toDate(r[k]);
  if (r.loan) r.loan.takenAt = toDate(r.loan.takenAt);
  if (r.marriage) r.marriage.marriedAt = toDate(r.marriage.marriedAt);
  if (r.protection) r.protection.expiresAt = toDate(r.protection.expiresAt);
  if (r.investment) r.investment.lastTick = toDate(r.investment.lastTick);
  if (r.cooldowns) for (const k of Object.keys(r.cooldowns)) r.cooldowns[k] = toDate(r.cooldowns[k]);
  (r.lands || []).forEach((l) => { l.lastCollected = toDate(l.lastCollected); });
  (r.tickets || []).forEach((t) => { t.issuedAt = toDate(t.issuedAt); t.paidAt = toDate(t.paidAt); });
  return r;
}
const clone = (o) => reviveDates(JSON.parse(JSON.stringify(o instanceof BankUser ? Object.assign({}, o) : o)));

// ---------- التخزين ----------
let users = [];
const index = new Map();
const keyOf = (r) => `${r.guildId}:${r.userId}`;
const rid = () => Date.now().toString(16) + Math.random().toString(16).slice(2, 10);

function rebuild() { index.clear(); users.forEach((u) => index.set(keyOf(u), u)); }
function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    users = (raw.users || []).map((u) => normalize(reviveDates(u)));
  } catch { users = []; }
  rebuild();
}
let timer = null;
function flush() {
  clearTimeout(timer); timer = null;
  try {
    const tmp = FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify({ version: 1, users }));
    fs.renameSync(tmp, FILE);
  } catch (e) { console.error('[BankUser] save failed:', e.message); }
}
let onChangeHook = null;
const scheduleSave = () => { if (onChangeHook) { try { onChangeHook(); } catch {} } if (!timer) timer = setTimeout(flush, 1000); };
process.on('SIGTERM', () => { flush(); process.exit(0); });
process.on('SIGINT', () => { flush(); process.exit(0); });
load();

// ---------- أدوات الاستعلام ----------
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'); let c = o;
  for (let i = 0; i < ks.length - 1; i++) { if (!isObj(c[ks[i]]) && !Array.isArray(c[ks[i]])) c[ks[i]] = {}; c = c[ks[i]]; }
  c[ks[ks.length - 1]] = v;
}
const eq = (a, b) => (a instanceof Date || b instanceof Date) ? +new Date(a) === +new Date(b) : JSON.stringify(a) === JSON.stringify(b);

function matches(rec, filter = {}) {
  return Object.entries(filter).every(([k, cond]) => {
    if (k === '$or') return cond.some((f) => matches(rec, f));
    if (k === '$and') return cond.every((f) => matches(rec, f));
    const v = getPath(rec, k);
    if (isObj(cond) && Object.keys(cond).some((x) => x.startsWith('$'))) {
      return Object.entries(cond).every(([op, c]) => {
        switch (op) {
          case '$gt': return v > c; case '$gte': return v >= c;
          case '$lt': return v < c; case '$lte': return v <= c;
          case '$ne': return !eq(v, c); case '$eq': return eq(v, c);
          case '$in': return c.some((x) => eq(v, x));
          case '$nin': return !c.some((x) => eq(v, x));
          case '$exists': return (v !== undefined) === !!c;
          default: throw new Error(`BankUser: operator ${op} not supported`);
        }
      });
    }
    if (Array.isArray(v) && !Array.isArray(cond)) return v.some((x) => eq(x, cond));
    return eq(v, cond);
  });
}

function applyUpdate(rec, update = {}) {
  const hasOps = Object.keys(update).some((k) => k.startsWith('$'));
  const ops = hasOps ? update : { $set: update };
  for (const [op, body] of Object.entries(ops)) {
    for (const [p, v] of Object.entries(body)) {
      if (op === '$set' || op === '$setOnInsert') setPath(rec, p, v);
      else if (op === '$inc') setPath(rec, p, (getPath(rec, p) || 0) + v);
      else if (op === '$unset') setPath(rec, p, undefined);
      else if (op === '$push') { const a = getPath(rec, p) || []; a.push(...(isObj(v) && v.$each ? v.$each : [v])); setPath(rec, p, a); }
      else if (op === '$pull') { const a = getPath(rec, p) || []; setPath(rec, p, a.filter((x) => !(isObj(v) ? matches(x, v) : eq(x, v)))); }
      else throw new Error(`BankUser: update operator ${op} not supported`);
    }
  }
  normalize(rec);
  rec.updatedAt = new Date();
}

// ---------- الـ Document ----------
const SNAP = Symbol('snap');
const snapshot = (rec) => { const s = {}; for (const k of Object.keys(rec)) s[k] = JSON.stringify(rec[k]); return s; };

class BankUser {
  constructor(data = {}, fromDb = false) {
    Object.assign(this, JSON.parse(JSON.stringify(data)));
    reviveDates(this);
    normalize(this);
    if (!this._id) this._id = rid();
    Object.defineProperty(this, SNAP, { value: fromDb ? snapshot(this) : null, writable: true, enumerable: false });
    Object.defineProperty(this, 'isNew', { value: !fromDb, writable: true, enumerable: false });
  }
  get id() { return this._id; }
  markModified() {}
  toObject() { return clone(this); }
  toJSON() { return Object.assign({}, this); }

  async save() {
    if (!this.userId || !this.guildId) throw new Error('BankUser validation failed: userId and guildId are required');
    if (!this.visaNumber) this.visaNumber = Math.floor(1000000000000000 + Math.random() * 9000000000000000).toString();
    normalize(this);
    this.updatedAt = new Date();
    const key = keyOf(this);
    const existing = index.get(key);
    if (this.isNew) {
      if (existing) { const e = new Error(`E11000 duplicate key: ${key}`); e.code = 11000; throw e; }
      const rec = clone(this); users.push(rec); index.set(key, rec);
    } else if (!existing) {
      const rec = clone(this); users.push(rec); index.set(key, rec);
    } else {
      // نكتب فقط الحقول اللي تغيّرت، عشان ما نمسح تعديلات ثانية صارت بالتزامن
      for (const k of Object.keys(this)) {
        const now = JSON.stringify(this[k]);
        if (now !== this[SNAP][k]) existing[k] = now === undefined ? undefined : JSON.parse(now);
      }
      reviveDates(existing); normalize(existing);
    }
    this[SNAP] = snapshot(this); this.isNew = false;
    scheduleSave();
    return this;
  }
}

// ---------- Query ----------
class Query {
  constructor(run) { this.run = run; this._sort = null; this._limit = 0; this._skip = 0; this._lean = false; }
  sort(s) { this._sort = s; return this; }
  limit(n) { this._limit = n; return this; }
  skip(n) { this._skip = n; return this; }
  lean() { this._lean = true; return this; }
  select() { return this; }
  populate() { return this; }
  exec() { return Promise.resolve().then(() => this.run(this)); }
  then(a, b) { return this.exec().then(a, b); }
  catch(f) { return this.exec().catch(f); }
  finally(f) { return this.exec().finally(f); }
}
function sorter(spec) {
  let pairs = [];
  if (typeof spec === 'string') pairs = spec.split(/\s+/).filter(Boolean).map((s) => s.startsWith('-') ? [s.slice(1), -1] : [s, 1]);
  else if (spec) pairs = Object.entries(spec).map(([k, v]) => [k, v === 'desc' || v === -1 ? -1 : 1]);
  return (a, b) => { for (const [k, d] of pairs) { const x = getPath(a, k), y = getPath(b, k); if (x < y) return -d; if (x > y) return d; } return 0; };
}
const wrap = (rec, q) => (q && q._lean) ? clone(rec) : new BankUser(rec, true);

BankUser.find = (filter = {}) => new Query((q) => {
  let r = users.filter((u) => matches(u, filter));
  if (q._sort) r = r.slice().sort(sorter(q._sort));
  if (q._skip) r = r.slice(q._skip);
  if (q._limit) r = r.slice(0, q._limit);
  return r.map((u) => wrap(u, q));
});
BankUser.findOne = (filter = {}) => new Query((q) => {
  let r = users.filter((u) => matches(u, filter));
  if (q._sort) r = r.slice().sort(sorter(q._sort));
  return r[0] ? wrap(r[0], q) : null;
});
BankUser.findById = (id) => BankUser.findOne({ _id: id });
BankUser.countDocuments = (filter = {}) => new Query(() => users.filter((u) => matches(u, filter)).length);
BankUser.exists = (filter = {}) => new Query(() => { const u = users.find((x) => matches(x, filter)); return u ? { _id: u._id } : null; });
BankUser.create = async (data) => {
  if (Array.isArray(data)) { const out = []; for (const d of data) out.push(await new BankUser(d).save()); return out; }
  return new BankUser(data).save();
};
BankUser.insertMany = (arr) => BankUser.create(arr);
BankUser.updateMany = (filter, update) => new Query(() => {
  const list = users.filter((u) => matches(u, filter));
  list.forEach((u) => applyUpdate(u, update)); scheduleSave();
  return { matchedCount: list.length, modifiedCount: list.length, acknowledged: true };
});
BankUser.updateOne = (filter, update, opts = {}) => new Query(() => {
  let u = users.find((x) => matches(x, filter));
  if (!u && opts.upsert) {
    const base = {}; Object.entries(filter).forEach(([k, v]) => { if (!isObj(v)) setPath(base, k, v); });
    u = normalize(base); u._id = rid(); users.push(u); index.set(keyOf(u), u);
  }
  if (!u) return { matchedCount: 0, modifiedCount: 0, acknowledged: true };
  applyUpdate(u, update); scheduleSave();
  return { matchedCount: 1, modifiedCount: 1, acknowledged: true };
});
BankUser.findOneAndUpdate = (filter, update, opts = {}) => new Query(() => {
  let u = users.find((x) => matches(x, filter));
  let before = u ? clone(u) : null;
  if (!u && opts.upsert) {
    const base = {}; Object.entries(filter).forEach(([k, v]) => { if (!isObj(v)) setPath(base, k, v); });
    u = normalize(base); u._id = rid(); users.push(u); index.set(keyOf(u), u);
    before = null;
  }
  if (!u) return null;
  applyUpdate(u, update); scheduleSave();
  return new BankUser(opts.new || opts.returnDocument === 'after' ? u : (before || u), true);
});
BankUser.deleteOne = (filter) => new Query(() => {
  const i = users.findIndex((x) => matches(x, filter));
  if (i >= 0) { users.splice(i, 1); rebuild(); scheduleSave(); }
  return { deletedCount: i >= 0 ? 1 : 0 };
});
BankUser.deleteMany = (filter = {}) => new Query(() => {
  const n = users.length; users = users.filter((x) => !matches(x, filter)); rebuild(); scheduleSave();
  return { deletedCount: n - users.length };
});
BankUser.findOneAndDelete = (filter) => new Query(() => {
  const i = users.findIndex((x) => matches(x, filter));
  if (i < 0) return null;
  const [u] = users.splice(i, 1); rebuild(); scheduleSave(); return new BankUser(u, true);
});
BankUser.aggregate = () => { throw new Error('BankUser.aggregate غير مدعوم في النسخة بدون MongoDB'); };

// ---------- للنسخ والاسترجاع ----------
BankUser.__dump = () => JSON.parse(JSON.stringify(users));
BankUser.__load = (arr) => { users = arr.map((u) => normalize(reviveDates(u))); rebuild(); flush(); return users.length; };
BankUser.__count = () => users.length;
BankUser.__flush = flush;
BankUser.__setOnChange = (fn) => { onChangeHook = fn; };

module.exports = BankUser;
