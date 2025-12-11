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
    it('should use static initial value when localStorage is empty', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
      
      expect(result.current[0]).toBe('default-value')
    })

    it('should use function initial value when localStorage is empty', () => {
      const initialValueFn = vi.fn(() => 'computed-value')
      const { result } = renderHook(() => useLocalStorage('test-key', initialValueFn))
      
      expect(result.current[0]).toBe('computed-value')
      expect(initialValueFn).toHaveBeenCalledOnce()
    })

    it('should handle objects as initial values', () => {
      const initialValue = { name: 'test', count: 42 }
      const { result } = renderHook(() => useLocalStorage('test-key', initialValue))
      
      expect(result.current[0]).toEqual(initialValue)
    })
  })

  describe('reading from localStorage', () => {
    it('should read existing value from localStorage', () => {
      localStorage.setItem('test-key', JSON.stringify('stored-value'))
      
      const { result } = renderHook(() => useLocalStorage('test-key', 'default-value'))
      
      expect(result.current[0]).toBe('stored-value')
    })

    it('should read complex objects from localStorage', () => {
      const storedValue = { id: '123', name: 'test', nested: { value: 42 } }
      localStorage.setItem('test-key', JSON.stringify(storedValue))
      
      const { result } = renderHook(() => useLocalStorage('test-key', {}))
      
      expect(result.current[0]).toEqual(storedValue)
    })

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
    it('should write initial value to localStorage', () => {
      renderHook(() => useLocalStorage('test-key', 'initial-value'))
      
      const stored = localStorage.getItem('test-key')
      expect(stored).toBe(JSON.stringify('initial-value'))
    })

    it('should update localStorage when value changes', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 'initial-value'))
      
      act(() => {
        result.current[1]('updated-value')
      })
      
      const stored = localStorage.getItem('test-key')
      expect(stored).toBe(JSON.stringify('updated-value'))
      expect(result.current[0]).toBe('updated-value')
    })

    it('should write complex objects to localStorage', () => {
      const { result } = renderHook(() => useLocalStorage<{ name: string; count: number }>('test-key', { name: 'test', count: 0 }))
      
      act(() => {
        result.current[1]({ name: 'updated', count: 42 })
      })
      
      const stored = localStorage.getItem('test-key')
      expect(stored).toBe(JSON.stringify({ name: 'updated', count: 42 }))
    })
  })

  describe('updating value', () => {
    it('should update value using setter function', () => {
      const { result } = renderHook(() => useLocalStorage('test-key', 10))
      
      expect(result.current[0]).toBe(10)
      
      act(() => {
        result.current[1](20)
      })
      
      expect(result.current[0]).toBe(20)
    })

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
  })

  describe('localStorage sync across hook instances', () => {
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
})
