import Container from '@/components/Container'
import { Description, Title } from '@/components/Hero/HeroMedium'
import { BookingsBlock as BookingsBlockType } from '@/payload-types'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CalendarIcon, MapPinIcon } from 'lucide-react'
import { CTALinks } from '@/components/CTALinks'
import { TwoColumnLayout } from '@/components/TwoColumnLayout'
import { Media } from '@/components/Media'
import { RichText } from '@/components/RichText'

export const BookingsBlock = ({
  title,
  description,
  bookingItems,
  direction,
  links,
  image,
}: BookingsBlockType) => {
  return (
    <Container className="space-y-12">
      <TwoColumnLayout direction={direction ?? 'ltr'}>
        <>
          <Title heading="h2" text={title} />
          <Description text={description} />
          <CTALinks links={links ?? []} />
        </>
        {image && typeof image === 'object' && <Media resource={image} className="rounded-lg" />}
      </TwoColumnLayout>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {Array.isArray(bookingItems) &&
          bookingItems.length > 0 &&
          bookingItems.map((booking) => {
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
