'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Mail, User, Lock, Eye, EyeOff } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { registerSchema, type RegisterInput } from '@/lib/validations/auth'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

export function RegisterForm() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [needsOrgCreation, setNeedsOrgCreation] = useState(false)
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false)
  const [joiningOrgName, setJoiningOrgName] = useState('')
  const [suggestedOrgName, setSuggestedOrgName] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [formData, setFormData] = useState<RegisterInput | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [selectedRole, setSelectedRole] = useState<'DEMAND_PLANNER' | 'SUPPLY_PLANNER' | 'ADMIN'>('DEMAND_PLANNER')
  const [requiresVerification, setRequiresVerification] = useState(false)
  const [userId, setUserId] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      mobileNumber: '',
      role: undefined,
    },
  })

  const onSubmit = async (data: RegisterInput) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      })

      const result = await response.json()

      if (!result.success) {
        // Check if organization creation is needed
        if (result.error.needsOrgCreation) {
          setNeedsOrgCreation(true)
          setSuggestedOrgName(result.error.suggestedOrgName || '')
          setOrganizationName(result.error.suggestedOrgName || '')
          setFormData(data)
          setIsLoading(false)
          return
        }

        // Check if joining existing org and needs role selection
        if (result.error.needsRoleSelection) {
          setNeedsRoleSelection(true)
          setJoiningOrgName(result.error.organizationName || '')
          setFormData(data)
          setIsLoading(false)
          return
        }

        toast.error(result.error.message)
        return
      }

      // Check if email verification is required
      if (result.data.requiresVerification) {
        setRequiresVerification(true)
        setUserId(result.data.userId)
        setUserEmail(data.email)
        toast.success('Verification code sent to your email')
        setIsLoading(false)
        return
      }

      toast.success('Account created successfully')
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateOrganization = async () => {
    if (!formData || !organizationName.trim()) {
      toast.error('Organization name is required')
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, organizationName }),
        credentials: 'include',
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error.message)
        return
      }

      // Check if email verification is required
      if (result.data.requiresVerification) {
        setRequiresVerification(true)
        setUserId(result.data.userId)
        setUserEmail(formData.email)
        setNeedsOrgCreation(false)
        toast.success('Verification code sent to your email')
        setIsLoading(false)
        return
      }

      toast.success(result.data.message)
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinWithRole = async () => {
    if (!formData) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, role: selectedRole }),
        credentials: 'include',
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error.message)
        return
      }

      // Check if email verification is required
      if (result.data.requiresVerification) {
        setRequiresVerification(true)
        setUserId(result.data.userId)
        setUserEmail(formData.email)
        setNeedsRoleSelection(false)
        toast.success('Verification code sent to your email')
        setIsLoading(false)
        return
      }

      toast.success(result.data.message)
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleVerifyOTP = async () => {
    if (!otpCode.trim() || otpCode.length !== 6) {
      toast.error('Please enter a valid 6-digit code')
      return
    }

    setIsVerifying(true)
    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, code: otpCode }),
        credentials: 'include',
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error.message)
        return
      }

      toast.success('Email verified successfully')
      router.push('/')
      router.refresh()
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResendOTP = async () => {
    setIsResending(true)
    try {
      const response = await fetch('/api/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, email: userEmail }),
        credentials: 'include',
      })

      const result = await response.json()

      if (!result.success) {
        toast.error(result.error.message)
        return
      }

      toast.success('Verification code sent')
      setOtpCode('')
    } catch (error) {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  // Show OTP verification screen
  if (requiresVerification) {
    console.log('Rendering OTP verification screen for:', userEmail)
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Verify Your Email</CardTitle>
          <CardDescription>
            We sent a 6-digit verification code to <strong>{userEmail}</strong>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Verification Code</Label>
              <Input
                type="text"
                placeholder="000000"
                value={otpCode}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setOtpCode(value)
                }}
                maxLength={6}
                className="text-center text-2xl tracking-widest font-semibold"
                autoComplete="one-time-code"
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from your email
              </p>
            </div>
            <Button onClick={handleVerifyOTP} className="w-full" disabled={isVerifying || otpCode.length !== 6}>
              {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Email
            </Button>
            <Button
              variant="outline"
              onClick={handleResendOTP}
              className="w-full"
              disabled={isResending}
            >
              {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Resend Code
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show role selection for joining existing org
  if (needsRoleSelection && formData) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold">Select Your Role</CardTitle>
          <CardDescription>
            You're joining <strong>{joiningOrgName}</strong>. Please select your role.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your Role</Label>
              <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DEMAND_PLANNER">Demand Planner</SelectItem>
                  <SelectItem value="SUPPLY_PLANNER">Supply Planner</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleJoinWithRole} className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Join Organization
            </Button>
            <Button
              variant="ghost"
              onClick={() => setNeedsRoleSelection(false)}
              className="w-full"
              disabled={isLoading}
            >
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Show onboarding wizard for new organizations
  if (needsOrgCreation && formData) {
    return (
      <OnboardingWizard
        initialData={formData}
        onVerificationRequired={(userId, email) => {
          console.log('onVerificationRequired callback triggered:', { userId, email })
          setRequiresVerification(true)
          setUserId(userId)
          setUserEmail(email)
          setNeedsOrgCreation(false)
          console.log('State updated, should show OTP screen now')
        }}
      />
    )
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold">Create an account</CardTitle>
        <CardDescription>
          Enter your details to create a new account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="John" className="pl-9" {...field} />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="you@example.com"
                        className="pl-9"
                        {...field}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 chars, uppercase, lowercase, number"
                        className="pl-9 pr-10"
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="mobileNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <PhoneInput
                      value={field.value}
                      onChange={(value) => field.onChange(value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              You'll be guided through organization setup or joining an existing team
            </p>
          </form>
        </Form>
      </CardContent>
      <CardFooter className="flex flex-col space-y-4">
        <div className="text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </div>
      </CardFooter>
    </Card>
  )
}
