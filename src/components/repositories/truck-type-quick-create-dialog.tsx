'use client'

import { useState } from 'react'
import type { ResourceType } from '@prisma/client'
import { toast } from 'sonner'
import { EntityFormDialog } from './entity-form-dialog'
import { createTruckTypeSchema } from '@/lib/validations/repositories'
import { useCreateTruckType } from '@/hooks/use-repositories'

interface TruckTypeQuickCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (truckType: ResourceType) => void
}

const truckTypeFields = [
  { name: 'name', label: 'Truck Type Name', placeholder: 'Enter truck type name (e.g., 10T Truck)', required: true },
]

const defaultValues = {
  name: '',
}

export function TruckTypeQuickCreateDialog({
  open,
  onOpenChange,
  onSuccess,
}: TruckTypeQuickCreateDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const createTruckType = useCreateTruckType()

  const handleSubmit = async (data: typeof defaultValues) => {
    setIsLoading(true)
    try {
      const truckType = await createTruckType.mutateAsync(data)
      toast.success('Truck type created successfully')
      onSuccess?.(truckType)
      onOpenChange(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create truck type')
      throw error
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <EntityFormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Add New Truck Type"
      description="Create a new truck type to use in your forecasts"
      schema={createTruckTypeSchema}
      fields={truckTypeFields}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isLoading={isLoading}
    />
  )
}
