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

    // Tests that optional injectionSitePosition field accepts string values
    it('should accept ShotEntry with injectionSitePosition field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        injectionSitePosition: 'left',
      }
      
      expect(shot.injectionSitePosition).toBe('left')
      expect(typeof shot.injectionSitePosition).toBe('string')
    })

    // Tests that optional testosteroneEster field accepts string values
    it('should accept ShotEntry with testosteroneEster field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        testosteroneEster: 'cypionate',
      }
      
      expect(shot.testosteroneEster).toBe('cypionate')
      expect(typeof shot.testosteroneEster).toBe('string')
    })

    // Tests that optional carrierOil field accepts string values
    it('should accept ShotEntry with carrierOil field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        carrierOil: 'cottonseed',
      }
      
      expect(shot.carrierOil).toBe('cottonseed')
      expect(typeof shot.carrierOil).toBe('string')
    })

    // Tests that the optional pain field accepts a level
    it('should accept ShotEntry with pain field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        pain: "mild",
      }
      
      expect(shot.pain).toBe('mild')
      expect(typeof shot.pain).toBe('string')
    })

    // Tests that the optional off-days pattern is accepted
    it('should accept ShotEntry with offDays field', () => {
      const shot: ShotEntry = {
        id: 'abc123',
        date: '2025-12-11',
        offDays: 'right-before',
      }

      expect(shot.offDays).toBe('right-before')
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
        injectionSitePosition: 'left',
        testosteroneEster: 'cypionate',
        carrierOil: 'cottonseed',
        pain: "mild",
        offDays: 'right-before',
        notes: 'Everything went smoothly',
      }
      
      expect(shot).toMatchObject({
        id: 'abc123',
        date: '2025-12-11',
        time: '14:30',
        doseMg: 75,
        injectionSite: 'thigh',
        injectionSitePosition: 'left',
        testosteroneEster: 'cypionate',
        carrierOil: 'cottonseed',
        pain: "mild",
        offDays: 'right-before',
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
        injectionSitePosition: undefined,
        testosteroneEster: undefined,
        carrierOil: undefined,
        pain: undefined,
        offDays: undefined,
        notes: undefined,
      }
      
      expect(shot.id).toBe('abc123')
      expect(shot.date).toBe('2025-12-11')
      expect(shot.time).toBeUndefined()
      expect(shot.doseMg).toBeUndefined()
      expect(shot.injectionSite).toBeUndefined()
      expect(shot.injectionSitePosition).toBeUndefined()
      expect(shot.testosteroneEster).toBeUndefined()
      expect(shot.carrierOil).toBeUndefined()
      expect(shot.pain).toBeUndefined()
      expect(shot.offDays).toBeUndefined()
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
          pain: "mild",
        },
        {
          id: '3',
          date: '2025-12-11',
          time: '10:00',
          doseMg: 100,
          injectionSite: 'stomach',
          injectionSitePosition: 'upper right',
          testosteroneEster: 'cypionate',
          carrierOil: 'sesame',
          pain: "none",
          offDays: 'none',
          notes: 'Best injection yet!',
        },
      ]
      
      expect(shots).toHaveLength(3)
      expect(shots[0].id).toBe('1')
      expect(shots[1].pain).toBe('mild')
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

    // Tests that pain accepts the lowest and highest levels
    it('should handle the ends of the pain scale', () => {
      const minPainShot: ShotEntry = {
        id: 'min',
        date: '2025-12-11',
        pain: "none",
      }
      
      const maxPainShot: ShotEntry = {
        id: 'max',
        date: '2025-12-11',
        pain: "severe",
      }
      
      expect(minPainShot.pain).toBe('none')
      expect(maxPainShot.pain).toBe('severe')
      // "none" is an answer, and distinct from not answering at all.
      const unanswered: ShotEntry = { id: 'u', date: '2025-12-11' }
      expect(unanswered.pain).toBeUndefined()
    })
  })
})
