import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle2, User, XCircle } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useStore } from '@tanstack/react-form'
import { withForm } from '@/blocks/Form/hooks/form'
import { collectLabFormOpts } from '../shared-form'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { FieldGroupHeader } from '../../../components/FieldGroupHeader'

export const ConfirmStep = withForm({
  ...collectLabFormOpts,

  render: function Render({ form }) {
    const [formValues] = useStore(form.store, (state) => [state.values])
    return (
      <div>
        <FieldGroupHeader title="Confirm Collection Details" />
        <Card>
          <CardContent className="space-y-6 pt-6 text-base md:text-lg">
            <div className="space-y-4">
              <div>
                <h3 className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                  <User className="h-4 w-4" />
                  Client
                </h3>
                <div className="mt-2 flex items-start gap-3 pl-6">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage
                      src={formValues.client.headshot ?? undefined}
                      alt={`${formValues.client.firstName} ${formValues.client.lastName}`}
                    />
                    <AvatarFallback className="text-sm">
                      {formValues.client.firstName?.charAt(0)}
                      {formValues.client.lastName?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 space-y-0.5">
                    <p className="text-lg font-semibold">
                      {formValues.client.firstName} {formValues.client.lastName}
                    </p>
                    <p className="text-muted-foreground text-sm">{formValues.client.email}</p>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-muted-foreground text-sm font-medium">Test Type</h3>
                <p className="mt-1 pl-6 text-lg">
                  {formValues.collection.testType === '11-panel-lab'
                    ? '11-Panel Lab Test'
                    : formValues.collection.testType === '17-panel-sos-lab'
                      ? '17-Panel SOS Lab Test'
                      : 'EtG Lab Test'}
                </p>
              </div>

              <div className="border-t pt-4">
                <h3 className="text-muted-foreground text-sm font-medium">Collection Date & Time</h3>
                <p className="mt-1 pl-6 text-lg">
                  {formValues.collection.collectionDate &&
                    format(new Date(formValues.collection.collectionDate), 'PPp')}
                </p>
              </div>

              {formValues.collection.breathalyzerTaken &&
                formValues.collection.breathalyzerResult !== null &&
                formValues.collection.breathalyzerResult !== undefined && (
                  <div className="space-y-2 border-t pt-4">
                    <h3 className="text-muted-foreground text-sm font-medium">Breathalyzer Test</h3>
                    <div className="pl-6">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            formValues.collection.breathalyzerResult! > 0.0
                              ? 'destructive'
                              : formValues.collection.breathalyzerResult! === 0
                                ? 'success'
                                : 'default'
                          }
                        >
                          {formValues.collection.breathalyzerResult! > 0.0 ? (
                            <>
                              <XCircle className="h-3 w-3" />
                              POSITIVE (FAIL)
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3" />
                              NEGATIVE (PASS)
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm">
                        <span className="text-muted-foreground">BAC Level:</span>{' '}
                        <span className="font-mono font-semibold">
                          {formValues.collection.breathalyzerResult!.toFixed(3)}
                        </span>
                      </p>
                      {formValues.collection.breathalyzerResult! > 0.0 && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          Any detectable alcohol level constitutes a positive result.
                        </p>
                      )}
                    </div>
                  </div>
                )}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  },
})
