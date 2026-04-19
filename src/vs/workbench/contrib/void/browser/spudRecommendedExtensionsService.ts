/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IExtensionGalleryService, IGalleryExtension, IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { IWorkbenchExtensionManagementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { areSameExtensions } from '../../../../platform/extensionManagement/common/extensionManagementUtil.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions, ConfigurationScope } from '../../../../platform/configuration/common/configurationRegistry.js';
import { localize } from '../../../../nls.js';

/**
 * Spud recommended default extensions.
 *
 * Curated list of "daily driver" extensions that cover common file formats
 * (CSV, PDF, YAML, Markdown) and productivity tooling (ESLint, Prettier,
 * GitLens, Error Lens, etc.) so users get a batteries-included experience
 * without having to hunt through the marketplace on first launch.
 *
 * All ids must resolve on Open VSX (https://open-vsx.org) since that is the
 * gallery configured in product.json.
 */
const SPUD_RECOMMENDED_EXTENSIONS: ReadonlyArray<string> = [
	// File format viewers / pretty printers
	'mechatroner.rainbow-csv',          // Rainbow-colored CSV / TSV columns + SQL-like queries
	'tomoki1207.pdf',                   // PDF viewer inside the editor
	'redhat.vscode-yaml',               // YAML with schema validation (Kubernetes, GitHub Actions, forms)

	// Markdown & diagrams
	'yzhang.markdown-all-in-one',       // Markdown shortcuts, TOC, list continuation
	'bierner.markdown-mermaid',         // Mermaid rendering inside markdown preview
	'hediet.vscode-drawio',             // Draw.io flowcharts / diagrams (.drawio / .dio)
	'jebbs.plantuml',                   // PlantUML diagrams

	// Code quality / DX
	'dbaeumer.vscode-eslint',           // ESLint
	'esbenp.prettier-vscode',           // Prettier
	'usernamehw.errorlens',             // Inline error / warning gutter
	'streetsidesoftware.code-spell-checker', // Spell check for code & docs
	'aaron-bond.better-comments',       // Highlighted TODO / FIXME / ? comments
	'christian-kohler.path-intellisense', // Path autocomplete
	'formulahendry.auto-rename-tag',    // Rename paired HTML / JSX tags

	// Git
	'eamodio.gitlens',                  // Rich git blame / history / graph
];

const INSTALL_COMPLETED_STORAGE_KEY = 'spud.recommendedExtensions.completedVersion';
const AUTO_INSTALL_SETTING_KEY = 'spud.recommendedExtensions.autoInstall';

// Bump this to re-run the installer (e.g. when adding new extensions to the list above).
const CURRENT_INSTALL_VERSION = '1';

export class SpudRecommendedExtensionsContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.spudRecommendedExtensions';

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ILogService private readonly logService: ILogService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IExtensionGalleryService private readonly galleryService: IExtensionGalleryService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IWorkbenchExtensionManagementService private readonly workbenchExtensionManagementService: IWorkbenchExtensionManagementService,
	) {
		super();
		// Fire-and-forget: never block workbench startup on a network round-trip.
		void this.run();
	}

	private async run(): Promise<void> {
		try {
			if (this.configurationService.getValue<boolean>(AUTO_INSTALL_SETTING_KEY) === false) {
				this.logService.info('[Spud] Skipping recommended extension install (disabled via setting).');
				return;
			}

			const completedVersion = this.storageService.get(INSTALL_COMPLETED_STORAGE_KEY, StorageScope.APPLICATION);
			if (completedVersion === CURRENT_INSTALL_VERSION) {
				return;
			}

			if (!this.galleryService.isEnabled()) {
				this.logService.warn('[Spud] Extension gallery is not enabled; cannot install recommended extensions.');
				return;
			}

			// Filter out extensions the user already has installed (e.g. from a previous transfer).
			const installed = await this.extensionManagementService.getInstalled();
			const missingIds = SPUD_RECOMMENDED_EXTENSIONS.filter(id =>
				!installed.some(local => areSameExtensions(local.identifier, { id }))
			);

			if (missingIds.length === 0) {
				this.storageService.store(INSTALL_COMPLETED_STORAGE_KEY, CURRENT_INSTALL_VERSION, StorageScope.APPLICATION, StorageTarget.MACHINE);
				return;
			}

			this.logService.info(`[Spud] Installing ${missingIds.length} recommended extension(s): ${missingIds.join(', ')}`);

			const galleryExtensions = await this.galleryService.getExtensions(
				missingIds.map(id => ({ id })),
				{ compatible: true },
				CancellationToken.None,
			);

			// Some ids may not be available on Open VSX; warn but don't fail the rest.
			const foundIds = new Set(galleryExtensions.map(g => g.identifier.id.toLowerCase()));
			for (const id of missingIds) {
				if (!foundIds.has(id.toLowerCase())) {
					this.logService.warn(`[Spud] Recommended extension not found on gallery: ${id}`);
				}
			}

			// Install each extension independently so a single failure doesn't abort the batch.
			await Promise.all(galleryExtensions.map(g => this.installOne(g)));

			this.storageService.store(INSTALL_COMPLETED_STORAGE_KEY, CURRENT_INSTALL_VERSION, StorageScope.APPLICATION, StorageTarget.MACHINE);
			this.logService.info('[Spud] Recommended extensions install pass complete.');
		} catch (err) {
			this.logService.error('[Spud] Failed to install recommended extensions', err);
		}
	}

	private async installOne(gallery: IGalleryExtension): Promise<void> {
		try {
			await this.workbenchExtensionManagementService.installFromGallery(gallery, {
				isMachineScoped: false,
				donotIncludePackAndDependencies: false,
			});
			this.logService.info(`[Spud] Installed recommended extension: ${gallery.identifier.id}`);
		} catch (err) {
			this.logService.warn(`[Spud] Failed to install recommended extension ${gallery.identifier.id}`, err);
		}
	}
}

// User-facing opt-out setting. Most people will never touch it, but power users
// who prefer a bare editor can disable the auto-install before first launch.
Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'spud',
	order: 1000,
	title: localize('spudConfigurationTitle', 'Spud'),
	type: 'object',
	properties: {
		[AUTO_INSTALL_SETTING_KEY]: {
			type: 'boolean',
			default: true,
			scope: ConfigurationScope.APPLICATION,
			description: localize(
				'spud.recommendedExtensions.autoInstall',
				"Automatically install Spud's recommended default extensions (CSV, PDF, Markdown, Mermaid, Draw.io, ESLint, Prettier, GitLens, etc.) on first launch. Already-installed extensions are skipped."
			),
		},
	},
});

registerWorkbenchContribution2(
	SpudRecommendedExtensionsContribution.ID,
	SpudRecommendedExtensionsContribution,
	WorkbenchPhase.Eventually,
);
