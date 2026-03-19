import { describe, it, expect } from 'vitest'
import { AgentRegistry } from './index.js'

describe('AgentRegistry', () => {
  it('can be imported', () => {
    new AgentRegistry()
  })

  it('list() returns empty array initially', () => {
    expect(new AgentRegistry().list()).toEqual([])
  })

  it('register() adds an agent visible in list()', () => {
    const r = new AgentRegistry()
    r.register({ id: 'p1', type: 'producer', url: 'http://localhost:3002', address: '0xaaa' })
    expect(r.list()).toHaveLength(1)
  })

  it('recordExit() marks agent inactive and stores exit score', () => {
    const r = new AgentRegistry()
    r.register({ id: 'p1', type: 'producer', url: 'http://localhost:3002', address: '0xaaa' })
    r.recordExit('p1', '50000000')
    const agent = r.list().find(a => a.id === 'p1')!
    expect(agent.active).toBe(false)
    expect(agent.exitScore).toBe('50000000')
  })

  it('find() excludes inactive agents', () => {
    const r = new AgentRegistry()
    r.register({ id: 'p1', type: 'producer', url: 'http://localhost:3002', address: '0xaaa' })
    r.recordExit('p1', '50000000')
    expect(r.find('producer')).toHaveLength(0)
  })

  it('find() returns only agents of the requested type', () => {
    const r = new AgentRegistry()
    r.register({ id: 'p1', type: 'producer', url: 'http://localhost:3002', address: '0xaaa' })
    r.register({ id: 'proc1', type: 'processor', url: 'http://localhost:3003', address: '0xbbb' })
    expect(r.find('producer')).toHaveLength(1)
    expect(r.find('producer')[0].id).toBe('p1')
  })
})
