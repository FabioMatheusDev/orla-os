/* Export a development handoff, never an installable or working platform port. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');
const ports = path.join(project, 'ports');
const targets = JSON.parse(fs.readFileSync(path.join(ports, 'targets.json'), 'utf8')).targets;
const target = process.argv[2];
if (process.argv.length !== 3 || !Object.hasOwn(targets, target)) {
  console.error('Usage: node scripts/prepare-port.cjs <android-tv|tizen|webos|vega>');
  process.exit(1);
}
// Reuse the current public-asset sanitizer, never copy raw private assets.
if (target !== 'android-tv') {
  execFileSync(process.execPath, [path.join(__dirname, 'prepare-assets.cjs')], { cwd: project, stdio: 'inherit' });
}
const base = path.join(project, '.local', 'ports');
fs.mkdirSync(base, { recursive: true });
const realProject = fs.realpathSync(project);
if (!fs.realpathSync(base).startsWith(realProject + path.sep)) throw new Error('Output must stay inside the project');
// A new directory on every run preserves any previous port work.
const output = fs.mkdtempSync(path.join(base, target + '-'));
for (const name of ['README.md', 'CONTRACT.md', 'REQUEST.md', 'platform-contract.d.ts']) {
  fs.copyFileSync(path.join(ports, name), path.join(output, name));
}
for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
  fs.copyFileSync(path.join(project, name), path.join(output, name));
}
fs.cpSync(path.join(ports, target), path.join(output, 'platform'), { recursive: true });
if (target !== 'android-tv') {
  fs.cpSync(path.join(project, 'app/build/generated/publicAssets/www'), path.join(output, 'ui'), { recursive: true });
  // Do not inherit even public personal preferences (city/dock/etc.) in a port handoff.
  fs.copyFileSync(path.join(project, 'app/src/main/assets/www/config.example.js'), path.join(output, 'ui/config.js'));
}
const plan = {
  schemaVersion: 1,
  target,
  ...targets[target],
  status: 'scaffold-only',
  readyToInstall: false,
  physicalDeviceValidated: false,
  runtimeAdapterImplemented: false,
  generatedAt: new Date().toISOString(),
  androidSource: target === 'android-tv' ? realProject : null,
  nextStep: 'Read platform/README.md and CONTRACT.md; implement and validate the platform adapter before packaging.'
};
fs.writeFileSync(path.join(output, 'PORT_PLAN.json'), JSON.stringify(plan, null, 2) + '\n');
fs.writeFileSync(path.join(output, 'NOT_INSTALLABLE.txt'),
  'DEVELOPMENT SCAFFOLD ONLY. No platform adapter, secure credential store or installable package is provided.\n');
console.log('Port handoff created: ' + path.relative(project, output));
console.log('Scaffold only. Not ready to install; no TV was modified.');
