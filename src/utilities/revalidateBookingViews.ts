import { revalidatePath } from 'next/cache'

const BOOKING_VIEW_PATHS = ['/admin', '/admin/drug-test-upload', '/dashboard', '/dashboard/schedule'] as const

export function revalidateBookingViews() {
  for (const path of BOOKING_VIEW_PATHS) {
    revalidatePath(path)
  }
}
