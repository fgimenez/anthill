import { describe, it, expect } from 'vitest'
import { getRandomPrompt } from './prompts.js'

describe('getRandomPrompt', () => {
  it('returns a non-empty string for producer', () => {
    expect(getRandomPrompt('producer').length).toBeGreaterThan(0)
  })

  it('returns a non-empty string for all archetypes', () => {
    for (const type of ['producer', 'processor', 'trader', 'speculator'] as const) {
      expect(getRandomPrompt(type).length).toBeGreaterThan(0)
    }
  })

  it('returns different strategies across calls (probabilistic)', () => {
    const results = new Set(Array.from({ length: 20 }, () => getRandomPrompt('producer')))
    expect(results.size).toBeGreaterThan(1)
  })
})
