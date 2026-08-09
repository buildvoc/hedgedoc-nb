/*
 * SPDX-FileCopyrightText: 2025 The HedgeDoc developers (see AUTHORS file)
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

import { getOperationsFromCnl } from './cnl-parser'
import { TransitiveClosureEngine } from './inference-engine'
import { operationsToGraph } from './operations-to-graph'
import { getMergedSchemas } from './schema-store'
import type { CnlGraphData } from './types'
import { validateOperations } from './validate-operations'

export interface NodeBookStats {
  nodeCount: number
  edgeCount: number
  attributeCount: number
  typedNodeCount: number
  morphCount: number
  queryCount: number
  inferredEdgeCount: number
  maxInferenceChain: number
  hasSchema: boolean
  schemaValidates: boolean
  hasTransition: boolean
  transitionBalanced: boolean
  hasComputation: boolean
  computationChained: boolean
  blockCount: number
}

export interface ScoreCategory {
  name: string
  earned: number
  max: number
}

export interface NodeBookScore {
  total: number
  categories: ScoreCategory[]
}

export function computeNodeBookScore(stats: NodeBookStats): NodeBookScore {
  const categories: ScoreCategory[] = []

  // Coverage (max 20): based on node count
  let coverage = 0
  if (stats.nodeCount >= 30) coverage = 20
  else if (stats.nodeCount >= 20) coverage = 15
  else if (stats.nodeCount >= 10) coverage = 10
  else if (stats.nodeCount >= 5) coverage = 5
  categories.push({ name: 'coverage', earned: coverage, max: 20 })

  // Connectivity (max 15): based on average degree
  const avgDegree = (2 * stats.edgeCount) / Math.max(stats.nodeCount, 1)
  let connectivity = 0
  if (avgDegree >= 4) connectivity = 15
  else if (avgDegree >= 3) connectivity = 10
  else if (avgDegree >= 2) connectivity = 5
  categories.push({ name: 'connectivity', earned: connectivity, max: 15 })

  // Typing (max 15): percentage of typed nodes
  const typedPercent = stats.nodeCount > 0 ? (stats.typedNodeCount / stats.nodeCount) * 100 : 0
  let typing = 0
  if (typedPercent >= 100) typing = 15
  else if (typedPercent >= 75) typing = 10
  else if (typedPercent >= 50) typing = 5
  categories.push({ name: 'typing', earned: typing, max: 15 })

  // Inference (max 10): based on max inference chain length
  let inference = 0
  if (stats.maxInferenceChain >= 4) inference = 10
  else if (stats.maxInferenceChain >= 3) inference = 6
  else if (stats.maxInferenceChain >= 2) inference = 3
  categories.push({ name: 'inference', earned: inference, max: 10 })

  // Schema (max 10): whether schema exists and validates
  let schema = 0
  if (stats.schemaValidates) schema = 10
  else if (stats.hasSchema) schema = 5
  categories.push({ name: 'schema', earned: schema, max: 10 })

  // Processes (max 10): transitions with balance
  let processes = 0
  if (stats.transitionBalanced) processes = 10
  else if (stats.hasTransition) processes = 5
  categories.push({ name: 'processes', earned: processes, max: 10 })

  // Computation (max 10): expressions chained
  let computation = 0
  if (stats.computationChained) computation = 10
  else if (stats.hasComputation) computation = 5
  categories.push({ name: 'computation', earned: computation, max: 10 })

  // Queries (max 5): any queries present
  let queries = 0
  if (stats.queryCount > 0) queries = 5
  categories.push({ name: 'queries', earned: queries, max: 5 })

  // Morphs (max 5): any morphs present
  let morphs = 0
  if (stats.morphCount > 0) morphs = 5
  categories.push({ name: 'morphs', earned: morphs, max: 5 })

  const total = categories.reduce((sum, cat) => sum + cat.earned, 0)

  return { total, categories }
}

/** Regex to extract ```nodeBook blocks (but not ```nodeBook-schema). */
const NODEBOOK_BLOCK_REGEX = /```nodeBook(?!-schema)\b[^\n]*\n([\s\S]*?)```/g

/** Regex to detect ```nodeBook-schema blocks. */
const SCHEMA_BLOCK_REGEX = /```nodeBook-schema\b/g

function isTransitionRoleForStats(role: string): boolean {
  return role === 'Transition' || role === 'Transaction' || role === 'Function'
}

export interface NodeBookStatsResult {
  hasNodeBookBlocks: boolean
  stats: NodeBookStats
  score: NodeBookScore
}

const EMPTY_STATS: NodeBookStats = {
  nodeCount: 0,
  edgeCount: 0,
  attributeCount: 0,
  typedNodeCount: 0,
  morphCount: 0,
  queryCount: 0,
  inferredEdgeCount: 0,
  maxInferenceChain: 0,
  hasSchema: false,
  schemaValidates: false,
  hasTransition: false,
  transitionBalanced: false,
  hasComputation: false,
  computationChained: false,
  blockCount: 0
}

/**
 * Extract every ```nodeBook block from a markdown document, aggregate graph
 * statistics across them (running transitive-closure inference and schema
 * validation), and score the result on the 9-category rubric. Pure — usable
 * from any host (HedgeDoc sidebar, editor plugins, CLI).
 */
export function computeNodeBookStatsFromMarkdown(markdownContent: string): NodeBookStatsResult {
  const blocks: string[] = []
  let match: RegExpExecArray | null
  const blockRegex = new RegExp(NODEBOOK_BLOCK_REGEX.source, NODEBOOK_BLOCK_REGEX.flags)
  while ((match = blockRegex.exec(markdownContent)) !== null) {
    blocks.push(match[1])
  }

  if (blocks.length === 0) {
    return { hasNodeBookBlocks: false, stats: EMPTY_STATS, score: computeNodeBookScore(EMPTY_STATS) }
  }

  const schemaRegex = new RegExp(SCHEMA_BLOCK_REGEX.source, SCHEMA_BLOCK_REGEX.flags)
  let schemaBlockCount = 0
  while (schemaRegex.exec(markdownContent) !== null) {
    schemaBlockCount++
  }

  let totalNodes = 0
  let totalEdges = 0
  let totalAttributes = 0
  let totalTypedNodes = 0
  let totalMorphs = 0
  let totalQueries = 0
  let totalInferredEdges = 0
  let maxChain = 0
  let hasTransition = false
  let transitionBalanced = false
  let hasComputation = false
  let computationChained = false

  const schemas = getMergedSchemas()
  const inferenceEngine = new TransitiveClosureEngine()
  let allValidationErrors = 0

  for (const block of blocks) {
    try {
      const operations = getOperationsFromCnl(block)
      const graphData: CnlGraphData = operationsToGraph(operations)

      totalNodes += graphData.nodes.length
      totalEdges += graphData.edges.length
      totalAttributes += graphData.attributes.length
      totalQueries += graphData.queries.length

      for (const node of graphData.nodes) {
        if (node.role !== 'individual') {
          totalTypedNodes++
        }
      }

      for (const node of graphData.nodes) {
        for (const morph of node.morphs) {
          if (morph.name !== 'basic') {
            totalMorphs++
          }
        }
      }

      const transitions = graphData.nodes.filter((n) => isTransitionRoleForStats(n.role))
      if (transitions.length > 0) {
        hasTransition = true
        const balanced = transitions.every((t) => {
          const hasInput = graphData.edges.some((e) => e.source_id === t.id && e.name === 'has prior_state')
          const hasOutput = graphData.edges.some((e) => e.source_id === t.id && e.name === 'has post_state')
          return hasInput && hasOutput
        })
        if (balanced) transitionBalanced = true
      }

      if (graphData.expressions.length > 0) {
        hasComputation = true
        if (graphData.expressions.length > 1) {
          computationChained = true
        }
      }

      const inferenceResult = inferenceEngine.infer(graphData, schemas)
      totalInferredEdges += inferenceResult.inferredEdges.length
      for (const edge of inferenceResult.inferredEdges) {
        if (edge.proofPath.length > maxChain) {
          maxChain = edge.proofPath.length
        }
      }

      const errors = validateOperations(operations, schemas)
      allValidationErrors += errors.length
    } catch {
      // Skip blocks that fail to parse
    }
  }

  const stats: NodeBookStats = {
    nodeCount: totalNodes,
    edgeCount: totalEdges,
    attributeCount: totalAttributes,
    typedNodeCount: totalTypedNodes,
    morphCount: totalMorphs,
    queryCount: totalQueries,
    inferredEdgeCount: totalInferredEdges,
    maxInferenceChain: maxChain,
    hasSchema: schemaBlockCount > 0,
    schemaValidates: schemaBlockCount > 0 && allValidationErrors === 0,
    hasTransition,
    transitionBalanced,
    hasComputation,
    computationChained,
    blockCount: blocks.length
  }

  return { hasNodeBookBlocks: true, stats, score: computeNodeBookScore(stats) }
}
