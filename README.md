# Welcome to Void.

<div align="center">
	<img
		src="./src/vs/workbench/browser/parts/editor/media/slice_of_void.png"
	 	alt="Void Welcome"
		width="300"
	 	height="300"
	/>
</div>

Void is the open-source Cursor alternative.

Use AI agents on your codebase, checkpoint and visualize changes, and bring any model or host locally. Void sends messages directly to providers without retaining your data.

This repo contains the full sourcecode for Void. If you're new, welcome!

- 🧭 [Website](https://voideditor.com)

- 👋 [Discord](https://discord.gg/RSNjgaugJs)

- 🚙 [Project Board](https://github.com/orgs/voideditor/projects/2)


## Install and run (Bun)

This fork uses [Bun](https://bun.sh) as the package manager for the workspace under `ide/`:

- Use **Node.js 20.x** for installs and native modules (see `.nvmrc`). Node v23+ is rejected by `preinstall` because `node-gyp` builds (e.g. `@vscode/spdlog`) break on newer runtimes. If you use Homebrew and also have a newer `node` on your `PATH`, prefer Node 20 for this repo, e.g. `export PATH="$(brew --prefix node@20)/bin:$PATH"` before `bun install`.
- Install dependencies: `bun install` (from `spud/ide`)
- Typical dev loop: `bun run watch`, then launch the app with your usual script (for example `./scripts/code.sh` or `./scripts/code-cli.sh` if present in your tree)

`package.json` pins the expected Bun version via `packageManager`. `npm-run-all` and `deemon` pick up the same package manager from `npm_execpath` when you invoke scripts with `bun run`.

On a **first** full install, the step for `extensions/open-remote-ssh` can sit on `📦 Installing [n/n]` or show no new lines for **several minutes**: the **`ssh2`** package runs a **native `node-gyp` build**, and Bun may print warnings like `ssh2's postinstall cost you …`. That is normal; let it finish. (Git dependencies were replaced with the registry `ssh2` package to avoid cloning large repos; `simple-socks` stays on a pinned git commit.)

## Note

We've paused work on the Void IDE (this repo) to explore a few novel coding ideas. We want to focus on innovation over feature-parity. Void will continue running, but without maintenance some existing features might stop working over time. Depending on the direction of our new work, we might not resume Void as an IDE.

We won't be actively reviewing Issues and PRs, but we will respond to all [email](mailto:hello@voideditor.com) inquiries on building and maintaining your own version of Void while we're paused. 

## Reference

Void is a fork of the [vscode](https://github.com/microsoft/vscode) repository. For a guide to the codebase, see [VOID_CODEBASE_GUIDE](https://github.com/voideditor/void/blob/main/VOID_CODEBASE_GUIDE.md).

For a guide on how to develop your own version of Void, see [HOW_TO_CONTRIBUTE](https://github.com/voideditor/void/blob/main/HOW_TO_CONTRIBUTE.md) and [void-builder](https://github.com/voideditor/void-builder).




## Support
You can always reach us in our Discord server or contact us via email: hello@voideditor.com.
