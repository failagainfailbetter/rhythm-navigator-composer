import { describe, expect, it } from 'vitest'
import { registerMcpTools } from './mcp'

type RegisteredTool = {
  name: string
  description: string
  schema: unknown
  handler: (params: any) => Promise<{ content: Array<{ type: 'text'; text: string }>; isError?: boolean }>
}

function createRegistrar(tools: RegisteredTool[]) {
  return {
    tool(name: string, description: string, schema: unknown, handler: RegisteredTool['handler']) {
      tools.push({ name, description, schema, handler })
    }
  }
}

describe('registerMcpTools', () => {
  it('lists the new structural predicates', async () => {
    const tools: RegisteredTool[] = []
    registerMcpTools(createRegistrar(tools) as any)
    const response = await tools.find(tool => tool.name === 'list_predicates')!.handler({})
    const { predicates } = JSON.parse(response.content[0].text)
    expect(predicates).toEqual(expect.arrayContaining([
      { id: 'erdosDeep', label: 'Erdős-deep' },
      { id: 'winogradDeep', label: 'Winograd-deep' },
      { id: 'reflectionSymmetric', label: 'Reflection-symmetric' },
      { id: 'primitive', label: 'Primitive (non-repeating)' },
      { id: 'metricalConflict', label: 'Metrical alignment conflict' },
      { id: 'sharedOmission', label: 'Shared missing beat' },
    ]))
  })

  it.each([
    ['erdosDeep', '111000', '101010'],
    ['winogradDeep', '111010', '101010'],
    ['reflectionSymmetric', '111000', '110100'],
    ['primitive', '110100', '101010'],
    ['maximallyEven', '101010', '110100'],
    ['metricalConflict', '10010010', '10101010'],
    ['sharedOmission', '11110000', '11100100'],
  ])('filters enumerated rhythms with %s', async (id, accepted, rejected) => {
    const tools: RegisteredTool[] = []
    registerMcpTools(createRegistrar(tools) as any)
    const response = await tools.find(tool => tool.name === 'enumerate_rhythms')!.handler({
      mode: 'binary', numerator: accepted.length, denominator: 1,
      maxResults: 0, predicates: [id], retentionProbability: 100,
    })
    const payload = JSON.parse(response.content[0].text)
    const patterns = payload.items.map((item: { pattern: string }) => item.pattern.replace(/\s/g, ''))
    expect(patterns).toContain(accepted)
    expect(patterns).not.toContain(rejected)
  })

  it('registers the matrix generation tool', () => {
    const tools: RegisteredTool[] = []

    registerMcpTools(createRegistrar(tools) as any)

    expect(tools.some(tool => tool.name === 'generate_rhythm_matrix')).toBe(true)
  })

  it('returns matrix results in the MCP response payload', async () => {
    const tools: RegisteredTool[] = []

    registerMcpTools(createRegistrar(tools) as any)

    const matrixTool = tools.find(tool => tool.name === 'generate_rhythm_matrix')
    expect(matrixTool).toBeDefined()

    const response = await matrixTool!.handler({
      mode: 'binary',
      numerator: 2,
      denominator: 1,
      rowCount: 1,
      columnCount: 2,
      maxResults: 1,
      maxAttempts: 1000,
      maxCellRetries: 50,
      predicates: []
    })

    const payload = JSON.parse(response.content[0].text)

    expect(payload.method).toBe('matrix')
    expect(payload.count).toBe(payload.matrices.length)
    expect(payload.controls.rowCount).toBe(1)
    expect(payload.controls.columnCount).toBe(2)
    expect(Array.isArray(payload.matrices)).toBe(true)
  })

  it('returns powered rhythm embedding from generated sequence positions', async () => {
    const tools: RegisteredTool[] = []

    registerMcpTools(createRegistrar(tools) as any)

    const sequenceTool = tools.find(tool => tool.name === 'generate_rhythm_sequence')
    expect(sequenceTool).toBeDefined()

    const response = await sequenceTool!.handler({
      mode: 'hex',
      pattern: '8 8 8 0',
      numerator: 4,
      denominator: 1,
      min: -3,
      max: 3,
      maxAmplitude: 0,
      repeatCount: 1,
    })

    const payload = JSON.parse(response.content[0].text)
    const expected = new Array(16).fill(0)
    const onsetIndices = [0, 4, 8]
    for (let i = 0; i < onsetIndices.length; i++) {
      const k = payload.positions[i]
      expected[onsetIndices[i]] = k < 0 ? -(2 ** (-k)) : 2 ** k
    }

    expect(payload.method).toBe('rhythm_sequence')
    expect(payload.positions).toHaveLength(3)
    expect(payload.poweredRhythm).toEqual(expected)
  })
})
