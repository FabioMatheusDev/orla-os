/* Generate only public settings. Personal keys in legacy config.js never enter the APK. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const project = path.resolve(__dirname, '..');
const source = path.join(project, 'app/src/main/assets');
const target = path.join(project, 'app/build/generated/publicAssets');
if (path.relative(project, target) !== path.join('app', 'build', 'generated', 'publicAssets')) throw new Error('Invalid generated assets directory');
const local = path.join(source, 'www/config.js');
const example = path.join(source, 'www/config.example.js');
const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(fs.existsSync(local) ? local : example, 'utf8'), sandbox, { timeout: 1000 });
const safe = {};
for (const name of ['city', 'latitude', 'longitude', 'visual', 'region', 'language', 'coins', 'dock', 'providers', 'catalogSections', 'enableBetaCatalog']) {
  if (sandbox.window.HOME_CONFIG[name] !== undefined) safe[name] = sandbox.window.HOME_CONFIG[name];
}
function copy(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === 'config.js' || entry.name.startsWith('.env') || /^(local\.properties|credentials\..*|secrets\..*)$/i.test(entry.name) || /\.(key|keystore|jks|p12|pem)$/i.test(entry.name)) continue;
    const a = path.join(from, entry.name), b = path.join(to, entry.name);
    if (entry.isDirectory()) copy(a, b); else fs.copyFileSync(a, b);
  }
}
// Delete only the verified generated directory so removed assets cannot survive a rebuild.
fs.rmSync(target, { recursive: true, force: true });
copy(source, target);
fs.writeFileSync(path.join(target, 'www/config.js'), 'window.HOME_CONFIG = ' + JSON.stringify(safe, null, 2) + ';\n');
console.log('Public assets generated; credentials excluded.');
