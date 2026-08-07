export const WizardContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mx-auto my-6 flex w-full max-w-4xl flex-col px-4 md:my-8 md:px-10">
      {children}
    </div>
  )
}
