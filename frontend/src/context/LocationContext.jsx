/**
 * LocationContext — provides the current user's assigned location filter.
 *
 * Mirrors backend/scoping.py: a user whose roles are ALL location/supplier-scoped
 * (warehouse_user, repair_centre, supplier) and who holds a location role is
 * scoped to their assigned locations. Any internal role → unrestricted.
 * The backend enforces the actual filtering; this context only drives the UI
 * (scope banner). `locationIdsParam` is still used by the Alerts page, whose
 * filtering stays client-driven until the R4 alerting rebuild.
 *
 * Components use useLocationFilter() hook to get:
 *   { locationIds, locationIdsParam, isFiltered, locationCodes }
 *
 * locationIdsParam: "3,7" — ready to pass as ?location_ids= query param
 * isFiltered: true when the user is scoped to specific locations
 */
import { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/auth.js'

const LocationContext = createContext({
  locationIds: [],
  locationIdsParam: null,
  isFiltered: false,
  locations: [],        // [{id, code, name}]
  locationCodes: '',    // "Oostrum, Memphis"
  loading: true,
})

export function LocationProvider({ auth, children }) {
  const [state, setState] = useState({
    locationIds: [],
    locationIdsParam: null,
    isFiltered: false,
    locations: [],
    locationCodes: '',
    loading: true,
  })

  useEffect(() => {
    const roles = auth?.roles || (auth?.role ? [auth.role] : [])
    const SCOPED = ['warehouse_user', 'repair_centre', 'supplier']
    const isScoped = roles.length > 0 &&
                     roles.every(r => SCOPED.includes(r)) &&
                     roles.some(r => r === 'warehouse_user' || r === 'repair_centre')

    if (!isScoped || !auth?.token) {
      // Not a scoped role — no location filter
      setState({ locationIds: [], locationIdsParam: null, isFiltered: false, locations: [], locationCodes: '', loading: false })
      return
    }

    // Fetch assigned locations (user_locations) for this scoped user
    api.get('/users/me').then(res => {
      const locs = res.data?.locations || []
      if (locs.length > 0) {
        const ids = locs.map(l => l.id)
        setState({
          locationIds: ids,
          locationIdsParam: ids.join(','),
          isFiltered: true,
          locations: locs,
          locationCodes: locs.map(l => l.code || l.name || l.id).join(', '),
          loading: false,
        })
      } else {
        // No locations assigned — backend returns no location-scoped data; banner says so
        setState({ locationIds: [], locationIdsParam: null, isFiltered: true, locations: [], locationCodes: '', loading: false })
      }
    }).catch(() => {
      setState({ locationIds: [], locationIdsParam: null, isFiltered: false, locations: [], locationCodes: '', loading: false })
    })
  }, [auth?.token, auth?.role, JSON.stringify(auth?.roles)])

  return (
    <LocationContext.Provider value={state}>
      {children}
    </LocationContext.Provider>
  )
}

export function useLocationFilter() {
  return useContext(LocationContext)
}
