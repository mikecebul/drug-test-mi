import * as React from 'react'
import { NavigationMenu as NavigationMenuPrimitive } from '@base-ui/react/navigation-menu'
import { cva } from 'class-variance-authority'
import { ChevronDown } from 'lucide-react'

import { cn } from '@/utilities/cn'

type NavigationMenuRootElement = React.ComponentRef<typeof NavigationMenuPrimitive.Root>

const NavigationMenuRootRefContext = React.createContext<React.RefObject<NavigationMenuRootElement | null> | null>(
  null,
)

function setForwardedRef<T>(ref: React.ForwardedRef<T>, value: T | null) {
  if (typeof ref === 'function') {
    ref(value)
  } else if (ref) {
    ref.current = value
  }
}

const NavigationMenu = React.forwardRef<
  NavigationMenuRootElement,
  NavigationMenuPrimitive.Root.Props
>(({ className, children, ...props }, ref) => {
  const rootRef = React.useRef<NavigationMenuRootElement | null>(null)
  const mergedRef = React.useCallback(
    (node: NavigationMenuRootElement | null) => {
      rootRef.current = node
      setForwardedRef(ref, node)
    },
    [ref],
  )

  return (
    <NavigationMenuRootRefContext.Provider value={rootRef}>
      <NavigationMenuPrimitive.Root
        ref={mergedRef}
        className={cn('relative z-10 flex max-w-max flex-1 items-center justify-center', className)}
        {...props}
      >
        {children}
        <NavigationMenuViewport />
      </NavigationMenuPrimitive.Root>
    </NavigationMenuRootRefContext.Provider>
  )
})
NavigationMenu.displayName = 'NavigationMenu'

const NavigationMenuList = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.List>,
  NavigationMenuPrimitive.List.Props
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.List
    ref={ref}
    className={cn('group flex flex-1 list-none items-center justify-center gap-1', className)}
    {...props}
  />
))
NavigationMenuList.displayName = 'NavigationMenuList'

const NavigationMenuItem = NavigationMenuPrimitive.Item

const navigationMenuTriggerStyle = cva(
  'group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-active:bg-accent/50 data-popup-open:bg-accent/50',
)

const NavigationMenuTrigger = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Trigger>,
  NavigationMenuPrimitive.Trigger.Props
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(navigationMenuTriggerStyle(), 'group', className)}
    {...props}
  >
    {children}{' '}
    <NavigationMenuPrimitive.Icon
      render={
        <ChevronDown
          className="relative top-px ml-1 size-3 transition duration-200 group-data-popup-open:rotate-180"
          aria-hidden="true"
        />
      }
    />
  </NavigationMenuPrimitive.Trigger>
))
NavigationMenuTrigger.displayName = 'NavigationMenuTrigger'

const NavigationMenuContent = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Content>,
  NavigationMenuPrimitive.Content.Props
>(({ className, ...props }, ref) => (
  <NavigationMenuPrimitive.Content
    ref={ref}
    className={cn(
      'transition-[opacity,translate] duration-200 data-starting-style:opacity-0 data-ending-style:opacity-0 data-[activation-direction=right]:data-starting-style:translate-x-52 data-[activation-direction=left]:data-starting-style:-translate-x-52',
      className,
    )}
    {...props}
  />
))
NavigationMenuContent.displayName = 'NavigationMenuContent'

const NavigationMenuLink = React.forwardRef<
  React.ComponentRef<typeof NavigationMenuPrimitive.Link>,
  NavigationMenuPrimitive.Link.Props
>(({ closeOnClick = true, onClick, ...props }, ref) => {
  const rootRef = React.useContext(NavigationMenuRootRefContext)

  return (
    <NavigationMenuPrimitive.Link
      ref={ref}
      closeOnClick={false}
      onClick={(event) => {
        onClick?.(event)
        if (event.defaultPrevented) return

        const href = event.currentTarget.getAttribute('href')
        if (!href) return

        const destination = new URL(event.currentTarget.href)
        const isSameDocument =
          destination.origin === window.location.origin &&
          destination.pathname === window.location.pathname &&
          destination.search === window.location.search

        if (!isSameDocument || !destination.hash) return

        event.preventDefault()
        window.history.pushState(null, '', destination)
        document.getElementById(decodeURIComponent(destination.hash.slice(1)))?.scrollIntoView()

        if (!closeOnClick) return

        const openTrigger = rootRef?.current?.querySelector<HTMLButtonElement>('[data-popup-open]')
        if (openTrigger?.isConnected) openTrigger.click()
      }}
      {...props}
    />
  )
})
NavigationMenuLink.displayName = 'NavigationMenuLink'

type NavigationMenuViewportProps = NavigationMenuPrimitive.Viewport.Props &
  Pick<NavigationMenuPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'>

const NavigationMenuViewport = React.forwardRef<HTMLDivElement, NavigationMenuViewportProps>(
  ({ className, align = 'start', alignOffset, side = 'bottom', sideOffset = 6, ...props }, ref) => (
    <NavigationMenuPrimitive.Portal>
      <NavigationMenuPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-50"
      >
        <NavigationMenuPrimitive.Popup
          className={cn(
            'bg-popover text-popover-foreground relative h-(--popup-height) w-(--popup-width) overflow-hidden rounded-md border shadow-lg outline-none transition-[opacity,scale] duration-200 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
            className,
          )}
        >
          <NavigationMenuPrimitive.Viewport ref={ref} {...props} />
        </NavigationMenuPrimitive.Popup>
      </NavigationMenuPrimitive.Positioner>
    </NavigationMenuPrimitive.Portal>
  ),
)
NavigationMenuViewport.displayName = 'NavigationMenuViewport'

const NavigationMenuIndicator = React.forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
  <div
    ref={ref}
    aria-hidden="true"
    className={cn(
      'absolute top-full z-1 flex h-1.5 items-end justify-center overflow-hidden',
      className,
    )}
    {...props}
  >
    <div className="relative top-[60%] h-2 w-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
  </div>
))
NavigationMenuIndicator.displayName = 'NavigationMenuIndicator'

export {
  navigationMenuTriggerStyle,
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
}
