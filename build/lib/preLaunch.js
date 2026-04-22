"use strict";
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-check
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const rootDir = path_1.default.resolve(__dirname, '..', '..');
function repoPrefersBun() {
    const p = process.env['npm_execpath'] || '';
    if (p.includes('bun')) {
        return true;
    }
    return fs_1.existsSync(path_1.default.join(rootDir, 'bun.lock')) || fs_1.existsSync(path_1.default.join(rootDir, 'bun.lockb'));
}
function bunExecutableAvailable() {
    const bun = process.platform === 'win32' ? 'bun.exe' : 'bun';
    try {
        const r = (0, child_process_1.spawnSync)(bun, ['--version'], { stdio: 'ignore', env: process.env });
        return r.status === 0;
    }
    catch {
        return false;
    }
}
function usingBun() {
    return repoPrefersBun() && bunExecutableAvailable();
}
function getRunner() {
    if (usingBun()) {
        return process.platform === 'win32' ? 'bun.exe' : 'bun';
    }
    return npm;
}
function runProcess(command, args = []) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.spawn)(command, args, { cwd: rootDir, stdio: 'inherit', env: process.env, shell: process.platform === 'win32' });
        child.on('exit', err => !err ? resolve() : process.exit(err ?? 1));
        child.on('error', reject);
    });
}
async function exists(subdir) {
    try {
        await fs_1.promises.stat(path_1.default.join(rootDir, subdir));
        return true;
    }
    catch {
        return false;
    }
}
async function ensureNodeModules() {
    if (!(await exists('node_modules'))) {
        if (usingBun()) {
            await runProcess(getRunner(), ['install']);
        }
        else {
            await runProcess(npm, ['ci']);
        }
    }
}
/** Bun skips some native builds; @vscode/sqlite3 has no install script — build for Electron before launch. */
async function ensureVscodeNativeDeps() {
    const scriptPath = path_1.default.join(rootDir, 'build', 'npm', 'ensureVscodeNativeDeps.js');
    if (fs_1.existsSync(scriptPath)) {
        await runProcess(process.execPath, [scriptPath]);
    }
}
async function getElectron() {
    await runProcess(getRunner(), ['run', 'electron']);
}
async function ensureCompiled() {
    if (!(await exists('out/main.js'))) {
        await runProcess(getRunner(), ['run', 'compile']);
    }
}
async function main() {
    await ensureNodeModules();
    await ensureVscodeNativeDeps();
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
//# sourceMappingURL=preLaunch.js.map