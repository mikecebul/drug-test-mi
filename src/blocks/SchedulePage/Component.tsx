"use client"

import { useState } from "react"
import { TesterSelection } from "@/components/tester-selection"
import { CalEmbed } from "@/components/cal-embed"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowLeft, Calendar, Clock } from "lucide-react"
import type { TesterWithAvailability } from "@/lib/types"
import { getTesterAvailabilityText } from "@/lib/mock-data"
import type { SchedulePageBlock as SchedulePageBlockType } from "@/payload-types"

export const SchedulePageBlock = ({ title }: SchedulePageBlockType) => {
  const [selectedTester, setSelectedTester] = useState<TesterWithAvailability | null>(null)

  const handleTesterSelect = (tester: TesterWithAvailability) => {
    setSelectedTester(tester)
  }

  const handleBackToSelection = () => {
    setSelectedTester(null)
  }

  return (
    <div className="bg-muted/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <div className="mb-6 sm:mb-8 lg:mb-10">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-2 sm:mb-3">
            {title || "Schedule Your Drug Test"}
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl">
            Select your preferred tester and schedule your appointment.
          </p>
        </div>

        {!selectedTester ? (
          <TesterSelection onTesterSelect={handleTesterSelect} />
        ) : (
          <div className="space-y-6 lg:space-y-8">
            <Button
              variant="outline"
              onClick={handleBackToSelection}
              className="bg-background hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Tester Selection
            </Button>

            <Card className="border-2">
              <CardContent className="p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
                  <Avatar className="h-20 w-20 lg:h-24 lg:w-24 mx-auto sm:mx-0">
                    <AvatarImage src={selectedTester.photo_url || "/placeholder.svg"} alt={selectedTester.name} />
                    <AvatarFallback className="text-lg lg:text-xl">
                      {selectedTester.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 text-center sm:text-left">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-3">
                      <h3 className="text-xl lg:text-2xl font-semibold">{selectedTester.name}</h3>
                      <Badge variant="secondary" className="capitalize w-fit mx-auto sm:mx-0">
                        {selectedTester.gender}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-sm lg:text-base mb-4 max-w-md">{selectedTester.bio}</p>

                    <div className="flex items-center justify-center sm:justify-start gap-2 text-sm lg:text-base text-muted-foreground">
                      <Clock className="h-4 w-4 lg:h-5 lg:w-5" />
                      <span>{getTesterAvailabilityText(selectedTester)}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardHeader className="pb-4 lg:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg lg:text-xl">
                  <Calendar className="h-5 w-5 lg:h-6 lg:w-6" />
                  Book Your Appointment
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <CalEmbed calUsername={selectedTester.cal_com_username} testerName={selectedTester.name} />
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}