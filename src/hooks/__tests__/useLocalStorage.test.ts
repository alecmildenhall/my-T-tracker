// src/hooks/__tests__/useLocalStorage.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useLocalStorage } from '../useLocalStorage'

describe('useLocalStorage', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Clear any mocked functions
    vi.clearAllMocks()
  })

  describe('initial value behavior', () => {
    // Tests that hook returns a static value when localStorage is empty
    it('should use static initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
      
      expect(result.current[0]).toBe('default-value')
    })

    // Tests that hook calls initializer function when localStorage is empty
    it('should use function initial value when localStorage is empty', () => {
      const initialValueFn = vi.fn(() => 'computed-value')
      const { result } = renderHook(() => useLocalStorage('test-key', initialValueFn))
      
      expect(result.current[0]).toBe('computed-value')
      // Called at least once — StrictMode deliberately invokes lazy initializers
      // twice in development to prove they're pure, so pinning an exact count
      // would assert React's internals rather than this hook's behaviour.
      expect(initialValueFn).toHaveBeenCalled()
    })

    // Tests that initializer function is NOT called when stored value exists
    it('should not call initializer function when localStorage has value', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'))
      const initialValueFn = vi.fn(() => 'computed-value')
      
      const { result } = renderHook(() => useLocalStorage('test-key', initialValueFn))
      
      expect(result.current[0]).toBe('stored-value')
      expect(initialValueFn).not.toHaveBeenCalled()
    })

    // Tests that hook correctly initializes with complex object values
    it('should handle objects as initial values', () => {
      const initialValue = { name: 'test', count: 42 }
      const { result } = renderHook(() => useLocalStorage('test-key', initialValue))
      
      expect(result.current[0]).toEqual(initialValue)
    })
  })

  describe('reading from localStorage', () => {
    // Tests that hook retrieves previously stored values from localStorage
    it('should read existing value from localStorage', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'))
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
      
      expect(result.current[0]).toBe('stored-value')
    })

    // Tests that hook correctly deserializes nested objects from localStorage
    it('should read complex objects from localStorage', () => {
      const storedValue = { id: '123', name: 'test', nested: { value: 42 } }
      localStorage.setItem('test-key', JSON.stringify(storedValue))
      
      const { result } = renderHook(() => useLocalStorage('test-key', {}))
      
      expect(result.current[0]).toEqual(storedValue)
    })

    // Tests error handling when localStorage contains malformed JSON data
    it('should use initial value when localStorage contains invalid JSON', () => {
      localStorage.setItem('test-key', 'invalid-json{')
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
      
      expect(result.current[0]).toBe('default-value')
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('writing to localStorage', () => {
    // Tests that hook persists initial value to localStorage on mount
    it('does not seed an untouched store on mount', () => {
      // Deliberately no write. Seeding is a write nobody asked for, and on a
      // brand-new install in private browsing it threw — greeting a first-time
      // user with "Your changes aren't being saved" before they had made any.
      // An absent key already reads back as the initial value, so nothing is lost.
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'))

      expect(localStorage.getItem('test-key')).toBeNull()
      expect(result.current[0]).toBe('initial-value')
    })

    it('writes as soon as the value is actually changed', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'))
      act(() => {
        result.current[1]('initial-value-changed')
      })
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify('initial-value-changed'))
    })

    // Tests that hook syncs state changes to localStorage
    it('should update localStorage when value changes', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'))
      
      act(() => {
        result.current[1]('updated-value')
      })
      
      const stored = localStorage.getItem('test-key')
      expect(stored).toBe(JSON.stringify('updated-value'))
      expect(result.current[0]).toBe('updated-value')
    })

    // Tests that hook correctly serializes objects when writing to localStorage
    it('should write complex objects to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage<{ name: string; count: number }>('test-key', { name: 'test', count: 0 }))
      
      act(() => {
        result.current[1]({ name: 'updated', count: 42 })
      })
      
      const stored = localStorage.getItem('test-key')
      expect(stored).toBe(JSON.stringify({ name: 'updated', count: 42 }))
    })

    // Tests error handling when localStorage.setItem throws
    it('should handle write errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))
      
      act(() => {
        result.current[1]('updated')
      })
      
      expect(result.current[0]).toBe('updated')
      expect(consoleSpy).toHaveBeenCalledWith(
        '[useLocalStorage] Failed to write to localStorage:',
        expect.any(Error)
      )
      
      setItemSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })

  describe('storage that cannot even be read', () => {
    // Safari with "Block all cookies", Firefox with dom.storage disabled, or a
    // partitioned iframe: touching localStorage THROWS rather than returning
    // null. An unguarded probe in the write effect throws from a passive effect
    // on first render, which the ErrorBoundary answers by replacing the whole
    // app — where this used to degrade quietly to in-memory-only.
    it('degrades to in-memory instead of throwing out of the effect', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      const getSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('SecurityError')
      })
      const setSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('SecurityError')
      })

      const { result } = renderHook(() => useLocalStorage('test-key', 'initial'))

      expect(result.current[0]).toBe('initial')
      act(() => {
        result.current[1]('updated')
      })
      expect(result.current[0]).toBe('updated')

      // This file clears mocks between tests but does not RESTORE them, so a
      // leaked Storage spy would break every later test in the suite.
      getSpy.mockRestore()
      setSpy.mockRestore()
    })
  })

  describe('updating value', () => {
    // Tests that setter function updates state correctly
    it('should update value using setter function', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 10))
      
      expect(result.current[0]).toBe(10)
      
      act(() => {
        result.current[1](20)
      })
      
      expect(result.current[0]).toBe(20)
    })

    // Tests that hook handles sequential state updates correctly
    it('should update value multiple times', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 0))
      
      act(() => {
        result.current[1](1)
      })
      expect(result.current[0]).toBe(1)
      
      act(() => {
        result.current[1](2)
      })
      expect(result.current[0]).toBe(2)
      
      act(() => {
        result.current[1](3)
      })
      expect(result.current[0]).toBe(3)
    })

    // Tests that functional updater pattern persists correctly to localStorage
    it('should support functional updater pattern', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 10))
      
      act(() => {
        result.current[1]((prev) => prev + 5)
      })
      
      expect(result.current[0]).toBe(15)
      
      const stored = localStorage.getItem('test-key')
      expect(stored).toBe(JSON.stringify(15))
      
      act(() => {
        result.current[1]((prev) => prev * 2)
      })
      
      expect(result.current[0]).toBe(30)
      expect(localStorage.getItem('test-key')).toBe(JSON.stringify(30))
    })
  })

  describe('localStorage sync across hook instances', () => {
    // Tests that new hook instances read updated values from localStorage
    it('should share state between multiple hook instances with same key', () => {
      const { result: result1 } = renderHook(() => useLocalStorage('shared-key', 'initial'))
      const { result: result2 } = renderHook(() => useLocalStorage('shared-key', 'initial'))
      
      // Second instance should read the value written by first instance
      expect(result2.current[0]).toBe('initial')
      
      // Update in first instance
      act(() => {
        result1.current[1]('updated')
      })
      
      // Both should have updated state
      expect(result1.current[0]).toBe('updated')
      
      // Create new instance after update
      const { result: result3 } = renderHook(() => useLocalStorage('shared-key', 'default'))
      
      // New instance should read updated value from localStorage
      expect(result3.current[0]).toBe('updated')
    })

    // Tests that different keys maintain independent state in localStorage
    it('should keep different keys independent', () => {
      const { result: result1 } = renderHook(() => useLocalStorage('key1', 'value1'))
      const { result: result2 } = renderHook(() => useLocalStorage('key2', 'value2'))
      
      expect(result1.current[0]).toBe('value1')
      expect(result2.current[0]).toBe('value2')
      
      act(() => {
        result1.current[1]('updated1')
      })
      
      expect(result1.current[0]).toBe('updated1')
      expect(result2.current[0]).toBe('value2')
    })
  })

  describe('key-change behavior', () => {
    // Tests that changing the key writes to the new localStorage key
    it('should write to new key when key prop changes', () => {
      const { result, rerender } = renderHook(
        ({ storageKey }) => useLocalStorage(storageKey, 'default'),
        { initialProps: { storageKey: 'key-a' } }
      )
      
      expect(result.current[0]).toBe('default')
      
      act(() => {
        result.current[1]('value-a')
      })
      
      expect(localStorage.getItem('key-a')).toBe(JSON.stringify('value-a'))
      
      // Change the key - note: the hook maintains its internal state but writes to new key
      rerender({ storageKey: 'key-b' })
      
      // Value persists in state (not re-read from localStorage)
      expect(result.current[0]).toBe('value-a')
      
      // But updates now go to the new key
      act(() => {
        result.current[1]('value-b')
      })
      
      expect(localStorage.getItem('key-b')).toBe(JSON.stringify('value-b'))
      expect(localStorage.getItem('key-a')).toBe(JSON.stringify('value-a'))
    })
  })

  describe('cross-tab sync (storage event)', () => {
    it('updates state when another tab changes the same key', () => {
      const { result } = renderHook(() => useLocalStorage('shared', 'a'))

      act(() => {
        // Simulate another tab writing, then broadcasting the storage event.
        localStorage.setItem('shared', JSON.stringify('from-other-tab'))
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'shared',
            newValue: JSON.stringify('from-other-tab'),
            storageArea: localStorage,
          })
        )
      })

      expect(result.current[0]).toBe('from-other-tab')
    })

    it('resets to the initial value when the key is removed in another tab', () => {
      localStorage.setItem('shared', JSON.stringify('x'))
      const { result } = renderHook(() => useLocalStorage('shared', 'fallback'))
      expect(result.current[0]).toBe('x')

      act(() => {
        localStorage.removeItem('shared')
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'shared',
            newValue: null,
            storageArea: localStorage,
          })
        )
      })

      expect(result.current[0]).toBe('fallback')
    })

    it('ignores storage events for other keys', () => {
      const { result } = renderHook(() => useLocalStorage('mine', 'keep'))

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'someone-else',
            newValue: JSON.stringify('nope'),
            storageArea: localStorage,
          })
        )
      })

      expect(result.current[0]).toBe('keep')
    })

    it('runs sanitize on a value synced from another tab', () => {
      const sanitize = (raw: unknown): number[] =>
        Array.isArray(raw) ? raw.filter((n): n is number => typeof n === 'number') : []
      const { result } = renderHook(() =>
        useLocalStorage<number[]>('nums', [], { sanitize })
      )

      act(() => {
        window.dispatchEvent(
          new StorageEvent('storage', {
            key: 'nums',
            newValue: JSON.stringify([1, 'x', 2]),
            storageArea: localStorage,
          })
        )
      })

      expect(result.current[0]).toEqual([1, 2])
    })
  })

  describe('sanitize option', () => {
    it('normalizes a malformed stored value on read', () => {
      localStorage.setItem('cfg', JSON.stringify('not-an-array'))
      const sanitize = (raw: unknown): string[] => (Array.isArray(raw) ? raw : [])
      const { result } = renderHook(() =>
        useLocalStorage<string[]>('cfg', [], { sanitize })
      )
      expect(result.current[0]).toEqual([])
    })

    it('passes a valid stored value through sanitize unchanged', () => {
      localStorage.setItem('cfg', JSON.stringify(['a', 'b']))
      const sanitize = (raw: unknown): string[] => (Array.isArray(raw) ? raw : [])
      const { result } = renderHook(() =>
        useLocalStorage<string[]>('cfg', [], { sanitize })
      )
      expect(result.current[0]).toEqual(['a', 'b'])
    })
  })
})
