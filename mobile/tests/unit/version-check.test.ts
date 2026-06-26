import { describe, it, expect } from 'vitest'
import { compareVersions, isUpdateRequired, isUpdateAvailable } from '@/lib/version-check'

describe('compareVersions', () => {
  it('should return 0 for equal versions', () => {
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  it('should return 1 when first version is greater', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1)
    expect(compareVersions('1.1.0', '1.0.0')).toBe(1)
    expect(compareVersions('1.0.1', '1.0.0')).toBe(1)
  })

  it('should return -1 when first version is less', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.1.0')).toBe(-1)
    expect(compareVersions('1.0.0', '1.0.1')).toBe(-1)
  })

  it('should handle multi-digit version numbers', () => {
    expect(compareVersions('10.20.30', '10.20.30')).toBe(0)
    expect(compareVersions('10.20.30', '9.99.99')).toBe(1)
    expect(compareVersions('1.0.0', '10.0.0')).toBe(-1)
  })
})

describe('isUpdateRequired', () => {
  it('should return true when current < min', () => {
    expect(isUpdateRequired('1.0.0', '1.0.1')).toBe(true)
    expect(isUpdateRequired('1.0.0', '2.0.0')).toBe(true)
  })

  it('should return false when current >= min', () => {
    expect(isUpdateRequired('1.0.1', '1.0.0')).toBe(false)
    expect(isUpdateRequired('1.0.0', '1.0.0')).toBe(false)
    expect(isUpdateRequired('2.0.0', '1.0.0')).toBe(false)
  })
})

describe('isUpdateAvailable', () => {
  it('should return true when current < latest', () => {
    expect(isUpdateAvailable('1.0.0', '1.0.1')).toBe(true)
  })

  it('should return false when current >= latest', () => {
    expect(isUpdateAvailable('1.0.1', '1.0.0')).toBe(false)
    expect(isUpdateAvailable('1.0.0', '1.0.0')).toBe(false)
  })
})
