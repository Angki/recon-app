// Each test invocation uses a disposable home: database tests must never open real scan history.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'recon-tests-'));
const env = {...process.env, HOME:home, USERPROFILE:home, APPDATA:path.join(home,'AppData','Roaming'), LOCALAPPDATA:path.join(home,'AppData','Local'), ELECTRON_RUN_AS_NODE:'1', RECON_TEST_HOME:home};
const electron = require('electron');
const probe = cp.spawnSync(electron, ['-e', "if(require('os').homedir() !== process.env.RECON_TEST_HOME) process.exit(7)"], {env,windowsHide:true});
if (probe.status !== 0) throw new Error('Test home isolation failed');
const requested = process.argv.slice(2);
const files = requested.length ? requested : fs.readdirSync(path.join(root,'tests')).filter(name => name.endsWith('.test.ts')).map(name => `tests/${name}`);
console.log(`Isolated test home: ${home}`);
const result = cp.spawnSync(electron, ['node_modules/tsx/dist/cli.mjs','--test','--test-concurrency=1',...files], {cwd:root,env,stdio:'inherit',windowsHide:true,timeout:180000});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
