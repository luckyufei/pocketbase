import { describe, it, expect, beforeEach } from 'bun:test'
import { render } from '@testing-library/react'
import { Provider } from 'jotai'
import { useHydrateAtoms } from 'jotai/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AutodateIcon } from './AutodateIcon'
import { collectionsAtom } from '@/store/collections'
import type { ReactNode } from 'react'

// Mock collection with autodate fields
const mockCollection = {
  id: 'col1',
  name: 'test_collection',
  type: 'base',
  fields: [
    { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
    { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
  ],
  schema: [],
  system: false,
  created: '',
  updated: '',
}

// Helper to provide jotai atoms
function HydrateAtoms({ initialValues, children }: { initialValues: any[]; children: ReactNode }) {
  useHydrateAtoms(initialValues)
  return children
}

function TestProvider({ children }: { children: ReactNode }) {
  return (
    <Provider>
      <TooltipProvider>
        <HydrateAtoms initialValues={[[collectionsAtom, [mockCollection]]]}>{children}</HydrateAtoms>
      </TooltipProvider>
    </Provider>
  )
}

describe('AutodateIcon', () => {
  it('should not render when record has no autodate values', () => {
    const record = {
      id: 'rec1',
      collectionId: 'col1',
      collectionName: 'test_collection',
    }

    const { container } = render(
      <TestProvider>
        <AutodateIcon record={record as any} />
      </TestProvider>
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render calendar icon when record has autodate values', () => {
    const record = {
      id: 'rec1',
      collectionId: 'col1',
      collectionName: 'test_collection',
      created: '2024-01-15T10:30:45.123Z',
      updated: '2024-01-16T14:20:30.456Z',
    }

    render(
      <TestProvider>
        <AutodateIcon record={record as any} />
      </TestProvider>
    )

    const icon = document.querySelector('.ri-calendar-event-line')
    expect(icon).toBeTruthy()
  })

  it('should not render when collection is not found', () => {
    const record = {
      id: 'rec1',
      collectionId: 'unknown-collection',
      collectionName: 'unknown',
      created: '2024-01-15T10:30:45.123Z',
    }

    const { container } = render(
      <TestProvider>
        <AutodateIcon record={record as any} />
      </TestProvider>
    )
    expect(container.firstChild).toBeNull()
  })
})
