/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react'
import { useIsDark, useSettingsState } from '../util/services.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { QuickEditChat } from './QuickEditChat.js'
import { QuickEditPropsType } from '../../../quickEditActions.js'

export const QuickEdit = (props: QuickEditPropsType) => {

	const isDark = useIsDark()
	const { globalSettings } = useSettingsState()
	const enhanceDark = isDark && globalSettings.enhanceBuiltinDarkChrome

	return <div className={`@@void-scope ${isDark ? 'dark' : ''}${enhanceDark ? ' @@void-enhance-dark' : ''}`}>
		<ErrorBoundary>
			<QuickEditChat {...props} />
		</ErrorBoundary>
	</div>


}
