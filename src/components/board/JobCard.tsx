export default function JobCard({ job }: any) {
    return (
      <div className="bg-white p-3 rounded-lg shadow mb-2">
        <h3 className="font-semibold">{job.company}</h3>
        <p className="text-sm text-gray-500">{job.role}</p>
      </div>
    )
  }