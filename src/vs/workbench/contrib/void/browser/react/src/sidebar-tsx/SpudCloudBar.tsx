/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useState } from 'react';
import { Cloud, ExternalLink, Settings as SettingsGear } from 'lucide-react';
import { URI } from '../../../../../../../base/common/uri.js';
import { useAccessor, useSettingsState } from '../util/services.js';
import { fetchSpudCloudSession, trimTrailingSlash } from '../util/spudCloudApi.js';
import { VOID_OPEN_SETTINGS_ACTION_ID } from '../../../voidSettingsPane.js';

export const SpudCloudBar = () => {
	const accessor = useAccessor();
	const commandService = accessor.get('ICommandService');
	const { globalSettings } = useSettingsState();
	const base = globalSettings.spudCloudApiBase.trim();
	const workspaceId = globalSettings.spudWorkspaceId.trim() || 'ws_acme';
	const token = globalSettings.spudCloudToken?.trim() ?? '';

	const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'err' | 'signin'>('idle');
	const [line, setLine] = useState<string>('');

	const refresh = useCallback(async () => {
		if (!base) {
			setStatus('idle');
			setLine('');
			return;
		}
		if (!token) {
			setStatus('signin');
			setLine('Sign in to Spud Cloud');
			return;
		}
		setStatus('loading');
		const res = await fetchSpudCloudSession(base, workspaceId, token);
		if (res.ok) {
			setStatus('ok');
			setLine(`${res.user.name} · ${res.workspace.name}`);
		} else {
			setStatus('err');
			setLine(res.error);
		}
	}, [base, workspaceId, token]);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const openCloudDashboard = useCallback(() => {
		const root = base ? trimTrailingSlash(base) : 'https://console.spud.dev';
		void commandService.executeCommand('vscode.open', URI.parse(root));
	}, [commandService, base]);

	const openSpudSettings = useCallback(() => {
		void commandService.executeCommand(VOID_OPEN_SETTINGS_ACTION_ID);
	}, [commandService]);

	if (!base) {
		return (
			<div className='vc-spud-cloud-bar vc-spud-cloud-bar--muted px-2 py-1.5 flex items-center justify-between gap-2 border-b border-void-border-3 text-[11px] text-void-fg-3'>
				<span className='truncate'>Spud Cloud: set API URL in Spud settings</span>
				<button
					type='button'
					className='shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-void-border-3 hover:bg-void-bg-3 text-void-fg-2'
					onClick={openSpudSettings}
				>
					<SettingsGear size={11} />
					<span>Settings</span>
				</button>
			</div>
		);
	}

	return (
		<div className='vc-spud-cloud-bar px-2 py-1.5 flex items-center justify-between gap-2 border-b border-void-border-3 text-[11px]'>
			<div className='flex items-center gap-1.5 min-w-0 flex-1'>
				<Cloud size={12} className='shrink-0 text-void-fg-3 opacity-90' aria-hidden />
				{status === 'loading' ? (
					<span className='text-void-fg-3 truncate'>Connecting to Spud Cloud…</span>
				) : status === 'ok' ? (
					<span className='text-void-fg-2 truncate' title={line}>{line}</span>
				) : status === 'signin' ? (
					<button
						type='button'
						className='text-void-fg-2 truncate underline decoration-dotted underline-offset-2 hover:text-void-fg-1'
						onClick={openSpudSettings}
						title='Paste your Spud Console token in Settings → General → Profile'
					>
						Sign in to Spud Cloud
					</button>
				) : status === 'err' ? (
					<span className='text-void-fg-3 truncate' title={line}>Cloud: {line}</span>
				) : (
					<span className='text-void-fg-3 truncate'>Spud Cloud</span>
				)}
			</div>
			<div className='flex items-center gap-1 shrink-0'>
				<button
					type='button'
					className='flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-void-border-3 hover:bg-void-bg-3 text-void-fg-2'
					onClick={openCloudDashboard}
					title='Open Spud Cloud dashboard'
				>
					<ExternalLink size={11} />
					<span>Cloud</span>
				</button>
				<button
					type='button'
					className='p-0.5 rounded hover:bg-void-bg-3 text-void-fg-3'
					onClick={openSpudSettings}
					title='Spud settings'
					aria-label='Spud settings'
				>
					<SettingsGear size={12} />
				</button>
			</div>
		</div>
	);
};
