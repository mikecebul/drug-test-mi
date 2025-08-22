import Container from '@/components/Container'
import { RichText } from '@/components/RichText'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { BookingCardsBlock as BookingCardsBlockType } from '@/payload-types'
import { format } from 'date-fns'
import { CalendarIcon, MapPinIcon } from 'lucide-react'

export const BookingCardsBlock = ({ bookingCards }: BookingCardsBlockType) => {
  return (
    <Container>
      <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
        {Array.isArray(bookingCards) &&
          bookingCards.length > 0 &&
          bookingCards.map((booking) => {
            if (typeof booking !== 'object') {
              return null
            }
            return (
              <Card key={booking.id} className="col-span-1">
                <CardHeader className="">
                  <CardTitle>{booking.title}</CardTitle>
                </CardHeader>
                <CardContent className="pb-6">
                  <CardDescription className="text-base">
                    <span className="flex flex-col">
                      <span className="flex items-center gap-2">
                        <CalendarIcon className="size-4" />
                        <span>{format(booking.startTime, 'MMMM do, yyyy h:mm a')}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        <MapPinIcon className="size-4" />
                        <span>{booking.location}</span>
                      </span>
                    </span>
                  </CardDescription>
                </CardContent>
                <CardContent className="">
                  <div className="text-sm text-muted-foreground">
                    <p><strong>Attendee:</strong> {booking.attendeeName}</p>
                    <p><strong>Type:</strong> {booking.type}</p>
                    <p><strong>Status:</strong> {booking.status}</p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
      </div>
    </Container>
  )
}
