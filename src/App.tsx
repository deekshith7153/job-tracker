import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

type Status = "Applied" | "Referred" | "OA" | "Interview" | "Offer" | "Rejected" | "Ghosted";
type Priority = "High" | "Medium" | "Low";

interface Application {
  id: string;
  company: string;
  role: string;
  status: Status;
  priority: Priority;
  appliedDate: string;
  contact?: string;
  contactEmail?: string;
  notes?: string;
  referral: boolean;
  lastUpdate: string;
}

const STATUS_CONFIG: Record<Status, { color: string; bg: string; dot: string }> = {
  Applied:   { color: "text-blue-700",   bg: "bg-blue-50 border-blue-200",   dot: "bg-blue-500" },
  Referred:  { color: "text-violet-700", bg: "bg-violet-50 border-violet-200", dot: "bg-violet-500" },
  OA:        { color: "text-amber-700",  bg: "bg-amber-50 border-amber-200",  dot: "bg-amber-500" },
  Interview: { color: "text-emerald-700",bg: "bg-emerald-50 border-emerald-200", dot: "bg-emerald-500" },
  Offer:     { color: "text-green-700",  bg: "bg-green-50 border-green-200",  dot: "bg-green-600" },
  Rejected:  { color: "text-red-600",    bg: "bg-red-50 border-red-200",      dot: "bg-red-500" },
  Ghosted:   { color: "text-gray-500",   bg: "bg-gray-50 border-gray-200",    dot: "bg-gray-400" },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; style: string }> = {
  High:   { label: "High",   style: "bg-red-100 text-red-700 border-red-200" },
  Medium: { label: "Medium", style: "bg-amber-100 text-amber-700 border-amber-200" },
  Low:    { label: "Low",    style: "bg-green-100 text-green-700 border-green-200" },
};

const INITIAL_DATA: Application[] = [
  { id: "1", company: "Visa", role: "Software Engineer", status: "Referred", priority: "High", appliedDate: "2025-01-10", contact: "Animesh Raj", contactEmail: "aniraj@visa.com", notes: "Referred twice. Focus on Product Reliability Engineering concepts.", referral: true, lastUpdate: "2025-01-12" },
  { id: "2", company: "PayPal", role: "Associate Software Engineer", status: "Applied", priority: "High", appliedDate: "2025-01-08", contact: "Soundarya", contactEmail: "", notes: "Reached out via LinkedIn.", referral: true, lastUpdate: "2025-01-08" },
  { id: "3", company: "Oracle", role: "Java Developer", status: "Applied", priority: "Medium", appliedDate: "2025-01-05", contact: "", notes: "Applied via portal.", referral: false, lastUpdate: "2025-01-05" },
  { id: "4", company: "Goldman Sachs", role: "Software Engineer", status: "OA", priority: "High", appliedDate: "2024-12-20", notes: "OA received. DSA + Java MCQs.", referral: false, lastUpdate: "2025-01-03" },
  { id: "5", company: "Amazon", role: "SDE-1", status: "Rejected", priority: "High", appliedDate: "2024-12-10", notes: "OA rejected — assessed as headcount/percentile cutoff, not skill gap.", referral: false, lastUpdate: "2024-12-28" },
  { id: "6", company: "UST", role: "Software Engineer", status: "Referred", priority: "Medium", appliedDate: "2025-01-09", contact: "Manjunatha", notes: "Internal portal access granted via Manjunatha.", referral: true, lastUpdate: "2025-01-09" },
  { id: "7", company: "Qualcomm", role: "Associate Engineer", status: "Applied", priority: "Medium", appliedDate: "2025-01-11", contact: "Abhay (RVCE alumni)", notes: "RVCE alumni connection.", referral: true, lastUpdate: "2025-01-11" },
  { id: "8", company: "American Express GBT", role: "Software Engineer", status: "Applied", priority: "High", appliedDate: "2025-01-06", contact: "Jagriti Raj", notes: "Recruiter: Jagriti Raj", referral: false, lastUpdate: "2025-01-06" },
];

const STATUSES: Status[] = ["Applied", "Referred", "OA", "Interview", "Offer", "Rejected", "Ghosted"];
const PRIORITIES: Priority[] = ["High", "Medium", "Low"];

function daysSince(dateStr: string): number {
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

export default function App() {
  const [apps, setApps] = useState<Application[]>(INITIAL_DATA);
  const [filterStatus, setFilterStatus] = useState<Status | "All">("All");
  const [filterPriority, setFilterPriority] = useState<Priority | "All">("All");
  const [search, setSearch] = useState("");
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [detailApp, setDetailApp] = useState<Application | null>(null);
  const [form, setForm] = useState<Partial<Application>>({
    status: "Applied", priority: "Medium", referral: false,
    appliedDate: new Date().toISOString().slice(0, 10),
    lastUpdate: new Date().toISOString().slice(0, 10),
  });

  const filtered = useMemo(() => apps.filter(a => {
    if (filterStatus !== "All" && a.status !== filterStatus) return false;
    if (filterPriority !== "All" && a.priority !== filterPriority) return false;
    if (search && !`${a.company} ${a.role} ${a.contact}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [apps, filterStatus, filterPriority, search]);

  const stats = useMemo(() => ({
    total: apps.length,
    active: apps.filter(a => !["Rejected", "Ghosted"].includes(a.status)).length,
    referred: apps.filter(a => a.referral).length,
    interviews: apps.filter(a => ["Interview", "Offer"].includes(a.status)).length,
  }), [apps]);

  function openAdd() {
    setForm({ status: "Applied", priority: "Medium", referral: false,
      appliedDate: new Date().toISOString().slice(0,10),
      lastUpdate: new Date().toISOString().slice(0,10) });
    setEditingApp(null);
    setAddOpen(true);
  }

  function openEdit(app: Application) {
    setForm({ ...app });
    setEditingApp(app);
    setAddOpen(true);
  }

  function saveApp() {
    if (!form.company || !form.role) return;
    const today = new Date().toISOString().slice(0,10);
    if (editingApp) {
      setApps(prev => prev.map(a => a.id === editingApp.id ? { ...a, ...form, lastUpdate: today } as Application : a));
    } else {
      setApps(prev => [{ ...form, id: Date.now().toString(), lastUpdate: today } as Application, ...prev]);
    }
    setAddOpen(false);
  }

  function deleteApp(id: string) {
    setApps(prev => prev.filter(a => a.id !== id));
    setDetailApp(null);
  }

  function updateStatus(id: string, status: Status) {
    const today = new Date().toISOString().slice(0,10);
    setApps(prev => prev.map(a => a.id === id ? { ...a, status, lastUpdate: today } : a));
    setDetailApp(prev => prev?.id === id ? { ...prev, status, lastUpdate: today } : prev);
  }

  const kanbanStatuses: Status[] = ["Applied", "Referred", "OA", "Interview", "Offer"];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Job Hunt Tracker</h1>
            <p className="text-sm text-gray-400 mt-0.5">Deekshith · SDE-1 Backend · Bengaluru → Pune / Hyderabad</p>
          </div>
          <Button onClick={openAdd} className="bg-gray-900 hover:bg-gray-800 text-white text-sm h-9">
            + Add Application
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total Applied", value: stats.total, icon: "📋" },
            { label: "Active Pipeline", value: stats.active, icon: "⚡" },
            { label: "With Referral", value: stats.referred, icon: "🤝" },
            { label: "Interviews Reached", value: stats.interviews, icon: "🎯" },
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
          <Input placeholder="Search companies, roles, contacts…" value={search}
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
          <Select value={filterPriority} onValueChange={v => setFilterPriority(v as any)}>
            <SelectTrigger className="w-36 bg-white border-gray-200 text-sm h-9">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Priorities</SelectItem>
              {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? "s" : ""}</span>
        </div>

        {/* Kanban */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Pipeline Board</h2>
          <div className="overflow-x-auto">
            <div className="flex gap-4 min-w-max pb-2">
              {[...kanbanStatuses, ...["Rejected", "Ghosted"] as Status[]].map(status => {
                const cfg = STATUS_CONFIG[status as Status];
                const colApps = filtered.filter(a => a.status === status);
                const faded = ["Rejected", "Ghosted"].includes(status);
                return (
                  <div key={status} className="w-56 flex-shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                      <span className={`text-xs font-semibold ${faded ? "text-gray-400" : "text-gray-700"}`}>{status}</span>
                      <span className="ml-auto text-xs text-gray-400 tabular-nums">{colApps.length}</span>
                    </div>
                    <div className="space-y-2 min-h-20">
                      {colApps.map(app => (
                        <div key={app.id} onClick={() => setDetailApp(app)}
                          className={`bg-white border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all ${
                            app.priority === "High" && !faded ? "border-l-4 border-l-red-400 border-gray-200" : "border-gray-200"
                          } ${faded ? "opacity-60" : ""}`}>
                          <div className="font-semibold text-gray-900 text-sm truncate">{app.company}</div>
                          <div className="text-xs text-gray-500 truncate mt-0.5">{app.role}</div>
                          <div className="flex items-center gap-1 mt-2">
                            {app.referral && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">Ref</span>}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${PRIORITY_CONFIG[app.priority].style}`}>{app.priority}</span>
                          </div>
                          <div className="text-[10px] text-gray-300 mt-1.5">{daysSince(app.lastUpdate)}d ago</div>
                        </div>
                      ))}
                      {colApps.length === 0 && (
                        <div className="text-xs text-gray-200 text-center py-8 border border-dashed border-gray-150 rounded-lg">—</div>
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
                    <th className="text-left px-4 py-2.5 font-medium">Contact</th>
                    <th className="text-left px-4 py-2.5 font-medium">Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(app => {
                    const cfg = STATUS_CONFIG[app.status];
                    return (
                      <tr key={app.id} onClick={() => setDetailApp(app)}
                        className="border-b border-gray-50 hover:bg-blue-50/30 cursor-pointer transition-colors">
                        <td className="px-5 py-2.5 font-semibold text-gray-900">
                          {app.company}
                          {app.referral && <span className="ml-1.5 text-[10px] text-violet-500">●</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 max-w-[140px] truncate text-xs">{app.role}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />{app.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`text-[11px] px-1.5 py-0.5 rounded border font-medium ${PRIORITY_CONFIG[app.priority].style}`}>
                            {app.priority}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs truncate max-w-[110px]">{app.contact || "—"}</td>
                        <td className="px-4 py-2.5 text-gray-400 text-xs">{daysSince(app.lastUpdate)}d ago</td>
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
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${PRIORITY_CONFIG[detailApp.priority].style}`}>
                    {detailApp.priority} Priority
                  </span>
                  {detailApp.referral && <span className="text-xs px-2.5 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200 font-medium">🤝 Referral</span>}
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Applied</div><div className="text-gray-800">{detailApp.appliedDate}</div></div>
                  <div><div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Last Update</div><div className="text-gray-800">{daysSince(detailApp.lastUpdate)}d ago</div></div>
                  {detailApp.contact && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Contact</div>
                      <div className="text-gray-800 font-medium">{detailApp.contact}</div>
                      {detailApp.contactEmail && <div className="text-xs text-gray-500">{detailApp.contactEmail}</div>}
                    </div>
                  )}
                  {detailApp.notes && (
                    <div className="col-span-2">
                      <div className="text-[11px] text-gray-400 uppercase tracking-wide mb-1">Notes</div>
                      <div className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 border border-gray-100 leading-relaxed">{detailApp.notes}</div>
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
                            detailApp.status === s ? `${c.bg} ${c.color} font-semibold shadow-sm` : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
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
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingApp ? "Edit Application" : "New Application"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500 mb-1 block">Company *</Label>
                <Input value={form.company || ""} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} placeholder="e.g. Visa" /></div>
              <div><Label className="text-xs text-gray-500 mb-1 block">Role *</Label>
                <Input value={form.role || ""} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} placeholder="e.g. SDE-1" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs text-gray-500 mb-1 block">Contact Name</Label>
                <Input value={form.contact || ""} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} placeholder="e.g. Animesh Raj" /></div>
              <div><Label className="text-xs text-gray-500 mb-1 block">Applied Date</Label>
                <Input type="date" value={form.appliedDate || ""} onChange={e => setForm(f => ({ ...f, appliedDate: e.target.value }))} /></div>
            </div>
            <div><Label className="text-xs text-gray-500 mb-1 block">Notes</Label>
              <Textarea value={form.notes || ""} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Prep tips, contact context, follow-up reminders…" rows={3} /></div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="ref" checked={!!form.referral}
                onChange={e => setForm(f => ({ ...f, referral: e.target.checked }))} className="rounded" />
              <Label htmlFor="ref" className="text-sm text-gray-700 cursor-pointer">Has referral connection</Label>
            </div>
            <div className="flex gap-2 pt-1">
              <Button onClick={saveApp} className="flex-1 bg-gray-900 hover:bg-gray-800 text-white">
                {editingApp ? "Save Changes" : "Add Application"}
              </Button>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
