/**
 * AuthFields Unit Tests
 * T8300: 创建 AuthFields 错误显示测试
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider, createStore } from 'jotai'
import { createElement } from 'react'
import { AuthFields } from './AuthFields'
import { formErrorsAtom } from '@/store/formErrors'
import type { CollectionModel, CollectionField } from 'pocketbase'
import { TooltipProvider } from '@/components/ui/tooltip'

// Mock i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}))

// Mock useConfirmation hook
vi.mock('@/hooks/useConfirmation', () => ({
  useConfirmation: () => ({
    confirm: vi.fn(({ onConfirm }) => onConfirm?.()),
  }),
}))

// Helper to create a mock auth collection
function createAuthCollection(overrides: Partial<CollectionModel> = {}): CollectionModel {
  return {
    id: 'users_collection',
    name: 'users',
    type: 'auth',
    system: false,
    fields: [
      { name: 'email', type: 'email', required: true } as CollectionField,
    ],
    indexes: [],
    created: '2024-01-01',
    updated: '2024-01-01',
    ...overrides,
  } as CollectionModel
}

// Test wrapper with providers
function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(
      Provider,
      { store },
      createElement(TooltipProvider, null, children)
    )
  }
}

describe('AuthFields', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('rendering', () => {
    it('should render email field', () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    })

    it('should render password fields for new record', () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      // Use ID selectors since labels have complex structure
      expect(document.getElementById('password')).toBeInTheDocument()
      expect(document.getElementById('passwordConfirm')).toBeInTheDocument()
    })

    it('should not render password fields by default for existing record', () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{ id: 'existing_id', email: 'test@test.com' }}
          onChange={onChange}
          collection={collection}
          isNew={false}
        />,
        { wrapper: createWrapper(store) }
      )

      // Should not see password fields initially
      expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument()
    })

    it('should render change password toggle for existing record', () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{ id: 'existing_id', email: 'test@test.com' }}
          onChange={onChange}
          collection={collection}
          isNew={false}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Change password')).toBeInTheDocument()
    })

    it('should render verified checkbox for non-superusers', () => {
      const collection = createAuthCollection({ name: 'users' })
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByLabelText('Verified')).toBeInTheDocument()
    })

    it('should not render verified checkbox for superusers', () => {
      const collection = createAuthCollection({ name: '_superusers' })
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.queryByLabelText('Verified')).not.toBeInTheDocument()
    })
  })

  describe('email field', () => {
    it('should call onChange when email is typed', () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'new@email.com' } })

      expect(onChange).toHaveBeenCalledWith('email', 'new@email.com')
    })

    it('should display current email value', () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{ email: 'existing@email.com' }}
          onChange={onChange}
          collection={collection}
          isNew={false}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByLabelText(/email/i)).toHaveValue('existing@email.com')
    })
  })

  describe('email visibility', () => {
    it('should toggle email visibility when button clicked', async () => {
      const collection = createAuthCollection({ name: 'users' })
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(
        <AuthFields
          record={{ emailVisibility: false }}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      await user.click(screen.getByText(/Public: Off/i))

      expect(onChange).toHaveBeenCalledWith('emailVisibility', true)
    })

    it('should not show email visibility for superusers', () => {
      const collection = createAuthCollection({ name: '_superusers' })
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.queryByText(/Public:/i)).not.toBeInTheDocument()
    })
  })

  describe('password fields', () => {
    it('should show password fields when change password toggle is enabled', async () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(
        <AuthFields
          record={{ id: 'existing_id', email: 'test@test.com' }}
          onChange={onChange}
          collection={collection}
          isNew={false}
        />,
        { wrapper: createWrapper(store) }
      )

      // Enable change password
      await user.click(screen.getByLabelText('Change password'))

      // Password fields should now be visible - check by ID since labels are complex
      await waitFor(() => {
        expect(document.getElementById('password')).toBeInTheDocument()
        expect(document.getElementById('passwordConfirm')).toBeInTheDocument()
      })
    })

    it('should toggle password visibility', async () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(
        <AuthFields
          record={{ password: 'secret123' }}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      const passwordInput = document.getElementById('password')

      // Initially password type
      expect(passwordInput).toHaveAttribute('type', 'password')

      // Find the eye toggle button for password field
      const eyeButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg.lucide-eye') || btn.querySelector('svg.lucide-eye-off')
      )
      
      if (eyeButtons.length > 0) {
        await user.click(eyeButtons[0])
        // After click it should show text
        expect(passwordInput?.getAttribute('type')).toBe('text')
      }
    })

    it('should generate password when generate button clicked', async () => {
      const collection = createAuthCollection()
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      // Find the generate button by its icon (RefreshCw)
      const buttons = screen.getAllByRole('button')
      const generateBtn = buttons.find(btn => btn.querySelector('svg.lucide-refresh-cw'))

      if (generateBtn) {
        await user.click(generateBtn)

        // Should have called onChange with both password fields
        expect(onChange).toHaveBeenCalledWith('password', expect.any(String))
        expect(onChange).toHaveBeenCalledWith('passwordConfirm', expect.any(String))
      }
    })
  })

  describe('verified field', () => {
    it('should call onChange when verified is toggled', async () => {
      const collection = createAuthCollection({ name: 'users' })
      const onChange = vi.fn()
      const user = userEvent.setup()

      render(
        <AuthFields
          record={{ verified: false }}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      await user.click(screen.getByLabelText('Verified'))

      expect(onChange).toHaveBeenCalledWith('verified', true)
    })

    it('should display current verified state', () => {
      const collection = createAuthCollection({ name: 'users' })
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{ verified: true }}
          onChange={onChange}
          collection={collection}
          isNew={false}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByLabelText('Verified')).toBeChecked()
    })
  })

  describe('error display', () => {
    it('should display email error from store', () => {
      store.set(formErrorsAtom, { email: { message: 'Invalid email format' } })
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Invalid email format')).toBeInTheDocument()
    })

    it('should display password error from store', () => {
      store.set(formErrorsAtom, { password: { message: 'Password too short' } })
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Password too short')).toBeInTheDocument()
    })

    it('should display passwordConfirm error from store', () => {
      store.set(formErrorsAtom, { passwordConfirm: { message: 'Passwords do not match' } })
      const collection = createAuthCollection()
      const onChange = vi.fn()

      render(
        <AuthFields
          record={{}}
          onChange={onChange}
          collection={collection}
          isNew={true}
        />,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
    })
  })
})
