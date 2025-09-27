"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  User,
  Mail,
  Phone,
  Calendar,
  Shield,
  Edit,
  Save,
  X,
} from "lucide-react"

type ClientProfile = {
  id: string
  firstName: string
  lastName: string
  email: string
  phone?: string
  dob?: string
  gender?: "male" | "female" | "other" | "prefer-not-to-say"
  clientType: "probation" | "employment" | "self"
  preferredContactMethod: "email" | "phone" | "sms"
  isActive: boolean
  courtInfo?: {
    courtName: string
    probationOfficerName: string
    probationOfficerEmail: string
  }
  employmentInfo?: {
    employerName: string
    contactName: string
    contactEmail: string
  }
  alternativeRecipient?: {
    name: string
    email: string
  }
}

const mockProfile: ClientProfile = {
  id: "1",
  firstName: "John",
  lastName: "Doe",
  email: "john.doe@email.com",
  phone: "(555) 123-4567",
  dob: "1985-03-15",
  gender: "male",
  clientType: "probation",
  preferredContactMethod: "email",
  isActive: true,
  courtInfo: {
    courtName: "Oakland County Circuit Court",
    probationOfficerName: "Sarah Johnson",
    probationOfficerEmail: "s.johnson@oaklandcounty.gov"
  }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<ClientProfile>(mockProfile)
  const [isEditing, setIsEditing] = useState(false)
  const [editedProfile, setEditedProfile] = useState<ClientProfile>(mockProfile)

  const handleSave = () => {
    setProfile(editedProfile)
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditedProfile(profile)
    setIsEditing(false)
  }

  const getClientTypeLabel = (type: string) => {
    switch (type) {
      case "probation":
        return "Probation/Court"
      case "employment":
        return "Employment"
      case "self":
        return "Self-Pay/Individual"
      default:
        return type
    }
  }

  return (
    <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
      <div className="px-4 lg:px-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
            <p className="text-muted-foreground">
              Manage your personal information and preferences
            </p>
          </div>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit Profile
            </Button>
          ) : (
            <div className="flex space-x-2">
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 lg:px-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Profile Overview */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="w-5 h-5 mr-2" />
                Profile Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full mx-auto flex items-center justify-center mb-3">
                  <span className="text-white text-2xl font-bold">
                    {profile.firstName[0]}{profile.lastName[0]}
                  </span>
                </div>
                <h3 className="font-semibold text-lg">
                  {profile.firstName} {profile.lastName}
                </h3>
                <Badge variant="outline" className="mt-1">
                  {getClientTypeLabel(profile.clientType)}
                </Badge>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{profile.email}</span>
                </div>
                {profile.phone && (
                  <div className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile.dob && (
                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span>{new Date(profile.dob).toLocaleDateString()}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className={profile.isActive ? "text-green-600" : "text-red-600"}>
                    {profile.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Personal Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>
                Your basic personal details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  {isEditing ? (
                    <Input
                      id="firstName"
                      value={editedProfile.firstName}
                      onChange={(e) => setEditedProfile({
                        ...editedProfile,
                        firstName: e.target.value
                      })}
                    />
                  ) : (
                    <p className="text-sm py-2">{profile.firstName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  {isEditing ? (
                    <Input
                      id="lastName"
                      value={editedProfile.lastName}
                      onChange={(e) => setEditedProfile({
                        ...editedProfile,
                        lastName: e.target.value
                      })}
                    />
                  ) : (
                    <p className="text-sm py-2">{profile.lastName}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  {isEditing ? (
                    <Input
                      id="email"
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile({
                        ...editedProfile,
                        email: e.target.value
                      })}
                    />
                  ) : (
                    <p className="text-sm py-2">{profile.email}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={editedProfile.phone || ""}
                      onChange={(e) => setEditedProfile({
                        ...editedProfile,
                        phone: e.target.value
                      })}
                    />
                  ) : (
                    <p className="text-sm py-2">{profile.phone || "Not provided"}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dob">Date of Birth</Label>
                  {isEditing ? (
                    <Input
                      id="dob"
                      type="date"
                      value={editedProfile.dob || ""}
                      onChange={(e) => setEditedProfile({
                        ...editedProfile,
                        dob: e.target.value
                      })}
                    />
                  ) : (
                    <p className="text-sm py-2">
                      {profile.dob ? new Date(profile.dob).toLocaleDateString() : "Not provided"}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender">Gender</Label>
                  {isEditing ? (
                    <Select
                      value={editedProfile.gender || ""}
                      onValueChange={(value) => setEditedProfile({
                        ...editedProfile,
                        gender: value as any
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                        <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="text-sm py-2 capitalize">
                      {profile.gender?.replace("-", " ") || "Not specified"}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Contact Preferences */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Contact Preferences</CardTitle>
              <CardDescription>
                How you prefer to be contacted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="contactMethod">Preferred Contact Method</Label>
                {isEditing ? (
                  <Select
                    value={editedProfile.preferredContactMethod}
                    onValueChange={(value) => setEditedProfile({
                      ...editedProfile,
                      preferredContactMethod: value as any
                    })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="phone">Phone</SelectItem>
                      <SelectItem value="sms">Text/SMS</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-sm py-2 capitalize">
                    {profile.preferredContactMethod.replace("sms", "Text/SMS")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Referral Information */}
          {profile.courtInfo && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Court/Probation Information</CardTitle>
                <CardDescription>
                  Your referral source information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Court Name</Label>
                    <p className="text-sm py-2">{profile.courtInfo.courtName}</p>
                  </div>
                  <div>
                    <Label>Probation Officer</Label>
                    <p className="text-sm py-2">{profile.courtInfo.probationOfficerName}</p>
                  </div>
                  <div>
                    <Label>Officer Email</Label>
                    <p className="text-sm py-2">{profile.courtInfo.probationOfficerEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {profile.employmentInfo && (
            <Card className="lg:col-span-3">
              <CardHeader>
                <CardTitle>Employment Information</CardTitle>
                <CardDescription>
                  Your employer contact information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-3 gap-4">
                  <div>
                    <Label>Employer</Label>
                    <p className="text-sm py-2">{profile.employmentInfo.employerName}</p>
                  </div>
                  <div>
                    <Label>HR Contact</Label>
                    <p className="text-sm py-2">{profile.employmentInfo.contactName}</p>
                  </div>
                  <div>
                    <Label>Contact Email</Label>
                    <p className="text-sm py-2">{profile.employmentInfo.contactEmail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Security & Privacy */}
      <div className="px-4 lg:px-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              Security & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 text-sm">
              <div>
                <h4 className="font-medium mb-3">Data Protection</h4>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Your personal information is encrypted and secure</li>
                  <li>• Test results are only shared with authorized personnel</li>
                  <li>• You control who receives your information</li>
                  <li>• All access is logged for compliance</li>
                </ul>
              </div>
              <div>
                <h4 className="font-medium mb-3">Account Actions</h4>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">
                    Change Password
                  </Button>
                  <Button variant="outline" size="sm">
                    Download My Data
                  </Button>
                  <Button variant="outline" size="sm">
                    Privacy Settings
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}