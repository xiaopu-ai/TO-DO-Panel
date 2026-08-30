const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.join(__dirname, '..');
const releasePolicyScript = path.join(projectRoot, 'scripts', 'release-policy.js');
const releaseWorkflowPath = path.join(projectRoot, '.github', 'workflows', 'release-dmg.yml');
const entitlementsPath = path.join(projectRoot, 'build', 'entitlements.mac.plist');
const readmePath = path.join(projectRoot, 'README.md');
const packageVersion = require(path.join(projectRoot, 'package.json')).version;
const packageConfig = require(path.join(projectRoot, 'package.json'));

function runReleasePolicy(t, environment) {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'todo-panel-release-policy-'));
  const outputPath = path.join(outputDir, 'github-output.txt');
  t.after(() => fs.rmSync(outputDir, { recursive: true, force: true }));

  const result = spawnSync(process.execPath, [releasePolicyScript], {
    cwd: projectRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
      ...environment,
    },
  });

  return {
    ...result,
    output: fs.existsSync(outputPath) ? fs.readFileSync(outputPath, 'utf8') : '',
  };
}

test('manual workflow runs validate the package without publishing a release', (t) => {
  const result = runReleasePolicy(t, {
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_REF_TYPE: 'branch',
    GITHUB_REF_NAME: 'main',
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^publish=false$/m);
  assert.match(result.output, new RegExp(`^version=${packageVersion.replaceAll('.', '\\.')}$`, 'm'));
});

test('a matching semantic version tag enables release publishing', (t) => {
  const result = runReleasePolicy(t, {
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_TYPE: 'tag',
    GITHUB_REF_NAME: `v${packageVersion}`,
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.output, /^publish=true$/m);
  assert.match(result.output, new RegExp(`^version=${packageVersion.replaceAll('.', '\\.')}$`, 'm'));
});

test('a pushed version tag that disagrees with package.json is rejected', (t) => {
  const result = runReleasePolicy(t, {
    GITHUB_EVENT_NAME: 'push',
    GITHUB_REF_TYPE: 'tag',
    GITHUB_REF_NAME: 'v9.9.9',
  });

  assert.notEqual(result.status, 0);
  assert.equal(
    result.stderr,
    `package.json version ${packageVersion} does not match tag v9.9.9\n`
  );
  assert.equal(result.output, '');
});

test('the release workflow lets manual runs verify artifacts while policy gates publishing', () => {
  const workflow = fs.readFileSync(releaseWorkflowPath, 'utf8');

  assert.match(workflow, /^\s{2}workflow_dispatch:\s*$/m);
  assert.match(workflow, /id:\s*release[\s\S]*?run:\s*node scripts\/release-policy\.js/);
  assert.match(workflow, /name:\s*Build DMG[\s\S]*?run:\s*npm run build/);
  assert.match(workflow, /name:\s*Verify and checksum DMG/);
  assert.match(
    workflow,
    /name:\s*Publish GitHub Release\s*\n\s*if:\s*steps\.release\.outputs\.publish == 'true'/
  );
});

test('macOS packaging declares the Electron 44 minimum and least-privilege runtime entitlements', () => {
  const entitlements = fs.readFileSync(entitlementsPath, 'utf8');
  const readme = fs.readFileSync(readmePath, 'utf8');

  assert.equal(packageConfig.build.mac.minimumSystemVersion, '13.0');
  assert.match(readme, /macOS 13(?:\.0)?\+/);
  assert.doesNotMatch(entitlements, /com\.apple\.security\.cs\.allow-dyld-environment-variables/);
  assert.doesNotMatch(entitlements, /com\.apple\.security\.cs\.disable-executable-page-protection/);
  assert.match(entitlements, /com\.apple\.security\.cs\.allow-jit/);
  assert.match(entitlements, /com\.apple\.security\.cs\.disable-library-validation/);
});
