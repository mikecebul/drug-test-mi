export const WizardContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mx-auto my-32 flex max-w-lg flex-col px-4 md:max-w-4xl md:px-6 lg:mx-auto lg:max-w-4xl">
      {children}
    </div>
  )
}
