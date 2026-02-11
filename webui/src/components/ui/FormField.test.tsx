/**
 * FormField Unit Tests
 * T8200: 创建 FormField 包装测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Provider, createStore } from 'jotai'
import { createElement } from 'react'
import { FormField } from './FormField'
import { formErrorsAtom, setFormErrorsAtom } from '@/store/formErrors'

// Helper to create test wrapper with Jotai store
function createWrapper(store: ReturnType<typeof createStore>) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(Provider, { store }, children)
  }
}

describe('FormField', () => {
  let store: ReturnType<typeof createStore>

  beforeEach(() => {
    store = createStore()
  })

  describe('rendering', () => {
    it('should render children', () => {
      render(
        <FormField name="test">
          <input data-testid="test-input" />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByTestId('test-input')).toBeInTheDocument()
    })

    it('should render label when provided', () => {
      render(
        <FormField name="test" label="Test Label">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Test Label')).toBeInTheDocument()
    })

    it('should show required indicator when required', () => {
      render(
        <FormField name="test" label="Test Label" required>
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('*')).toBeInTheDocument()
    })

    it('should render hint text when provided and no error', () => {
      render(
        <FormField name="test" hint="This is a hint">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('This is a hint')).toBeInTheDocument()
    })
  })

  describe('error display', () => {
    it('should display error message from store', () => {
      store.set(formErrorsAtom, { test: { message: 'Field is required' } })

      render(
        <FormField name="test">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Field is required')).toBeInTheDocument()
    })

    it('should display string error directly', () => {
      store.set(formErrorsAtom, { test: 'Invalid value' })

      render(
        <FormField name="test">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Invalid value')).toBeInTheDocument()
    })

    it('should hide hint when error is present', () => {
      store.set(formErrorsAtom, { test: 'Error message' })

      render(
        <FormField name="test" hint="This is a hint">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.queryByText('This is a hint')).not.toBeInTheDocument()
      expect(screen.getByText('Error message')).toBeInTheDocument()
    })

    it('should apply error class to container', () => {
      store.set(formErrorsAtom, { test: 'Error' })

      render(
        <FormField name="test" className="custom-class">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      const container = screen.getByText('Error').closest('.form-field')
      expect(container).toHaveClass('error')
    })
  })

  describe('nested error paths', () => {
    it('should display error for nested path', () => {
      store.set(formErrorsAtom, {
        fields: {
          0: {
            name: { message: 'Name is required' }
          }
        }
      })

      render(
        <FormField name="fields.0.name">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })
  })

  describe('error clearing', () => {
    it('should clear error on input change', () => {
      store.set(formErrorsAtom, { test: 'Error message' })
      const onChange = vi.fn()

      render(
        <FormField name="test">
          <input data-testid="test-input" onChange={onChange} />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      // Error should be visible initially
      expect(screen.getByText('Error message')).toBeInTheDocument()

      // Trigger change
      fireEvent.change(screen.getByTestId('test-input'), { target: { value: 'new value' } })

      // Original onChange should be called
      expect(onChange).toHaveBeenCalled()

      // Error should be cleared
      expect(store.get(formErrorsAtom).test).toBeUndefined()
    })

    it('should call original onChange handler', () => {
      const onChange = vi.fn()

      render(
        <FormField name="test">
          <input data-testid="test-input" onChange={onChange} />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      fireEvent.change(screen.getByTestId('test-input'), { target: { value: 'new value' } })

      expect(onChange).toHaveBeenCalled()
    })
  })

  describe('styling', () => {
    it('should apply custom className', () => {
      render(
        <FormField name="test" className="custom-class">
          <input />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      const container = document.querySelector('.form-field')
      expect(container).toHaveClass('custom-class')
    })

    it('should apply error styles to input when error present', () => {
      store.set(formErrorsAtom, { test: 'Error' })

      render(
        <FormField name="test">
          <input data-testid="test-input" className="original-class" />
        </FormField>,
        { wrapper: createWrapper(store) }
      )

      const input = screen.getByTestId('test-input')
      expect(input).toHaveClass('border-destructive')
    })
  })
})
