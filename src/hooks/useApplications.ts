import { useEffect, useState } from "react"
import { getApplications } from "@/services/applicationService"

export const useApplications = () => {
  const [applications, setApplications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadApplications()
  }, [])

  const loadApplications = async () => {
    try {
      const data = await getApplications()
      setApplications(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return { applications, loading, reload: loadApplications }
}