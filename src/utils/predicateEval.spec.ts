import { describe, expect, it } from 'vitest'
import { ALL_PREDICATE_IDS, PREDICATE_LABELS, type PredicateGroup, type PredicateId } from '@/types/predicateExpression'
import { evaluatePredicateTree, explainPredicateTree, flattenPredicateTrace } from './predicateEval'

describe('predicate explanation', () => {
  it.each<[PredicateId, number[], number, boolean]>([
    ['erdosDeep', [0, 3, 6, 10, 13], 16, true],
    ['erdosDeep', [0, 4, 8, 12], 16, false],
    ['winogradDeep', [0, 1, 2, 4], 6, true],
    ['winogradDeep', [0, 3, 6, 10, 13], 16, false],
    ['reflectionSymmetric', [0, 1, 3, 6], 8, true],
    ['reflectionSymmetric', [0, 1, 3], 8, false],
    ['primitive', [0, 1, 3], 8, true],
    ['primitive', [0, 2, 4, 6], 8, false],
    ['maximallyEven', [0, 2, 4, 7], 10, false],
    ['maximallyEven', [0, 2, 5, 7], 10, true],
    ['metricalConflict', [0, 3, 6], 8, true],
    ['metricalConflict', [0, 2, 4, 6], 8, false],
    ['metricalConflict', [0, 1, 2], 6, false],
    ['sharedOmission', [0, 1, 2, 3], 8, true],
    ['sharedOmission', [0, 1, 2, 5], 8, false],
    ['sharedOmission', [2, 3], 6, false],
  ])('evaluates and explains %s on %j', (id, onsets, L, expected) => {
    const node = { type: 'predicate' as const, id }
    expect(ALL_PREDICATE_IDS).toContain(id)
    expect(evaluatePredicateTree(node, onsets, L)).toBe(expected)
    expect(explainPredicateTree(node, onsets, L)).toMatchObject({
      id,
      label: PREDICATE_LABELS[id],
      result: expected,
    })
    const trace = flattenPredicateTrace(explainPredicateTree(node, onsets, L))[0]
    expect(trace.summary).not.toBe('No explanation available.')
  })

  it('combines new predicates in nested AND/OR filters with short-circuit explanations', () => {
    const node: PredicateGroup = {
      type: 'and',
      children: [
        { type: 'predicate', id: 'primitive' },
        { type: 'or', children: [
          { type: 'predicate', id: 'winogradDeep' },
          { type: 'predicate', id: 'erdosDeep' },
        ] },
        { type: 'predicate', id: 'reflectionSymmetric' },
      ],
    }
    expect(evaluatePredicateTree(node, [0, 3, 6, 10, 13], 16)).toBe(true)
    expect(explainPredicateTree(node, [0, 3, 6, 10, 13], 16).result).toBe(true)
    const trace = explainPredicateTree(node, [0, 4, 8, 12], 16)
    expect(trace).toMatchObject({ result: false, shortCircuited: true })
    expect(flattenPredicateTrace(trace)).toHaveLength(1)
  })

  it('matches the boolean evaluator for nested groups', () => {
    const node: PredicateGroup = {
      type: 'and',
      children: [
        { type: 'predicate', id: 'maximallyEven' },
        {
          type: 'or',
          children: [
            { type: 'predicate', id: 'no-antipodes' },
            { type: 'predicate', id: 'lowEntropy' },
          ]
        }
      ]
    }

    const onsets = [0, 3, 5]
    const totalBits = 8

    expect(explainPredicateTree(node, onsets, totalBits).result).toBe(
      evaluatePredicateTree(node, onsets, totalBits)
    )
  })

  it('combines metrical predicates in nested filters', () => {
    const node: PredicateGroup = {
      type: 'and',
      children: [
        { type: 'predicate', id: 'metricalConflict' },
        { type: 'or', children: [
          { type: 'predicate', id: 'sharedOmission' },
          { type: 'predicate', id: 'maximallyEven' },
        ] },
      ],
    }
    expect(evaluatePredicateTree(node, [1, 2, 3], 8)).toBe(true)
    expect(explainPredicateTree(node, [1, 2, 3], 8)).toMatchObject({ result: true })
    const trace = explainPredicateTree(node, [0, 2, 4, 6], 8)
    expect(trace).toMatchObject({ result: false, shortCircuited: true })
    expect(flattenPredicateTrace(trace)).toHaveLength(1)
  })

  it('keeps the shared-omission meter fixed for every contour option', () => {
    const node = { type: 'predicate' as const, id: 'sharedOmission' as const }
    for (const circular of [false, true]) {
      for (const rotationInvariant of [false, true]) {
        for (const reflectionInvariant of [false, true]) {
          const opts = { circular, rotationInvariant, reflectionInvariant }
          expect(evaluatePredicateTree(node, [0, 1, 2, 3], 8, opts)).toBe(true)
          expect(evaluatePredicateTree(node, [0, 1, 2, 7], 8, opts)).toBe(false)
          expect(explainPredicateTree(node, [0, 1, 2, 7], 8, opts)).toMatchObject({ result: false })
        }
      }
    }
  })

  it('flattens evaluated leaves in order', () => {
    const node: PredicateGroup = {
      type: 'and',
      children: [
        { type: 'predicate', id: 'maximallyEven' },
        { type: 'predicate', id: 'no-antipodes' },
      ]
    }

    const flat = flattenPredicateTrace(explainPredicateTree(node, [0, 2, 4], 6))

    expect(flat).toHaveLength(2)
    expect(flat[0].id).toBe('maximallyEven')
    expect(flat[1].id).toBe('no-antipodes')
  })
})
