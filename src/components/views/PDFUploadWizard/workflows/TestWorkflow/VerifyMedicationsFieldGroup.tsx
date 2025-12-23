'use client'

import { withForm } from '@/blocks/Form/hooks/form'
import z from 'zod'
import { testWorkflowFormOpts } from './shared-form'

// Export the schema for reuse in step validation


export const VerifyMedicationsFieldGroup = withForm({
  ...testWorkflowFormOpts,

  props: {
    title: 'Verify Medications',
    description: "Review and update the client's medications for accurate drug test interpretation",
  },

  render: function Render({ form, title, description = '' }) {
    return (
      <div>
        <p>Hello</p>
      </div>
    )
  },
})
// Get form values to access client data
//     const formValues = useStore(group.form.store, (state: any) => state.values)
//     const client = formValues?.clientData

//     // Get medications from form state
//     const medications = useStore(group.store, (state) => state.values.medications || [])

//     // State for loading initial medications
//     const [isLoading, setIsLoading] = useState(true)
//     const [initialFetchDone, setInitialFetchDone] = useState(false)

//     // Fetch medications on mount and store in form state
//     useEffect(() => {
//       if (!client?.id || initialFetchDone) {
//         setIsLoading(false)
//         return
//       }

//       const fetchMedications = async () => {
//         setIsLoading(true)
//         try {
//           const result = await adminGetClientMedicationsAction(client.id)
//           if (result.success) {
//             // Store medications in form state
//             group.setFieldValue('medications', result.medications)
//           }
//         } catch (error) {
//           console.error('Error fetching medications:', error)
//         } finally {
//           setIsLoading(false)
//           setInitialFetchDone(true)
//         }
//       }

//       fetchMedications()
//     }, [client?.id, initialFetchDone, group])

//     const handleRefresh = () => {
//       setInitialFetchDone(false)
//     }

//     if (!client) {
//       return (
//         <div className="space-y-6">
//           <div>
//             <h2 className="mb-2 text-2xl font-bold">{title}</h2>
//             <p className="text-muted-foreground">{description}</p>
//           </div>
//           <Card>
//             <CardContent className="pt-6">
//               <p className="text-muted-foreground text-center">
//                 No client selected. Please go back and select a client.
//               </p>
//             </CardContent>
//           </Card>
//         </div>
//       )
//     }

//     return (
//       <div className="space-y-6">
//         <FieldGroupHeader title={title} description={description} />

//         {/* Client Info Card */}
//         <div className="bg-card border-border w-full rounded-xl border p-6 shadow-md">
//           {/* Client Info */}
//           <div className="flex items-start gap-8">
//             <Avatar className="size-24 shrink-0">
//               <AvatarImage
//                 src={client.headshot ?? undefined}
//                 alt={`${client.firstName} ${client.lastName}`}
//               />
//               <AvatarFallback className="text-lg">
//                 {client.firstName?.charAt(0)}
//                 {client.lastName?.charAt(0)}
//               </AvatarFallback>
//             </Avatar>
//             <div className="flex-1 space-y-3">
//               <p className="text-foreground text-2xl font-semibold">
//                 {client.firstName} {client.middleInitial ? `${client.middleInitial}. ` : ''}
//                 {client.lastName}
//               </p>
//               <div>
//                 <p className="text-muted-foreground text-lg">{client.email}</p>
//                 {client.dob && (
//                   <p className="text-muted-foreground text-lg">
//                     DOB: {new Date(client.dob).toLocaleDateString()}
//                   </p>
//                 )}
//               </div>
//             </div>
//           </div>
//         </div>

//         {/* Medications Section */}
//         <Card className="shadow-md">
//           <CardContent className="space-y-4 pt-6">
//             <div className="flex items-center justify-between pb-4">
//               <div>
//                 <h3 className="text-2xl font-semibold">Medications</h3>
//                 <p className="text-muted-foreground text-lg">
//                   Manage medications for accurate drug test interpretation
//                 </p>
//               </div>
//               <Button
//                 type="button"
//                 size="sm"
//                 variant="ghost"
//                 onClick={handleRefresh}
//                 className="text-muted-foreground hover:text-foreground p-2 transition-colors"
//                 title="Refresh medications"
//               >
//                 <RefreshCw className="size-5" />
//               </Button>
//             </div>

//             {isLoading ? (
//               <div className="text-muted-foreground py-8 text-center">
//                 <RefreshCw className="mx-auto mb-2 h-8 w-8 animate-spin" />
//                 <p>Loading medications...</p>
//               </div>
//             ) : (
//               <group.AppField name="medications" mode="array">
//                 {(field) => {
//                   // Filter to only show active medications
//                   const activeMedications = field.state.value.filter(
//                     (med: any) => med.status === 'active',
//                   )
//                   const allMedications = field.state.value

//                   return (
//                     <MedicationList
//                       field={field}
//                       activeMedications={activeMedications}
//                       allMedications={allMedications}
//                     />
//                   )
//                 }}
//               </group.AppField>
//             )}
//           </CardContent>
//         </Card>
//       </div>
//     )
//   },
// })
