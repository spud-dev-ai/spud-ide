/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { mainWindow } from '../../../../base/browser/window.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';

/**
 * Spud chrome contribution: toggles body-level classes that other CSS
 * (see `media/void.css`) keys off of, so we can tune the workbench chrome
 * on top of whichever color theme is active.
 *
 * Classes applied on <body>:
 *   - `spud-dark`              — set when the active color theme is dark
 *   - `spud-enhance-dark`      — set when dark AND the user enabled
 *                                `enhanceBuiltinDarkChrome` in Spud settings
 */
export class SpudChromeContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.spudChrome';

	constructor(
		@IThemeService private readonly themeService: IThemeService,
		@IVoidSettingsService private readonly voidSettings: IVoidSettingsService,
	) {
		super();
		this.apply();

		this._register(this.themeService.onDidColorThemeChange(() => this.apply()));
		this._register(this.voidSettings.onDidChangeState(() => this.apply()));
	}

	private apply(): void {
		const body = mainWindow.document.body;
		if (!body) return;

		const type = this.themeService.getColorTheme().type;
		const isDark = type === ColorScheme.DARK || type === ColorScheme.HIGH_CONTRAST_DARK;
		const enhance = !!this.voidSettings.state.globalSettings.enhanceBuiltinDarkChrome;

		body.classList.toggle('spud-dark', isDark);
		body.classList.toggle('spud-enhance-dark', isDark && enhance);
	}
}

registerWorkbenchContribution2(SpudChromeContribution.ID, SpudChromeContribution, WorkbenchPhase.BlockRestore);
