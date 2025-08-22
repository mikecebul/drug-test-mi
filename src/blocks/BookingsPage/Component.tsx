import Container from '@/components/Container'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BookingsPageBlock as BookingsPageBlockType } from '@/payload-types'
import { CalendarIcon, MapPinIcon } from 'lucide-react'
import { format } from 'date-fns'
import { Title } from '@/components/Hero/HeroMedium'
import { RichText } from '@/components/RichText'

export const BookingsPageBlock = ({ title, bookingCards, announcements }: BookingsPageBlockType) => {
  return (
    <Container className="space-y-16">
      <div className="space-y-16">
        <Title text={title ?? 'Upcoming Bookings'} heading="h1" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
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
      </div>
      {announcements && announcements.length > 0 && (
        <div className="space-y-8">
          <Title text="Announcements" heading="h2" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-3">
            {announcements?.map((announcement) => {
              if (typeof announcement !== 'object') return null
              return (
                <Card key={announcement.id} className="mb-4">
                  <CardHeader>
                    <CardTitle>{announcement.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="">
                      <RichText data={announcement.description} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </Container>
  )
}
