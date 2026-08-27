#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.join(__dirname, '..');
const packageJson = require(path.join(projectRoot, 'package.json'));
const outputPath = process.env.GITHUB_OUTPUT;
const expectedTag = `v${packageJson.version}`;
const isPushedTag = process.env.GITHUB_EVENT_NAME === 'push'
  && process.env.GITHUB_REF_TYPE === 'tag';

if (isPushedTag && process.env.GITHUB_REF_NAME !== expectedTag) {
  process.stderr.write(
    `package.json version ${packageJson.version} does not match tag ${process.env.GITHUB_REF_NAME}\n`
  );
  process.exit(1);
}

if (!outputPath) {
  process.stderr.write('GITHUB_OUTPUT is required\n');
  process.exit(1);
}

fs.appendFileSync(outputPath, `publish=${isPushedTag}\nversion=${packageJson.version}\n`);
