/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import * as nls from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { mountVoidSettings } from './react/out/void-settings-tsx/index.js'
import { Codicon } from '../../../../base/common/codicons.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';

/** Secondary side bar (Void chat strip) — tab next to History. */
export const SPUD_SETTINGS_VIEW_CONTAINER_ID = 'workbench.view.spudSettings';
export const SPUD_SETTINGS_VIEW_ID = 'workbench.view.spudSettings.main';

// ---------- View pane: hosts React settings ----------

class SpudSettingsViewPane extends ViewPane {

	constructor(
		options: IViewPaneOptions,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IThemeService themeService: IThemeService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IOpenerService openerService: IOpenerService,
		@ITelemetryService telemetryService: ITelemetryService,
		@IHoverService hoverService: IHoverService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.userSelect = 'text';

		this.instantiationService.invokeFunction(accessor => {
			const disposeFn: (() => void) | undefined = mountVoidSettings(parent, accessor)?.dispose;
			this._register(toDisposable(() => disposeFn?.()));
		});
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}
}

// ---------- Register view container on the auxiliary bar (Chat / History / Spud Settings strip) ----------

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const settingsContainer = viewContainerRegistry.registerViewContainer({
	id: SPUD_SETTINGS_VIEW_CONTAINER_ID,
	title: nls.localize2('spudSettingsContainer', 'Spud Settings'),
	storageId: 'workbench.spudSettings.views.state',
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [SPUD_SETTINGS_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	/* After Chat (order 1) and History (order 2) — see sidebarPane.ts */
	order: 3,
	rejectAddedViews: true,
	icon: Codicon.settingsGear,
	alwaysUseContainerInfo: true,
	openCommandActionDescriptor: {
		id: SPUD_SETTINGS_VIEW_CONTAINER_ID,
		title: nls.localize2('spudSettingsOpenView', 'Spud Settings'),
		order: 3,
	},
}, ViewContainerLocation.AuxiliaryBar, { isDefault: false, doNotRegisterOpenCommand: true });

const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: SPUD_SETTINGS_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('spudSettingsViewName', 'Spud Settings'),
	ctorDescriptor: new SyncDescriptor(SpudSettingsViewPane),
	canToggleVisibility: true,
	canMoveView: false,
	collapsed: false,
	weight: 100,
	order: 1,
}], settingsContainer);


// ---------- Commands (open / toggle Spud Settings in the side bar) ----------

export const VOID_TOGGLE_SETTINGS_ACTION_ID = 'workbench.action.toggleVoidSettings'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_TOGGLE_SETTINGS_ACTION_ID,
			title: nls.localize2('voidSettings', "Spud: Toggle Settings"),
			icon: Codicon.settingsGear,
			menu: [
				{
					id: MenuId.LayoutControlMenuSubmenu,
					group: 'z_end',
				}
			]
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		if (viewsService.isViewContainerActive(SPUD_SETTINGS_VIEW_CONTAINER_ID)) {
			viewsService.closeViewContainer(SPUD_SETTINGS_VIEW_CONTAINER_ID);
		} else {
			await viewsService.openViewContainer(SPUD_SETTINGS_VIEW_CONTAINER_ID, true);
		}
	}
})


export const VOID_OPEN_SETTINGS_ACTION_ID = 'workbench.action.openVoidSettings'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPEN_SETTINGS_ACTION_ID,
			title: nls.localize2('voidSettingsAction2', "Spud: Open Settings"),
			f1: true,
			icon: Codicon.settingsGear,
		});
	}
	async run(accessor: ServicesAccessor): Promise<void> {
		const viewsService = accessor.get(IViewsService);
		await viewsService.openViewContainer(SPUD_SETTINGS_VIEW_CONTAINER_ID, true);
	}
})


// Account / global activity menu
MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
	group: '0_command',
	command: {
		id: VOID_OPEN_SETTINGS_ACTION_ID,
		title: nls.localize('voidSettingsActionGear', 'Spud Settings')
	},
	order: 1
});
