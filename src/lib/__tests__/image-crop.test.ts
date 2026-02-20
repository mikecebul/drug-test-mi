import { describe, expect, it } from 'vitest'
import type { Crop, PixelCrop } from 'react-image-crop'
import { resolvePixelCropForSave } from '../image-crop'

const image = {
  width: 400,
  height: 200,
  naturalWidth: 4000,
  naturalHeight: 2000,
}

describe('resolvePixelCropForSave', () => {
  it('returns completedCrop when it is valid', () => {
    const completedCrop: PixelCrop = { unit: 'px', x: 12, y: 8, width: 150, height: 120 }
    const crop: Crop = { unit: '%', x: 10, y: 10, width: 50, height: 50 }

    const result = resolvePixelCropForSave({
      image,
      crop,
      completedCrop,
    })

    expect(result).toEqual(completedCrop)
  })

  it('converts percent crop to pixel crop when completedCrop is unavailable', () => {
    const crop: Crop = { unit: '%', x: 10, y: 20, width: 50, height: 25 }

    const result = resolvePixelCropForSave({
      image,
      crop,
      completedCrop: null,
    })

    expect(result).toEqual({
      unit: 'px',
      x: 40,
      y: 40,
      width: 200,
      height: 50,
    })
  })

  it('returns null when image dimensions are invalid', () => {
    const crop: Crop = { unit: '%', x: 10, y: 10, width: 80, height: 80 }

    const result = resolvePixelCropForSave({
      image: { width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 },
      crop,
      completedCrop: null,
    })

    expect(result).toBeNull()
  })

  it('returns null when completedCrop is invalid and fallback crop cannot produce positive dimensions', () => {
    const completedCrop: PixelCrop = { unit: 'px', x: 0, y: 0, width: 0, height: -10 }
    const crop: Crop = { unit: '%', x: 10, y: 10, width: 0, height: 0 }

    const result = resolvePixelCropForSave({
      image,
      crop,
      completedCrop,
    })

    expect(result).toBeNull()
  })
})
