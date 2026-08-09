/*
 * SPDX-FileCopyrightText: 2025 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { useMemo } from 'react'
import { useNoteMarkdownContent } from '../../../../hooks/common/use-note-markdown-content'
import { computeNodeBookStatsFromMarkdown } from '@nodebook/core'
import type { NodeBookStatsResult } from '@nodebook/core'

export type { NodeBookStatsResult }

export function useNodeBookStats(): NodeBookStatsResult {
  const markdownContent = useNoteMarkdownContent()
  return useMemo(() => computeNodeBookStatsFromMarkdown(markdownContent), [markdownContent])
}
