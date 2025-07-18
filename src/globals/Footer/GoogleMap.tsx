'use client'

import { CompanyInfo } from '@/payload-types'
import { APIProvider, InfoWindow, Map } from '@vis.gl/react-google-maps'
import { LandPlot } from 'lucide-react'

export const GoogleMap = ({ contact }: { contact: CompanyInfo['contact'] }) => {
  const {
    name,
    physicalAddress: { coordinates, street, cityStateZip },
  } = contact
  const defaultPosition = { lat: 45.3235, lng: -85.2432 }

  const position = coordinates ? { lat: coordinates[1], lng: coordinates[0] } : defaultPosition

  if (process.env.NODE_ENV !== 'production' || !process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="h-[350px] bg-gray-100 flex items-center justify-center flex-col gap-2">
        <div className="text-sm text-gray-500">
          <p>{name}</p>
          <p>{street}</p>
          <p>{cityStateZip}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[350px]">
      <APIProvider apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!}>
        <Map defaultZoom={13} defaultCenter={position} disableDefaultUI>
          <InfoWindow
            position={position}
            shouldFocus={false}
            maxWidth={280}
            headerContent={
              <div className="flex items-center gap-4">
                <LandPlot className="text-primary size-8 shrink-0" />
                <div className="flex flex-col gap-4">
                  <h3 className="text-base leading-5 font-bold text-balance">{name}</h3>
                </div>
              </div>
            }
          >
            <div className="flex flex-col pt-2 pl-12">
              <p className="text-sm text-gray-500">{street}</p>
              <p className="text-sm text-gray-500">{cityStateZip}</p>
            </div>
          </InfoWindow>
        </Map>
      </APIProvider>
    </div>
  )
}
