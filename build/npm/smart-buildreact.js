/*---------------------------------------------------------------------------------------------
 *  Smart Void React bundle builder — skips the (slow) scope-tailwind + tsup pipeline when the
 *  bundled output under `react/out/` is already at least as new as every source file under
 *  `react/src/`. Falls back to running `build.js` whenever the cache looks stale.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..', '..');
const reactDir = path.join(root, 'src', 'vs', 'workbench', 'contrib', 'void', 'browser', 'react');
const srcDir = path.join(reactDir, 'src');
const outDir = path.join(reactDir, 'out');

/**
 * Walk a directory returning the newest mtime (in ms) of any file beneath it.
 * Skips `node_modules/` and dotfiles.
 * @param {string} dir
 * @returns {number}
 */
function newestMtime(dir) {
	let newest = 0;
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const full = path.join(dir, entry.name);
		try {
			if (entry.isDirectory()) {
				const sub = newestMtime(full);
				if (sub > newest) newest = sub;
			} else {
				const stat = fs.statSync(full);
				if (stat.mtimeMs > newest) newest = stat.mtimeMs;
			}
		} catch {
			// missing entry — ignore
		}
	}
	return newest;
}

function oldestMtime(dir) {
	let oldest = Number.POSITIVE_INFINITY;
	let entries;
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return 0;
	}
	for (const entry of entries) {
		if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
		const full = path.join(dir, entry.name);
		try {
			if (entry.isDirectory()) {
				const sub = oldestMtime(full);
				if (sub < oldest) oldest = sub;
			} else {
				const stat = fs.statSync(full);
				if (stat.mtimeMs < oldest) oldest = stat.mtimeMs;
			}
		} catch {
			// ignore
		}
	}
	return oldest === Number.POSITIVE_INFINITY ? 0 : oldest;
}

function tag(msg) {
	if (process.stdout.isTTY) {
		console.log(`\x1b[35m[smart-buildreact]\x1b[0m ${msg}`);
	} else {
		console.log(`[smart-buildreact] ${msg}`);
	}
}

function run() {
	const force = process.argv.includes('--force') || process.env['SPUD_FORCE_BUILDREACT'] === '1';
	const outExists = fs.existsSync(outDir) && fs.existsSync(path.join(outDir, 'sidebar-tsx', 'index.js'));

	if (!force && outExists) {
		// Compare oldest out file vs newest src file. If the slowest-built output is still newer
		// than the newest source touch, the bundles are fresh — skip.
		const srcNewest = newestMtime(srcDir);
		const outOldest = oldestMtime(outDir);

		if (outOldest >= srcNewest && srcNewest > 0) {
			const ageSeconds = Math.round((Date.now() - outOldest) / 1000);
			tag(`bundles are fresh (last rebuilt ${ageSeconds}s ago) — skipping.`);
			tag(`run 'bun run buildreact' or set SPUD_FORCE_BUILDREACT=1 to force a rebuild.`);
			return;
		}
		tag(`src newer than out — rebuilding.`);
	} else if (force) {
		tag(`--force requested — rebuilding.`);
	} else {
		tag(`out/ missing — building.`);
	}

	execSync('node build.js', { cwd: reactDir, stdio: 'inherit' });
}

run();
