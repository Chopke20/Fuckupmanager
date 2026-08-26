import { describe, it, expect } from 'vitest'
import { detectProposalConceptCategory, generateProposalConceptFacts, suggestProposalConcept } from './proposalConcept'
import type { ProposalScopeGroup } from './proposalScope'

function makeGroup(overrides: Partial<ProposalScopeGroup>): ProposalScopeGroup {
  return {
    id: 'g1',
    title: 'Blok',
    itemNames: [],
    equipmentDetails: [],
    productionDetails: [],
    equipmentNet: 0,
    productionNet: 0,
    transportNet: 0,
    ...overrides,
  }
}

describe('proposalConcept', () => {
  it('detects category from block title', () => {
    expect(detectProposalConceptCategory(makeGroup({ title: 'Nagłośnienie sceny głównej' }))).toBe('AUDIO')
    expect(detectProposalConceptCategory(makeGroup({ title: 'Oświetlenie sceniczne' }))).toBe('LIGHT')
    expect(detectProposalConceptCategory(makeGroup({ title: 'Budowa sceny' }))).toBe('STAGE')
    expect(detectProposalConceptCategory(makeGroup({ title: 'Coś zupełnie innego' }))).toBe('GENERIC')
  })

  it('falls back to equipment category when title does not match', () => {
    const group = makeGroup({
      title: 'Pakiet startowy',
      equipmentDetails: [
        { name: 'Kolumna X', quantity: 4, category: 'Nagłośnienie' },
        { name: 'Statyw', quantity: 2, category: 'Akcesoria' },
      ],
    })
    expect(detectProposalConceptCategory(group)).toBe('AUDIO')
  })

  it('sums quantities across matching item names into facts, never inventing numbers', () => {
    const group = makeGroup({
      title: 'Nagłośnienie',
      equipmentDetails: [
        { name: 'Mikrofon bezprzewodowy A', quantity: 4, category: 'Nagłośnienie' },
        { name: 'Mikrofon przewodowy B', quantity: 2, category: 'Nagłośnienie' },
        { name: 'Kolumna line array', quantity: 8, category: 'Nagłośnienie' },
      ],
    })
    const facts = generateProposalConceptFacts('AUDIO', group)
    expect(facts).toContain('6 mikrofonów')
    expect(facts.some((f) => f.includes('8') && f.includes('kolumn'))).toBe(true)
  })

  it('never returns an empty fact list even for unmatched generic content', () => {
    const group = makeGroup({
      title: 'Coś innego',
      equipmentDetails: [{ name: 'Dziwna pozycja', quantity: 3, category: null }],
    })
    const facts = generateProposalConceptFacts('GENERIC', group)
    expect(facts.length).toBeGreaterThan(0)
    expect(facts[0]).toContain('Dziwna pozycja')
  })

  it('suggestProposalConcept keeps the operator-authored block title and fills facts/benefit', () => {
    const group = makeGroup({
      id: 'block-1',
      title: 'Nagłośnienie sceny głównej',
      equipmentDetails: [{ name: 'Mikrofon', quantity: 6, category: 'Nagłośnienie' }],
    })
    const suggestion = suggestProposalConcept(group)
    expect(suggestion.groupId).toBe('block-1')
    expect(suggestion.title).toBe('Nagłośnienie sceny głównej')
    expect(suggestion.facts.length).toBeGreaterThan(0)
    expect(suggestion.benefit.length).toBeGreaterThan(0)
  })
})
