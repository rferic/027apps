import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IdeaList, type IdeaItemData } from './idea-list'

const items: IdeaItemData[] = [
  { id: '1', title: 'New feature', type: 'feature', votes: 5, comments: 3 },
  { id: '2', title: 'New app', type: 'new_app', votes: 10, comments: 7 },
]

describe('IdeaList', () => {
  it('renders title', () => {
    render(<IdeaList items={items} title="Ideas" />)
    expect(screen.getByText('Ideas')).toBeDefined()
  })

  it('renders idea items', () => {
    render(<IdeaList items={items} />)
    expect(screen.getByText('New feature')).toBeDefined()
    expect(screen.getByText('New app')).toBeDefined()
  })

  it('shows total votes badge', () => {
    render(<IdeaList items={items} />)
    expect(screen.getByText('15 votos')).toBeDefined()
  })

  it('shows view all link when onViewAll provided', () => {
    render(<IdeaList items={items} onViewAll={() => {}} />)
    expect(screen.getByText('Ver todas →')).toBeDefined()
  })
})
