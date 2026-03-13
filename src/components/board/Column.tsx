import JobCard from "./JobCard"

export default function Column({ title, jobs }: any) {
  return (
    <div className="w-72 bg-gray-100 rounded-xl p-3">
      <h2 className="font-bold mb-3">{title}</h2>

      {jobs.map((job: any) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}