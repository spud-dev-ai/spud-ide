/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/**
 * Bun may skip package lifecycle scripts unless listed in trustedDependencies. Even then,
 * @vscode/sqlite3 has no install script — the native addon must be built for the Electron
 * version in devDependencies (node-gyp against electron headers).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..', '..');

function getElectronVersion() {
	const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
	const v = pkg.devDependencies && pkg.devDependencies.electron;
	if (!v) {
		throw new Error('devDependencies.electron missing');
	}
	return String(v).replace(/^[\^~]/, '');
}

function main() {
	const rgBin =
		process.platform === 'win32'
			? path.join(root, 'node_modules', '@vscode', 'ripgrep', 'bin', 'rg.exe')
			: path.join(root, 'node_modules', '@vscode', 'ripgrep', 'bin', 'rg');
	if (!fs.existsSync(rgBin)) {
		console.log('[ensure-vscode-native] @vscode/ripgrep binary missing; running postinstall...');
		const rgRoot = path.join(root, 'node_modules', '@vscode', 'ripgrep');
		if (!fs.existsSync(path.join(rgRoot, 'lib', 'postinstall.js'))) {
			console.warn('[ensure-vscode-native] @vscode/ripgrep not found; skip.');
			return;
		}
		execSync('node ./lib/postinstall.js', { cwd: rgRoot, stdio: 'inherit' });
	}

	const sqliteNode = path.join(root, 'node_modules', '@vscode', 'sqlite3', 'build', 'Release', 'vscode-sqlite3.node');
	if (!fs.existsSync(sqliteNode)) {
		const electronVer = getElectronVersion();
		console.log(`[ensure-vscode-native] @vscode/sqlite3 native missing; rebuilding for Electron ${electronVer} (first run can take several minutes)...`);
		const sqliteRoot = path.join(root, 'node_modules', '@vscode', 'sqlite3');
		if (!fs.existsSync(path.join(sqliteRoot, 'binding.gyp'))) {
			console.warn('[ensure-vscode-native] @vscode/sqlite3 not found; skip.');
			return;
		}
		const env = {
			...process.env,
			npm_config_target: electronVer,
			npm_config_runtime: 'electron',
			npm_config_disturl: 'https://electronjs.org/headers',
		};
		execSync('npx --yes node-gyp rebuild', { cwd: sqliteRoot, stdio: 'inherit', env, shell: true });
	}
}

module.exports = { main };

if (require.main === module) {
	main();
}
