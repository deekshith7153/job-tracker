import { useApplications } from "@/hooks/useApplications"
import Board from "@/components/board/Board"

export default function Dashboard() {

  const { applications, loading } = useApplications()

  if (loading) {
    return <div>Loading...</div>
  }

  return (
    <Board jobs={applications} />
  )
}