/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// @ts-check

import path from 'path';
import { spawn } from 'child_process';
import { promises as fs, existsSync } from 'fs';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = path.resolve(__dirname, '..', '..');

function usingBun(): boolean {
	const p = process.env['npm_execpath'] || '';
	if (p.includes('bun')) {
		return true;
	}
	// `code.sh` invokes `node preLaunch.js` without npm's env — still prefer Bun when the repo uses it.
	return existsSync(path.join(rootDir, 'bun.lock')) || existsSync(path.join(rootDir, 'bun.lockb'));
}

function getRunner(): string {
	if (usingBun()) {
		return process.platform === 'win32' ? 'bun.exe' : 'bun';
	}
	return npm;
}

function runProcess(command: string, args: ReadonlyArray<string> = []) {
	return new Promise<void>((resolve, reject) => {
		const child = spawn(command, args, { cwd: rootDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
		child.on('exit', err => !err ? resolve() : process.exit(err ?? 1));
		child.on('error', reject);
	});
}

async function exists(subdir: string) {
	try {
		await fs.stat(path.join(rootDir, subdir));
		return true;
	} catch {
		return false;
	}
}

async function ensureNodeModules() {
	if (!(await exists('node_modules'))) {
		if (usingBun()) {
			await runProcess(getRunner(), ['install']);
		} else {
			await runProcess(npm, ['ci']);
		}
	}
}

async function getElectron() {
	await runProcess(getRunner(), ['run', 'electron']);
}

async function ensureCompiled() {
	// Require the real entry — a partial `out/` (e.g. failed compile) must not skip the full build.
	if (!(await exists('out/main.js'))) {
		await runProcess(getRunner(), ['run', 'compile']);
	}
}

async function main() {
	await ensureNodeModules();
	await getElectron();
	await ensureCompiled();

	// Can't require this until after dependencies are installed
	const { getBuiltInExtensions } = require('./builtInExtensions');
	await getBuiltInExtensions();
}

if (require.main === module) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}
