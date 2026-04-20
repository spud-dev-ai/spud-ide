/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

// Increase max listeners for event emitters
require('events').EventEmitter.defaultMaxListeners = 100;

const gulp = require('gulp');
const util = require('./lib/util');
const task = require('./lib/task');
const { transpileClientSWC, transpileTask, compileTask, watchTask, compileApiProposalNamesTask, watchApiProposalNamesTask } = require('./lib/compilation');
const { monacoTypecheckTask/* , monacoTypecheckWatchTask */ } = require('./gulpfile.editor');
const { compileExtensionsTask, watchExtensionsTask, compileExtensionMediaTask } = require('./gulpfile.extensions');

// API proposal names
gulp.task(compileApiProposalNamesTask);
gulp.task(watchApiProposalNamesTask);

// SWC Client Transpile
const transpileClientSWCTask = task.define('transpile-client-esbuild', task.series(util.rimraf('out'), transpileTask('src', 'out', true)));
gulp.task(transpileClientSWCTask);

// Transpile only
const transpileClientTask = task.define('transpile-client', task.series(util.rimraf('out'), transpileTask('src', 'out')));
gulp.task(transpileClientTask);

// Fast compile for development time
const compileClientTask = task.define('compile-client', task.series(util.rimraf('out'), compileApiProposalNamesTask, compileTask('src', 'out', false)));
gulp.task(compileClientTask);

const watchClientTask = task.define('watch-client', task.series(util.rimraf('out'), task.parallel(watchTask('out', false), watchApiProposalNamesTask)));
gulp.task(watchClientTask);

// All — keep monaco typecheck parallel (noEmit). Serialize client → extensions → extension media so
// vinyl-fs does not mkdir/chmod the same `out/` tree concurrently (flaky ENOENT chmod on e.g. out/vs/editor/common/diff).
const _compileTask = task.define('compile', task.parallel(
	monacoTypecheckTask,
	task.series(compileClientTask, compileExtensionsTask, compileExtensionMediaTask)
));
gulp.task(_compileTask);

// Fast compile — esbuild transpile (no typecheck, no emit-time type errors).
// Use with `bun run compile:fast` for the dev inner loop; run `bun run typecheck` or
// `bun run typecheck:watch` separately to see type errors. Produces a runnable `out/`.
const compileClientFastTask = task.define('compile-client-fast', task.series(
	util.rimraf('out'),
	compileApiProposalNamesTask,
	transpileTask('src', 'out', true),
));
gulp.task(compileClientFastTask);

const _compileFastTask = task.define('compile-fast', task.series(
	compileClientFastTask,
	compileExtensionsTask,
	compileExtensionMediaTask,
));
gulp.task(_compileFastTask);

gulp.task(task.define('watch', task.parallel(/* monacoTypecheckWatchTask, */ watchClientTask, watchExtensionsTask)));

// Default
gulp.task('default', _compileTask);

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
	process.exit(1);
});

// Load all the gulpfiles only if running tasks other than the editor tasks
require('glob').sync('gulpfile.*.js', { cwd: __dirname })
	.forEach(f => require(`./${f}`));
