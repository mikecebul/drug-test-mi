import { cn } from 'src/utilities/cn'
import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'

const cardVariants = cva('bg-card text-card-foreground border-border rounded-lg border shadow-xs', {
  variants: {
    variant: {
      default: '',
      admin: 'border-border/70 bg-gradient-to-b from-card via-card to-muted/20 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/15',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, variant, ...props }, ref) => (
  <div className={cn(cardVariants({ variant }), className)} ref={ref} {...props} />
))
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      className={cn('flex flex-col space-y-1.5 p-6', className)}
      ref={ref}
      {...props}
    />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      className={cn('text-2xl leading-none font-semibold tracking-tight', className)}
      ref={ref}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p className={cn('text-muted-foreground text-sm', className)} ref={ref} {...props} />
))
CardDescription.displayName = 'CardDescription'

const CardDescriptionDiv = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div className={cn('text-muted-foreground text-sm', className)} ref={ref} {...props} />
))
CardDescriptionDiv.displayName = 'CardDescriptionDiv'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn('p-6 pt-0', className)} ref={ref} {...props} />
  ),
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn('flex items-center p-6 pt-0', className)} ref={ref} {...props} />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardContent, CardDescription, CardDescriptionDiv, CardFooter, CardHeader, CardTitle }
