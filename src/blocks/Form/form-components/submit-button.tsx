'use client'

import { Button } from '@/components/ui/button'
import { useFormContext } from '../hooks/form-context'
import { Loader } from 'lucide-react'
import { cn } from '@/utilities/cn'

export default function SubmitButton({ label, className }: { label: string; className?: string }) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
      {([canSubmit, isSubmitting]) => (
        <Button
          type="submit"
          className={cn('w-full', className)}
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? <Loader className="animate-spin" /> : label}
        </Button>
      )}
    </form.Subscribe>
  )
}
