import { APPLICATION_STATUS } from "@/constants/applicationStatus"
import Column from "./Column"

export default function Board({ jobs }: any) {

  const jobsByStatus = APPLICATION_STATUS.reduce((acc: any, status) => {
    acc[status] = jobs.filter((j: any) => j.status === status)
    return acc
  }, {})

  return (
    <div className="flex gap-4 overflow-x-auto p-4">

      {APPLICATION_STATUS.map((status) => (
        <Column
          key={status}
          title={status}
          jobs={jobsByStatus[status]}
        />
      ))}

    </div>
  )
}