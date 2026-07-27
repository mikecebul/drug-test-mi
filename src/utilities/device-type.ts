export type DeviceType = 'mobile' | 'tablet' | 'desktop'

type DeviceSignals = {
  maxTouchPoints?: number
  userAgent?: string
  width: number
}

const MOBILE_MAX_WIDTH = 767
const TABLET_MAX_WIDTH = 1024

export function getDeviceType({
  maxTouchPoints = 0,
  userAgent = '',
  width,
}: DeviceSignals): DeviceType {
  const isIPad =
    /\biPad\b/i.test(userAgent) ||
    (/\bMacintosh\b/i.test(userAgent) && maxTouchPoints > 1)
  if (isIPad) return 'tablet'

  if (/\b(iPhone|iPod|Windows Phone)\b/i.test(userAgent)) return 'mobile'
  if (/\bAndroid\b/i.test(userAgent)) {
    return /\bMobile\b/i.test(userAgent) ? 'mobile' : 'tablet'
  }

  if (width <= MOBILE_MAX_WIDTH) return 'mobile'
  if (width <= TABLET_MAX_WIDTH) return 'tablet'
  return 'desktop'
}
