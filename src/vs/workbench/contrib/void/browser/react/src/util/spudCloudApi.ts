/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

export function trimTrailingSlash(s: string): string {
	return s.replace(/\/+$/, '');
}

export type SpudCloudUser = {
	name: string;
	email: string;
	initials: string;
	role?: string;
	mfa?: boolean;
	createdAt?: string;
};

export type SpudCloudWorkspace = {
	name: string;
	slug: string;
	plan: string;
	seats: { used: number; total: number };
	region: string;
	gstin: string;
	renewsOn: string;
};

export async function fetchSpudCloudSession(
	apiBase: string,
	workspaceId: string,
): Promise<
	| { ok: true; user: SpudCloudUser; workspace: SpudCloudWorkspace }
	| { ok: false; error: string }
> {
	const base = trimTrailingSlash(apiBase.trim());
	if (!base) {
		return { ok: false, error: 'Set Spud Cloud API URL in Spud settings (General → Profile).' };
	}
	const sp = new URLSearchParams();
	sp.set('workspace', workspaceId.trim() || 'ws_acme');
	const q = sp.toString();
	try {
		const [meRes, wsRes] = await Promise.all([
			fetch(`${base}/api/v1/me?${q}`, { credentials: 'omit' }),
			fetch(`${base}/api/v1/workspace?${q}`, { credentials: 'omit' }),
		]);
		if (!meRes.ok || !wsRes.ok) {
			return { ok: false, error: `HTTP ${meRes.status} / ${wsRes.status}` };
		}
		const me = (await meRes.json()) as { user: SpudCloudUser };
		const w = (await wsRes.json()) as { workspace: SpudCloudWorkspace };
		if (!me.user || !w.workspace) {
			return { ok: false, error: 'Unexpected API response' };
		}
		return { ok: true, user: me.user, workspace: w.workspace };
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Network error';
		return { ok: false, error: msg };
	}
}
