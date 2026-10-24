'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const project = path.resolve(__dirname, '..');

test('port handoffs exclude private configuration, remain incomplete, and preserve earlier work', t => {
  const parent = fs.realpathSync(os.tmpdir());
  const fixture = fs.mkdtempSync(path.join(parent, 'home-tv-port-test-'));
  t.after(() => {
    if (path.dirname(fixture) !== parent) throw new Error('Unexpected cleanup location');
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(fixture, 'scripts'));
  for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.md']) {
    fs.copyFileSync(path.join(project, name), path.join(fixture, name));
  }
  for (const name of ['prepare-port.cjs', 'prepare-assets.cjs']) {
    fs.copyFileSync(path.join(project, 'scripts', name), path.join(fixture, 'scripts', name));
  }
  fs.cpSync(path.join(project, 'ports'), path.join(fixture, 'ports'), { recursive: true });
  const assets = path.join(fixture, 'app/src/main/assets/www');
  fs.mkdirSync(assets, { recursive: true });
  const secret = 'placeholder_private_key_never_export';
  fs.writeFileSync(path.join(assets, 'config.js'),
    'window.HOME_CONFIG = ' + JSON.stringify({ city: 'PRIVATE_CITY_FOR_TEST', tmdbKey: secret, mdblistKey: secret }) + ';');
  fs.writeFileSync(path.join(assets, '.env'), 'TMDB_API_KEY=' + secret);
  fs.writeFileSync(path.join(assets, 'secrets.json'), JSON.stringify({ key: secret }));
  fs.writeFileSync(path.join(assets, 'config.example.js'), 'window.HOME_CONFIG = {city: "Example City"};\n');
  fs.writeFileSync(path.join(assets, 'index.html'), '<!doctype html><title>Home TV test</title>');
  const run = target => spawnSync(process.execPath, [path.join(fixture, 'scripts/prepare-port.cjs'), target], { encoding: 'utf8' });
  assert.notEqual(run('../../outside').status, 0);
  assert.equal(fs.existsSync(path.join(fixture, '.local')), false, 'invalid input must not create output');
  const base = path.join(fixture, '.local/ports');
  for (const target of ['android-tv', 'tizen', 'webos', 'vega']) {
    const result = run(target);
    assert.equal(result.status, 0, result.stderr);
    assert(!result.stdout.includes(secret));
    const folder = path.join(base, fs.readdirSync(base).find(name => name.startsWith(target + '-')));
    const plan = JSON.parse(fs.readFileSync(path.join(folder, 'PORT_PLAN.json')));
    assert.equal(plan.readyToInstall, false);
    assert.equal(plan.runtimeAdapterImplemented, false);
    assert.equal(plan.physicalDeviceValidated, false);
    assert(plan.pending.length > 0);
    assert(fs.existsSync(path.join(folder, 'NOT_INSTALLABLE.txt')));
    assert(fs.existsSync(path.join(folder, 'LICENSE')));
    assert.equal(fs.existsSync(path.join(folder, 'ui')), target !== 'android-tv');
    if (target !== 'android-tv') {
      const config = fs.readFileSync(path.join(folder, 'ui/config.js'), 'utf8');
      assert.equal(config, fs.readFileSync(path.join(assets, 'config.example.js'), 'utf8'));
      assert(!config.includes('PRIVATE_CITY_FOR_TEST'));
      const scan = directory => {
        for (const file of fs.readdirSync(directory, { withFileTypes: true })) {
          const full = path.join(directory, file.name);
          if (file.isDirectory()) scan(full);
          else {
            assert(!fs.readFileSync(full, 'utf8').includes(secret));
            assert(!file.name.startsWith('.env'));
            assert.notEqual(file.name, 'secrets.json');
          }
        }
      };
      scan(folder);
    }
    fs.writeFileSync(path.join(folder, 'developer-work.txt'), 'keep my changes');
    assert.equal(run(target).status, 0);
    assert.equal(fs.readFileSync(path.join(folder, 'developer-work.txt'), 'utf8'), 'keep my changes');
    assert.equal(fs.readdirSync(base).filter(name => name.startsWith(target + '-')).length, 2);
  }
});
