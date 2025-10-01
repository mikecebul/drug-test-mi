import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { XCircle } from 'lucide-react'

export default function EnrollmentCancelPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <XCircle className="w-16 h-16 text-orange-500" />
        </div>

        <h1 className="text-4xl font-bold">Enrollment Cancelled</h1>

        <p className="text-lg text-gray-600">
          Your enrollment process was cancelled. No charges have been made to your account.
        </p>

        <div className="bg-gray-50 rounded-lg p-6 text-left space-y-4">
          <h2 className="text-xl font-semibold">Need Help?</h2>
          <p className="text-gray-600">
            If you experienced any issues during enrollment or have questions about our testing
            programs, please don't hesitate to contact us.
          </p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>📞 Phone: [Your phone number]</li>
            <li>✉️ Email: [Your email]</li>
          </ul>
        </div>

        <div className="flex gap-4 justify-center pt-4">
          <Button asChild>
            <Link href="/enroll">Try Again</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
