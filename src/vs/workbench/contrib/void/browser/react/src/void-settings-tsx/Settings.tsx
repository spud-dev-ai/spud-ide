/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'; // Added useRef import just in case it was missed, though likely already present
import { ProviderName, SettingName, displayInfoOfSettingName, providerNames, VoidStatefulModelInfo, customSettingNamesOfProvider, RefreshableProviderName, refreshableProviderNames, displayInfoOfProviderName, nonlocalProviderNames, localProviderNames, GlobalSettingName, featureNames, displayInfoOfFeatureName, isProviderNameDisabled, FeatureName, hasDownloadButtonsOnModelsProviderNames, subTextMdOfProviderName } from '../../../../common/voidSettingsTypes.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { VoidButtonBgDarken, VoidCustomDropdownBox, VoidInputBox2, VoidSimpleInputBox, VoidSwitch } from '../util/inputs.js'
import { useAccessor, useIsDark, useIsOptedOut, useRefreshModelListener, useRefreshModelState, useSettingsState } from '../util/services.js'
import { X, RefreshCw, Loader2, Check, Asterisk, Plus, Sun, Moon } from 'lucide-react'
import { URI } from '../../../../../../../base/common/uri.js'
import { ModelDropdown } from './ModelDropdown.js'
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js'
import { WarningBox } from './WarningBox.js'
import { os } from '../../../../common/helpers/systemInfo.js'
import { IconLoading } from '../sidebar-tsx/SidebarChat.js'
import { ToolApprovalType, toolApprovalTypes } from '../../../../common/toolsServiceTypes.js'
import Severity from '../../../../../../../base/common/severity.js'
import { getModelCapabilities, modelOverrideKeys, ModelOverrides } from '../../../../common/modelCapabilities.js';
import { TransferEditorType, TransferFilesInfo } from '../../../extensionTransferTypes.js';
import { MCPServer } from '../../../../common/mcpServiceTypes.js';
import { useMCPServiceState } from '../util/services.js';
import { OPT_OUT_KEY } from '../../../../common/storageKeys.js';
import { StorageScope, StorageTarget } from '../../../../../../../platform/storage/common/storage.js';
import { fetchSpudCloudSession, trimTrailingSlash } from '../util/spudCloudApi.js';

type Tab =
	| 'models'
	| 'localProviders'
	| 'providers'
	| 'featureOptions'
	| 'mcp'
	| 'general'
	| 'all';

/** Shared responsive typography + spacing for settings sections (mobile → desktop). */
const settingsSectionTitleClass = 'text-xl sm:text-2xl lg:text-3xl font-semibold tracking-tight text-void-fg-1 mb-2 sm:mb-3'
const settingsSectionLeadClass = 'text-sm sm:text-[15px] leading-relaxed text-void-fg-3 mb-3 sm:mb-4'

const SettingsSectionCard = ({ children, className }: { children: React.ReactNode; className?: string }) => (
	<section
		className={`rounded-xl border border-void-border-3 bg-void-bg-1/85 p-4 shadow-sm backdrop-blur-[1px] dark:bg-void-bg-2/45 sm:p-5 ${className ?? ''}`}
		style={{ borderColor: 'var(--vscode-widget-border, rgba(0, 0, 0, 0.1))' }}
	>
		{children}
	</section>
)

const SPUD_LIGHT_THEME_ID = 'Spud Paper'
const SPUD_DARK_THEME_ID = 'Spud Paper Dark'

const AppearanceToggle = () => {
	const accessor = useAccessor()
	const configurationService = accessor.get('IConfigurationService')
	const metricsService = accessor.get('IMetricsService')
	const isDark = useIsDark()

	const setTheme = (mode: 'light' | 'dark') => {
		const id = mode === 'dark' ? SPUD_DARK_THEME_ID : SPUD_LIGHT_THEME_ID
		configurationService.updateValue('workbench.colorTheme', id)
		configurationService.updateValue('workbench.preferredLightColorTheme', SPUD_LIGHT_THEME_ID)
		configurationService.updateValue('workbench.preferredDarkColorTheme', SPUD_DARK_THEME_ID)
		metricsService.capture('Set appearance', { mode })
	}

	const baseBtn = 'flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0 px-4 py-2 sm:py-1.5 text-sm border border-void-border-1 transition-colors touch-manipulation'
	const activeCls = 'bg-void-bg-3 text-void-fg-1'
	const inactiveCls = 'bg-void-bg-1 text-void-fg-3 hover:bg-void-bg-2'

	return (
		<div className='inline-flex rounded-md overflow-hidden' role='radiogroup' aria-label='Appearance'>
			<button
				type='button'
				role='radio'
				aria-checked={!isDark}
				className={`${baseBtn} rounded-l-md ${!isDark ? activeCls : inactiveCls}`}
				onClick={() => setTheme('light')}
			>
				<Sun className='size-4' />
				<span>Light</span>
			</button>
			<button
				type='button'
				role='radio'
				aria-checked={isDark}
				className={`${baseBtn} rounded-r-md border-l-0 ${isDark ? activeCls : inactiveCls}`}
				onClick={() => setTheme('dark')}
			>
				<Moon className='size-4' />
				<span>Dark</span>
			</button>
		</div>
	)
}

const ButtonLeftTextRightOption = ({ text, leftButton }: { text: string, leftButton?: React.ReactNode }) => {

	return <div className='flex items-center text-void-fg-3 px-3 py-0.5 rounded-sm overflow-hidden gap-2'>
		{leftButton ? leftButton : null}
		<span>
			{text}
		</span>
	</div>
}

// models
const RefreshModelButton = ({ providerName }: { providerName: RefreshableProviderName }) => {

	const refreshModelState = useRefreshModelState()

	const accessor = useAccessor()
	const refreshModelService = accessor.get('IRefreshModelService')
	const metricsService = accessor.get('IMetricsService')

	const [justFinished, setJustFinished] = useState<null | 'finished' | 'error'>(null)

	useRefreshModelListener(
		useCallback((providerName2, refreshModelState) => {
			if (providerName2 !== providerName) return
			const { state } = refreshModelState[providerName]
			if (!(state === 'finished' || state === 'error')) return
			// now we know we just entered 'finished' state for this providerName
			setJustFinished(state)
			const tid = setTimeout(() => { setJustFinished(null) }, 2000)
			return () => clearTimeout(tid)
		}, [providerName])
	)

	const { state } = refreshModelState[providerName]

	const { title: providerTitle } = displayInfoOfProviderName(providerName)

	return <ButtonLeftTextRightOption

		leftButton={
			<button
				className='flex items-center'
				disabled={state === 'refreshing' || justFinished !== null}
				onClick={() => {
					refreshModelService.startRefreshingModels(providerName, { enableProviderOnSuccess: false, doNotFire: false })
					metricsService.capture('Click', { providerName, action: 'Refresh Models' })
				}}
			>
				{justFinished === 'finished' ? <Check className='stroke-green-500 size-3' />
					: justFinished === 'error' ? <X className='stroke-red-500 size-3' />
						: state === 'refreshing' ? <Loader2 className='size-3 animate-spin' />
							: <RefreshCw className='size-3' />}
			</button>
		}

		text={justFinished === 'finished' ? `${providerTitle} Models are up-to-date!`
			: justFinished === 'error' ? `${providerTitle} not found!`
				: `Manually refresh ${providerTitle} models.`}
	/>
}

const RefreshableModels = () => {
	const settingsState = useSettingsState()


	const buttons = refreshableProviderNames.map(providerName => {
		if (!settingsState.settingsOfProvider[providerName]._didFillInProviderSettings) return null
		return <RefreshModelButton key={providerName} providerName={providerName} />
	})

	return <>
		{buttons}
	</>

}



export const AnimatedCheckmarkButton = ({ text, className }: { text?: string, className?: string }) => {
	const [dashOffset, setDashOffset] = useState(40);

	useEffect(() => {
		const startTime = performance.now();
		const duration = 500; // 500ms animation

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const newOffset = 40 - (progress * 40);

			setDashOffset(newOffset);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		const animationId = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(animationId);
	}, []);

	return <div
		className={`flex items-center gap-1.5 w-fit
			${className ? className : `px-2 py-0.5 text-xs text-zinc-900 bg-zinc-100 rounded-sm`}
		`}
	>
		<svg className="size-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M5 13l4 4L19 7"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				style={{
					strokeDasharray: 40,
					strokeDashoffset: dashOffset
				}}
			/>
		</svg>
		{text}
	</div>
}


const AddButton = ({ disabled, text = 'Add', ...props }: { disabled?: boolean, text?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {

	return <button
		disabled={disabled}
		className={`bg-[#0e70c0] px-3 py-1 text-white rounded-sm ${!disabled ? 'hover:bg-[#1177cb] cursor-pointer' : 'opacity-50 cursor-not-allowed bg-opacity-70'}`}
		{...props}
	>{text}</button>

}

// ConfirmButton prompts for a second click to confirm an action, cancels if clicking outside
const ConfirmButton = ({ children, onConfirm, className }: { children: React.ReactNode, onConfirm: () => void, className?: string }) => {
	const [confirm, setConfirm] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!confirm) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setConfirm(false);
			}
		};
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	}, [confirm]);
	return (
		<div ref={ref} className={`inline-block`}>
			<VoidButtonBgDarken className={className} onClick={() => {
				if (!confirm) {
					setConfirm(true);
				} else {
					onConfirm();
					setConfirm(false);
				}
			}}>
				{confirm ? `Confirm Reset` : children}
			</VoidButtonBgDarken>
		</div>
	);
};

// ---------------- Simplified Model Settings Dialog ------------------

// keys of ModelOverrides we allow the user to override



// This new dialog replaces the verbose UI with a single JSON override box.
const SimpleModelSettingsDialog = ({
	isOpen,
	onClose,
	modelInfo,
}: {
	isOpen: boolean;
	onClose: () => void;
	modelInfo: { modelName: string; providerName: ProviderName; type: 'autodetected' | 'custom' | 'default' } | null;
}) => {
	if (!isOpen || !modelInfo) return null;

	const { modelName, providerName, type } = modelInfo;
	const accessor = useAccessor()
	const settingsState = useSettingsState()
	const mouseDownInsideModal = useRef(false); // Ref to track mousedown origin
	const settingsStateService = accessor.get('IVoidSettingsService')

	// current overrides and defaults
	const defaultModelCapabilities = getModelCapabilities(providerName, modelName, undefined);
	const currentOverrides = settingsState.overridesOfModel?.[providerName]?.[modelName] ?? undefined;
	const { recognizedModelName, isUnrecognizedModel } = defaultModelCapabilities

	// Create the placeholder with the default values for allowed keys
	const partialDefaults: Partial<ModelOverrides> = {};
	for (const k of modelOverrideKeys) { if (defaultModelCapabilities[k]) partialDefaults[k] = defaultModelCapabilities[k] as any; }
	const placeholder = JSON.stringify(partialDefaults, null, 2);

	const [overrideEnabled, setOverrideEnabled] = useState<boolean>(() => !!currentOverrides);

	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

	// reset when dialog toggles
	useEffect(() => {
		if (!isOpen) return;
		const cur = settingsState.overridesOfModel?.[providerName]?.[modelName];
		setOverrideEnabled(!!cur);
		setErrorMsg(null);
	}, [isOpen, providerName, modelName, settingsState.overridesOfModel, placeholder]);

	const onSave = async () => {
		// if disabled override, reset overrides
		if (!overrideEnabled) {
			await settingsStateService.setOverridesOfModel(providerName, modelName, undefined);
			onClose();
			return;
		}

		// enabled overrides
		// parse json
		let parsedInput: Record<string, unknown>

		if (textAreaRef.current?.value) {
			try {
				parsedInput = JSON.parse(textAreaRef.current.value);
			} catch (e) {
				setErrorMsg('Invalid JSON');
				return;
			}
		} else {
			setErrorMsg('Invalid JSON');
			return;
		}

		// only keep allowed keys
		const cleaned: Partial<ModelOverrides> = {};
		for (const k of modelOverrideKeys) {
			if (!(k in parsedInput)) continue
			const isEmpty = parsedInput[k] === '' || parsedInput[k] === null || parsedInput[k] === undefined;
			if (!isEmpty) {
				cleaned[k] = parsedInput[k] as any;
			}
		}
		await settingsStateService.setOverridesOfModel(providerName, modelName, cleaned);
		onClose();
	};

	const sourcecodeOverridesLink = `https://github.com/voideditor/void/blob/2e5ecb291d33afbe4565921664fb7e183189c1c5/src/vs/workbench/contrib/void/common/modelCapabilities.ts#L146-L172`

	return (
		<div // Backdrop
			className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999999]"
			onMouseDown={() => {
				mouseDownInsideModal.current = false;
			}}
			onMouseUp={() => {
				if (!mouseDownInsideModal.current) {
					onClose();
				}
				mouseDownInsideModal.current = false;
			}}
		>
			{/* MODAL */}
			<div
				className="bg-void-bg-1 rounded-md p-4 max-w-xl w-full shadow-xl overflow-y-auto max-h-[90vh]"
				onClick={(e) => e.stopPropagation()} // Keep stopping propagation for normal clicks inside
				onMouseDown={(e) => {
					mouseDownInsideModal.current = true;
					e.stopPropagation();
				}}
			>
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-medium">
						Change Defaults for {modelName} ({displayInfoOfProviderName(providerName).title})
					</h3>
					<button
						onClick={onClose}
						className="text-void-fg-3 hover:text-void-fg-1"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* Display model recognition status */}
				<div className="text-sm text-void-fg-3 mb-4">
					{type === 'default' ? `${modelName} comes packaged with Spud, so you shouldn't need to change these settings.`
						: isUnrecognizedModel
							? `Model not recognized by Spud.`
							: `Spud recognizes ${modelName} ("${recognizedModelName}").`}
				</div>


				{/* override toggle */}
				<div className="flex items-center gap-2 mb-4">
					<VoidSwitch size='xs' value={overrideEnabled} onChange={setOverrideEnabled} />
					<span className="text-void-fg-3 text-sm">Override model defaults</span>
				</div>

				{/* Informational link */}
				{overrideEnabled && <div className="text-sm text-void-fg-3 mb-4">
					<ChatMarkdownRender string={`See the [sourcecode](${sourcecodeOverridesLink}) for a reference on how to set this JSON (advanced).`} chatMessageLocation={undefined} />
				</div>}

				<textarea
					key={overrideEnabled + ''}
					ref={textAreaRef}
					className={`w-full min-h-[200px] p-2 rounded-sm border border-void-border-2 bg-void-bg-2 resize-none font-mono text-sm ${!overrideEnabled ? 'text-void-fg-3' : ''}`}
					defaultValue={overrideEnabled && currentOverrides ? JSON.stringify(currentOverrides, null, 2) : placeholder}
					placeholder={placeholder}
					readOnly={!overrideEnabled}
				/>
				{errorMsg && (
					<div className="text-red-500 mt-2 text-sm">{errorMsg}</div>
				)}


				<div className="flex justify-end gap-2 mt-4">
					<VoidButtonBgDarken onClick={onClose} className="px-3 py-1">
						Cancel
					</VoidButtonBgDarken>
					<VoidButtonBgDarken
						onClick={onSave}
						className="px-3 py-1 bg-[#0e70c0] text-white"
					>
						Save
					</VoidButtonBgDarken>
				</div>
			</div>
		</div>
	);
};




export const ModelDump = ({ filteredProviders }: { filteredProviders?: ProviderName[] }) => {
	const accessor = useAccessor()
	const settingsStateService = accessor.get('IVoidSettingsService')
	const settingsState = useSettingsState()

	// State to track which model's settings dialog is open
	const [openSettingsModel, setOpenSettingsModel] = useState<{
		modelName: string,
		providerName: ProviderName,
		type: 'autodetected' | 'custom' | 'default'
	} | null>(null);

	// States for add model functionality
	const [isAddModelOpen, setIsAddModelOpen] = useState(false);
	const [showCheckmark, setShowCheckmark] = useState(false);
	const [userChosenProviderName, setUserChosenProviderName] = useState<ProviderName | null>(null);
	const [modelName, setModelName] = useState<string>('');
	const [errorString, setErrorString] = useState('');

	// a dump of all the enabled providers' models
	const modelDump: (VoidStatefulModelInfo & { providerName: ProviderName, providerEnabled: boolean })[] = []

	// Use either filtered providers or all providers
	const providersToShow = filteredProviders || providerNames;

	for (let providerName of providersToShow) {
		const providerSettings = settingsState.settingsOfProvider[providerName]
		// if (!providerSettings.enabled) continue
		modelDump.push(...providerSettings.models.map(model => ({ ...model, providerName, providerEnabled: !!providerSettings._didFillInProviderSettings })))
	}

	// sort by hidden
	modelDump.sort((a, b) => {
		return Number(b.providerEnabled) - Number(a.providerEnabled)
	})

	type RowModel = (typeof modelDump)[number]
	const modelGroups: { providerName: ProviderName; models: RowModel[] }[] = []
	for (const m of modelDump) {
		const last = modelGroups[modelGroups.length - 1]
		if (!last || last.providerName !== m.providerName) {
			modelGroups.push({ providerName: m.providerName, models: [m] })
		} else {
			last.models.push(m)
		}
	}

	// Add model handler
	const handleAddModel = () => {
		if (!userChosenProviderName) {
			setErrorString('Please select a provider.');
			return;
		}
		if (!modelName) {
			setErrorString('Please enter a model name.');
			return;
		}

		// Check if model already exists
		if (settingsState.settingsOfProvider[userChosenProviderName].models.find(m => m.modelName === modelName)) {
			setErrorString(`This model already exists.`);
			return;
		}

		settingsStateService.addModel(userChosenProviderName, modelName);
		setShowCheckmark(true);
		setTimeout(() => {
			setShowCheckmark(false);
			setIsAddModelOpen(false);
			setUserChosenProviderName(null);
			setModelName('');
		}, 1500);
		setErrorString('');
	};

	const renderModelRow = (m: RowModel) => {
		const { isHidden, type, modelName, providerName, providerEnabled } = m
		const providerTitle = displayInfoOfProviderName(providerName).title
		const disabled = !providerEnabled
		const value = disabled ? false : !isHidden
		const tooltipName = (
			disabled ? `Add ${providerTitle} to enable`
				: value === true ? 'Show in Dropdown'
					: 'Hide from Dropdown'
		)
		const detailAboutModel = type === 'autodetected' ?
			<Asterisk size={14} className="inline-block shrink-0 align-text-top brightness-115 stroke-[2] text-[#0e70c0]" data-tooltip-id='void-tooltip' data-tooltip-place='right' data-tooltip-content='Detected locally' />
			: type === 'custom' ?
				<Asterisk size={14} className="inline-block shrink-0 align-text-top brightness-115 stroke-[2] text-[#0e70c0]" data-tooltip-id='void-tooltip' data-tooltip-place='right' data-tooltip-content='Custom model' />
				: undefined
		const hasOverrides = !!settingsState.overridesOfModel?.[providerName]?.[modelName]

		return (
			<div
				key={`${modelName}${providerName}`}
				className="group flex cursor-default items-center justify-between gap-3 overflow-hidden rounded-md px-2 py-2.5 sm:px-3 hover:bg-black/10 dark:hover:bg-gray-300/10"
			>
				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span className="truncate text-sm text-void-fg-1">{modelName}</span>
					{detailAboutModel}
				</div>
				<div className="flex w-fit shrink-0 items-center gap-2">
					{disabled ? null : (
						<div className="flex w-5 items-center justify-center">
							<button
								type="button"
								onClick={() => { setOpenSettingsModel({ modelName, providerName, type }) }}
								data-tooltip-id="void-tooltip"
								data-tooltip-place="right"
								data-tooltip-content="Advanced Settings"
								className={`${hasOverrides ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
							>
								<Plus size={12} className="text-void-fg-3 opacity-50" />
							</button>
						</div>
					)}
					<VoidSwitch
						value={value}
						onChange={() => { settingsStateService.toggleModelHidden(providerName, modelName) }}
						disabled={disabled}
						size="sm"
						data-tooltip-id="void-tooltip"
						data-tooltip-place="right"
						data-tooltip-content={tooltipName}
					/>
					<div className="flex w-5 items-center justify-center">
						{type === 'default' || type === 'autodetected' ? null : (
							<button
								type="button"
								onClick={() => { settingsStateService.deleteModel(providerName, modelName) }}
								data-tooltip-id="void-tooltip"
								data-tooltip-place="right"
								data-tooltip-content="Delete"
								className={`${hasOverrides ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
							>
								<X size={12} className="text-void-fg-3 opacity-50" />
							</button>
						)}
					</div>
				</div>
			</div>
		)
	}

	return <div className="space-y-3">
		{modelGroups.map(({ providerName, models }) => (
			<div
				key={providerName}
				className="overflow-hidden rounded-lg border border-void-border-3/90 bg-void-bg-1/70 dark:bg-void-bg-1/25"
				style={{ borderColor: 'var(--vscode-widget-border, rgba(0, 0, 0, 0.12))' }}
			>
				<div
					className="border-b px-3 py-2 sm:px-4"
					style={{
						borderColor: 'var(--vscode-widget-border, rgba(0, 0, 0, 0.08))',
						background: 'color-mix(in oklab, var(--vscode-sideBar-background) 75%, transparent)',
					}}
				>
					<span className="text-[11px] font-semibold uppercase tracking-wide text-void-fg-3">
						{displayInfoOfProviderName(providerName).title}
					</span>
				</div>
				<div className="divide-y divide-void-border-3/60">
					{models.map((m) => renderModelRow(m))}
				</div>
			</div>
		))}

		{/* Add Model Section */}
		{showCheckmark ? (
			<div className="mt-4">
				<AnimatedCheckmarkButton text='Added' className="bg-[#0e70c0] text-white px-3 py-1 rounded-sm" />
			</div>
		) : isAddModelOpen ? (
			<div className="mt-4">
				<form className="flex items-center gap-2">

					{/* Provider dropdown */}
					<ErrorBoundary>
						<VoidCustomDropdownBox
							options={providersToShow}
							selectedOption={userChosenProviderName}
							onChangeOption={(pn) => setUserChosenProviderName(pn)}
							getOptionDisplayName={(pn) => pn ? displayInfoOfProviderName(pn).title : 'Provider Name'}
							getOptionDropdownName={(pn) => pn ? displayInfoOfProviderName(pn).title : 'Provider Name'}
							getOptionsEqual={(a, b) => a === b}
							className="max-w-32 mx-2 w-full resize-none bg-void-bg-1 text-void-fg-1 placeholder:text-void-fg-3 border border-void-border-2 focus:border-void-border-1 py-1 px-2 rounded"
							arrowTouchesText={false}
						/>
					</ErrorBoundary>

					{/* Model name input */}
					<ErrorBoundary>
						<VoidSimpleInputBox
							value={modelName}
							compact={true}
							onChangeValue={setModelName}
							placeholder='Model Name'
							className='max-w-32'
						/>
					</ErrorBoundary>

					{/* Add button */}
					<ErrorBoundary>
						<AddButton
							type='button'
							disabled={!modelName || !userChosenProviderName}
							onClick={handleAddModel}
						/>
					</ErrorBoundary>

					{/* X button to cancel */}
					<button
						type="button"
						onClick={() => {
							setIsAddModelOpen(false);
							setErrorString('');
							setModelName('');
							setUserChosenProviderName(null);
						}}
						className='text-void-fg-4'
					>
						<X className='size-4' />
					</button>
				</form>

				{errorString && (
					<div className='text-red-500 truncate whitespace-nowrap mt-1'>
						{errorString}
					</div>
				)}
			</div>
		) : (
			<div
				className="text-void-fg-4 flex flex-nowrap text-nowrap items-center hover:brightness-110 cursor-pointer mt-4"
				onClick={() => setIsAddModelOpen(true)}
			>
				<div className="flex items-center gap-1">
					<Plus size={16} />
					<span>Add a model</span>
				</div>
			</div>
		)}

		{/* Model Settings Dialog */}
		<SimpleModelSettingsDialog
			isOpen={openSettingsModel !== null}
			onClose={() => setOpenSettingsModel(null)}
			modelInfo={openSettingsModel}
		/>
	</div>
}



// providers

const ProviderSetting = ({ providerName, settingName, subTextMd }: { providerName: ProviderName, settingName: SettingName, subTextMd: React.ReactNode }) => {

	const { title: settingTitle, placeholder, isPasswordField } = displayInfoOfSettingName(providerName, settingName)

	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const settingsState = useSettingsState()

	const settingValue = settingsState.settingsOfProvider[providerName][settingName] as string // this should always be a string in this component
	if (typeof settingValue !== 'string') {
		console.log('Error: Provider setting had a non-string value.')
		return
	}

	// Create a stable callback reference using useCallback with proper dependencies
	const handleChangeValue = useCallback((newVal: string) => {
		voidSettingsService.setSettingOfProvider(providerName, settingName, newVal)
	}, [voidSettingsService, providerName, settingName]);

	return <ErrorBoundary>
		<div className='my-1'>
			<VoidSimpleInputBox
				value={settingValue}
				onChangeValue={handleChangeValue}
				placeholder={`${settingTitle} (${placeholder})`}
				passwordBlur={isPasswordField}
				compact={true}
			/>
			{!subTextMd ? null : <div className='py-1 px-3 opacity-50 text-sm'>
				{subTextMd}
			</div>}
		</div>
	</ErrorBoundary>
}

// const OldSettingsForProvider = ({ providerName, showProviderTitle }: { providerName: ProviderName, showProviderTitle: boolean }) => {
// 	const voidSettingsState = useSettingsState()

// 	const needsModel = isProviderNameDisabled(providerName, voidSettingsState) === 'addModel'

// 	// const accessor = useAccessor()
// 	// const voidSettingsService = accessor.get('IVoidSettingsService')

// 	// const { enabled } = voidSettingsState.settingsOfProvider[providerName]
// 	const settingNames = customSettingNamesOfProvider(providerName)

// 	const { title: providerTitle } = displayInfoOfProviderName(providerName)

// 	return <div className='my-4'>

// 		<div className='flex items-center w-full gap-4'>
// 			{showProviderTitle && <h3 className='text-xl truncate'>{providerTitle}</h3>}

// 			{/* enable provider switch */}
// 			{/* <VoidSwitch
// 				value={!!enabled}
// 				onChange={
// 					useCallback(() => {
// 						const enabledRef = voidSettingsService.state.settingsOfProvider[providerName].enabled
// 						voidSettingsService.setSettingOfProvider(providerName, 'enabled', !enabledRef)
// 					}, [voidSettingsService, providerName])}
// 				size='sm+'
// 			/> */}
// 		</div>

// 		<div className='px-0'>
// 			{/* settings besides models (e.g. api key) */}
// 			{settingNames.map((settingName, i) => {
// 				return <ProviderSetting key={settingName} providerName={providerName} settingName={settingName} />
// 			})}

// 			{needsModel ?
// 				providerName === 'ollama' ?
// 					<WarningBox text={`Please install an Ollama model. We'll auto-detect it.`} />
// 					: <WarningBox text={`Please add a model for ${providerTitle} (Models section).`} />
// 				: null}
// 		</div>
// 	</div >
// }


export const SettingsForProvider = ({ providerName, showProviderTitle, showProviderSuggestions }: { providerName: ProviderName, showProviderTitle: boolean, showProviderSuggestions: boolean }) => {
	const voidSettingsState = useSettingsState()

	const needsModel = isProviderNameDisabled(providerName, voidSettingsState) === 'addModel'

	// const accessor = useAccessor()
	// const voidSettingsService = accessor.get('IVoidSettingsService')

	// const { enabled } = voidSettingsState.settingsOfProvider[providerName]
	const settingNames = customSettingNamesOfProvider(providerName)

	const { title: providerTitle } = displayInfoOfProviderName(providerName)

	return <div>

		<div className='flex items-center w-full gap-4'>
			{showProviderTitle && <h3 className='text-xl truncate'>{providerTitle}</h3>}

			{/* enable provider switch */}
			{/* <VoidSwitch
				value={!!enabled}
				onChange={
					useCallback(() => {
						const enabledRef = voidSettingsService.state.settingsOfProvider[providerName].enabled
						voidSettingsService.setSettingOfProvider(providerName, 'enabled', !enabledRef)
					}, [voidSettingsService, providerName])}
				size='sm+'
			/> */}
		</div>

		<div className='px-0'>
			{/* settings besides models (e.g. api key) */}
			{settingNames.map((settingName, i) => {

				return <ProviderSetting
					key={settingName}
					providerName={providerName}
					settingName={settingName}
					subTextMd={i !== settingNames.length - 1 ? null
						: <ChatMarkdownRender string={subTextMdOfProviderName(providerName)} chatMessageLocation={undefined} />}
				/>
			})}

			{showProviderSuggestions && needsModel ?
				providerName === 'ollama' ?
					<WarningBox className="pl-2 mb-4" text={`Please install an Ollama model. We'll auto-detect it.`} />
					: <WarningBox className="pl-2 mb-4" text={`Please add a model for ${providerTitle} (Models section).`} />
				: null}
		</div>
	</div >
}


export const VoidProviderSettings = ({ providerNames }: { providerNames: ProviderName[] }) => {
	return <>
		{providerNames.map(providerName =>
			<SettingsForProvider key={providerName} providerName={providerName} showProviderTitle={true} showProviderSuggestions={true} />
		)}
	</>
}


type TabName = 'models' | 'general'
export const AutoDetectLocalModelsToggle = () => {
	const settingName: GlobalSettingName = 'autoRefreshModels'

	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const metricsService = accessor.get('IMetricsService')

	const voidSettingsState = useSettingsState()

	// right now this is just `enabled_autoRefreshModels`
	const enabled = voidSettingsState.globalSettings[settingName]

	return <ButtonLeftTextRightOption
		leftButton={<VoidSwitch
			size='xxs'
			value={enabled}
			onChange={(newVal) => {
				voidSettingsService.setGlobalSetting(settingName, newVal)
				metricsService.capture('Click', { action: 'Autorefresh Toggle', settingName, enabled: newVal })
			}}
		/>}
		text={`Automatically detect local providers and models (${refreshableProviderNames.map(providerName => displayInfoOfProviderName(providerName).title).join(', ')}).`}
	/>


}

export const AIInstructionsBox = () => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const voidSettingsState = useSettingsState()
	return <VoidInputBox2
		className='min-h-[81px] p-3 rounded-sm'
		initValue={voidSettingsState.globalSettings.aiInstructions}
		placeholder={`Do not change my indentation or delete my comments. When writing TS or JS, do not add ;'s. Write new code using Rust if possible. `}
		multiline
		onChangeText={(newText) => {
			voidSettingsService.setGlobalSetting('aiInstructions', newText)
		}}
	/>
}

const FastApplyMethodDropdown = () => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')

	const options = useMemo(() => [true, false], [])

	const onChangeOption = useCallback((newVal: boolean) => {
		voidSettingsService.setGlobalSetting('enableFastApply', newVal)
	}, [voidSettingsService])

	return <VoidCustomDropdownBox
		className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1'
		options={options}
		selectedOption={voidSettingsService.state.globalSettings.enableFastApply}
		onChangeOption={onChangeOption}
		getOptionDisplayName={(val) => val ? 'Fast Apply' : 'Slow Apply'}
		getOptionDropdownName={(val) => val ? 'Fast Apply' : 'Slow Apply'}
		getOptionDropdownDetail={(val) => val ? 'Output Search/Replace blocks' : 'Rewrite whole files'}
		getOptionsEqual={(a, b) => a === b}
	/>

}


export const OllamaSetupInstructions = ({ sayWeAutoDetect }: { sayWeAutoDetect?: boolean }) => {
	return <div className='prose-p:my-0 prose-ol:list-decimal prose-p:py-0 prose-ol:my-0 prose-ol:py-0 prose-span:my-0 prose-span:py-0 text-void-fg-3 text-sm list-decimal select-text'>
		<div className=''><ChatMarkdownRender string={`Ollama Setup Instructions`} chatMessageLocation={undefined} /></div>
		<div className=' pl-6'><ChatMarkdownRender string={`1. Download [Ollama](https://ollama.com/download).`} chatMessageLocation={undefined} /></div>
		<div className=' pl-6'><ChatMarkdownRender string={`2. Open your terminal.`} chatMessageLocation={undefined} /></div>
		<div
			className='pl-6 flex items-center w-fit'
			data-tooltip-id='void-tooltip-ollama-settings'
		>
			<ChatMarkdownRender string={`3. Run \`ollama pull your_model\` to install a model.`} chatMessageLocation={undefined} />
		</div>
		{sayWeAutoDetect && <div className=' pl-6'><ChatMarkdownRender string={`Spud automatically detects locally running models and enables them.`} chatMessageLocation={undefined} /></div>}
	</div>
}


const RedoOnboardingButton = ({ className }: { className?: string }) => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	return <div
		className={`text-void-fg-4 flex flex-nowrap text-nowrap items-center hover:brightness-110 cursor-pointer ${className}`}
		onClick={() => { voidSettingsService.setGlobalSetting('isOnboardingComplete', false) }}
	>
		See onboarding screen?
	</div>

}







export const ToolApprovalTypeSwitch = ({ approvalType, size, desc }: { approvalType: ToolApprovalType, size: "xxs" | "xs" | "sm" | "sm+" | "md", desc: string }) => {
	const accessor = useAccessor()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const voidSettingsState = useSettingsState()
	const metricsService = accessor.get('IMetricsService')

	const onToggleAutoApprove = useCallback((approvalType: ToolApprovalType, newValue: boolean) => {
		voidSettingsService.setGlobalSetting('autoApprove', {
			...voidSettingsService.state.globalSettings.autoApprove,
			[approvalType]: newValue
		})
		metricsService.capture('Tool Auto-Accept Toggle', { enabled: newValue })
	}, [voidSettingsService, metricsService])

	return <>
		<VoidSwitch
			size={size}
			value={voidSettingsState.globalSettings.autoApprove[approvalType] ?? false}
			onChange={(newVal) => onToggleAutoApprove(approvalType, newVal)}
		/>
		<span className="text-void-fg-3 text-xs">{desc}</span>
	</>
}



export const OneClickSwitchButton = ({ fromEditor = 'VS Code', className = '' }: { fromEditor?: TransferEditorType, className?: string }) => {
	const accessor = useAccessor()
	const extensionTransferService = accessor.get('IExtensionTransferService')

	const [transferState, setTransferState] = useState<{ type: 'done', error?: string } | { type: | 'loading' | 'justfinished' }>({ type: 'done' })



	const onClick = async () => {
		if (transferState.type !== 'done') return

		setTransferState({ type: 'loading' })

		const errAcc = await extensionTransferService.transferExtensions(os, fromEditor)

		// Even if some files were missing, consider it a success if no actual errors occurred
		const hadError = !!errAcc
		if (hadError) {
			setTransferState({ type: 'done', error: errAcc })
		}
		else {
			setTransferState({ type: 'justfinished' })
			setTimeout(() => { setTransferState({ type: 'done' }); }, 3000)
		}
	}

	return <>
		<VoidButtonBgDarken className={`max-w-48 p-4 ${className}`} disabled={transferState.type !== 'done'} onClick={onClick}>
			{transferState.type === 'done' ? `Transfer from ${fromEditor}`
				: transferState.type === 'loading' ? <span className='text-nowrap flex flex-nowrap'>Transferring<IconLoading /></span>
					: transferState.type === 'justfinished' ? <AnimatedCheckmarkButton text='Settings Transferred' className='bg-none' />
						: null
			}
		</VoidButtonBgDarken>
		{transferState.type === 'done' && transferState.error ? <WarningBox text={transferState.error} /> : null}
	</>
}


// full settings

// MCP Server component
const MCPServerComponent = ({ name, server }: { name: string, server: MCPServer }) => {
	const accessor = useAccessor();
	const mcpService = accessor.get('IMCPService');

	const voidSettings = useSettingsState()
	const isOn = voidSettings.mcpUserStateOfName[name]?.isOn

	const removeUniquePrefix = (name: string) => name.split('_').slice(1).join('_')

	return (
		<div className="border border-void-border-2 bg-void-bg-1 py-3 px-4 rounded-sm my-2">
			<div className="flex items-center justify-between">
				{/* Left side - status and name */}
				<div className="flex items-center gap-2">
					{/* Status indicator */}
					<div className={`w-2 h-2 rounded-full
						${server.status === 'success' ? 'bg-green-500'
							: server.status === 'error' ? 'bg-red-500'
								: server.status === 'loading' ? 'bg-yellow-500'
									: server.status === 'offline' ? 'bg-void-fg-3'
										: ''}
					`}></div>

					{/* Server name */}
					<div className="text-sm font-medium text-void-fg-1">{name}</div>
				</div>

				{/* Right side - power toggle switch */}
				<VoidSwitch
					value={isOn ?? false}
					size='xs'
					disabled={server.status === 'error'}
					onChange={() => mcpService.toggleServerIsOn(name, !isOn)}
				/>
			</div>

			{/* Tools section */}
			{isOn && (
				<div className="mt-3">
					<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
						{(server.tools ?? []).length > 0 ? (
							(server.tools ?? []).map((tool: { name: string; description?: string }) => (
								<span
									key={tool.name}
									className="px-2 py-0.5 bg-void-bg-2 text-void-fg-3 rounded-sm text-xs"

									data-tooltip-id='void-tooltip'
									data-tooltip-content={tool.description || ''}
									data-tooltip-class-name='void-max-w-[300px]'
								>
									{removeUniquePrefix(tool.name)}
								</span>
							))
						) : (
							<span className="text-xs text-void-fg-3">No tools available</span>
						)}
					</div>
				</div>
			)}

			{/* Command badge */}
			{isOn && server.command && (
				<div className="mt-3">
					<div className="text-xs text-void-fg-3 mb-1">Command:</div>
					<div className="px-2 py-1 bg-void-bg-2 text-xs font-mono overflow-x-auto whitespace-nowrap text-void-fg-2 rounded-sm">
						{server.command}
					</div>
				</div>
			)}

			{/* Error message if present */}
			{server.error && (
				<div className="mt-3">
					<WarningBox text={server.error} />
				</div>
			)}
		</div>
	);
};

// Main component that renders the list of servers
const MCPServersList = () => {
	const mcpServiceState = useMCPServiceState()

	let content: React.ReactNode
	if (mcpServiceState.error) {
		content = <div className="text-void-fg-3 text-sm mt-2">
			{mcpServiceState.error}
		</div>
	}
	else {
		const entries = Object.entries(mcpServiceState.mcpServerOfName)
		if (entries.length === 0) {
			content = <div className="text-void-fg-3 text-sm mt-2">
				No servers found
			</div>
		}
		else {
			content = entries.map(([name, server]) => (
				<MCPServerComponent key={name} name={name} server={server} />
			))
		}
	}

	return <div className="my-2">{content}</div>
};

const SpudCloudSettingsSection = () => {
	const accessor = useAccessor();
	const voidSettingsService = accessor.get('IVoidSettingsService');
	const commandService = accessor.get('ICommandService');
	const metricsService = accessor.get('IMetricsService');
	const voidSettingsState = useSettingsState();
	const [testResult, setTestResult] = useState<string | null>(null);

	const openDashboard = () => {
		const b = voidSettingsState.globalSettings.spudCloudApiBase.trim() || 'https://cloud.spud.dev';
		void commandService.executeCommand('vscode.open', URI.parse(trimTrailingSlash(b)));
	};

	const testConnection = async () => {
		setTestResult('Testing…');
		const r = await fetchSpudCloudSession(
			voidSettingsState.globalSettings.spudCloudApiBase,
			voidSettingsState.globalSettings.spudWorkspaceId,
		);
		if (r.ok) {
			setTestResult(`Connected as ${r.user.name} · ${r.workspace.name}`);
			metricsService.capture('Spud Cloud test', { ok: true });
		} else {
			setTestResult(r.error);
			metricsService.capture('Spud Cloud test', { ok: false });
		}
	};

	return (
		<div className='max-w-[min(100%,36rem)] mb-4 sm:mb-6'>
			<h2 className={settingsSectionTitleClass}>Spud Cloud</h2>
			<h4 className={settingsSectionLeadClass}>
				Connect this IDE to the same Spud Cloud workspace as the web dashboard (usage, billing, team). Use your deployed URL or{' '}
				<code className='text-xs'>http://localhost:8788</code> when the API runs locally.
			</h4>
			<div className='flex flex-col gap-3'>
				<div>
					<div className='text-xs text-void-fg-3 mb-1'>API base URL</div>
					<VoidInputBox2
						className='w-full min-h-[28px] px-2 py-1 rounded-sm'
						initValue={voidSettingsState.globalSettings.spudCloudApiBase}
						placeholder='https://cloud.spud.dev'
						onChangeText={(t) => { void voidSettingsService.setGlobalSetting('spudCloudApiBase', t); }}
					/>
				</div>
				<div>
					<div className='text-xs text-void-fg-3 mb-1'>Workspace ID</div>
					<VoidInputBox2
						className='w-full min-h-[28px] px-2 py-1 rounded-sm'
						initValue={voidSettingsState.globalSettings.spudWorkspaceId}
						placeholder='ws_acme'
						onChangeText={(t) => { void voidSettingsService.setGlobalSetting('spudWorkspaceId', t); }}
					/>
				</div>
				<div className='flex flex-wrap gap-2 items-center'>
					<VoidButtonBgDarken className='px-4 py-1' onClick={() => { void testConnection(); }}>Test connection</VoidButtonBgDarken>
					<VoidButtonBgDarken className='px-4 py-1' onClick={openDashboard}>Open Cloud dashboard</VoidButtonBgDarken>
					{testResult ? <span className='text-xs text-void-fg-3 max-w-md'>{testResult}</span> : null}
				</div>
			</div>
		</div>
	);
};

export const Settings = () => {
	const isDark = useIsDark()
	// ─── sidebar nav ──────────────────────────
	const [selectedSection, setSelectedSection] =
		useState<Tab>('models');

	const navItems: { tab: Tab; label: string }[] = [
		{ tab: 'models', label: 'Models' },
		{ tab: 'localProviders', label: 'Local Providers' },
		{ tab: 'providers', label: 'Main Providers' },
		{ tab: 'featureOptions', label: 'Feature Options' },
		{ tab: 'general', label: 'General' },
		{ tab: 'mcp', label: 'MCP' },
		{ tab: 'all', label: 'All Settings' },
	];
	const shouldShowTab = (tab: Tab) => selectedSection === 'all' || selectedSection === tab;
	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const environmentService = accessor.get('IEnvironmentService')
	const nativeHostService = accessor.get('INativeHostService')
	const settingsState = useSettingsState()
	const voidSettingsService = accessor.get('IVoidSettingsService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const notificationService = accessor.get('INotificationService')
	const mcpService = accessor.get('IMCPService')
	const storageService = accessor.get('IStorageService')
	const metricsService = accessor.get('IMetricsService')
	const isOptedOut = useIsOptedOut()

	const onDownload = (t: 'Chats' | 'Settings') => {
		let dataStr: string
		let downloadName: string
		if (t === 'Chats') {
			// Export chat threads
			dataStr = JSON.stringify(chatThreadsService.state, null, 2)
			downloadName = 'void-chats.json'
		}
		else if (t === 'Settings') {
			// Export user settings
			dataStr = JSON.stringify(voidSettingsService.state, null, 2)
			downloadName = 'void-settings.json'
		}
		else {
			dataStr = ''
			downloadName = ''
		}

		const blob = new Blob([dataStr], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = downloadName
		a.click()
		URL.revokeObjectURL(url)
	}


	// Add file input refs
	const fileInputSettingsRef = useRef<HTMLInputElement>(null)
	const fileInputChatsRef = useRef<HTMLInputElement>(null)

	const [s, ss] = useState(0)

	const handleUpload = (t: 'Chats' | 'Settings') => (e: React.ChangeEvent<HTMLInputElement>,) => {
		const files = e.target.files
		if (!files) return;
		const file = files[0]
		if (!file) return

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const json = JSON.parse(reader.result as string);

				if (t === 'Chats') {
					chatThreadsService.dangerousSetState(json as any)
				}
				else if (t === 'Settings') {
					voidSettingsService.dangerousSetState(json as any)
				}

				notificationService.info(`${t} imported successfully!`)
			} catch (err) {
				notificationService.notify({ message: `Failed to import ${t}`, source: err + '', severity: Severity.Error, })
			}
		};
		reader.readAsText(file);
		e.target.value = '';

		ss(s => s + 1)
	}


	const enhanceDark = isDark && settingsState.globalSettings.enhanceBuiltinDarkChrome
	return (
		<div
			className={`@@void-scope vc-settings-shell ${isDark ? 'dark' : ''}${enhanceDark ? ' @@void-enhance-dark' : ''}`}
			style={{
				height: '100%',
				width: '100%',
				overflow: 'auto',
				background: 'var(--vscode-sideBar-background, var(--vscode-editor-background))',
				paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
			}}
		>
			<div className="flex flex-col w-full min-h-full">
				{/* Paper + Earth header — ink label, calm chrome */}
				<header
					className="shrink-0 border-b px-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-3 sm:px-5 sm:py-4 sm:pt-4"
					style={{
						borderColor: 'var(--vscode-widget-border, rgba(0,0,0,0.08))',
						background: 'color-mix(in oklab, var(--vscode-sideBar-background) 92%, transparent)',
					}}
				>
					<div className="text-[10px] sm:text-[10.5px] font-semibold uppercase tracking-[0.14em] text-void-fg-3">
						Spud
					</div>
					<h1 className="text-lg sm:text-[1.35rem] font-semibold tracking-tight text-void-fg-1 mt-0.5">
						Settings
					</h1>
				</header>

				<nav
					aria-label="Settings sections"
					className="void-vc-settings-nav sticky top-0 z-[2] shrink-0 border-b backdrop-blur-md"
					style={{
						borderColor: 'var(--vscode-widget-border, rgba(0,0,0,0.08))',
						background: 'color-mix(in oklab, var(--vscode-sideBar-background) 90%, transparent)',
					}}
				>
					<div className="mx-auto flex w-full max-w-4xl flex-nowrap items-stretch gap-1 overflow-x-auto px-3 py-2 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin] sm:px-5">
						{navItems.map(({ tab, label }) => (
							<button
								type="button"
								key={tab}
								onClick={() => {
									if (tab === 'all') {
										setSelectedSection('all');
										window.scrollTo({ top: 0, behavior: 'smooth' });
									} else {
										setSelectedSection(tab);
									}
								}}
								className={`
									shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-left text-[13px] transition-colors duration-150 touch-manipulation min-h-[40px] sm:min-h-0
									${selectedSection === tab
									? 'bg-void-bg-2 font-medium text-void-fg-1 shadow-sm ring-1 ring-[#007FD4]/35'
									: 'text-void-fg-2 hover:bg-void-bg-2/70 active:bg-void-bg-2'}
								`}
							>
								{label}
							</button>
						))}
					</div>
				</nav>

				<main
					className="flex min-h-0 w-full flex-1 select-none overflow-x-hidden px-4 py-4 sm:px-5 sm:py-5 md:px-6 lg:py-6"
					style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}
				>
					<div className="mx-auto w-full max-w-4xl">
						<div className="flex flex-col gap-5 sm:gap-6 lg:gap-8">
							{/* Models section (formerly FeaturesTab) */}
							<div className={shouldShowTab('models') ? `` : 'hidden'}>
								<ErrorBoundary>
									<SettingsSectionCard>
										<div className="mb-4 flex flex-col gap-2 sm:mb-5 sm:flex-row sm:items-start sm:justify-between">
											<h2 className="text-xl font-semibold tracking-tight text-void-fg-1 sm:text-2xl">Models</h2>
											<RedoOnboardingButton className="text-sm shrink-0 self-start" />
										</div>
										<ModelDump />
										<div
											className="my-5 w-full border-t border-void-border-3 pt-5"
											style={{ borderColor: 'var(--vscode-widget-border, rgba(0,0,0,0.08))' }}
										/>
										<AutoDetectLocalModelsToggle />
										<RefreshableModels />
									</SettingsSectionCard>
								</ErrorBoundary>
							</div>

							{/* Local Providers section */}
							<div className={shouldShowTab('localProviders') ? `` : 'hidden'}>
								<ErrorBoundary>
									<SettingsSectionCard>
										<h2 className={settingsSectionTitleClass}>Local Providers</h2>
										<h3 className={`text-void-fg-3 mb-2`}>{`Spud can access any model that you host locally. We automatically detect your local models by default.`}</h3>

										<div className='opacity-80 mb-4'>
											<OllamaSetupInstructions sayWeAutoDetect={true} />
										</div>

										<VoidProviderSettings providerNames={localProviderNames} />
									</SettingsSectionCard>
								</ErrorBoundary>
							</div>

							{/* Main Providers section */}
							<div className={shouldShowTab('providers') ? `` : 'hidden'}>
								<ErrorBoundary>
									<SettingsSectionCard>
										<h2 className={settingsSectionTitleClass}>Main Providers</h2>
										<h3 className={`text-void-fg-3 mb-2`}>{`Spud can access models from Anthropic, OpenAI, OpenRouter, and more.`}</h3>

										<VoidProviderSettings providerNames={nonlocalProviderNames} />
									</SettingsSectionCard>
								</ErrorBoundary>
							</div>

							{/* Feature Options section */}
							<div className={shouldShowTab('featureOptions') ? `` : 'hidden'}>
								<ErrorBoundary>
									<SettingsSectionCard>
										<h2 className={settingsSectionTitleClass}>Feature Options</h2>

										<div className='my-4 flex flex-col gap-y-8'>
										<ErrorBoundary>
											{/* FIM */}
											<div>
												<h4 className={`text-base`}>{displayInfoOfFeatureName('Autocomplete')}</h4>
												<div className='text-sm text-void-fg-3 mt-1'>
													<span>
														Experimental.{' '}
													</span>
													<span
														className='hover:brightness-110'
														data-tooltip-id='void-tooltip'
														data-tooltip-content='We recommend using the largest qwen2.5-coder model you can with Ollama (try qwen2.5-coder:3b).'
														data-tooltip-class-name='void-max-w-[20px]'
													>
														Only works with FIM models.*
													</span>
												</div>

												<div className='my-2'>
													{/* Enable Switch */}
													<ErrorBoundary>
														<div className='flex items-center gap-x-2 my-2'>
															<VoidSwitch
																size='xs'
																value={settingsState.globalSettings.enableAutocomplete}
																onChange={(newVal) => voidSettingsService.setGlobalSetting('enableAutocomplete', newVal)}
															/>
															<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.enableAutocomplete ? 'Enabled' : 'Disabled'}</span>
														</div>
													</ErrorBoundary>

													{/* Model Dropdown */}
													<ErrorBoundary>
														<div className={`my-2 ${!settingsState.globalSettings.enableAutocomplete ? 'hidden' : ''}`}>
															<ModelDropdown featureName={'Autocomplete'} className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1' />
														</div>
													</ErrorBoundary>

												</div>

											</div>
										</ErrorBoundary>

										{/* Apply */}
										<ErrorBoundary>

											<div className='w-full'>
												<h4 className={`text-base`}>{displayInfoOfFeatureName('Apply')}</h4>
												<div className='text-sm text-void-fg-3 mt-1'>Settings that control the behavior of the Apply button.</div>

												<div className='my-2'>
													{/* Sync to Chat Switch */}
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.syncApplyToChat}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('syncApplyToChat', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.syncApplyToChat ? 'Same as Chat model' : 'Different model'}</span>
													</div>

													{/* Model Dropdown */}
													<div className={`my-2 ${settingsState.globalSettings.syncApplyToChat ? 'hidden' : ''}`}>
														<ModelDropdown featureName={'Apply'} className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1' />
													</div>
												</div>


												<div className='my-2'>
													{/* Fast Apply Method Dropdown */}
													<div className='flex items-center gap-x-2 my-2'>
														<FastApplyMethodDropdown />
													</div>
												</div>

											</div>
										</ErrorBoundary>




										{/* Tools Section */}
										<div>
											<h4 className={`text-base`}>Tools</h4>
											<div className='text-sm text-void-fg-3 mt-1'>{`Tools are functions that LLMs can call. Some tools require user approval.`}</div>

											<div className='my-2'>
												{/* Auto Accept Switch */}
												<ErrorBoundary>
													{[...toolApprovalTypes].map((approvalType) => {
														return <div key={approvalType} className="flex items-center gap-x-2 my-2">
															<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
														</div>
													})}

												</ErrorBoundary>

												{/* Tool Lint Errors Switch */}
												<ErrorBoundary>

													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.includeToolLintErrors}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('includeToolLintErrors', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.includeToolLintErrors ? 'Fix lint errors' : `Fix lint errors`}</span>
													</div>
												</ErrorBoundary>

												{/* Auto Accept LLM Changes Switch */}
												<ErrorBoundary>
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.autoAcceptLLMChanges}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('autoAcceptLLMChanges', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>Auto-accept LLM changes</span>
													</div>
												</ErrorBoundary>
											</div>
										</div>



										<div className='w-full'>
											<h4 className={`text-base`}>Editor</h4>
											<div className='text-sm text-void-fg-3 mt-1'>{`Settings that control the visibility of Spud suggestions in the code editor.`}</div>

											<div className='my-2'>
												{/* Auto Accept Switch */}
												<ErrorBoundary>
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.showInlineSuggestions}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('showInlineSuggestions', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.showInlineSuggestions ? 'Show suggestions on select' : 'Show suggestions on select'}</span>
													</div>
												</ErrorBoundary>
											</div>
										</div>

										{/* SCM */}
										<ErrorBoundary>

											<div className='w-full'>
												<h4 className={`text-base`}>{displayInfoOfFeatureName('SCM')}</h4>
												<div className='text-sm text-void-fg-3 mt-1'>Settings that control the behavior of the commit message generator.</div>

												<div className='my-2'>
													{/* Sync to Chat Switch */}
													<div className='flex items-center gap-x-2 my-2'>
														<VoidSwitch
															size='xs'
															value={settingsState.globalSettings.syncSCMToChat}
															onChange={(newVal) => voidSettingsService.setGlobalSetting('syncSCMToChat', newVal)}
														/>
														<span className='text-void-fg-3 text-xs pointer-events-none'>{settingsState.globalSettings.syncSCMToChat ? 'Same as Chat model' : 'Different model'}</span>
													</div>

													{/* Model Dropdown */}
													<div className={`my-2 ${settingsState.globalSettings.syncSCMToChat ? 'hidden' : ''}`}>
														<ModelDropdown featureName={'SCM'} className='text-xs text-void-fg-3 bg-void-bg-1 border border-void-border-1 rounded p-0.5 px-1' />
													</div>
												</div>

											</div>
										</ErrorBoundary>
									</div>
									</SettingsSectionCard>
								</ErrorBoundary>
							</div>

							{/* General section */}
							<div className={`${shouldShowTab('general') ? `` : 'hidden'} flex flex-col gap-5 sm:gap-6 lg:gap-8`}>
								<ErrorBoundary>
									<SettingsSectionCard>
										<SpudCloudSettingsSection />
									</SettingsSectionCard>
								</ErrorBoundary>

								{/* One-Click Switch section */}
								<SettingsSectionCard>
									<ErrorBoundary>
										<h2 className={settingsSectionTitleClass}>One-Click Switch</h2>
										<h4 className={settingsSectionLeadClass}>{`Transfer your editor settings into Spud.`}</h4>

										<div className='flex flex-col gap-2'>
											<OneClickSwitchButton className='w-48' fromEditor="VS Code" />
											<OneClickSwitchButton className='w-48' fromEditor="Cursor" />
											<OneClickSwitchButton className='w-48' fromEditor="Windsurf" />
										</div>
									</ErrorBoundary>
								</SettingsSectionCard>

								{/* Import/Export section */}
								<SettingsSectionCard>
									<h2 className={settingsSectionTitleClass}>Import/Export</h2>
									<h4 className={settingsSectionLeadClass}>{`Transfer Spud's settings and chats in and out of Spud.`}</h4>
									<div className='flex flex-col gap-8'>
										{/* Settings Subcategory */}
										<div className='flex flex-col gap-2 max-w-48 w-full'>
											<input key={2 * s} ref={fileInputSettingsRef} type='file' accept='.json' className='hidden' onChange={handleUpload('Settings')} />
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => { fileInputSettingsRef.current?.click() }}>
												Import Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => onDownload('Settings')}>
												Export Settings
											</VoidButtonBgDarken>
											<ConfirmButton className='px-4 py-1 w-full' onConfirm={() => { voidSettingsService.resetState(); }}>
												Reset Settings
											</ConfirmButton>
										</div>

										{/* Chats Subcategory */}
										<div className='flex flex-col gap-2 max-w-48 w-full'>
											<input key={2 * s + 1} ref={fileInputChatsRef} type='file' accept='.json' className='hidden' onChange={handleUpload('Chats')} />
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => { fileInputChatsRef.current?.click() }}>
												Import Chats
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-1 w-full' onClick={() => onDownload('Chats')}>
												Export Chats
											</VoidButtonBgDarken>
											<ConfirmButton className='px-4 py-1 w-full' onConfirm={() => { chatThreadsService.resetState(); }}>
												Reset Chats
											</ConfirmButton>
										</div>
									</div>
								</SettingsSectionCard>



								{/* Appearance — workbench theme + optional Spud Paper shortcuts + rich dark panels */}
								<SettingsSectionCard>
									<h2 className={settingsSectionTitleClass}>Appearance</h2>
									<h4 className={settingsSectionLeadClass}>{`Spud panels use your active VS Code color theme. The buttons below jump to Spud Paper light/dark; you can use Command Palette → Color Theme to pick any built-in dark theme instead.`}</h4>

									<ErrorBoundary>
										<AppearanceToggle />
									</ErrorBoundary>

									<div className='mt-6 max-w-lg'>
										<h3 className='text-lg mb-1'>Rich dark panels</h3>
										<p className='text-void-fg-3 text-sm mb-3'>{`When your theme is dark, add a bit more depth and border contrast inside Spud sidebars and quick-edit. This does not add a new theme file — it only remaps panel colors on top of your current theme’s tokens.`}</p>
										<div className='flex items-center gap-x-2'>
											<VoidSwitch
												size='xs'
												value={settingsState.globalSettings.enhanceBuiltinDarkChrome}
												onChange={(v) => { void voidSettingsService.setGlobalSetting('enhanceBuiltinDarkChrome', v) }}
											/>
											<span className='text-void-fg-3 text-xs'>{settingsState.globalSettings.enhanceBuiltinDarkChrome ? 'Enabled' : 'Disabled'}</span>
										</div>
									</div>
								</SettingsSectionCard>

								{/* Built-in Settings section */}
								<SettingsSectionCard>
									<h2 className={settingsSectionTitleClass}>Built-in Settings</h2>
									<h4 className={settingsSectionLeadClass}>{`IDE settings and keyboard settings.`}</h4>

									<ErrorBoundary>
										<div className='flex flex-col gap-2 justify-center w-full max-w-full sm:max-w-48'>
											<VoidButtonBgDarken className='px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 touch-manipulation justify-center' onClick={() => { commandService.executeCommand('workbench.action.openSettings') }}>
												General Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 touch-manipulation justify-center' onClick={() => { commandService.executeCommand('workbench.action.openGlobalKeybindings') }}>
												Keyboard Settings
											</VoidButtonBgDarken>
											<VoidButtonBgDarken className='px-4 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 touch-manipulation justify-center' onClick={() => { nativeHostService.showItemInFolder(environmentService.logsHome.fsPath) }}>
												Open Logs
											</VoidButtonBgDarken>
										</div>
									</ErrorBoundary>
								</SettingsSectionCard>


								{/* Metrics section */}
								<SettingsSectionCard className="max-w-[min(100%,36rem)]">
									<h2 className={settingsSectionTitleClass}>Metrics</h2>
									<h4 className={settingsSectionLeadClass}>Very basic anonymous usage tracking helps us keep Spud running smoothly. You may opt out below. Regardless of this setting, Spud never sees your code, messages, or API keys.</h4>

									<div className='my-2'>
										{/* Disable All Metrics Switch */}
										<ErrorBoundary>
											<div className='flex items-center gap-x-2 my-2'>
												<VoidSwitch
													size='xs'
													value={isOptedOut}
													onChange={(newVal) => {
														storageService.store(OPT_OUT_KEY, newVal, StorageScope.APPLICATION, StorageTarget.MACHINE)
														metricsService.capture(`Set metrics opt-out to ${newVal}`, {}) // this only fires if it's enabled, so it's fine to have here
													}}
												/>
												<span className='text-void-fg-3 text-xs pointer-events-none'>{'Opt-out (requires restart)'}</span>
											</div>
										</ErrorBoundary>
									</div>
								</SettingsSectionCard>

								{/* AI Instructions section */}
								<SettingsSectionCard className="max-w-[min(100%,36rem)]">
									<h2 className={settingsSectionTitleClass}>AI Instructions</h2>
									<h4 className={settingsSectionLeadClass}>
										<ChatMarkdownRender inPTag={true} string={`
System instructions to include with all AI requests.
Alternatively, place a \`.voidrules\` file in the root of your workspace.
								`} chatMessageLocation={undefined} />
									</h4>
									<ErrorBoundary>
										<AIInstructionsBox />
									</ErrorBoundary>
									{/* --- Disable System Message Toggle --- */}
									<div className='my-4'>
										<ErrorBoundary>
											<div className='flex items-center gap-x-2'>
												<VoidSwitch
													size='xs'
													value={!!settingsState.globalSettings.disableSystemMessage}
													onChange={(newValue) => {
														voidSettingsService.setGlobalSetting('disableSystemMessage', newValue);
													}}
												/>
												<span className='text-void-fg-3 text-xs pointer-events-none'>
													{'Disable system message'}
												</span>
											</div>
										</ErrorBoundary>
										<div className='text-void-fg-3 text-xs mt-1'>
											{`When disabled, Spud will not include anything in the system message except for content you specified above.`}
										</div>
									</div>
								</SettingsSectionCard>

							</div>



							{/* MCP section */}
							<div className={shouldShowTab('mcp') ? `` : 'hidden'}>
								<ErrorBoundary>
									<SettingsSectionCard>
										<h2 className={settingsSectionTitleClass}>MCP</h2>
										<h4 className={settingsSectionLeadClass}>
											<ChatMarkdownRender inPTag={true} string={`
Use Model Context Protocol to provide Agent mode with more tools.
							`} chatMessageLocation={undefined} />
										</h4>
										<div className='my-2'>
											<VoidButtonBgDarken className='px-4 py-1 w-full max-w-48' onClick={async () => { await mcpService.revealMCPConfigFile() }}>
												Add MCP Server
											</VoidButtonBgDarken>
										</div>

										<ErrorBoundary>
											<MCPServersList />
										</ErrorBoundary>
									</SettingsSectionCard>
								</ErrorBoundary>
							</div>





						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
