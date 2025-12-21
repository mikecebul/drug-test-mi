export const WizsrdContainer = ({ children }: { children: React.ReactNode }) => {
  return (
    <div className="mx-auto my-32 flex max-w-lg flex-col md:max-w-4xl lg:mx-auto lg:max-w-4xl">
      {children}
    </div>
  )
}
