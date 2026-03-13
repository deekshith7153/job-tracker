import React, { useState, useMemo, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { DndContext, useDraggable, useDroppable, closestCenter, type DragEndEvent } from "@dnd-kit/core";
type Status = "Saved" | "Applied" | "Referred" | "OA" | "Interview" | "Offer" | "Rejected" | "Ghosted";
type Priority = "High" | "Medium" | "Low";
type Source = "LinkedIn" | "Portal" | "Referral" | "WhatsApp" | "Other";

interface Application {
  id: string;
  user_id?: string;
  company: string;
  role: string;
  status: Status;
  priority: Priority;
  source: Source;
  linkedin_url?: string;
  contact_name?: string;
  contact_email?: string;
  jd_notes?: string;
  cover_letter?: string;
  applied_date?: string;
  last_update?: string;
  created_at?: string;
  referral_message_linkedin?: string;
  referral_message_linkedin_alumni?: string;
  referral_message_whatsapp?: string;
  referral_message_whatsapp_alumni?: string;
}

interface Profile {
  id: string;
  resume_text?: string;
  resume_filename?: string;
}

const STATUS_CONFIG: Record<Status, { color: string; bg: string; dot: string }> = {
  Saved:     { color: "text-gray-600",    bg: "bg-gray-50 border-gray-200",      dot: "bg-gray-400" },
  Applied:   { color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",      dot: "bg-blue-500" },
  Referred:  { color: "text-violet-700",  bg: "bg-violet-50 border-violet-200",  dot: "bg-violet-500" },
  OA:        { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",    dot: "bg-amber-500" },
  Interview: { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500" },
  Offer:     { color: "text-green-700",   bg: "bg-green-50 border-green-200",    dot: "bg-green-600" },
  Rejected:  { color: "text-red-600",     bg: "bg-red-50 border-red-200",        dot: "bg-red-500" },
  Ghosted:   { color: "text-gray-500",    bg: "bg-gray-50 border-gray-200",      dot: "bg-gray-400" },
};

const PRIORITY_CONFIG: Record<Priority, { style: string }> = {
  High:   { style: "bg-red-100 text-red-700 border-red-200" },
  Medium: { style: "bg-amber-100 text-amber-700 border-amber-200" },
  Low:    { style: "bg-green-100 text-green-700 border-green-200" },
};

const STATUSES: Status[] = ["Saved", "Applied", "Referred", "OA", "Interview", "Offer", "Rejected", "Ghosted"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const SOURCES: Source[] = ["LinkedIn", "Portal", "Referral", "WhatsApp", "Other"];

function getStatusConfig(status: Status | string | undefined | null) {
  return STATUS_CONFIG[status as Status] ?? STATUS_CONFIG.Saved;
}

function normalizeStatus(raw: string | null | undefined): Status {
  if (!raw) return "Saved";
  const upper = raw.toUpperCase();
  switch (upper) {
    case "SAVED":
      return "Saved";
    case "APPLIED":
      return "Applied";
    case "REFERRED":
      return "Referred";
    case "OA":
      return "OA";
    case "INTERVIEW":
      return "Interview";
    case "OFFER":
      return "Offer";
    case "REJECTED":
      return "Rejected";
    case "GHOSTED":
      return "Ghosted";
    default:
      return "Saved";
  }
}

const REFERRAL_TABS = [
  { key: "referral_message_linkedin",        label: "LinkedIn" },
  { key: "referral_message_linkedin_alumni", label: "LinkedIn Alumni" },
  { key: "referral_message_whatsapp",        label: "WhatsApp" },
  { key: "referral_message_whatsapp_alumni", label: "WhatsApp Alumni" },
] as const;

type ReferralKey = typeof REFERRAL_TABS[number]["key"];

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

async function extractTextFromPDF(file: File): Promise<string> {
  // Read as base64 and send to Claude to extract text
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(",")[1];
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: [{
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 }
              }, {
                type: "text",
                text: "Extract all text content from this resume. Return only the plain text, no formatting."
              }]
            }]
          })
        });
        const data = await response.json();
        resolve(data.content?.[0]?.text || "");
      } catch {
        resolve("");
      }
    };
    reader.readAsDataURL(file);
  });
}

async function generateReferralMessage(
  type: ReferralKey,
  company: string,
  role: string,
  contactName: string,
  resumeText: string
): Promise<string> {
  const isAlumni = type.includes("alumni");
  const isWhatsApp = type.includes("whatsapp");

  const prompt = `You are helping a software engineer write a referral request message.

Candidate background (from resume):
${resumeText || "Java/Spring Boot backend engineer, 1.6 years experience at HummingWave Technologies, B.E. CSE from RV College of Engineering (RVCE) Bengaluru, 9.03 CGPA, IEEE publication, skills: Java, Spring Boot, Microservices, Kafka, PostgreSQL, AWS"}

They want to reach out to: ${contactName || "a contact"} at ${company} for the role: ${role}

Write a ${isWhatsApp ? "casual WhatsApp" : "professional LinkedIn"} message${isAlumni ? " — this person is an RVCE alumni so mention the RVCE connection warmly" : ""}.

Rules:
- ${isWhatsApp ? "Casual, friendly, short (under 120 words), conversational tone" : "Professional but warm, concise (under 150 words)"}
- Mention the specific role: ${role} at ${company}
- Highlight 1-2 most relevant skills from the resume
- Ask for a referral clearly but politely
- ${isAlumni ? "Start with the RVCE alumni connection. End with 'RVCE, CSE — Deekshith'" : "End with name: Deekshith"}
- No generic filler phrases
- Return only the message text, nothing else`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await response.json();
  return data.content?.[0]?.text || "";
}

function DraggableCard({ app, children }: any) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: app.id
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
        zIndex: isDragging ? 50 : "auto"
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="touch-none"
      {...listeners}
      {...attributes}
    >
      {children}
    </div>
  );
}

function DroppableColumn({ status, children }: any) {
  const { setNodeRef } = useDroppable({
    id: status
  });

  return (
    <div ref={setNodeRef} className="min-h-[300px]">
      {children}
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "All">("All");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState<ReferralKey | null>(null);
  const [savedMsg, setSavedMsg] = useState<ReferralKey | null>(null);
  const [copied, setCopied] = useState<ReferralKey | null>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Partial<Application>>({
    status: "Saved", priority: "Medium", source: "LinkedIn",
    applied_date: new Date().toISOString().slice(0, 10),
  });

  // Auth
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user) { fetchApps(); fetchProfile(); }
  }, [user]);

  async function fetchApps() {
    setDbLoading(true);
  
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
  
    if (!error && data) {
      const formatted = data.map((a) => ({
        ...a,
        status: normalizeStatus(a.status),
      }));
  
      setApps(formatted);
    }
  
    setDbLoading(false);
  }

  async function fetchProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    if (data) setProfile(data);
  }

  async function handleResumeUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingResume(true);
    try {
      const text = await extractTextFromPDF(file);
      const { data, error } = await supabase.from("profiles").upsert({
        id: user.id, resume_text: text, resume_filename: file.name, updated_at: new Date().toISOString()
      }).select().single();
      if (!error && data) setProfile(data);
    } finally {
      setUploadingResume(false);
    }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin } });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setApps([]); setProfile(null);
  }

  async function saveApp() {
    if (!form.company || !form.role) return;
  
    setSaving(true);
  
    const today = new Date().toISOString();
  
    const payload = {
      ...form,
      status: form.status?.toUpperCase(),
      user_id: user.id,
      last_update: today,
    };
  
    if (editingApp) {
      const { data, error } = await supabase
        .from("applications")
        .update(payload)
        .eq("id", editingApp.id)
        .select()
        .single();
  
      console.log("UPDATE RESULT:", data, error);
  
      if (!error && data) {
        const formatted = {
          ...data,
          status: normalizeStatus(data.status),
        };
  
        setApps((prev) =>
          prev.map((a) => (a.id === editingApp.id ? formatted : a))
        );
        setDetailApp(formatted);
      }
    } else {
      const { data, error } = await supabase
        .from("applications")
        .insert(payload)
        .select()
        .single();
  
      console.log("INSERT RESULT:", data, error);
  
      if (!error && data) {
        const formatted = {
          ...data,
          status: normalizeStatus(data.status),
        };
  
        setApps((prev) => [formatted, ...prev]);
      }
    }
  
    setSaving(false);
    setAddOpen(false);
    setEditingApp(null);
  }

  async function deleteApp(id: string) {
    await supabase.from("applications").delete().eq("id", id);
    setApps(prev => prev.filter(a => a.id !== id));
    setDetailApp(null);
  }

  async function updateStatus(id: string, status: Status) {
    const { data, error } = await supabase
      .from("applications")
      .update({
        status: status.toUpperCase(),
        last_update: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();
  
    if (!error && data) {
      const formatted = {
        ...data,
        status: data.status.charAt(0) + data.status.slice(1).toLowerCase(),
      };
  
      setApps((prev) => prev.map((a) => (a.id === id ? formatted : a)));
  
      setDetailApp((prev) => (prev?.id === id ? formatted : prev));
    }
  }

  async function generateMessage(tabKey: ReferralKey) {
    if (!detailApp) return;
    setGeneratingMsg(tabKey);
    try {
      const msg = await generateReferralMessage(
        tabKey, detailApp.company, detailApp.role,
        detailApp.contact_name || "", profile?.resume_text || ""
      );
      const { data } = await supabase.from("applications")
        .update({ [tabKey]: msg, last_update: new Date().toISOString() }).eq("id", detailApp.id).select().single();
      if (data) { setApps(prev => prev.map(a => a.id === detailApp.id ? data : a)); setDetailApp(data); }
    } finally {
      setGeneratingMsg(null);
    }
  }

  async function saveMessage(tabKey: ReferralKey, value: string) {
    if (!detailApp) return;
    const { data } = await supabase.from("applications")
      .update({ [tabKey]: value, last_update: new Date().toISOString() }).eq("id", detailApp.id).select().single();
    if (data) { setApps(prev => prev.map(a => a.id === detailApp.id ? data : a)); setDetailApp(data); setSavedMsg(tabKey); setTimeout(() => setSavedMsg(null), 2000); }
  }

  function copyMessage(tabKey: ReferralKey, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(tabKey); setTimeout(() => setCopied(null), 2000);
  }

  function openAdd() {
    setForm({ status: "Saved", priority: "Medium", source: "LinkedIn", applied_date: new Date().toISOString().slice(0, 10) });
    setEditingApp(null); setAddOpen(true);
  }

  function openEdit(app: Application) {
    setForm({ ...app }); setEditingApp(app); setAddOpen(true);
  }

  const filtered = useMemo(() => apps.filter(a => {
    const normalized = normalizeStatus(a.status);
    if (filterStatus !== "All" && normalized !== filterStatus) return false;
    if (search && !`${a.company} ${a.role} ${a.contact_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [apps, filterStatus, search]);

  const stats = useMemo(() => ({
    total: apps.length,
    saved: apps.filter(a => normalizeStatus(a.status) === "Saved").length,
    active: apps.filter(a => !["Rejected", "Ghosted", "Saved"].includes(normalizeStatus(a.status))).length,
    interviews: apps.filter(a => ["Interview", "Offer"].includes(normalizeStatus(a.status))).length,
    needsFollowUp: apps.filter(a => !["Rejected", "Ghosted", "Offer"].includes(normalizeStatus(a.status)) && daysSince(a.last_update) >= 7).length,
  }), [apps]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
  
    if (!over) return;
  
    const appId = String(active.id);
    const newStatus = over.id as Status;
  
    const app = apps.find(a => a.id === appId);
  
    if (!app) return;
    if (app.status === newStatus) return;
  
    updateStatus(appId, newStatus);
  }

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <Card className="w-full max-w-md border-white/10 bg-slate-950/70 backdrop-blur-xl shadow-2xl shadow-black/40">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-50">
                Job Hunt Tracker
              </CardTitle>
              <p className="text-sm text-slate-400 mt-1">
                A focused board for managing every application in one place.
              </p>
            </div>
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center text-lg">
              🎯
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/5 px-4 py-3 text-xs text-emerald-200/90">
            <p className="font-medium mb-1">Built for active job hunts</p>
            <p className="text-emerald-100/80">
              Track roles, interviews, and follow‑ups without losing context in spreadsheets or notes.
            </p>
          </div>
          <Button
            onClick={signInWithGoogle}
            className="w-full h-10 bg-slate-50 text-slate-900 font-medium hover:bg-white"
          >
            Continue with Google
          </Button>
          <p className="text-[11px] leading-relaxed text-slate-500 text-center">
            We only use your Google account for secure sign‑in.
            <br />
            Your job data stays private to you.
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white/80 backdrop-blur border-b border-slate-200 px-4 sm:px-6 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-slate-50 flex items-center justify-center text-sm">
              JH
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-semibold text-slate-900 tracking-tight">
                Job Hunt Tracker
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs sm:max-w-none">
                {user.email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <input
              ref={resumeInputRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleResumeUpload}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => resumeInputRef.current?.click()}
              disabled={uploadingResume}
              className="hidden sm:inline-flex text-xs h-8 text-slate-600"
            >
              {uploadingResume
                ? "Reading resume..."
                : profile?.resume_filename
                ? `📄 ${profile.resume_filename}`
                : "📄 Upload Resume"}
            </Button>
            <Button
              size="sm"
              onClick={openAdd}
              className="h-8 bg-slate-900 hover:bg-slate-800 text-xs text-white px-3"
            >
              + Add
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={signOut}
              className="h-8 text-xs text-slate-500"
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {/* Alerts */}
        <div className="space-y-2">
          {stats.saved > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900 flex-1">
                <span className="mr-1.5">⚠️</span>
                <span className="font-medium">
                  {stats.saved} saved post{stats.saved > 1 ? "s" : ""}
                </span>{" "}
                you haven&apos;t applied to yet.
              </p>
              <button
                onClick={() => setFilterStatus("Saved")}
                className="text-xs font-medium text-amber-800 underline underline-offset-2"
              >
                View
              </button>
            </div>
          )}
          {stats.needsFollowUp > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-blue-900 flex-1">
                <span className="mr-1.5">🔔</span>
                <span className="font-medium">
                  {stats.needsFollowUp} application
                  {stats.needsFollowUp > 1 ? "s" : ""}
                </span>{" "}
                with no update in 7+ days.
              </p>
              <button
                onClick={() => setFilterStatus("Applied")}
                className="text-xs font-medium text-blue-800 underline underline-offset-2"
              >
                View
              </button>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total tracked", value: stats.total, icon: "📋" },
            { label: "Saved (not applied)", value: stats.saved, icon: "🔖" },
            { label: "Active pipeline", value: stats.active, icon: "⚡" },
            { label: "Interviews", value: stats.interviews, icon: "🎯" },
          ].map((s) => (
            <Card
              key={s.label}
              className="border-slate-200 shadow-none bg-white/90"
            >
              <CardContent className="pt-4 pb-3 flex items-center gap-3">
                <div className="text-2xl">{s.icon}</div>
                <div>
                  <div className="text-xl font-semibold text-slate-900 leading-none">
                    {s.value}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    {s.label}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
          <Input
            placeholder="Search companies, roles, contacts…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-md bg-white border-slate-200 text-sm h-9"
          />
          <div className="flex items-center gap-2">
            <Select
              value={filterStatus}
              onValueChange={(v) => setFilterStatus(v as any)}
            >
              <SelectTrigger className="w-40 bg-white border-slate-200 text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {dbLoading && (
              <span className="text-[11px] text-slate-400">Syncing…</span>
            )}
          </div>
          <span className="text-xs text-slate-400 sm:ml-auto">
            {filtered.length} result{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Kanban */}
        <div>
          <h2 className="text-[11px] font-semibold text-slate-400 uppercase tracking-[0.18em] mb-2">
            Pipeline
          </h2>
          <DndContext
            onDragEnd={handleDragEnd}
            collisionDetection={closestCenter}
          >
            <div className="overflow-x-auto">
              <div className="flex gap-4 min-w-max pb-2">
                {(
                  [
                    "Saved",
                    "Applied",
                    "Referred",
                    "OA",
                    "Interview",
                    "Offer",
                    "Rejected",
                    "Ghosted",
                  ] as Status[]
                ).map((status) => {
                  const cfg = getStatusConfig(status);
                  const colApps = filtered.filter(
                    (a) => normalizeStatus(a.status) === status
                  );
                  const faded = ["Rejected", "Ghosted"].includes(status);
                  return (
                    <DroppableColumn key={status} status={status}>
                      <div className="w-60 sm:w-64 flex-shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                          <span
                            className={`text-xs font-semibold ${
                              faded ? "text-slate-400" : "text-slate-700"
                            }`}
                          >
                            {status}
                          </span>
                          <span className="ml-auto text-[11px] text-slate-400">
                            {colApps.length}
                          </span>
                        </div>
                        <div className="space-y-2 min-h-16">
                          {colApps.map((app) => (
                            <DraggableCard key={app.id} app={app}>
                              <div
                                onClick={() => setDetailApp(app)}
                                className={`bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all ${
                                  app.priority === "High" && !faded
                                    ? "border-l-4 border-l-red-400 border-slate-200"
                                    : "border-slate-200"
                                } ${faded ? "opacity-60" : ""}`}
                              >
                                <div className="font-semibold text-slate-900 text-sm truncate">
                                  {app.company}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate mt-0.5">
                                  {app.role}
                                </div>
                                <div className="flex items-center gap-1 mt-2">
                                  <span
                                    className={`text-[10px] px-1.5 py-0.5 rounded border ${
                                      PRIORITY_CONFIG[app.priority].style
                                    }`}
                                  >
                                    {app.priority}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">
                                    {app.source}
                                  </span>
                                </div>
                                <div className="text-[10px] text-slate-300 mt-1.5">
                                  {daysSince(app.last_update)}d ago
                                </div>
                              </div>
                            </DraggableCard>
                          ))}
                          {colApps.length === 0 && (
                            <div className="text-[11px] text-slate-200 text-center py-6 border border-dashed border-slate-200/70 rounded-lg">
                              Drop a card here
                            </div>
                          )}
                        </div>
                      </div>
                    </DroppableColumn>
                  );
                })}
              </div>
            </div>
          </DndContext>
        </div>

        {/* Table */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-5 flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800">
              All applications
            </CardTitle>
            <span className="text-[11px] text-slate-400">
              Click any row to open details
            </span>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-100 bg-slate-50/60">
                  <tr className="text-[11px] text-slate-400 uppercase tracking-[0.16em]">
                    <th className="text-left px-5 py-2.5 font-medium">Company</th>
                    <th className="text-left px-4 py-2.5 font-medium">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                    <th className="text-left px-4 py-2.5 font-medium">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-5 py-8 text-center text-sm text-slate-400"
                      >
                        {dbLoading
                          ? "Loading…"
                          : "No applications yet — click + Add to create your first one."}
                      </td>
                    </tr>
                  )}
                  {filtered.map((app) => {
                    const cfg = getStatusConfig(normalizeStatus(app.status));
                    return (
                      <tr
                        key={app.id}
                        onClick={() => setDetailApp(app)}
                        className="border-b border-slate-50 hover:bg-slate-50/80 cursor-pointer transition-colors"
                      >
                        <td className="px-5 py-2.5 font-semibold text-slate-900">
                          {app.company}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500 max-w-[160px] truncate text-xs">
                          {app.role}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}
                            />
                            {normalizeStatus(app.status)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${
                              PRIORITY_CONFIG[app.priority].style
                            }`}
                          >
                            {app.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                          {app.source}
                        </td>
                        <td className="px-4 py-2.5 text-slate-400 text-xs">
                          {daysSince(app.last_update)}d ago
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!detailApp} onOpenChange={o => !o && setDetailApp(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {detailApp && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold text-slate-900">
                  {detailApp!.company}
                </DialogTitle>
                <p className="text-sm text-slate-500">{detailApp!.role}</p>
              </DialogHeader>
              <div className="space-y-4 mt-1">
                {/* Status badges */}
                <div className="flex gap-2 flex-wrap">
                  {(() => { const normalized = normalizeStatus(detailApp!.status); const c = getStatusConfig(normalized); return (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.bg} ${c.color}`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />{normalized}
                    </span>
                  );})()}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_CONFIG[detailApp!.priority].style}`}>
                    {detailApp!.priority}
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                    {detailApp!.source}
                  </span>
                </div>

                <Separator />

                {/* Details */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailApp!.contact_name && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                        Contact
                      </div>
                      <div className="font-medium text-slate-800">
                        {detailApp!.contact_name}
                      </div>
                      {detailApp!.contact_email && (
                        <div className="text-xs text-slate-500">
                          {detailApp!.contact_email}
                        </div>
                      )}
                    </div>
                  )}
                  {detailApp!.jd_notes && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                        JD Notes
                      </div>
                      <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 max-h-32 overflow-y-auto">
                        {detailApp!.jd_notes}
                      </div>
                    </div>
                  )}
                  {detailApp!.cover_letter && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-1">
                        Cover Letter / Email Sent
                      </div>
                      <div className="text-sm text-slate-700 bg-slate-50 rounded-lg p-3 border border-slate-100 max-h-32 overflow-y-auto">
                        {detailApp!.cover_letter}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Referral Messages */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] text-slate-400 uppercase tracking-wide font-medium">
                      Referral Messages
                    </div>
                    {!profile?.resume_text && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        Upload resume for better AI messages
                      </span>
                    )}
                  </div>
                  <Tabs defaultValue="referral_message_linkedin">
                    <TabsList className="grid grid-cols-4 h-8 mb-3">
                      {REFERRAL_TABS.map(tab => (
                        <TabsTrigger
                          key={tab.key}
                          value={tab.key}
                          className="text-[11px]"
                        >
                          {tab.label}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                    {REFERRAL_TABS.map(tab => {
                      const msg = detailApp![tab.key] || "";
                      return (
                        <TabsContent key={tab.key} value={tab.key} className="space-y-2 mt-0">
                          <Textarea
                            value={msg}
                            onChange={e => setDetailApp(prev => prev ? { ...prev, [tab.key]: e.target.value } : null)}
                            placeholder={`Your ${tab.label} referral message will appear here...`}
                            rows={5}
                            className="text-sm resize-none"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => generateMessage(tab.key)}
                              disabled={generatingMsg === tab.key}
                              className="text-xs flex-1"
                            >
                              {generatingMsg === tab.key ? "✨ Generating..." : "✨ Generate with AI"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => saveMessage(tab.key, msg)}
                              disabled={!msg}
                              className="text-xs"
                            >
                              {savedMsg === tab.key ? "✓ Saved" : "Save"}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => copyMessage(tab.key, msg)}
                              disabled={!msg}
                              className="text-xs"
                            >
                              {copied === tab.key ? "✓ Copied!" : "Copy"}
                            </Button>
                          </div>
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>

                <Separator />

                {/* Update status */}
                <div>
                  <div className="text-[11px] text-slate-400 uppercase tracking-wide mb-2">
                    Update Status
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => {
                      const c = getStatusConfig(s);
                      return (
                        <button
                          key={s}
                          onClick={() => detailApp && updateStatus(detailApp.id, s)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            detailApp.status === s
                              ? `${c.bg} ${c.color} font-semibold`
                              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!detailApp) return;
                      openEdit(detailApp);
                      setDetailApp(null);
                    }}
                    className="flex-1 text-sm"
                  >
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => detailApp && deleteApp(detailApp.id)}
                    className="text-sm text-red-500 border-red-200 hover:bg-red-50"
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Modal */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) { setAddOpen(false); setEditingApp(null); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingApp ? "Edit application" : "Add application"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Company *
                </Label>
                <Input value={form.company || ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Visa" /></div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Role *
                </Label>
                <Input value={form.role || ""} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. SDE-1" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Status
                </Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Status }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Priority
                </Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select></div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Source
                </Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v as Source }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">
                LinkedIn Post URL
              </Label>
              <Input value={form.linkedin_url || ""} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/posts/..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Contact Name
                </Label>
                <Input value={form.contact_name || ""} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="e.g. Animesh Raj" /></div>
              <div>
                <Label className="text-xs text-slate-500 mb-1 block">
                  Contact Email
                </Label>
                <Input value={form.contact_email || ""} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="hr@company.com" /></div>
            </div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">
                JD Notes
              </Label>
              <Textarea value={form.jd_notes || ""} onChange={e => setForm(f => ({ ...f, jd_notes: e.target.value }))}
                placeholder="Paste the job description or key requirements…" rows={3} /></div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">
                Cover Letter / Email Sent
              </Label>
              <Textarea value={form.cover_letter || ""} onChange={e => setForm(f => ({ ...f, cover_letter: e.target.value }))}
                placeholder="Paste the email or cover letter you sent…" rows={3} /></div>
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">
                Applied Date
              </Label>
              <Input type="date" value={form.applied_date || ""} onChange={e => setForm(f => ({ ...f, applied_date: e.target.value }))} /></div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveApp} disabled={saving} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white">
                {saving ? "Saving..." : editingApp ? "Save changes" : "Add application"}
              </Button>
              <Button variant="outline" onClick={() => { setAddOpen(false); setEditingApp(null); }}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
