import { describe, expect, it } from 'vitest'
import { hasMetricalConflict, hasSharedOmission } from './predicates'

function onsetsOf(bits: number[]): number[] {
  return bits.flatMap((bit, position) => bit ? [position] : [])
}

/** Definition-based reference: explicitly score every possible alignment. */
function alignmentConflictReference(bits: number[]): boolean {
  const L = bits.length
  const fine: number[] = []
  const coarse: number[] = []
  for (let shift = 0; shift < L; shift++) {
    let fineScore = 0
    let coarseScore = 0
    for (let beat = 0; beat < L; beat += 2) {
      fineScore += bits[(beat + shift) % L] - bits[(beat + shift + 1) % L]
    }
    for (let beat = 0; beat < L; beat += 4) {
      coarseScore += bits[(beat + shift) % L] - bits[(beat + shift + 2) % L]
    }
    fine.push(fineScore)
    coarse.push(coarseScore)
  }
  const maxFine = Math.max(...fine)
  const maxCoarse = Math.max(...coarse)
  return !fine.some((value, shift) => value === maxFine && coarse[shift] === maxCoarse)
}

/** Independent reference: intersect omission targets found at each scale. */
function sharedOmissionReference(bits: number[]): boolean {
  const L = bits.length
  const fineTargets = new Set<number>()
  const coarseTargets = new Set<number>()
  for (let onset = 1; onset < L; onset += 2) {
    const target = (onset + 1) % L
    if (bits[onset] && !bits[target]) fineTargets.add(target)
  }
  for (let onset = 2; onset < L; onset += 4) {
    const target = (onset + 2) % L
    if (bits[onset] && !bits[target]) coarseTargets.add(target)
  }
  return [...fineTargets].some((target) => coarseTargets.has(target))
}

describe('Hadamard-inspired metrical predicates', () => {
  it('recognizes conflicting alignments in tresillo and son clave', () => {
    expect(hasMetricalConflict([0, 3, 6], 8)).toBe(true)
    expect(hasMetricalConflict([0, 3, 6, 10, 12], 16)).toBe(true)
    expect(hasMetricalConflict([0, 2, 4, 6], 8)).toBe(false)
  })

  it('does not classify ties, empty patterns, or full patterns as conflict', () => {
    for (const onsets of [[], [0], [0, 1, 2, 3], [0, 2, 4, 6], [0, 1, 2, 3, 4, 5, 6, 7]]) {
      expect(hasMetricalConflict(onsets, 8)).toBe(false)
    }
  })

  it('distinguishes a shared missing beat from separate omission targets', () => {
    expect(hasSharedOmission([0, 1, 2, 3], 8)).toBe(true)
    expect(hasSharedOmission([0, 1, 2, 5], 8)).toBe(false)
    expect(hasSharedOmission([], 8)).toBe(false)
    expect(hasSharedOmission([0, 1, 2, 3, 4, 5, 6, 7], 8)).toBe(false)
  })

  it('handles a shared omission at the cyclic downbeat', () => {
    expect(hasSharedOmission([6, 7], 8)).toBe(true)
    expect(hasSharedOmission([0, 6, 7], 8)).toBe(false)
    expect(hasSharedOmission([7], 8)).toBe(false)
    expect(hasSharedOmission([6], 8)).toBe(false)
  })

  it('preserves conflict under rotation while keeping shared omissions meter-relative', () => {
    for (let shift = 0; shift < 8; shift++) {
      const rotated = [0, 3, 6].map((onset) => (onset + shift) % 8)
      expect(hasMetricalConflict(rotated, 8)).toBe(true)
    }
    expect(hasSharedOmission([0, 1, 2, 3], 8)).toBe(true)
    expect(hasSharedOmission([0, 1, 2, 7], 8)).toBe(false)
    expect(hasSharedOmission([4, 5, 6, 7], 8)).toBe(true)
  })

  it.each([0, 1, 2, 3, 6, 12, -4, 4.5, NaN, Infinity])('rejects unsupported cycle length %s', (L) => {
    expect(hasMetricalConflict([0, 1, 2], L)).toBe(false)
    expect(hasSharedOmission([2, 3], L)).toBe(false)
  })

  it('supports sparse power-of-two cycles beyond the 32-bit bitwise range', () => {
    expect(hasMetricalConflict([0, 1, 2], 2 ** 32)).toBe(true)
    expect(hasSharedOmission([2, 3], 2 ** 32)).toBe(true)
    expect(hasMetricalConflict([0, 1, 2], 2 ** 32 + 4)).toBe(false)
    expect(hasSharedOmission([2, 3], 2 ** 32 + 4)).toBe(false)
  })

  it.each([4, 8, 16])('matches both definitions for every %i-pulse binary pattern', (L) => {
    for (let mask = 0; mask < 2 ** L; mask++) {
      const bits = Array.from({ length: L }, (_, position) => (mask >> position) & 1)
      const onsets = onsetsOf(bits)
      expect(hasMetricalConflict(onsets, L), `conflict: L=${L}, mask=${mask}`).toBe(alignmentConflictReference(bits))
      expect(hasSharedOmission(onsets, L), `shared omission: L=${L}, mask=${mask}`).toBe(sharedOmissionReference(bits))
    }
  })
})
