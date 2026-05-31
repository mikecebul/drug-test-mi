import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { DashboardBreadcrumb } from "@/components/DashboardBreadcrumb"

export function SiteHeader() {
  return (
    <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
      <div className="flex w-full items-center px-6 lg:px-10 xl:px-12">
        <div className="flex shrink-0 items-center justify-center md:-ml-11 md:w-11">
          <SidebarTrigger />
        </div>
        <Separator
          orientation="vertical"
          className="mr-6 data-[orientation=vertical]:h-4"
        />
        <DashboardBreadcrumb />
      </div>
    </header>
  )
}
