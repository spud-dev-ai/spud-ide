/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import '../styles.css'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { PastThreadsList } from '../sidebar-tsx/SidebarThreadSelector.js'

/**
 * Full auxiliary view: scrollable list of prior threads (newest first).
 */
export const HistoryPanel = ({ className }: { className: string }) => {
	return (
		<div
			className={`@@void-scope ${className ?? ''}`}
			style={{ width: '100%', height: '100%' }}
		>
			<div className='w-full h-full flex flex-col min-h-0 bg-void-bg-2 text-void-fg-1'>
				<div className='flex-shrink-0 px-3 py-2 border-b border-void-border-3 vc-section-label text-void-fg-2'>
					History
				</div>
				<div className='flex-1 min-h-0 overflow-y-auto px-2 py-2'>
					<ErrorBoundary>
						<PastThreadsList variant='list' unlimited={true} className='mb-0' />
					</ErrorBoundary>
				</div>
			</div>
		</div>
	)
}
