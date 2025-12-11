// src/types/__tests__/shot.test.ts
import { describe, it, expect } from 'vitest'
import type { ShotEntry } from '../shot'

describe('ShotEntry type', () => {
  describe('required fields', () => {
    // Tests that ShotEntry can be created with only required fields
    it('should accept valid ShotEntry with required fields only', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
      }
      
      expect(shot.id).toBe('abc123')
      expect(shot.date).toBe('2025-12-11')
    })

    // Tests that id field is typed as string
    it('should have string type for id field', () => {
      const shot: ShotEntry = {
        id: 'test-id-123',
        date: '2025-01-01',
      }
      
      expect(typeof shot.id).toBe('string')
    })

    // Tests that date field is typed as string
    it('should have string type for date field', () => {
      const shot: ShotEntry = {
        id: 'test-id',
        date: '2025-12-11',
      }
      
      expect(typeof shot.date).toBe('string')
    })
  })

  describe('optional fields', () => {
    // Tests that optional time field accepts string values
    it('should accept ShotEntry with time field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
      }
      
      expect(shot.time).toBe('14:30')
      expect(typeof shot.time).toBe('string')
    })

    // Tests that optional doseMg field accepts numeric values
    it('should accept ShotEntry with doseMg field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        doseMg: 100,
      }
      
      expect(shot.doseMg).toBe(100)
      expect(typeof shot.doseMg).toBe('number')
    })

    // Tests that optional injectionSite field accepts string values
    it('should accept ShotEntry with injectionSite field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        injectionSite: 'thigh',
      }
      
      expect(shot.injectionSite).toBe('thigh')
      expect(typeof shot.injectionSite).toBe('string')
    })

    // Tests that optional painScore field accepts numeric values
    it('should accept ShotEntry with painScore field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        painScore: 3,
      }
      
      expect(shot.painScore).toBe(3)
      expect(typeof shot.painScore).toBe('number')
    })

    // Tests that optional mood field accepts string values
    it('should accept ShotEntry with mood field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        mood: 'happy',
      }
      
      expect(shot.mood).toBe('happy')
      expect(typeof shot.mood).toBe('string')
    })

    // Tests that optional notes field accepts string values
    it('should accept ShotEntry with notes field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        notes: 'Feeling good today, no side effects',
      }
      
      expect(shot.notes).toBe('Feeling good today, no side effects')
      expect(typeof shot.notes).toBe('string')
    })

    // Tests that ShotEntry accepts all fields populated at once
    it('should accept ShotEntry with all fields populated', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
        doseMg: 75,
        injectionSite: 'thigh',
        painScore: 2,
        mood: 'energetic',
        notes: 'Everything went smoothly',
      }
      
      expect(shot).toMatchObject({
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
        doseMg: 75,
        injectionSite: 'thigh',
        painScore: 2,
        mood: 'energetic',
        notes: 'Everything went smoothly',
      })
    })

    // Tests that optional fields can be explicitly set to undefined
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
    // Tests that ShotEntry arrays can hold entries with varying optional fields
    it('should create valid shot entries with different data', () => {
      const shots: ShotEntry[] = [
        {
          id: '1',
          date: '2025-12-01',
          doseMg: 50,
          injectionSite: 'thigh',
        },
        {
          id: '2',
          date: '2025-12-08',
          doseMg: 75,
          injectionSite: 'glute',
          painScore: 1,
        },
        {
          id: '3',
          date: '2025-12-11',
          time: '10:00',
          doseMg: 100,
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

    // Tests that date field accepts YYYY-MM-DD format strings
    it('should work with date formats', () => {
      const shot: ShotEntry = {
        id: 'test',
        date: '2025-12-11',
      }
      
      // Verify date is in YYYY-MM-DD format
      expect(shot.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    // Tests that painScore field accepts values in the 0-10 range
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
