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

function authHeaders(token: string | undefined | null): Record<string, string> {
	const t = (token ?? '').trim();
	return t ? { Authorization: `Bearer ${t}` } : {};
}

/**
 * Fetches /api/v1/me + /api/v1/workspace for the configured Spud Console.
 * Requires a valid access token — the endpoints 401/403 otherwise.
 */
export async function fetchSpudCloudSession(
	apiBase: string,
	workspaceId: string,
	token?: string,
): Promise<
	| { ok: true; user: SpudCloudUser; workspace: SpudCloudWorkspace }
	| { ok: false; error: string; status?: number }
> {
	const base = trimTrailingSlash(apiBase.trim());
	if (!base) {
		return { ok: false, error: 'Set Spud Cloud API URL in Spud settings (General → Profile).' };
	}
	const sp = new URLSearchParams();
	sp.set('workspace', workspaceId.trim() || 'ws_acme');
	const q = sp.toString();
	const headers = authHeaders(token);
	if (Object.keys(headers).length === 0) {
		return {
			ok: false,
			error:
				'Missing Spud Cloud access token. Paste a token from console.spud.dev (Profile → Spud Cloud API token) in Settings → General.',
		};
	}
	try {
		const [meRes, wsRes] = await Promise.all([
			fetch(`${base}/api/v1/me?${q}`, { credentials: 'omit', headers }),
			fetch(`${base}/api/v1/workspace?${q}`, { credentials: 'omit', headers }),
		]);
		if (!meRes.ok || !wsRes.ok) {
			const status = !meRes.ok ? meRes.status : wsRes.status;
			let detail = `HTTP ${meRes.status} / ${wsRes.status}`;
			if (status === 401) detail = 'Unauthorized — token invalid or expired. Sign in on console.spud.dev and paste a new token.';
			if (status === 403) detail = 'Forbidden — this token is valid but the account is not a member of the selected workspace.';
			return { ok: false, error: detail, status };
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

/**
 * POST /api/v1/usage/report — report token usage for a BYO-provider completion
 * so the Spud Console token ledger reflects IDE traffic too.
 *
 * Fire-and-forget: returns `{ ok }` so callers can ignore the result on failure.
 */
export async function reportSpudUsage(
	apiBase: string,
	workspaceId: string,
	token: string | undefined | null,
	payload: {
		provider: string;
		model: string;
		promptTokens?: number;
		completionTokens?: number;
		totalTokens?: number;
		latencyMs?: number;
		threadId?: string;
		cost?: string;
		source?: 'ide-direct' | 'agent';
	},
): Promise<{ ok: boolean; error?: string }> {
	const base = trimTrailingSlash(apiBase.trim());
	const t = (token ?? '').trim();
	if (!base || !t) return { ok: false, error: 'not_configured' };
	const sp = new URLSearchParams();
	sp.set('workspace', workspaceId.trim() || 'ws_acme');
	try {
		const res = await fetch(`${base}/api/v1/usage/report?${sp.toString()}`, {
			method: 'POST',
			credentials: 'omit',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${t}`,
			},
			body: JSON.stringify({ source: 'ide-direct', ...payload }),
		});
		if (!res.ok) {
			return { ok: false, error: `HTTP ${res.status}` };
		}
		return { ok: true };
	} catch (e) {
		return { ok: false, error: e instanceof Error ? e.message : 'network_error' };
	}
}
