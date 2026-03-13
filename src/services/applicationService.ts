import { supabase } from "@/lib/supabase"

export const getApplications = async () => {
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    throw error
  }

  return data
}