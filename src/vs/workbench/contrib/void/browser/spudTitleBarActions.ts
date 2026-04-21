/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { ColorScheme } from '../../../../platform/theme/common/theme.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { Categories } from '../../../../platform/action/common/actionCommonCategories.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IMetricsService } from '../common/metricsService.js';

/** Matches Spud Settings → Appearance (void-settings-tsx/Settings.tsx). */
const SPUD_LIGHT_THEME_ID = 'Spud Paper';
const SPUD_DARK_THEME_ID = 'Spud Paper Dark';

export const SPUD_TOGGLE_LIGHT_DARK_ACTION_ID = 'workbench.action.spud.toggleLightDarkTheme';

registerAction2(class SpudToggleLightDarkThemeAction extends Action2 {
	constructor() {
		super({
			id: SPUD_TOGGLE_LIGHT_DARK_ACTION_ID,
			title: localize2('spudToggleLightDarkTheme', 'Toggle Light/Dark Theme'),
			icon: Codicon.colorMode,
			category: Categories.View,
			f1: true,
			metadata: {
				description: localize2('spudToggleLightDarkThemeDescription', 'Switch between Spud Paper (light) and Spud Paper Dark. Uses the workbench color theme, same as Spud Settings → Appearance.'),
			},
		});
	}

	run(accessor: ServicesAccessor): void {
		const configurationService = accessor.get(IConfigurationService);
		const themeService = accessor.get(IThemeService);
		const metricsService = accessor.get(IMetricsService);

		const type = themeService.getColorTheme().type;
		const isDark = type === ColorScheme.DARK || type === ColorScheme.HIGH_CONTRAST_DARK;
		const useDarkNext = !isDark;

		const id = useDarkNext ? SPUD_DARK_THEME_ID : SPUD_LIGHT_THEME_ID;
		configurationService.updateValue('workbench.colorTheme', id);
		configurationService.updateValue('workbench.preferredLightColorTheme', SPUD_LIGHT_THEME_ID);
		configurationService.updateValue('workbench.preferredDarkColorTheme', SPUD_DARK_THEME_ID);
		metricsService.capture('Set appearance', { mode: useDarkNext ? 'dark' : 'light', source: 'titleBar' });
	}
});

MenuRegistry.appendMenuItem(MenuId.TitleBar, {
	command: {
		id: SPUD_TOGGLE_LIGHT_DARK_ACTION_ID,
		title: localize('spudTitleBarToggleLightDark', 'Light / dark theme'),
		icon: Codicon.colorMode,
	},
	group: 'navigation',
	order: 5,
});
