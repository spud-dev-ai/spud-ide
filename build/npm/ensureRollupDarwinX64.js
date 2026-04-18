/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Bun/npm on Apple Silicon installs @rollup/rollup-darwin-arm64 only. If Node is x64 (Rosetta),
 * Rollup loads @rollup/rollup-darwin-x64 — which was never installed. Fetch that tarball from
 * the registry when missing (optional deps cannot be forced per-CPU in Bun the way Rosetta needs).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..', '..');

function main() {
	if (process.platform !== 'darwin' || process.arch !== 'x64') {
		return;
	}
	const destDir = path.join(root, 'node_modules', '@rollup', 'rollup-darwin-x64');
	const marker = path.join(destDir, 'package.json');
	if (fs.existsSync(marker)) {
		return;
	}
	let version;
	try {
		const rollupPkg = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', 'rollup', 'package.json'), 'utf8'));
		version = rollupPkg.optionalDependencies && rollupPkg.optionalDependencies['@rollup/rollup-darwin-x64'];
	} catch {
		return;
	}
	if (!version) {
		return;
	}
	console.log(`[ensure-rollup-darwin-x64] Installing @rollup/rollup-darwin-x64@${version} for x64 Node on macOS...`);
	const url = `https://registry.npmjs.org/@rollup/rollup-darwin-x64/-/rollup-darwin-x64-${version}.tgz`;
	const tgz = path.join(os.tmpdir(), `rollup-darwin-x64-${version}-${process.pid}.tgz`);
	try {
		execSync(`curl -fsSL "${url}" -o "${tgz}"`, { stdio: 'inherit', shell: true });
		fs.mkdirSync(destDir, { recursive: true });
		execSync(`tar -xzf "${tgz}" -C "${destDir}" --strip-components=1`, { stdio: 'inherit', shell: true });
		console.log('[ensure-rollup-darwin-x64] Done.');
	} finally {
		try {
			fs.unlinkSync(tgz);
		} catch {
			// ignore
		}
	}
}

module.exports = { main };

if (require.main === module) {
	main();
}
