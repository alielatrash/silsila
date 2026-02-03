// Utility to format audit log entries into human-readable messages

interface AuditLogEntry {
  action: string
  entityType: string | null
  metadata: Record<string, unknown> | null
}

export function formatAuditMessage(entry: AuditLogEntry, userName: string): string {
  const { action, entityType, metadata } = entry

  // Helper to format route keys
  const formatRoute = (routeKey?: string) => {
    if (!routeKey) return ''
    const [pickup, dropoff] = routeKey.split('->')
    return `${pickup?.trim()} → ${dropoff?.trim()}`
  }

  // Helper to get party name
  const getPartyName = () => {
    if (metadata?.partyName) return metadata.partyName as string
    if (metadata?.clientName) return metadata.clientName as string
    if (metadata?.supplierName) return metadata.supplierName as string
    return 'Unknown'
  }

  // Helper to count loads
  const getTotalLoads = () => {
    let total = 0
    // Check for day loads
    for (let i = 1; i <= 7; i++) {
      const dayKey = `day${i}Loads` as keyof typeof metadata
      if (metadata && typeof metadata[dayKey] === 'number') {
        total += metadata[dayKey] as number
      }
    }
    // Check for week loads
    for (let i = 1; i <= 5; i++) {
      const weekKey = `week${i}Loads` as keyof typeof metadata
      if (metadata && typeof metadata[weekKey] === 'number') {
        total += metadata[weekKey] as number
      }
    }
    return total
  }

  // Helper to count commitments
  const getTotalCommitments = () => {
    let total = 0
    for (let i = 1; i <= 7; i++) {
      const dayKey = `day${i}Committed` as keyof typeof metadata
      if (metadata && typeof metadata[dayKey] === 'number') {
        total += metadata[dayKey] as number
      }
    }
    return total
  }

  // Format based on action type
  switch (action) {
    // Demand forecasts
    case 'demand.created': {
      const route = formatRoute(metadata?.routeKey as string)
      const client = getPartyName()
      const total = getTotalLoads()
      if (route && client) {
        return `created ${total} load${total !== 1 ? 's' : ''} for ${client} on ${route} route`
      }
      return 'created a demand forecast'
    }

    case 'demand.updated': {
      const route = formatRoute(metadata?.routeKey as string)
      const client = getPartyName()
      if (route && client) {
        return `updated demand forecast for ${client} on ${route} route`
      }
      return 'updated a demand forecast'
    }

    case 'demand.deleted': {
      const route = formatRoute(metadata?.routeKey as string)
      const client = getPartyName()
      if (route && client) {
        return `deleted demand forecast for ${client} on ${route} route`
      }
      return 'deleted a demand forecast'
    }

    // Supply commitments
    case 'supply.committed': {
      const route = formatRoute(metadata?.routeKey as string)
      const supplier = getPartyName()
      const total = getTotalCommitments()
      if (route && supplier) {
        return `committed ${total} truck${total !== 1 ? 's' : ''} from ${supplier} for ${route} route`
      }
      return 'created a supply commitment'
    }

    case 'supply.updated': {
      const route = formatRoute(metadata?.routeKey as string)
      const supplier = getPartyName()
      if (route && supplier) {
        return `updated commitment from ${supplier} for ${route} route`
      }
      return 'updated a supply commitment'
    }

    case 'supply.deleted': {
      const route = formatRoute(metadata?.routeKey as string)
      const supplier = getPartyName()
      if (route && supplier) {
        return `removed commitment from ${supplier} for ${route} route`
      }
      return 'deleted a supply commitment'
    }

    // User actions
    case 'user.logged_in':
      return 'logged in'

    case 'user.logged_out':
      return 'logged out'

    case 'user.registered':
      return 'registered a new account'

    case 'otp.verified':
      return 'verified OTP and completed registration'

    case 'user.role_changed': {
      const newRole = metadata?.newRole as string
      const previousRole = metadata?.previousRole as string
      if (newRole && previousRole) {
        return `changed role from ${previousRole} to ${newRole}`
      }
      return 'had their role changed'
    }

    // Repository items
    case 'client.created':
      return `created client "${metadata?.name || 'Unknown'}"`

    case 'client.updated':
      return `updated client "${metadata?.name || 'Unknown'}"`

    case 'client.deleted':
      return `deleted client "${metadata?.name || 'Unknown'}"`

    case 'supplier.created':
      return `created supplier "${metadata?.name || 'Unknown'}"`

    case 'supplier.updated':
      return `updated supplier "${metadata?.name || 'Unknown'}"`

    case 'supplier.deleted':
      return `deleted supplier "${metadata?.name || 'Unknown'}"`

    case 'city.created':
      return `created city "${metadata?.name || 'Unknown'}"`

    case 'city.updated':
      return `updated city "${metadata?.name || 'Unknown'}"`

    case 'city.deleted':
      return `deleted city "${metadata?.name || 'Unknown'}"`

    case 'truck_type.created':
      return `created truck type "${metadata?.name || 'Unknown'}"`

    case 'truck_type.updated':
      return `updated truck type "${metadata?.name || 'Unknown'}"`

    case 'truck_type.deleted':
      return `deleted truck type "${metadata?.name || 'Unknown'}"`

    case 'demand_category.created':
      return `created demand category "${metadata?.name || 'Unknown'}"`

    case 'demand_category.updated':
      return `updated demand category "${metadata?.name || 'Unknown'}"`

    case 'demand_category.deleted':
      return `deleted demand category "${metadata?.name || 'Unknown'}"`

    // Organization actions
    case 'organization.switched':
      return `switched to organization "${metadata?.organizationName || 'Unknown'}"`

    case 'organization.created':
      return `created organization "${metadata?.name || 'Unknown'}"`

    case 'organization.updated':
      return `updated organization settings`

    case 'organization.member_invited':
      return `invited ${metadata?.email || 'a user'} to the organization`

    case 'organization.member_removed':
      return `removed ${metadata?.email || 'a user'} from the organization`

    case 'organization.member_role_changed':
      return `changed role for ${metadata?.email || 'a user'}`

    // Default fallback
    default:
      return action.replace(/[._]/g, ' ')
  }
}

// Get action category for badge styling
export function getActionCategory(action: string): 'create' | 'update' | 'delete' | 'auth' | 'other' {
  if (action.includes('created') || action.includes('committed')) return 'create'
  if (action.includes('updated')) return 'update'
  if (action.includes('deleted') || action.includes('removed')) return 'delete'
  if (action.includes('logged') || action.includes('otp') || action.includes('registered')) return 'auth'
  return 'other'
}

// Get icon for action type
export function getActionIcon(action: string): string {
  if (action.includes('demand')) return '📦'
  if (action.includes('supply')) return '🚛'
  if (action.includes('client')) return '👤'
  if (action.includes('supplier')) return '🏢'
  if (action.includes('city')) return '🏙️'
  if (action.includes('truck_type')) return '🚚'
  if (action.includes('logged_in')) return '🔐'
  if (action.includes('logged_out')) return '🚪'
  if (action.includes('organization')) return '🏢'
  return '📝'
}
