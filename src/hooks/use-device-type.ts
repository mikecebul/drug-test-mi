'use client'

import * as React from 'react'

import { getDeviceType, type DeviceType } from '@/utilities/device-type'

export function useDeviceType() {
  const [deviceType, setDeviceType] = React.useState<DeviceType | undefined>()

  React.useEffect(() => {
    const updateDeviceType = () => {
      setDeviceType(
        getDeviceType({
          maxTouchPoints: navigator.maxTouchPoints,
          userAgent: navigator.userAgent,
          width: window.innerWidth,
        }),
      )
    }

    updateDeviceType()
    window.addEventListener('resize', updateDeviceType)
    return () => window.removeEventListener('resize', updateDeviceType)
  }, [])

  return deviceType
}
