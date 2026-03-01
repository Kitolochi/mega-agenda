import { useRef, useCallback, useEffect } from 'react'

export function useAutoSave<T>(
  saveFn: (value: T) => Promise<void>,
  delay: number = 500
): (value: T) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveFnRef = useRef(saveFn)
  saveFnRef.current = saveFn

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  return useCallback((value: T) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => {
      saveFnRef.current(value)
    }, delay)
  }, [delay])
}
