import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Custom hook for periodic data polling with auto-refresh.
 * @param {Function} fetcher - Async function to fetch data
 * @param {Object} options
 * @param {number} options.interval - Polling interval in ms (default: 10000)
 * @param {boolean} options.enabled - Whether polling is active (default: true)
 * @param {boolean} options.immediate - Fetch immediately on mount (default: true)
 */
export function usePolling(fetcher, { interval = 10000, enabled = true, immediate = true } = {}) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const intervalRef = useRef(null)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true)
      setError(null)
      const result = await fetcher()
      if (mountedRef.current) {
        setData(result)
        setLastUpdated(new Date())
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err)
        console.error('Polling error:', err)
      }
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [fetcher])

  const refresh = useCallback(() => fetchData(false), [fetchData])

  useEffect(() => {
    mountedRef.current = true
    if (immediate) fetchData(false)
    return () => { mountedRef.current = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!enabled || !interval) return
    intervalRef.current = setInterval(() => fetchData(true), interval)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, interval, fetchData])

  return { data, loading, error, refresh, lastUpdated }
}

/**
 * Hook for admin stats with computed trend data
 */
export function useAdminData(fetcher, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const result = await fetcher()
      setData(result)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  return { data, loading, error, refresh: load }
}
