/**
 * Music theory predicates for rhythm analysis.
 * Based on musicological literature, especially Godfried Toussaint's "The Geometry of Musical Rhythm"
 * and the combinatorics-on-words literature on rhythmic oddity properties.
 */

/**
 * Calculate circular Inter-Onset Intervals (IOIs) for given onsets.
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns Array of circular intervals between consecutive onsets
 */
export function circularIntervals(onsets: number[], L: number): number[] {
  if (onsets.length < 2) {
    return []
  }

  const intervals: number[] = []
  const n = onsets.length

  for (let i = 0; i < n; i++) {
    const current = onsets[i]
    const next = onsets[(i + 1) % n]
    
    // Calculate circular distance from current to next onset
    const interval = (next - current + L) % L || L
    intervals.push(interval)
  }

  return intervals
}

/**
 * Check if onsets are maximally even (Euclidean spacing).
 * 
 * For every m from 1 to k-1, the clockwise span of m consecutive onset
 * intervals must be floor(m*L/k) or ceil(m*L/k). Checking only adjacent
 * intervals is insufficient: [2,2,3,3] has balanced gap counts but is not
 * maximally even, whereas [2,3,2,3] is.
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if the rhythm has maximally even spacing, false otherwise
 */
export function isMaximallyEven(onsets: number[], L: number): boolean {
  if (onsets.length === 0) {
    return false
  }

  if (onsets.length === 1) {
    // Single onset is trivially maximally even
    return true
  }

  const k = onsets.length
  for (let m = 1; m < k; m++) {
    const lower = Math.floor(m * L / k)
    const upper = Math.ceil(m * L / k)
    for (let i = 0; i < k; i++) {
      const j = i + m
      const span = onsets[j % k] - onsets[i] + (j >= k ? L : 0)
      if (span !== lower && span !== upper) return false
    }
  }
  return true
}

/**
 * Internal helper to detect if any contiguous block of intervals sums to L/2.
 * Uses a sliding window over the doubled interval sequence to handle circular wrapping.
 * 
 * @param intervals Array of intervals
 * @param L Total length
 * @returns true if any contiguous block sums to L/2, false otherwise
 */
function noHalfArc(intervals: number[], L: number): boolean {
  if (L % 2 !== 0) {
    return true // L/2 is not an integer, so no half-arc possible
  }
  
  const halfL = L / 2
  const n = intervals.length
  
  if (n === 0) {
    return true
  }
  
  // Double the intervals array to handle circular wrapping
  const doubled = intervals.concat(intervals)
  
  // Use sliding window to check all possible contiguous sums
  for (let start = 0; start < n; start++) {
    let sum = 0
    for (let len = 1; len < n; len++) { // len < n to avoid checking the full cycle
      sum += doubled[start + len - 1]
      if (sum === halfL) {
        return false // Found a half-arc
      }
      if (sum > halfL) {
        break // No point continuing this window
      }
    }
  }
  
  return true
}

/**
 * Check if rhythm has the Rhythmic Oddity Property (classic {2,3} version).
 * 
 * A rhythm has ROP if:
 * - Total length L is even
 * - All circular IOIs are only 2 or 3
 * - No rotation admits any contiguous block of IOIs summing to L/2
 * 
 * Based on the combinatorics-on-words literature.
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if rhythm has ROP {2,3}, false otherwise
 */
export function hasROP23(onsets: number[], L: number): boolean {
  if (onsets.length < 2) {
    return false
  }
  
  if (L % 2 !== 0) {
    return false // L must be even
  }
  
  const intervals = circularIntervals(onsets, L)
  
  // Check that all intervals are 2 or 3
  for (const interval of intervals) {
    if (interval !== 2 && interval !== 3) {
      return false
    }
  }
  
  // Check no half-arc property
  return noHalfArc(intervals, L)
}

/**
 * Check if rhythm has odd-intervals oddity property.
 * 
 * A rhythm has this property if:
 * - Total length L is even
 * - All circular IOIs are odd integers
 * - No contiguous block of IOIs (wrapping allowed) sums to L/2
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if rhythm has odd-intervals oddity, false otherwise
 */
export function hasOddIntervalsOddity(onsets: number[], L: number): boolean {
  if (onsets.length < 2) {
    return false
  }
  
  if (L % 2 !== 0) {
    return false // L must be even
  }
  
  const intervals = circularIntervals(onsets, L)
  
  // Check that all intervals are odd
  for (const interval of intervals) {
    if (interval % 2 === 0) {
      return false
    }
  }
  
  // Check no half-arc property
  return noHalfArc(intervals, L)
}

/**
 * Check if rhythm has no antipodal pairs.
 * 
 * When L is even, there should be no pairs of onsets separated by exactly L/2.
 * When L is odd, this is always true (no antipodal points exist).
 * 
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if no antipodal pairs exist, false otherwise
 */
export function noAntipodalPairs(onsets: number[], L: number): boolean {
  if (L % 2 !== 0) {
    return true // No antipodal points when L is odd
  }
  
  const halfL = L / 2
  const onsetSet = new Set(onsets)
  
  for (const onset of onsets) {
    const antipodal = (onset + halfL) % L
    if (onsetSet.has(antipodal)) {
      return false // Found an antipodal pair
    }
  }
  
  return true
}

/**
 * Reverse triangular number: largest k such that k*(k+1)/2 <= n.
 */
function reverseTriangularNumber(n: number): number {
  if (n <= 0) return 0
  return Math.floor((Math.sqrt(1 + 8 * n) - 1) / 2)
}

/**
 * Shannon entropy (natural log) of a multiset given by an array of integers.
 * Values are used only for equality classes; probabilities are counts/size.
 */
function entropyOf(values: number[]): number {
  const N = values.length
  if (N === 0) return 0
  const freq = new Map<number, number>()
  for (const v of values) freq.set(v, (freq.get(v) ?? 0) + 1)
  let h = 0
  for (const [, c] of freq) {
    const p = c / N
    h += p * Math.log(p)
  }
  return h === 0 ? 0 : -h
}

/**
 * Low-entropy predicate inspired by the provided Java implementation.
 *
 * - Build the circular IOI sequence (a composition of total length L).
 * - Compute Shannon entropy of the IOI value distribution.
 * - Compare h against ln(reverseTriangularNumber(L) * 0.5).
 */
const lowEntropyBoundCache = new Map<number, number>()

export function isLowEntropy(onsets: number[], L: number): boolean {
  if (onsets.length < 2) {
    // With <2 onsets, intervals are undefined; follow Java behavior: entropy 0 < bound (likely true for typical L)
    let bound = lowEntropyBoundCache.get(L)
    if (bound === undefined) {
      bound = Math.log(reverseTriangularNumber(L) * 0.5)
      lowEntropyBoundCache.set(L, bound)
    }
    return 0 < bound
  }
  const intervals = circularIntervals(onsets, L)
  const h = entropyOf(intervals)
  let bound = lowEntropyBoundCache.get(L)
  if (bound === undefined) {
    bound = Math.log(reverseTriangularNumber(L) * 0.5)
    lowEntropyBoundCache.set(L, bound)
  }
  return h < bound
}

/**
 * Interval vector per Java reference (circular):
 * For i = 1..floor(L/2), count positions j such that onset[j] && onset[(j+i) % L].
 * When L is even and i == L/2, halve the count (each antipodal pair would be counted twice).
 * Returns array of length m = floor(L/2), index i-1 corresponds to interval i.
 */
export function intervalVector(onsets: number[], L: number): number[] {
  const m = Math.floor(L / 2)
  if (m <= 0) return []
  const vec = new Array<number>(m).fill(0)
  const flags = new Uint8Array(L)
  for (const p of onsets) {
    if (p >= 0 && p < L) flags[p] = 1
  }
  for (let i = 1; i <= m; i++) {
    let k = 0
    for (let j = 0; j < L; j++) {
      if (flags[j] && flags[(j + i) % L]) k++
    }
    if (i === m && L % 2 === 0) k = Math.floor(k / 2)
    vec[i - 1] = k
  }
  return vec
}

/**
 * Erdős-deep: the positive shortest-distance multiplicities are exactly
 * 1, 2, ..., k-1, each appearing once. Empty and singleton rhythms pass
 * vacuously, as in the mathematical definition; every two-onset set passes.
 * Onsets must be distinct, sorted, and within [0, L), with positive integer L.
 */
export function isErdosDeep(onsets: number[], L: number): boolean {
  if (onsets.length < 2) return true
  const counts = intervalVector(onsets, L).filter((count) => count > 0)
  if (counts.length !== onsets.length - 1) return false
  const seen = new Set(counts)
  for (let count = 1; count < onsets.length; count++) {
    if (!seen.has(count)) return false
  }
  return true
}

/**
 * Winograd-deep: all bins of the shortest-distance interval vector have
 * distinct multiplicities, including zero bins (at most one may be zero).
 * Uses the same onset/cycle contract as isErdosDeep.
 */
export function isWinogradDeep(onsets: number[], L: number): boolean {
  const counts = intervalVector(onsets, L)
  return new Set(counts).size === counts.length
}

/**
 * True if a reflection x -> (a-x) mod L preserves the onset set for some a.
 * This includes axes through pulses and between pulses. Empty and singleton
 * rhythms are symmetric. Uses the same onset/cycle contract as isErdosDeep.
 */
export function isReflectionSymmetric(onsets: number[], L: number): boolean {
  if (onsets.length < 2) return true
  const onsetSet = new Set(onsets)
  // Any axis must map the first onset onto another onset: only k candidates.
  for (const target of onsets) {
    const axis = onsets[0] + target
    if (onsets.every((onset) => onsetSet.has((axis - onset + L) % L))) return true
  }
  return false
}

/**
 * Primitive: no nonzero rotation smaller than L preserves the onset set.
 * Empty/full rhythms have period 1, so are primitive only when L=1.
 * Uses the same onset/cycle contract as isErdosDeep.
 */
export function isPrimitive(onsets: number[], L: number): boolean {
  if (onsets.length === 0 || onsets.length === L) return L === 1
  const onsetSet = new Set(onsets)
  // The least period divides L and moves the first onset to another onset.
  for (let i = 1; i < onsets.length; i++) {
    const shift = onsets[i] - onsets[0]
    if (L % shift !== 0 || (onsets.length * shift) % L !== 0) continue
    if (onsets.every((onset) => onsetSet.has((onset + shift) % L))) return false
  }
  return true
}

/** Cycle-length domain for the two Hadamard-inspired metrical predicates. */
export function isPureDupleCycleLength(L: number): boolean {
  return Number.isSafeInteger(L) && L >= 4 && 2 ** Math.round(Math.log2(L)) === L
}

/**
 * No rotation simultaneously maximizes level-1 and level-2 onbeatness.
 * Equivalently, h1 * h2 * h3 < 0 in the unnormalized, naturally ordered
 * Walsh-Hadamard transform. Zero coefficients are ties and do not conflict.
 * Rotation-invariant; independent of contour options. Unsupported lengths
 * return false. Onsets must be distinct integers within [0, L).
 */
export function hasMetricalConflict(onsets: number[], L: number): boolean {
  if (!isPureDupleCycleLength(L)) return false

  let h1 = 0
  let h2 = 0
  let h3 = 0
  for (const onset of onsets) {
    const residue = onset % 4
    h1 += residue % 2 === 0 ? 1 : -1
    h2 += residue < 2 ? 1 : -1
    h3 += residue === 0 || residue === 3 ? 1 : -1
  }
  return h1 * h2 * h3 < 0
}

/**
 * Some empty beat b = 0 mod 4 has onsets at both b-1 and b-2 (mod L):
 * fine- and coarse-level onset/omission pairs share the same missing beat.
 * Position 0 anchors the meter; rotating the onset set can change the result.
 * Unsupported lengths return false. Uses the same onset contract as above.
 */
export function hasSharedOmission(onsets: number[], L: number): boolean {
  if (!isPureDupleCycleLength(L)) return false

  const onsetSet = new Set(onsets)
  // Only an onset immediately before a multiple of four can be a witness.
  // Iterating onsets avoids scanning a potentially sparse, long cycle.
  for (const onset of onsets) {
    if (onset % 4 !== 3) continue
    const beat = (onset + 1) % L
    if (!onsetSet.has(beat) && onsetSet.has(onset - 1)) return true
  }
  return false
}

/**
 * HasNoGaps: the non-zero entries of the interval vector (IOI histogram) occupy
 * a single consecutive block of indices. Single non-zero bin counts as true.
 */
export function hasNoGaps(onsets: number[], L: number): boolean {
  const vec = intervalVector(onsets, L)
  if (vec.length === 0) return true
  const nzIdx: number[] = []
  for (let i = 0; i < vec.length; i++) if (vec[i] !== 0) nzIdx.push(i)
  if (nzIdx.length <= 1) return true
  for (let i = 0; i < nzIdx.length - 1; i++) {
    if (nzIdx[i + 1] - nzIdx[i] !== 1) return false
  }
  return true
}

/**
 * Binomial coefficient with basic overflow guard.
 */
export function binomial(n: number, k: number): number {
  if (n < 0 || k < 0 || k > n) throw new Error('Invalid n,k for binomial')
  if (k > n - k) k = n - k
  let result = 1
  for (let i = 0; i < k; i++) {
    // JS numbers are floats; skip overflow guard as advisory
    result = (result * (n - i)) / (i + 1)
  }
  return result
}

export function triangularNumber(n: number): number {
  return binomial(n + 1, 2)
}

/**
 * RelativelyFlat: requires HasNoGaps; let a be the interval-vector with zeros removed.
 * Let n = a.size, mean = triangularNumber(k)/n, k = onsets.length.
 * All entries must lie within +/- 50% of the mean.
 */
export function relativelyFlat(onsets: number[], L: number): boolean {
  if (!hasNoGaps(onsets, L)) return false
  const k = onsets.length
  if (k < 1) return false
  const vec = intervalVector(onsets, L)
  const a = vec.filter((v) => v !== 0)
  const n = a.length
  if (n === 0) return false
  const mean = triangularNumber(k) / n
  for (const v of a) {
    if (Math.abs(v - mean) > 0.5 * mean) return false
  }
  return true
}

/**
 * Helper: check if n is a power of two (n > 0 and n & (n-1) === 0).
 */
function isPowerOfTwo(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0
}

/**
 * DuplePartitioned: checks whether the composition (circular IOI sequence)
 * is "duple-partitioned" in either the forward or reversed direction.
 *
 * Each direction uses the rule ported from Java OnCompositions.duplePartitioned:
 * walk the entire interval sequence, maintaining a running sum (accumulator).
 * An interval may exceed its predecessor only when the preceding sum is a power
 * of two. The sum is never reset. At least one complete direction must pass;
 * directions cannot be chosen separately at individual boundaries.
 *
 * @param onsets Array of onset positions (should be sorted and within [0, L))
 * @param L Total length of the rhythm cycle
 * @returns true if the rhythm's composition is duple-partitioned, false otherwise
 */
export function isDuplePartitioned(onsets: number[], L: number): boolean {
  const intervals = circularIntervals(onsets, L)
  return isDuplePartitionedSequence(intervals) || isDuplePartitionedSequence(intervals.reverse())
}

function isDuplePartitionedSequence(intervals: number[]): boolean {
  if (intervals.length < 2) return true

  let acc = intervals[0]
  for (let i = 1; i < intervals.length; i++) {
    if (!isPowerOfTwo(acc)) {
      if (intervals[i] > intervals[i - 1]) return false
    }
    acc += intervals[i]
  }
  return true
}
