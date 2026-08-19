'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { formOptions, useStore } from '@tanstack/react-form'
import {
  AtSign,
  BriefcaseBusiness,
  Camera,
  CalendarDays,
  Loader2,
  Pencil,
  Phone,
  UserRound,
  UserX,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAppForm } from '@/blocks/Form/hooks/form'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatClientGender, getClientGenderBadgeClass } from '@/lib/client-gender'
import { formatDobInput } from '@/lib/date-utils'
import { formatPhoneNumber } from '@/lib/client-utils'
import { cn } from '@/utilities/cn'
import { invalidateWizardClientDerivedData } from '../../../queries'
import { guidedWorkflowApi } from '../../complete-workflow/guided-workflow-api'
import { ReferralProfileDrawer } from '../emails/referrals/ReferralProfileDrawer'
import { clientBasicsFieldsSchema, type ClientBasicsFormValues } from './client-basics-schema'
import { HeadshotCaptureCard } from './HeadshotCaptureCard'
import { updateClientBasics } from './updateClientBasics'

export type ClientDetailsValue = {
  id: string
  firstName: string
  middleInitial?: string | null
  lastName: string
  email: string
  dob?: string | null
  phone?: string | null
  gender?: 'male' | 'female' | 'prefer-not-to-say' | null
  headshot?: string | null
  headshotId?: string | null
  referralType?: 'court' | 'employer' | 'self' | null
  referralTitle?: string | null
}

const GENDER_OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Prefer not to say', value: 'prefer-not-to-say' },
]

function createClientDraft(client: ClientDetailsValue): ClientBasicsFormValues {
  return {
    firstName: client.firstName,
    middleInitial: client.middleInitial || '',
    lastName: client.lastName,
    dob: formatDobInput(client.dob),
    email: client.email,
    phone: client.phone ? formatPhoneNumber(client.phone) : '',
    gender: client.gender || '',
  }
}

type ClientDetailsCardProps = {
  client: ClientDetailsValue
  editable?: boolean
  eyebrow?: string
  className?: string
  onClientUpdated?: (client: Partial<ClientDetailsValue>) => void
  onChangeClient?: () => void
  onHeadshotCaptureReady?: (openEditor: (() => void) | null) => void
}

type ClientSaveStage = 'idle' | 'pressed' | 'validating' | 'saving' | 'slow' | 'interrupted'

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="grid min-w-0 grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
      <Icon className="text-muted-foreground mt-0.5 size-4" />
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium uppercase">{label}</p>
        <div className="truncate text-sm font-medium">{value}</div>
      </div>
    </div>
  )
}

export function ClientDetailsCard({
  client,
  editable = false,
  eyebrow = 'Client',
  className,
  onClientUpdated,
  onChangeClient,
  onHeadshotCaptureReady,
}: ClientDetailsCardProps) {
  const [editorOpen, setEditorOpen] = useState(false)
  const [referralOpen, setReferralOpen] = useState(false)
  const [saveStage, setSaveStage] = useState<ClientSaveStage>('idle')
  const queryClient = useQueryClient()
  const [headshotDraft, setHeadshotDraft] = useState({
    headshot: client.headshot || null,
    headshotId: client.headshotId || null,
  })
  const { data: referralProfile = null, refetch: refetchReferral } = useQuery({
    queryKey: ['client-details', 'referral', client.id],
    queryFn: ({ signal }) => guidedWorkflowApi.getReferralProfile(client.id, signal),
    enabled: editable && (editorOpen || referralOpen),
    staleTime: 30_000,
  })

  const fullName = useMemo(
    () => [client.firstName, client.middleInitial, client.lastName].filter(Boolean).join(' '),
    [client.firstName, client.lastName, client.middleInitial],
  )
  const initials = `${client.firstName.charAt(0)}${client.lastName.charAt(0)}`
  const referralLabel =
    referralProfile?.referralTitle || client.referralTitle || (client.referralType === 'self' ? 'Self' : 'Not set')

  const clientForm = useAppForm(
    formOptions({
      defaultValues: createClientDraft(client),
      canSubmitWhenInvalid: true,
      validators: {
        onSubmit: clientBasicsFieldsSchema,
      },
      onSubmit: async ({ value }) => {
        setSaveStage('saving')
        const result = await updateClientBasics({
          clientId: client.id,
          ...value,
        })

        if (!result.success) {
          setSaveStage('idle')
          toast.error(result.error)
          return
        }

        onClientUpdated?.(result.client)
        invalidateWizardClientDerivedData(queryClient, { clientId: client.id })
        setEditorOpen(false)
        toast.success('Client details updated')
      },
    }),
  )
  const isPending = useStore(clientForm.store, (state) => state.isSubmitting)
  const draft = useStore(clientForm.store, (state) => state.values)
  const saveIsBusy = isPending || saveStage === 'validating' || saveStage === 'saving' || saveStage === 'slow'

  useEffect(() => {
    if (saveStage !== 'pressed' && saveStage !== 'saving') return

    const timeout = window.setTimeout(
      () => setSaveStage(saveStage === 'pressed' ? 'interrupted' : 'slow'),
      saveStage === 'pressed' ? 1_200 : 10_000,
    )

    return () => window.clearTimeout(timeout)
  }, [saveStage])

  const submitClientForm = async () => {
    if (saveIsBusy) return

    setSaveStage('validating')
    try {
      await clientForm.handleSubmit()
    } catch (error) {
      console.error('[client-details] Save failed before receiving a response', error)
      toast.error(error instanceof Error ? error.message : 'Client details could not be updated.')
    } finally {
      setSaveStage('idle')
    }
  }

  const applyHeadshot = (url: string, docId: string) => {
    setHeadshotDraft({ headshot: url, headshotId: docId })
    onClientUpdated?.({ headshot: url, headshotId: docId })
    invalidateWizardClientDerivedData(queryClient, { clientId: client.id })
  }

  const handleEditorOpenChange = useCallback((nextOpen: boolean) => {
    setSaveStage('idle')

    if (nextOpen) {
      clientForm.reset(createClientDraft(client))
      setHeadshotDraft({
        headshot: client.headshot || null,
        headshotId: client.headshotId || null,
      })
    }

    setEditorOpen(nextOpen)
  }, [client, clientForm])

  const openHeadshotEditor = useCallback(() => {
    handleEditorOpenChange(true)
  }, [handleEditorOpenChange])

  useEffect(() => {
    onHeadshotCaptureReady?.(openHeadshotEditor)
    return () => onHeadshotCaptureReady?.(null)
  }, [onHeadshotCaptureReady, openHeadshotEditor])

  const previewData = referralProfile
    ? referralProfile
    : {
        referralType: client.referralType || 'self',
        referralTitle: referralLabel,
        referralEmails: [],
        referralRecipientsDetailed: [],
        clientAdditionalRecipientsDetailed: [],
        hasExplicitReferralRecipients: false,
      }

  return (
    <>
      <Card className={cn('rounded-lg', className)}>
        <CardHeader className="flex-row items-start justify-between gap-3 p-4 pb-2">
          <div>
            <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">{eyebrow}</p>
            <CardTitle className="mt-1 text-lg">{fullName}</CardTitle>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {editable && !client.headshot && (
              <Button
                type="button"
                size="sm"
                onClick={() => handleEditorOpenChange(true)}
                data-testid="add-headshot-button"
              >
                <Camera className="size-4" />
                Add headshot
              </Button>
            )}
            {onChangeClient && (
              <Button type="button" variant="outline" size="sm" onClick={onChangeClient}>
                <UserX className="size-4" />
                Change client
              </Button>
            )}
            {editable && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleEditorOpenChange(true)}
                aria-label={`Edit ${fullName}`}
              >
                <Pencil className="size-4" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-y-4 p-4 pt-0 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-x-6">
          <Avatar className="size-16 shrink-0">
            <AvatarImage src={client.headshot || undefined} alt={fullName} />
            <AvatarFallback className="text-xl">{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 gap-3 sm:grid-cols-2">
            <Detail icon={AtSign} label="Email" value={client.email} />
            <Detail
              icon={CalendarDays}
              label="Date of birth"
              value={client.dob ? formatDobInput(client.dob) : 'Not set'}
            />
            <Detail icon={Phone} label="Phone" value={client.phone ? formatPhoneNumber(client.phone) : 'Not set'} />
            <Detail
              icon={UserRound}
              label="Gender"
              value={
                <Badge variant="outline" className={getClientGenderBadgeClass(client.gender)}>
                  {formatClientGender(client.gender)}
                </Badge>
              }
            />
            <Detail icon={BriefcaseBusiness} label="Referral" value={referralLabel} />
          </div>
        </CardContent>
      </Card>

      <Drawer swipeDirection="right" open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <DrawerContent className="bg-background data-[swipe-direction=right]:w-[min(640px,calc(100vw-16px))] data-[swipe-direction=right]:sm:max-w-none">
          <DrawerHeader className="border-border border-b">
            <DrawerTitle>Edit Client Details</DrawerTitle>
            <DrawerDescription>Changes save to the client profile and sync with connected services.</DrawerDescription>
          </DrawerHeader>
          <form
            onSubmit={async (event) => {
              event.preventDefault()
              event.stopPropagation()
              await submitClientForm()
            }}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="no-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto p-4 pb-24 sm:p-6 sm:pb-24">
              <HeadshotCaptureCard
                client={{
                  id: client.id,
                  firstName: draft.firstName,
                  middleInitial: draft.middleInitial,
                  lastName: draft.lastName,
                  email: draft.email,
                  dob: draft.dob,
                  phone: draft.phone,
                  headshot: headshotDraft.headshot,
                  headshotId: headshotDraft.headshotId,
                }}
                expectedClientEmail={client.email}
                onHeadshotLinked={applyHeadshot}
              />

              <FieldGroup className="grid gap-4 sm:grid-cols-2">
                <clientForm.Field
                  name="firstName"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.firstName,
                    onSubmit: clientBasicsFieldsSchema.shape.firstName,
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor={field.name}>First name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0 || undefined}
                        autoComplete="given-name"
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </clientForm.Field>

                <clientForm.Field
                  name="middleInitial"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.middleInitial,
                    onSubmit: clientBasicsFieldsSchema.shape.middleInitial,
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor={field.name}>Middle initial</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        maxLength={1}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value.toUpperCase())}
                        aria-invalid={field.state.meta.errors.length > 0 || undefined}
                        autoComplete="additional-name"
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </clientForm.Field>

                <clientForm.Field
                  name="lastName"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.lastName,
                    onSubmit: clientBasicsFieldsSchema.shape.lastName,
                  }}
                >
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor={field.name}>Last name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(event) => field.handleChange(event.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0 || undefined}
                        autoComplete="family-name"
                      />
                      <FieldError errors={field.state.meta.errors} />
                    </Field>
                  )}
                </clientForm.Field>

                <clientForm.AppField
                  name="dob"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.dob,
                    onSubmit: clientBasicsFieldsSchema.shape.dob,
                  }}
                >
                  {(field) => <field.DobField label="Date of birth" required />}
                </clientForm.AppField>

                <clientForm.AppField
                  name="email"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.email,
                    onSubmit: clientBasicsFieldsSchema.shape.email,
                  }}
                >
                  {(field) => <field.EmailField label="Email" required />}
                </clientForm.AppField>

                <clientForm.AppField
                  name="phone"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.phone,
                    onSubmit: clientBasicsFieldsSchema.shape.phone,
                  }}
                >
                  {(field) => <field.PhoneField label="Phone" />}
                </clientForm.AppField>

                <clientForm.AppField
                  name="gender"
                  validators={{
                    onBlur: clientBasicsFieldsSchema.shape.gender,
                    onSubmit: clientBasicsFieldsSchema.shape.gender,
                  }}
                >
                  {(field) => <field.SelectField label="Gender" options={GENDER_OPTIONS} />}
                </clientForm.AppField>

                <Field className="min-w-0">
                  <FieldLabel>Referral</FieldLabel>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-w-0 justify-start"
                    onClick={() => setReferralOpen(true)}
                  >
                    <BriefcaseBusiness data-icon="inline-start" />
                    <span className="min-w-0 flex-1 truncate text-left">{referralLabel}</span>
                    <Pencil data-icon="inline-end" />
                  </Button>
                </Field>
              </FieldGroup>
            </div>
            <DrawerFooter className="border-border border-t sm:flex-row sm:justify-end">
              <div className="text-muted-foreground min-h-5 flex-1 text-sm" role="status" aria-live="polite">
                {saveStage === 'pressed' && 'Save selected...'}
                {saveStage === 'validating' && 'Checking client details...'}
                {saveStage === 'saving' && 'Saving client details...'}
                {saveStage === 'slow' && 'Still waiting for the server to finish saving...'}
                {saveStage === 'interrupted' && 'The browser interrupted that tap. Please tap Save again.'}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => handleEditorOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                data-base-ui-swipe-ignore
                type="button"
                disabled={saveIsBusy}
                aria-busy={saveIsBusy}
                onPointerDown={() => {
                  if (!saveIsBusy) setSaveStage('pressed')
                }}
                onPointerCancel={() => setSaveStage('interrupted')}
                onClick={() => void submitClientForm()}
              >
                {saveIsBusy && <Loader2 data-icon="inline-start" className="animate-spin" />}
                {saveStage === 'validating'
                  ? 'Checking...'
                  : saveStage === 'saving'
                    ? 'Saving...'
                    : saveStage === 'slow'
                      ? 'Still saving...'
                      : 'Save Client'}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
        <ReferralProfileDrawer
          nested
          open={referralOpen}
          onOpenChange={setReferralOpen}
          clientId={client.id}
          previewData={previewData}
          fallbackReferralEmails={referralProfile?.referralEmails || []}
          onSaved={(data) => {
            onClientUpdated?.({
              referralType: data.referralType,
              referralTitle: data.referralTitle,
            })
            void refetchReferral()
          }}
        />
      </Drawer>
    </>
  )
}
