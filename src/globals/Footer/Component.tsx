import { Separator } from '@/components/ui/separator'
import Link from 'next/link'

import { cn } from '@/utilities/cn'
import { buttonVariants } from '@/components/ui/button'
import { Clock, Facebook, Mail, Navigation, Phone, Printer } from 'lucide-react'
import Container from '@/components/Container'
import { CMSLink } from '@/components/Link'
import { getPayload } from 'payload'
import payloadConfig from '@payload-config'
import { GoogleMap } from './GoogleMap'
import { Copyright } from './Copyright'

export async function Footer() {
  const payload = await getPayload({ config: payloadConfig })

  const { pageLinks, showContact, showGoogleMap } = await payload.findGlobal({
    slug: 'footer',
    depth: 1,
  })

  const { contact, social, hours } = await payload.findGlobal({
    slug: 'company-info',
    depth: 1,
  })

  return (
    <footer>
      <Container className="py-0">
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* PageLinks */}
          {pageLinks && pageLinks.length > 0 && (
            <div className="col-span-1 flex flex-col">
              <p className="text-lg font-bold">Website</p>
              <Separator className="my-4" />
              <ul className="mb-8 flex flex-col space-y-4 font-medium text-gray-500">
                {pageLinks.map(({ link }, id) => {
                  return (
                    <li key={id}>
                      <CMSLink {...link} appearance="nav" className={cn('text-sm')} />
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
          {/* Contact Info */}
          {showContact && contact && (
            <div className="col-span-1 flex flex-col">
              <p className="text-lg font-bold">Contact</p>
              <Separator className="my-4" />
              <ul className="mb-8 flex flex-col space-y-4 text-gray-500">
                {typeof contact.phone === 'string' && contact.phone.length > 0 && (
                  <li key={contact.phone} className="group">
                    <a
                      href={`tel:${contact.phone.replace(/\D/g, '')}`}
                      className={cn(
                        buttonVariants({ variant: 'ghost' }),
                        'group-hover:text-primary flex justify-start',
                      )}
                    >
                      <Phone className="mr-2 shrink-0" size={20} />
                      {contact.phone}
                    </a>
                  </li>
                )}
                {typeof contact.email === 'string' && contact.email.length > 0 && (
                  <li key={contact.email} className="group">
                    <a
                      href={`mailto:${contact.email}`}
                      className={cn(
                        buttonVariants({ variant: 'ghost' }),
                        'group-hover:text-primary flex justify-start',
                      )}
                    >
                      <Mail className="mr-2 shrink-0" size={20} />
                      {contact.email}
                    </a>
                  </li>
                )}
                {typeof contact.fax === 'string' && contact.fax.length > 0 && (
                  <li key={contact.fax} className="group">
                    <div className={cn(buttonVariants({ variant: 'text' }), 'text-gray-500')}>
                      <Printer className="mr-2" size={20} />
                      {contact.fax}
                    </div>
                  </li>
                )}
                {(contact.physicalAddress?.street || contact.mailingAddress?.street) && (
                  <li
                    className={cn(
                      buttonVariants({ variant: 'text' }),
                      'flex h-full items-start justify-start text-gray-500',
                    )}
                  >
                    <Navigation className="mr-2 shrink-0" size={20} />
                    <ul>
                      {contact.physicalAddress?.street && (
                        <li>
                          <span>
                            <strong>Physical: </strong>
                            {`${contact.physicalAddress.street}, ${contact.physicalAddress.cityStateZip}`}
                          </span>
                        </li>
                      )}
                      {contact.mailingAddress?.street && (
                        <li>
                          <span>
                            <strong>Mailing: </strong>
                            {`${contact.mailingAddress.street}, ${contact.mailingAddress.cityStateZip}`}
                          </span>
                        </li>
                      )}
                    </ul>
                  </li>
                )}
                {/* Social Links */}
                {!!social &&
                  social?.map(({ link }) => (
                    <li key={link.label} className="group">
                      <a
                        href={link.url ?? ''}
                        className={cn(
                          buttonVariants({ variant: 'ghost' }),
                          'group-hover:text-primary flex justify-start',
                        )}
                      >
                        <Facebook className="mr-2" size={20} />
                        {link.label}
                      </a>
                    </li>
                  ))}

                {/* Business Hours */}
                {!!hours && hours?.length > 0 && (
                  <li
                    className={cn(
                      buttonVariants({ variant: 'text' }),
                      'flex h-full items-start justify-start text-gray-500',
                    )}
                  >
                    <Clock className="mr-2" size={20} />
                    <ul>
                      {hours?.map(({ day, hours, id, note, type }) => (
                        <li key={id}>
                          {type === 'default' ? (
                            <span>
                              <strong>{`${day}: `}</strong>
                              {hours}
                            </span>
                          ) : (
                            <span>{note}</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Map Section */}
          {showGoogleMap && (
            <div className="col-span-1 sm:col-span-2 lg:col-span-1">
              <p className="text-lg font-bold">Location</p>
              <Separator className="my-4" />
              <GoogleMap contact={contact} />
            </div>
          )}
        </div>

        <Separator />
        <div className="flex items-center justify-center">
          <Copyright>
            <Link href="/" className={cn(buttonVariants({ variant: 'ghost' }), 'p-0 text-balance')}>
              {contact.name ?? 'Charlevoix Junior Golf'}
            </Link>
          </Copyright>
        </div>
      </Container>
    </footer>
  )
}
