// src/types/__tests__/shot.test.ts
import { describe, it, expect } from 'vitest'
import type { ShotEntry } from '../shot'

describe('ShotEntry type', () => {
  describe('required fields', () => {
    it('should accept valid ShotEntry with required fields only', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
      }
      
      expect(shot.id).toBe('abc123')
      expect(shot.date).toBe('2025-12-11')
    })

    it('should have string type for id field', () => {
      const shot: ShotEntry = {
        id: 'test-id-123',
        date: '2025-01-01',
      }
      
      expect(typeof shot.id).toBe('string')
    })

    it('should have string type for date field', () => {
      const shot: ShotEntry = {
        id: 'test-id',
        date: '2025-12-11',
      }
      
      expect(typeof shot.date).toBe('string')
    })
  })

  describe('optional fields', () => {
    it('should accept ShotEntry with time field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
      }
      
      expect(shot.time).toBe('14:30')
      expect(typeof shot.time).toBe('string')
    })

    it('should accept ShotEntry with doseMg field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        doseMg: 5.5,
      }
      
      expect(shot.doseMg).toBe(5.5)
      expect(typeof shot.doseMg).toBe('number')
    })

    it('should accept ShotEntry with injectionSite field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        injectionSite: 'thigh',
      }
      
      expect(shot.injectionSite).toBe('thigh')
      expect(typeof shot.injectionSite).toBe('string')
    })

    it('should accept ShotEntry with painScore field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        painScore: 3,
      }
      
      expect(shot.painScore).toBe(3)
      expect(typeof shot.painScore).toBe('number')
    })

    it('should accept ShotEntry with mood field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        mood: 'happy',
      }
      
      expect(shot.mood).toBe('happy')
      expect(typeof shot.mood).toBe('string')
    })

    it('should accept ShotEntry with notes field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        notes: 'Feeling good today, no side effects',
      }
      
      expect(shot.notes).toBe('Feeling good today, no side effects')
      expect(typeof shot.notes).toBe('string')
    })

    it('should accept ShotEntry with all fields populated', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
        doseMg: 5.5,
        injectionSite: 'thigh',
        painScore: 2,
        mood: 'energetic',
        notes: 'Everything went smoothly',
      }
      
      expect(shot).toMatchObject({
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
        doseMg: 5.5,
        injectionSite: 'thigh',
        painScore: 2,
        mood: 'energetic',
        notes: 'Everything went smoothly',
      })
    })

    it('should allow undefined optional fields', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        time: undefined,
        doseMg: undefined,
        injectionSite: undefined,
        painScore: undefined,
        mood: undefined,
        notes: undefined,
      }
      
      expect(shot.id).toBe('abc123')
      expect(shot.date).toBe('2025-12-11')
      expect(shot.time).toBeUndefined()
      expect(shot.doseMg).toBeUndefined()
      expect(shot.injectionSite).toBeUndefined()
      expect(shot.painScore).toBeUndefined()
      expect(shot.mood).toBeUndefined()
      expect(shot.notes).toBeUndefined()
    })
  })

  describe('type structure validation', () => {
    it('should create valid shot entries with different data', () => {
      const shots: ShotEntry[] = [
        {
          id: '1',
          date: '2025-12-01',
          doseMg: 5,
          injectionSite: 'thigh',
        },
        {
          id: '2',
          date: '2025-12-08',
          doseMg: 5,
          injectionSite: 'glute',
          painScore: 1,
        },
        {
          id: '3',
          date: '2025-12-11',
          time: '10:00',
          doseMg: 5.5,
          injectionSite: 'stomach',
          painScore: 0,
          mood: 'great',
          notes: 'Best injection yet!',
        },
      ]
      
      expect(shots).toHaveLength(3)
      expect(shots[0].id).toBe('1')
      expect(shots[1].painScore).toBe(1)
      expect(shots[2].notes).toBe('Best injection yet!')
    })

    it('should work with date formats', () => {
      const shot: ShotEntry = {
        id: 'test',
        date: '2025-12-11',
      }
      
      // Verify date is in YYYY-MM-DD format
      expect(shot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('should handle numeric ranges for painScore', () => {
      const minPainShot: ShotEntry = {
        id: 'min',
        date: '2025-12-11',
        painScore: 0,
      }
      
      const maxPainShot: ShotEntry = {
        id: 'max',
        date: '2025-12-11',
        painScore: 10,
      }
      
      expect(minPainShot.painScore).toBe(0)
      expect(maxPainShot.painScore).toBe(10)
    })
  })
})
