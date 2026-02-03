'use client'

import * as React from 'react'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface MultiSelectOption {
  value: string
  label: string
  description?: string
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[]
  value?: string[]
  onValueChange?: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  footerAction?: React.ReactNode
  onSearchChange?: (search: string) => void
  maxDisplay?: number
}

export function MultiSelectCombobox({
  options,
  value = [],
  onValueChange,
  placeholder = 'Select options...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results found.',
  disabled,
  className,
  footerAction,
  onSearchChange,
  maxDisplay = 2,
}: MultiSelectComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')

  const selectedOptions = options.filter((option) => value.includes(option.value))

  const handleSearchChange = (search: string) => {
    setSearchValue(search)
    onSearchChange?.(search)
  }

  const handleSelect = (selectedValue: string) => {
    const newValue = value.includes(selectedValue)
      ? value.filter((v) => v !== selectedValue)
      : [...value, selectedValue]
    onValueChange?.(newValue)
  }

  const handleRemove = (valueToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const newValue = value.filter((v) => v !== valueToRemove)
    onValueChange?.(newValue)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            'w-full justify-between font-normal h-auto min-h-10',
            !value.length && 'text-muted-foreground',
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1">
            {selectedOptions.length === 0 ? (
              <span>{placeholder}</span>
            ) : selectedOptions.length <= maxDisplay ? (
              selectedOptions.map((option) => (
                <Badge key={option.value} variant="secondary" className="gap-1">
                  {option.label}
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleRemove(option.value, e)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleRemove(option.value, e)
                      }
                    }}
                    className="ml-1 ring-offset-background rounded-full outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))
            ) : (
              <Badge variant="secondary">
                {selectedOptions.length} selected
              </Badge>
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options
                .filter((option) => {
                  if (!searchValue) return true
                  const searchLower = searchValue.toLowerCase()
                  const labelMatch = option.label.toLowerCase().includes(searchLower)
                  const descriptionMatch = option.description?.toLowerCase().includes(searchLower)
                  return labelMatch || descriptionMatch
                })
                .map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value.includes(option.value) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{option.label}</span>
                      {option.description && (
                        <span className="text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
            {footerAction && (
              <div className="border-t p-2">
                {footerAction}
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
