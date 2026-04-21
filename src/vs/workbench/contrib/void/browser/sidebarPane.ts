/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import {
	Extensions as ViewContainerExtensions, IViewContainersRegistry,
	ViewContainerLocation, IViewsRegistry, Extensions as ViewExtensions,
	IViewDescriptorService,
} from '../../../common/views.js';

import * as nls from '../../../../nls.js';

// import { Codicon } from '../../../../base/common/codicons.js';
// import { localize } from '../../../../nls.js';
// import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';

import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
// import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';


import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';

import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
// import { IDisposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { mountSidebar } from './react/out/sidebar-tsx/index.js';
import { mountHistoryPanel } from './react/out/history-tsx/index.js';

import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
// import { IDisposable } from '../../../../base/common/lifecycle.js';
import { toDisposable } from '../../../../base/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

// compare against search.contribution.ts and debug.contribution.ts, scm.contribution.ts (source control)

// ---------- Define viewpane ----------

class SidebarViewPane extends ViewPane {

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
		// @ICodeEditorService private readonly editorService: ICodeEditorService,
		// @IContextKeyService private readonly editorContextKeyService: IContextKeyService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService)

	}



	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		// parent.style.overflow = 'auto'
		parent.style.userSelect = 'text'

		// gets set immediately
		this.instantiationService.invokeFunction(accessor => {
			// mount react
			const disposeFn: (() => void) | undefined = mountSidebar(parent, accessor)?.dispose;
			this._register(toDisposable(() => disposeFn?.()))
		});
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width)
		this.element.style.height = `${height}px`
		this.element.style.width = `${width}px`
	}

}



class HistoryViewPane extends ViewPane {

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
			const disposeFn: (() => void) | undefined = mountHistoryPanel(parent, accessor)?.dispose;
			this._register(toDisposable(() => disposeFn?.()));
		});
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}
}


// ---------- Register viewpane inside the void container ----------

// const voidThemeIcon = Codicon.symbolObject;
// const voidViewIcon = registerIcon('void-view-icon', voidThemeIcon, localize('voidViewIcon', 'View icon of the Void chat view.'));

// called VIEWLET_ID in other places for some reason
export const VOID_VIEW_CONTAINER_ID = 'workbench.view.void'
export const VOID_VIEW_ID = VOID_VIEW_CONTAINER_ID

/** Own auxiliary icon next to Chat — browse past threads. */
export const VOID_HISTORY_VIEW_CONTAINER_ID = 'workbench.view.void.history'
export const VOID_HISTORY_VIEW_ID = VOID_HISTORY_VIEW_CONTAINER_ID

// Register Chat view container (secondary side bar, left of the two top icons)
const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const voidChatContainer = viewContainerRegistry.registerViewContainer({
	id: VOID_VIEW_CONTAINER_ID,
	title: nls.localize2('voidContainer', 'Chat'), // this is used to say "Void" (Ctrl + L)
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VOID_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 1,

	rejectAddedViews: true,
	icon: Codicon.symbolMethod,


}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: true, isDefault: true });


const voidHistoryContainer = viewContainerRegistry.registerViewContainer({
	id: VOID_HISTORY_VIEW_CONTAINER_ID,
	title: nls.localize2('voidHistoryContainer', 'History'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [VOID_HISTORY_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.HORIZONTAL,
	}]),
	hideIfEmpty: false,
	order: 2,
	rejectAddedViews: true,
	icon: Codicon.history,
}, ViewContainerLocation.AuxiliaryBar, { doNotRegisterOpenCommand: true, isDefault: false });


// Register views
const viewsRegistry = Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry);
viewsRegistry.registerViews([{
	id: VOID_VIEW_ID,
	hideByDefault: false, // start open
	name: nls.localize2('voidChat', 'Chat'),
	ctorDescriptor: new SyncDescriptor(SidebarViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 100,
	order: 1,
}], voidChatContainer);

viewsRegistry.registerViews([{
	id: VOID_HISTORY_VIEW_ID,
	hideByDefault: false,
	name: nls.localize2('voidHistory', 'History'),
	ctorDescriptor: new SyncDescriptor(HistoryViewPane),
	canToggleVisibility: false,
	canMoveView: false,
	weight: 100,
	order: 1,
}], voidHistoryContainer);


// open sidebar
export const VOID_OPEN_SIDEBAR_ACTION_ID = 'void.openSidebar'
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: VOID_OPEN_SIDEBAR_ACTION_ID,
			title: 'Open Void Sidebar',
		})
	}
	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService)
		viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID);
	}
});

export class SidebarStartContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.startupVoidSidebar';
	constructor(
		@ICommandService private readonly commandService: ICommandService,
	) {
		this.commandService.executeCommand(VOID_OPEN_SIDEBAR_ACTION_ID)
	}
}
registerWorkbenchContribution2(SidebarStartContribution.ID, SidebarStartContribution, WorkbenchPhase.AfterRestored);
