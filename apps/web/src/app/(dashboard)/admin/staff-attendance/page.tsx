"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { Calendar, Save, Loader2, Check } from "lucide-react"
import { AttendanceLegend, RemarksInput, StatusPicker, sameEntry } from "@/components/features/attendance/status-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { staffApi, AttendanceStatus, type StaffMember, type StaffAttendanceRecord } from "@/lib/api"
import { getApiErrorMessage } from "@/lib/lab-validation"
import { useInstituteToday } from "@/lib/institute-time"

interface AttendanceEntry {
  staffId: string;
  status: AttendanceStatus | null;
  remarks: string;
}

type EntryMap = Record<string, AttendanceEntry>

function blankEntries(staff: StaffMember[]): EntryMap {
  return Object.fromEntries(staff.map((s) => [s.id, { staffId: s.id, status: null, remarks: "" }]))
}

export default function StaffAttendancePage() {
  const [selectedDate, setSelectedDate] = useState("")
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [entries, setEntries] = useState<EntryMap>({})
  // Last state confirmed by the server for this date (used for dirty tracking & rollback)
  const [savedEntries, setSavedEntries] = useState<EntryMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingStaff, setLoadingStaff] = useState(true)
  const { toast } = useToast()

  // Institute timezone, not the device's (R6.6)
  const today = useInstituteToday()
  const lastToday = useRef("")
  useEffect(() => {
    setSelectedDate((d) => (!d || d === lastToday.current ? today : d))
    lastToday.current = today
  }, [today])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        setLoadingStaff(true)
        const response = await staffApi.getAllStaff({ limit: 100 })
        if (!cancelled) setStaffMembers(response.data.filter((s) => s.user.status === "ACTIVE"))
      } catch (error) {
        if (!cancelled) {
          toast({
            variant: "destructive",
            title: "Error loading staff",
            description: getApiErrorMessage(error, "Failed to load staff members"),
          })
        }
      } finally {
        if (!cancelled) setLoadingStaff(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  // Load the register for the selected date. Always start from a blank roster so
  // marks from a previously viewed date never leak into this one.
  const loadExistingAttendance = useCallback(async () => {
    if (!selectedDate || staffMembers.length === 0) return
    const base = blankEntries(staffMembers)
    setLoading(true)
    try {
      const records = await staffApi.getAttendanceByDate(selectedDate)
      records.forEach((record: StaffAttendanceRecord) => {
        if (base[record.staffId]) {
          base[record.staffId] = { staffId: record.staffId, status: record.status, remarks: record.remarks || "" }
        }
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Could not load saved attendance",
        description: getApiErrorMessage(error, "Showing an empty register for this date"),
      })
    } finally {
      setEntries(base)
      setSavedEntries(base)
      setLoading(false)
    }
  }, [selectedDate, staffMembers, toast])

  useEffect(() => {
    loadExistingAttendance()
  }, [loadExistingAttendance])

  const setStatus = (staffId: string, status: AttendanceStatus) =>
    setEntries((prev) => ({ ...prev, [staffId]: { ...prev[staffId], status } }))

  const setRemarks = (staffId: string, remarks: string) =>
    setEntries((prev) => ({ ...prev, [staffId]: { ...prev[staffId], remarks } }))

  const markAllPresent = () =>
    setEntries((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, e]) => [id, e.status ? e : { ...e, status: AttendanceStatus.PRESENT }]),
      ),
    )

  const dirtyIds = useMemo(
    () => Object.keys(entries).filter((id) => entries[id].status !== null && !sameEntry(entries[id], savedEntries[id])),
    [entries, savedEntries],
  )
  const markedCount = useMemo(() => Object.values(entries).filter((e) => e.status !== null).length, [entries])

  const handleSave = async () => {
    if (dirtyIds.length === 0) {
      toast({ title: "Nothing to save", description: "No new or changed marks." })
      return
    }

    const toSave = dirtyIds.map((id) => entries[id])
    const previousSaved = savedEntries

    // Optimistic update: treat the rows as saved immediately, roll back failures
    setSavedEntries((prev) => ({ ...prev, ...Object.fromEntries(toSave.map((e) => [e.staffId, e])) }))
    setSaving(true)

    const results = await Promise.allSettled(
      toSave.map((entry) =>
        staffApi.markAttendance({
          staffId: entry.staffId,
          attendanceDate: selectedDate,
          status: entry.status!,
          remarks: entry.remarks || undefined,
        }),
      ),
    )

    const failed = toSave.filter((_, i) => results[i].status === "rejected")
    if (failed.length) {
      setSavedEntries((prev) => ({
        ...prev,
        ...Object.fromEntries(failed.map((e) => [e.staffId, previousSaved[e.staffId]])),
      }))
      const firstError = results.find((r) => r.status === "rejected") as PromiseRejectedResult
      toast({
        variant: "destructive",
        title: `${failed.length} of ${toSave.length} mark(s) not saved`,
        description: getApiErrorMessage(firstError.reason, "Please try again"),
      })
    } else {
      toast({ title: "Attendance saved", description: `${toSave.length} mark(s) saved for ${selectedDate}` })
    }
    setSaving(false)
  }

  if (loadingStaff) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" aria-busy="true">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="sr-only">Loading staff…</span>
      </div>
    )
  }

  const unmarked = staffMembers.length - markedCount

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl font-bold">Staff Attendance Marking</CardTitle>
          <CardDescription>Mark daily attendance for all staff members (administrators)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 md:items-center justify-between">
            <label className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-gray-500" aria-hidden="true" />
              <span className="sr-only">Attendance date</span>
              <input
                type="date"
                value={selectedDate}
                max={today}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-11 w-full md:w-auto rounded-md border border-gray-300 bg-white px-3 text-base md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              />
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <p className="text-sm text-gray-600" aria-live="polite">
                Marked {markedCount} / {staffMembers.length}
                {unmarked > 0 && <span className="ml-1 font-medium text-amber-700">({unmarked} unmarked)</span>}
                {dirtyIds.length > 0 && <span className="ml-1 text-brand-strong">· {dirtyIds.length} unsaved</span>}
              </p>
              <Button variant="outline" onClick={markAllPresent} disabled={loading || unmarked === 0}>
                Mark rest Present
              </Button>
              <Button onClick={handleSave} disabled={saving || loading || dirtyIds.length === 0} className="gap-2">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save Attendance
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="space-y-3" aria-busy="true">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : staffMembers.length === 0 ? (
            <p className="py-8 text-center text-gray-500">No active staff members found</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {staffMembers.map((staff, index) => {
                const entry = entries[staff.id]
                const isUnmarked = !entry?.status
                const isSaved = !isUnmarked && sameEntry(entry, savedEntries[staff.id])
                return (
                  <li
                    key={staff.id}
                    className={`grid gap-3 p-3 sm:p-4 md:grid-cols-[2rem_minmax(0,1fr)_auto_minmax(10rem,14rem)] md:items-center ${
                      isUnmarked ? "bg-amber-50" : ""
                    }`}
                  >
                    <span className="hidden md:block text-sm text-gray-500">{index + 1}</span>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 truncate">
                        {staff.firstName} {staff.lastName}
                        {isSaved && (
                          <Check className="ml-1 inline h-4 w-4 text-green-600" aria-label="Saved" />
                        )}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {staff.staffId} · {staff.designation} · {staff.department}
                      </p>
                    </div>
                    <StatusPicker
                      label={`Attendance for ${staff.firstName} ${staff.lastName}`}
                      value={entry?.status ?? null}
                      onChange={(status) => setStatus(staff.id, status)}
                    />
                    <RemarksInput
                      label={`Remarks for ${staff.firstName} ${staff.lastName}`}
                      value={entry?.remarks || ""}
                      onChange={(value) => setRemarks(staff.id, value)}
                    />
                  </li>
                )
              })}
            </ul>
          )}

          <AttendanceLegend />
        </CardContent>
      </Card>
    </div>
  )
}
