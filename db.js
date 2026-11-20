const fs = require('fs');
const FILE = './data.json';
let data = {};
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}

const save = () => fs.writeFileSync(FILE, JSON.stringify(data, null, 2));

module.exports = {
  get: (k, d) => data[k] ?? d,
  set: (k, v) => { data[k] = v; save(); },
  all: () => data,
  replace: (obj) => { data = obj; save(); },
};
