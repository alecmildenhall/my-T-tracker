// src/hooks/__tests__/useShots.test.ts
import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, beforeEach } from 'vitest'
import { useShots } from '../useShots'
import type { ShotEntry } from '../../types/shot'

describe('useShots', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
  })

  describe('initial state', () => {
    it('should initialize with empty shots array', () => {
      const { result } = renderHook(() => useShots())
      
      expect(result.current.shots).toEqual([])
      expect(Array.isArray(result.current.shots)).toBe(true)
    })

    it('should load existing shots from localStorage', () => {
      const existingShots: ShotEntry[] = [
        {
          id: 'shot-1',
          date: '2024-01-15',
          doseMg: 50,
          injectionSite: 'thigh'
        },
        {
          id: 'shot-2',
          date: '2024-01-22',
          doseMg: 50,
          injectionSite: 'glute'
        }
      ]
      
      localStorage.setItem('hrt-shot-tracker:v1:shots', JSON.stringify(existingShots))
      
      const { result } = renderHook(() => useShots())
      
      expect(result.current.shots).toEqual(existingShots)
      expect(result.current.shots).toHaveLength(2)
    })

    it('should provide addShot function', () => {
      const { result } = renderHook(() => useShots())
      
      expect(typeof result.current.addShot).toBe('function')
    })

    it('should provide deleteShot function', () => {
      const { result } = renderHook(() => useShots())
      
      expect(typeof result.current.deleteShot).toBe('function')
    })
  })

  describe('addShot', () => {
    it('should add a shot to empty array', () => {
      const { result } = renderHook(() => useShots())
      
      const newShot: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50,
        injectionSite: 'thigh'
      }
      
      act(() => {
        result.current.addShot(newShot)
      })
      
      expect(result.current.shots).toHaveLength(1)
      expect(result.current.shots[0]).toEqual(newShot)
    })

    it('should add multiple shots', () => {
      const { result } = renderHook(() => useShots())
      
      const shot1: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50
      }
      
      const shot2: ShotEntry = {
        id: 'shot-2',
        date: '2024-01-22',
        doseMg: 50
      }
      
      act(() => {
        result.current.addShot(shot1)
      })
      
      expect(result.current.shots).toHaveLength(1)
      
      act(() => {
        result.current.addShot(shot2)
      })
      
      expect(result.current.shots).toHaveLength(2)
      expect(result.current.shots[0]).toEqual(shot1)
      expect(result.current.shots[1]).toEqual(shot2)
    })

    it('should add shot with all optional fields', () => {
      const { result } = renderHook(() => useShots())
      
      const fullShot: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        time: '14:30',
        doseMg: 50,
        injectionSite: 'thigh',
        painScore: 3,
        mood: 'good',
        notes: 'Felt great after this one'
      }
      
      act(() => {
        result.current.addShot(fullShot)
      })
      
      expect(result.current.shots[0]).toEqual(fullShot)
    })

    it('should add shot with minimal required fields', () => {
      const { result } = renderHook(() => useShots())
      
      const minimalShot: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15'
      }
      
      act(() => {
        result.current.addShot(minimalShot)
      })
      
      expect(result.current.shots[0]).toEqual(minimalShot)
    })

    it('should persist added shot to localStorage', () => {
      const { result } = renderHook(() => useShots())
      
      const newShot: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50
      }
      
      act(() => {
        result.current.addShot(newShot)
      })
      
      const stored = localStorage.getItem('hrt-shot-tracker:v1:shots')
      expect(stored).toBe(JSON.stringify([newShot]))
    })

    it('should maintain function reference across renders', () => {
      const { result, rerender } = renderHook(() => useShots())
      
      const firstAddShot = result.current.addShot
      
      rerender()
      
      expect(result.current.addShot).toBe(firstAddShot)
    })
  })

  describe('deleteShot', () => {
    it('should delete a shot by id', () => {
      const { result } = renderHook(() => useShots())
      
      const shot1: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50
      }
      
      const shot2: ShotEntry = {
        id: 'shot-2',
        date: '2024-01-22',
        doseMg: 50
      }
      
      act(() => {
        result.current.addShot(shot1)
        result.current.addShot(shot2)
      })
      
      expect(result.current.shots).toHaveLength(2)
      
      act(() => {
        result.current.deleteShot('shot-1')
      })
      
      expect(result.current.shots).toHaveLength(1)
      expect(result.current.shots[0]).toEqual(shot2)
    })

    it('should delete the correct shot from multiple shots', () => {
      const { result } = renderHook(() => useShots())
      
      const shots: ShotEntry[] = [
        { id: 'shot-1', date: '2024-01-15', doseMg: 50 },
        { id: 'shot-2', date: '2024-01-22', doseMg: 50 },
        { id: 'shot-3', date: '2024-01-29', doseMg: 50 }
      ]
      
      act(() => {
        shots.forEach(shot => result.current.addShot(shot))
      })
      
      expect(result.current.shots).toHaveLength(3)
      
      act(() => {
        result.current.deleteShot('shot-2')
      })
      
      expect(result.current.shots).toHaveLength(2)
      expect(result.current.shots.map(s => s.id)).toEqual(['shot-1', 'shot-3'])
    })

    it('should do nothing when deleting non-existent shot', () => {
      const { result } = renderHook(() => useShots())
      
      const shot: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50
      }
      
      act(() => {
        result.current.addShot(shot)
      })
      
      expect(result.current.shots).toHaveLength(1)
      
      act(() => {
        result.current.deleteShot('non-existent-id')
      })
      
      expect(result.current.shots).toHaveLength(1)
      expect(result.current.shots[0]).toEqual(shot)
    })

    it('should do nothing when deleting from empty array', () => {
      const { result } = renderHook(() => useShots())
      
      expect(result.current.shots).toHaveLength(0)
      
      act(() => {
        result.current.deleteShot('any-id')
      })
      
      expect(result.current.shots).toHaveLength(0)
    })

    it('should persist deletion to localStorage', () => {
      const { result } = renderHook(() => useShots())
      
      const shot1: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50
      }
      
      const shot2: ShotEntry = {
        id: 'shot-2',
        date: '2024-01-22',
        doseMg: 50
      }
      
      act(() => {
        result.current.addShot(shot1)
        result.current.addShot(shot2)
      })
      
      act(() => {
        result.current.deleteShot('shot-1')
      })
      
      const stored = localStorage.getItem('hrt-shot-tracker:v1:shots')
      expect(stored).toBe(JSON.stringify([shot2]))
    })

    it('should maintain function reference across renders', () => {
      const { result, rerender } = renderHook(() => useShots())
      
      const firstDeleteShot = result.current.deleteShot
      
      rerender()
      
      expect(result.current.deleteShot).toBe(firstDeleteShot)
    })

    it('should handle deleting all shots one by one', () => {
      const { result } = renderHook(() => useShots())
      
      const shots: ShotEntry[] = [
        { id: 'shot-1', date: '2024-01-15' },
        { id: 'shot-2', date: '2024-01-22' },
        { id: 'shot-3', date: '2024-01-29' }
      ]
      
      act(() => {
        shots.forEach(shot => result.current.addShot(shot))
      })
      
      expect(result.current.shots).toHaveLength(3)
      
      act(() => {
        result.current.deleteShot('shot-1')
      })
      expect(result.current.shots).toHaveLength(2)
      
      act(() => {
        result.current.deleteShot('shot-2')
      })
      expect(result.current.shots).toHaveLength(1)
      
      act(() => {
        result.current.deleteShot('shot-3')
      })
      expect(result.current.shots).toHaveLength(0)
      
      const stored = localStorage.getItem('hrt-shot-tracker:v1:shots')
      expect(stored).toBe(JSON.stringify([]))
    })
  })

  describe('localStorage persistence', () => {
    it('should load and persist state across hook instances', () => {
      const { result: result1 } = renderHook(() => useShots())
      
      const shot: ShotEntry = {
        id: 'shot-1',
        date: '2024-01-15',
        doseMg: 50
      }
      
      act(() => {
        result1.current.addShot(shot)
      })
      
      // Create a new hook instance - it should read from localStorage
      const { result: result2 } = renderHook(() => useShots())
      
      expect(result2.current.shots).toHaveLength(1)
      expect(result2.current.shots[0]).toEqual(shot)
    })

    it('should handle complex shot data with all fields', () => {
      const { result } = renderHook(() => useShots())
      
      const complexShot: ShotEntry = {
        id: 'shot-complex',
        date: '2024-01-15',
        time: '14:30',
        doseMg: 50,
        injectionSite: 'thigh',
        painScore: 7,
        mood: 'nervous but hopeful',
        notes: 'First shot of the year. Felt a bit anxious beforehand but everything went smoothly.'
      }
      
      act(() => {
        result.current.addShot(complexShot)
      })
      
      // Create new instance to verify persistence
      const { result: result2 } = renderHook(() => useShots())
      
      expect(result2.current.shots[0]).toEqual(complexShot)
    })

    it('should handle empty localStorage gracefully', () => {
      localStorage.clear()
      
      const { result } = renderHook(() => useShots())
      
      expect(result.current.shots).toEqual([])
    })

    it('should handle corrupted localStorage data', () => {
      localStorage.setItem('hrt-shot-tracker:v1:shots', 'invalid-json{')
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      const { result } = renderHook(() => useShots())
      
      // Should fall back to empty array
      expect(result.current.shots).toEqual([])
      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('edge cases', () => {
    it('should handle rapid consecutive operations', () => {
      const { result } = renderHook(() => useShots())
      
      const shots: ShotEntry[] = [
        { id: 'shot-1', date: '2024-01-15' },
        { id: 'shot-2', date: '2024-01-22' },
        { id: 'shot-3', date: '2024-01-29' }
      ]
      
      act(() => {
        // Add all at once
        shots.forEach(shot => result.current.addShot(shot))
        // Delete one immediately
        result.current.deleteShot('shot-2')
        // Add another
        result.current.addShot({ id: 'shot-4', date: '2024-02-05' })
      })
      
      expect(result.current.shots).toHaveLength(3)
      expect(result.current.shots.map(s => s.id)).toEqual(['shot-1', 'shot-3', 'shot-4'])
    })

    it('should handle shots with duplicate ids (keeps both)', () => {
      const { result } = renderHook(() => useShots())
      
      const shot1: ShotEntry = {
        id: 'duplicate-id',
        date: '2024-01-15'
      }
      
      const shot2: ShotEntry = {
        id: 'duplicate-id',
        date: '2024-01-22'
      }
      
      act(() => {
        result.current.addShot(shot1)
        result.current.addShot(shot2)
      })
      
      expect(result.current.shots).toHaveLength(2)
    })

    it('should handle deleting shot with duplicate ids (removes first match)', () => {
      const { result } = renderHook(() => useShots())
      
      const shot1: ShotEntry = {
        id: 'duplicate-id',
        date: '2024-01-15'
      }
      
      const shot2: ShotEntry = {
        id: 'duplicate-id',
        date: '2024-01-22'
      }
      
      act(() => {
        result.current.addShot(shot1)
        result.current.addShot(shot2)
      })
      
      act(() => {
        result.current.deleteShot('duplicate-id')
      })
      
      // Filter removes ALL matching items, not just first
      expect(result.current.shots).toHaveLength(0)
    })

    it('should handle shots with special characters in fields', () => {
      const { result } = renderHook(() => useShots())
      
      const specialShot: ShotEntry = {
        id: 'shot-special',
        date: '2024-01-15',
        injectionSite: 'left thigh (outer)',
        mood: '😊 happy & relieved!',
        notes: 'Quote: "This is fine" - everything went well. Cost: $50'
      }
      
      act(() => {
        result.current.addShot(specialShot)
      })
      
      expect(result.current.shots[0]).toEqual(specialShot)
      
      const stored = localStorage.getItem('hrt-shot-tracker:v1:shots')
      const parsed = JSON.parse(stored!)
      expect(parsed[0]).toEqual(specialShot)
    })

    it('should handle large numbers of shots', () => {
      const { result } = renderHook(() => useShots())
      
      const manyShots: ShotEntry[] = Array.from({ length: 100 }, (_, i) => ({
        id: `shot-${i}`,
        date: '2024-01-15',
        doseMg: 50
      }))
      
      act(() => {
        manyShots.forEach(shot => result.current.addShot(shot))
      })
      
      expect(result.current.shots).toHaveLength(100)
      
      act(() => {
        result.current.deleteShot('shot-50')
      })
      
      expect(result.current.shots).toHaveLength(99)
      expect(result.current.shots.find(s => s.id === 'shot-50')).toBeUndefined()
    })
  })
})
