'use client'

import { useState } from 'react'
import type { Product, Client } from '@/payload-types'
import { initiateEnrollment } from './actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface EnrollmentFormProps {
  products: Product[]
  client: Client
}

export function EnrollmentForm({ products, client }: EnrollmentFormProps) {
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  const [testingType, setTestingType] = useState<string>('')
  const [preferredDay, setPreferredDay] = useState<string>('')
  const [preferredTimeSlot, setPreferredTimeSlot] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const checkoutUrl = await initiateEnrollment({
        productId: selectedProduct,
        testingType,
        preferredDay: testingType !== 'fixed-saturday' ? preferredDay : undefined,
        preferredTimeSlot: testingType !== 'fixed-saturday' ? preferredTimeSlot : undefined,
      })

      // Redirect to Stripe Checkout
      window.location.href = checkoutUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start enrollment')
      setIsLoading(false)
    }
  }

  const selectedProductData = products.find((p) => p.id === selectedProduct)
  const showPreferences = testingType && testingType !== 'fixed-saturday'

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Product Selection */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Select a Plan</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card
              key={product.id}
              className={`cursor-pointer transition-all ${
                selectedProduct === product.id
                  ? 'ring-2 ring-primary'
                  : 'hover:ring-1 hover:ring-gray-300'
              }`}
              onClick={() => setSelectedProduct(product.id)}
            >
              <CardHeader>
                <CardTitle>{product.name || 'Testing Plan'}</CardTitle>
                <CardDescription>
                  {product.priceInUSD
                    ? `$${(product.priceInUSD / 100).toFixed(2)}/${product.testingFrequency || 'month'}`
                    : 'Price not available'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{product.description || 'Subscribe to recurring drug testing'}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Testing Type */}
      {selectedProduct && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Testing Schedule</h2>
          <RadioGroup value={testingType} onValueChange={setTestingType}>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="fixed-saturday" id="fixed-saturday" />
              <Label htmlFor="fixed-saturday">Fixed Saturday 11:10 AM</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="random-1x" id="random-1x" />
              <Label htmlFor="random-1x">Random 1x/week</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="random-2x" id="random-2x" />
              <Label htmlFor="random-2x">Random 2x/week</Label>
            </div>
          </RadioGroup>
        </div>
      )}

      {/* Preferences (only for non-fixed schedules) */}
      {showPreferences && (
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold">Preferences</h2>
          <p className="text-sm text-gray-600">
            These are your preferences. Actual test times may vary for random testing.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="preferredDay">Preferred Day of Week</Label>
              <Select value={preferredDay} onValueChange={setPreferredDay}>
                <SelectTrigger id="preferredDay">
                  <SelectValue placeholder="Select day..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monday">Monday</SelectItem>
                  <SelectItem value="tuesday">Tuesday</SelectItem>
                  <SelectItem value="wednesday">Wednesday</SelectItem>
                  <SelectItem value="thursday">Thursday</SelectItem>
                  <SelectItem value="friday">Friday</SelectItem>
                  <SelectItem value="saturday">Saturday</SelectItem>
                  <SelectItem value="sunday">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferredTimeSlot">Preferred Time Slot</Label>
              <Select value={preferredTimeSlot} onValueChange={setPreferredTimeSlot}>
                <SelectTrigger id="preferredTimeSlot">
                  <SelectValue placeholder="Select time..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning (8AM-12PM)</SelectItem>
                  <SelectItem value="late-morning">Late Morning (10AM-12PM)</SelectItem>
                  <SelectItem value="afternoon">Afternoon (12PM-5PM)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Submit Button */}
      <Button
        type="submit"
        size="lg"
        disabled={
          !selectedProduct ||
          !testingType ||
          (showPreferences && (!preferredDay || !preferredTimeSlot)) ||
          isLoading
        }
        className="w-full"
      >
        {isLoading ? 'Processing...' : 'Continue to Payment'}
      </Button>
    </form>
  )
}
