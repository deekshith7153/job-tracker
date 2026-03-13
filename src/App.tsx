import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/lib/supabase";

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
}

const STATUS_CONFIG: Record<Status, { color: string; bg: string; dot: string }> = {
  Saved:     { color: "text-gray-600",   bg: "bg-gray-50 border-gray-200",     dot: "bg-gray-400" },
  Applied:   { color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",     dot: "bg-blue-500" },
  Referred:  { color: "text-violet-700", bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
  OA:        { color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",   dot: "bg-amber-500" },
  Interview: { color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200",dot: "bg-emerald-500" },
  Offer:     { color: "text-green-700",  bg: "bg-green-50 border-green-200",   dot: "bg-green-600" },
  Rejected:  { color: "text-red-600",    bg: "bg-red-50 border-red-200",       dot: "bg-red-500" },
  Ghosted:   { color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",     dot: "bg-gray-400" },
};

const PRIORITY_CONFIG: Record<Priority, { style: string }> = {
  High:   { style: "bg-red-100 text-red-700 border-red-200" },
  Medium: { style: "bg-amber-100 text-amber-700 border-amber-200" },
  Low:    { style: "bg-green-100 text-green-700 border-green-200" },
};

const STATUSES: Status[] = ["Saved", "Applied", "Referred", "OA", "Interview", "Offer", "Rejected", "Ghosted"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];
const SOURCES: Source[] = ["LinkedIn", "Portal", "Referral", "WhatsApp", "Other"];

function daysSince(dateStr?: string): number {
  if (!dateStr) return 0;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<Application[]>([]);
  const [dbLoading, setDbLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<Status | "All">("All");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<Application>>({
    status: "Saved", priority: "Medium", source: "LinkedIn",
    applied_date: new Date().toISOString().slice(0, 10),
  });

  // Auth listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load apps when user logs in
  useEffect(() => {
    if (user) fetchApps();
  }, [user]);

  async function fetchApps() {
    setDbLoading(true);
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setApps(data);
    setDbLoading(false);
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setApps([]);
  }

  async function saveApp() {
    if (!form.company || !form.role) return;
    setSaving(true);
    if (editingApp) {
      const { data, error } = await supabase
        .from("applications")
        .update({ ...form, last_update: new Date().toISOString() })
        .eq("id", editingApp.id)
        .select()
        .single();
      if (!error && data) {
        setApps(prev => prev.map(a => a.id === editingApp.id ? data : a));
        setDetailApp(data);
      }
    } else {
      const { data, error } = await supabase
        .from("applications")
        .insert({ ...form, user_id: user.id, last_update: new Date().toISOString() })
        .select()
        .single();
      if (!error && data) setApps(prev => [data, ...prev]);
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
    const { data } = await supabase
      .from("applications")
      .update({ status, last_update: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (data) {
      setApps(prev => prev.map(a => a.id === id ? data : a));
      setDetailApp(prev => prev?.id === id ? data : prev);
    }
  }

  function openAdd() {
    setForm({ status: "Saved", priority: "Medium", source: "LinkedIn",
      applied_date: new Date().toISOString().slice(0, 10) });
    setEditingApp(null);
    setAddOpen(true);
  }

  function openEdit(app: Application) {
    setForm({ ...app });
    setEditingApp(app);
    setAddOpen(true);
  }

  const filtered = useMemo(() => apps.filter(a => {
    if (filterStatus !== "All" && a.status !== filterStatus) return false;
    if (search && !`${a.company} ${a.role} ${a.contact_name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [apps, filterStatus, search]);

  const stats = useMemo(() => ({
    total: apps.length,
    saved: apps.filter(a => a.status === "Saved").length,
    active: apps.filter(a => !["Rejected", "Ghosted", "Saved"].includes(a.status)).length,
    interviews: apps.filter(a => ["Interview", "Offer"].includes(a.status)).length,
    needsFollowUp: apps.filter(a => !["Rejected", "Ghosted", "Offer"].includes(a.status) && daysSince(a.last_update) >= 7).length,
  }), [apps]);

  const kanbanStatuses: Status[] = ["Saved", "Applied", "Referred", "OA", "Interview", "Offer"];

  // Loading screen
  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading...</div>
    </div>
  );

  // Login screen
  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <Card className="w-full max-w-sm border-gray-200 shadow-none">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-xl font-bold text-gray-900">Job Hunt Tracker</CardTitle>
          <p className="text-sm text-gray-500 mt-1">Your personal career OS</p>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <Button onClick={signInWithGoogle} className="w-full bg-gray-900 hover:bg-gray-800 text-white">
            Continue with Google
          </Button>
          <p className="text-xs text-gray-400 text-center">Your data is private and only visible to you</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Job Hunt Tracker</h1>
            <p className="text-xs text-gray-400 mt-0.5">{user.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={openAdd} className="bg-gray-900 hover:bg-gray-800 text-white text-sm h-9">
              + Add Application
            </Button>
            <Button variant="outline" onClick={signOut} className="text-sm h-9 text-gray-500">
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alerts */}
        {stats.saved > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-amber-800">
              ⚠️ <span className="font-medium">{stats.saved} saved post{stats.saved > 1 ? "s" : ""}</span> you haven't applied to yet
            </p>
            <button onClick={() => setFilterStatus("Saved")} className="text-xs text-amber-700 underline">View all</button>
          </div>
        )}
        {stats.needsFollowUp > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between">
            <p className="text-sm text-blue-800">
              🔔 <span className="font-medium">{stats.needsFollowUp} application{stats.needsFollowUp > 1 ? "s" : ""}</span> with no update in 7+ days — time to follow up
            </p>
            <button onClick={() => setFilterStatus("Applied")} className="text-xs text-blue-700 underline">View all</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Tracked", value: stats.total, icon: "📋" },
            { label: "Saved (not applied)", value: stats.saved, icon: "🔖" },
            { label: "Active Pipeline", value: stats.active, icon: "⚡" },
            { label: "Interviews", value: stats.interviews, icon: "🎯" },
          ].map(s => (
            <Card key={s.label} className="border-gray-200 shadow-none bg-white">
              <CardContent className="pt-5 pb-4 flex items-center gap-3">
                <div className="text-2xl">{s.icon}</div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 leading-none">{s.value}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <Input placeholder="Search companies, roles…" value={search}
            onChange={e => setSearch(e.target.value)}
            className="max-w-xs bg-white border-gray-200 text-sm h-9" />
          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as any)}>
            <SelectTrigger className="w-36 bg-white border-gray-200 text-sm h-9">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Statuses</SelectItem>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {dbLoading && <span className="text-xs text-gray-400">Loading...</span>}
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Kanban */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-2">
              {[...kanbanStatuses, ...["Rejected", "Ghosted"] as Status[]].map(status => {
                const cfg = STATUS_CONFIG[status as Status];
                const colApps = filtered.filter(a => a.status === status);
                const faded = ["Rejected", "Ghosted"].includes(status);
                return (
                  <div key={status} className="w-52 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className={`text-xs font-semibold ${faded ? "text-gray-400" : "text-gray-700"}`}>{status}</span>
                      <span className="ml-auto text-xs text-gray-400 tabular-nums">{colApps.length}</span>
                    </div>
                    <div className="space-y-2 min-h-16">
                      {colApps.map(app => (
                        <div key={app.id} onClick={() => setDetailApp(app)}
                          className={`bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${
                            app.priority === "High" && !faded ? "border-l-4 border-l-red-400 border-gray-200" : "border-gray-200"
                          } ${faded ? "opacity-60" : ""}`}>
                          <div className="font-semibold text-gray-900 text-sm truncate">{app.company}</div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">{app.role}</div>
                          <div className="flex items-center gap-1 mt-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_CONFIG[app.priority].style}`}>{app.priority}</span>
                            {app.source && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{app.source}</span>}
                          </div>
                          <div className="text-[10px] text-gray-300 mt-1.5">{daysSince(app.last_update)}d ago</div>
                        </div>
                      ))}
                      {colApps.length === 0 && (
                        <div className="text-xs text-gray-200 text-center py-6 border border-dashed border-gray-150 rounded-lg">—</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <Card className="border-gray-200 shadow-none">
          <CardHeader className="pb-2 pt-4 px-5">
            <CardTitle className="text-sm font-semibold text-gray-700">All Applications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-72">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100 bg-gray-50/50">
                  <tr className="text-[11px] text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-5 py-2.5 font-medium">Company</th>
                    <th className="text-left px-4 py-2.5 font-medium">Role</th>
                    <th className="text-left px-4 py-2.5 font-medium">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium">Priority</th>
                    <th className="text-left px-4 py-2.5 font-medium">Source</th>
                    <th className="text-left px-4 py-2.5 font-medium">Last Update</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-gray-400">
                      {dbLoading ? "Loading your applications..." : "No applications yet — click + Add Application to start"}
                    </td></tr>
                  )}
                  {filtered.map(app => {
                    const cfg = STATUS_CONFIG[app.status];
                    return (
                      <tr key={app.id} onClick={() => setDetailApp(app)}
                        className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors">
                        <td className="px-5 py-2.5 font-semibold text-gray-900">{app.company}</td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[140px] truncate text-xs">{app.role}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{app.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_CONFIG[app.priority].style}`}>{app.priority}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{app.source}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{daysSince(app.last_update)}d ago</td>
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
        <DialogContent className="max-w-md">
          {detailApp && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-gray-900">{detailApp.company}</DialogTitle>
                <p className="text-sm text-gray-500">{detailApp.role}</p>
              </DialogHeader>
              <div className="space-y-4 mt-1">
                <div className="flex gap-2 flex-wrap">
                  {(() => { const c = STATUS_CONFIG[detailApp.status]; return (
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${c.bg} ${c.color}`}>
                      <span className={`w-2 h-2 rounded-full ${c.dot}`} />{detailApp.status}
                    </span>
                  );})()}
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_CONFIG[detailApp.priority].style}`}>{detailApp.priority}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">{detailApp.source}</span>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {detailApp.contact_name && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Contact</div>
                      <div className="font-medium text-gray-800">{detailApp.contact_name}</div>
                      {detailApp.contact_email && <div className="text-xs text-gray-500">{detailApp.contact_email}</div>}
                    </div>
                  )}
                  {detailApp.linkedin_url && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">LinkedIn Post</div>
                      <a href={detailApp.linkedin_url} target="_blank" rel="noreferrer" className="text-xs text-blue-600 underline truncate block">{detailApp.linkedin_url}</a>
                    </div>
                  )}
                  {detailApp.jd_notes && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">JD Notes</div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 max-h-24 overflow-y-auto">{detailApp.jd_notes}</div>
                    </div>
                  )}
                  {detailApp.cover_letter && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Cover Letter / Email Sent</div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 max-h-24 overflow-y-auto">{detailApp.cover_letter}</div>
                    </div>
                  )}
                </div>
                <Separator />
                <div>
                  <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-2">Update Status</div>
                  <div className="flex flex-wrap gap-1.5">
                    {STATUSES.map(s => {
                      const c = STATUS_CONFIG[s];
                      return (
                        <button key={s} onClick={() => updateStatus(detailApp.id, s)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            detailApp.status === s ? `${c.bg} ${c.color} font-semibold` : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                          }`}>{s}</button>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button variant="outline" onClick={() => { openEdit(detailApp); setDetailApp(null); }} className="flex-1 text-sm">Edit</Button>
                  <Button variant="outline" onClick={() => deleteApp(detailApp.id)} className="text-sm text-red-500 border-red-200 hover:bg-red-50">Delete</Button>
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
            <DialogTitle>{editingApp ? "Edit Application" : "Add Application"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500 mb-1 block">Company *</Label>
                <Input value={form.company || ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Visa" /></div>
              <div><Label className="text-xs text-gray-500 mb-1 block">Role *</Label>
                <Input value={form.role || ""} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. SDE-1" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><Label className="text-xs text-gray-500 mb-1 block">Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as Status }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs text-gray-500 mb-1 block">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as Priority }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select></div>
              <div><Label className="text-xs text-gray-500 mb-1 block">Source</Label>
                <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v as Source }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select></div>
            </div>
            <div><Label className="text-xs text-gray-500 mb-1 block">LinkedIn Post URL</Label>
              <Input value={form.linkedin_url || ""} onChange={e => setForm(f => ({ ...f, linkedin_url: e.target.value }))} placeholder="https://linkedin.com/posts/..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500 mb-1 block">Contact Name</Label>
                <Input value={form.contact_name || ""} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} placeholder="e.g. Animesh Raj" /></div>
              <div><Label className="text-xs text-gray-500 mb-1 block">Contact Email</Label>
                <Input value={form.contact_email || ""} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))} placeholder="hr@company.com" /></div>
            </div>
            <div><Label className="text-xs text-gray-500 mb-1 block">JD Notes</Label>
              <Textarea value={form.jd_notes || ""} onChange={e => setForm(f => ({ ...f, jd_notes: e.target.value }))}
                placeholder="Paste the job description or key requirements here…" rows={3} /></div>
            <div><Label className="text-xs text-gray-500 mb-1 block">Cover Letter / Email Sent</Label>
              <Textarea value={form.cover_letter || ""} onChange={e => setForm(f => ({ ...f, cover_letter: e.target.value }))}
                placeholder="Paste the email or cover letter you sent…" rows={3} /></div>
            <div><Label className="text-xs text-gray-500 mb-1 block">Applied Date</Label>
              <Input type="date" value={form.applied_date || ""} onChange={e => setForm(f => ({ ...f, applied_date: e.target.value }))} /></div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveApp} disabled={saving} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white">
                {saving ? "Saving..." : editingApp ? "Save Changes" : "Add Application"}
              </Button>
              <Button variant="outline" onClick={() => { setAddOpen(false); setEditingApp(null); }}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
