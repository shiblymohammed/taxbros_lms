"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { format } from "date-fns"
import { Calendar, Check, Loader2, Lock, Save, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AttendanceLegend, RemarksInput, StatusPicker, sameEntry } from "@/components/features/attendance/status-picker"
import { ClassCheckIn } from "@/components/features/attendance/class-check-in"
import { changedMarks, entriesFromRegister, type EntryMap } from "@/lib/attendance-register"
import {
  AttendanceStatus,
  classesApi,
  registersApi,
  type AttendanceRegister,
  type Class,
} from "@/lib/api"
import { getApiErrorMessage } from "@/lib/lab-validation"
import { useInstituteToday } from "@/lib/institute-time"

function errorStatus(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status
}

/**
 * Class register (Task 22, R7–R9, T2).
 * Pick a class and date → the register opens with the roster frozen at first opening →
 * mark Present/Absent/Late → save. Reopening a saved register and saving again records corrections.
 * Administrators, and staff with the MARK_ATTENDANCE permission.
 */
export default function ClassRegisterPage() {
  const { toast } = useToast()
  // Institute timezone, not the device's (R6.6)
  const today = useInstituteToday()

  const [classes, setClasses] = useState<Class[]>([])
  const [classesLoading, setClassesLoading] = useState(true)
  const [classId, setClassId] = useState("")
  const [date, setDate] = useState(today)
  // Follow "today" once the institute timezone loads, unless a date was picked
  const lastToday = useRef(today)
  useEffect(() => {
    setDate((d) => (d === lastToday.current ? today : d))
    lastToday.current = today
  }, [today])

  const [register, setRegister] = useState<AttendanceRegister | null>(null)
  const [entries, setEntries] = useState<EntryMap>({})
  const [savedEntries, setSavedEntries] = useState<EntryMap>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [blocked, setBlocked] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const list = await classesApi.getAll()
        if (cancelled) return
        setClasses(list)
        if (list.length === 1) setClassId(list[0].id)
      } catch (err) {
        if (!cancelled) {
          toast({ variant: "destructive", title: "Could not load classes", description: getApiErrorMessage(err) })
        }
      } finally {
        if (!cancelled) setClassesLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [toast])

  const applyRegister = useCallback((reg: AttendanceRegister) => {
    const fromServer = entriesFromRegister(reg)
    setRegister(reg)
    setEntries(fromServer)
    setSavedEntries(fromServer)
  }, [])

  // Open the register whenever the class or date changes. Always replace the previous
  // register's marks so nothing carries over between classes or dates.
  useEffect(() => {
    if (!classId || !date) return
    let cancelled = false
    setLoading(true)
    setBlocked(null)
    setRegister(null)
    setEntries({})
    setSavedEntries({})
    ;(async () => {
      try {
        const reg = await registersApi.open(classId, date)
        if (!cancelled) applyRegister(reg)
      } catch (err) {
        if (cancelled) return
        if (errorStatus(err) === 403) {
          setBlocked("You need the Mark Attendance permission to open registers. Ask an administrator to grant it.")
        } else {
          toast({ variant: "destructive", title: "Could not open the register", description: getApiErrorMessage(err) })
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [classId, date, applyRegister, toast])

  const setStatus = (studentId: string, status: AttendanceStatus) =>
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], status } }))

  const setRemarks = (studentId: string, remarks: string) =>
    setEntries((prev) => ({ ...prev, [studentId]: { ...prev[studentId], remarks } }))

  const markRestPresent = () =>
    setEntries((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, e]) => [id, e.status ? e : { ...e, status: AttendanceStatus.PRESENT }]),
      ),
    )

  const pending = useMemo(() => changedMarks(entries, savedEntries), [entries, savedEntries])
  const students = register?.students ?? []
  const markedCount = students.filter((s) => entries[s.studentId]?.status).length
  const unmarked = students.length - markedCount
  const isCorrection = register?.status === "SAVED"

  const handleSave = async () => {
    if (!register || pending.length === 0) return
    setSaving(true)
    try {
      const updated = await registersApi.mark(register.id, pending)
      // Keep any rows the user is still editing that weren't part of this save
      const fromServer = entriesFromRegister(updated)
      setRegister(updated)
      setSavedEntries(fromServer)
      setEntries((prev) => {
        const next = { ...fromServer }
        for (const [id, e] of Object.entries(prev)) {
          if (e.status === null && !fromServer[id]?.status) next[id] = e
        }
        return next
      })
      toast({
        title: isCorrection ? "Corrections saved" : "Register saved",
        description: `${pending.length} mark(s) saved for ${updated.className} on ${date}`,
      })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Register not saved",
        description:
          errorStatus(err) === 403
            ? "You no longer have permission to mark attendance."
            : getApiErrorMessage(err, "Please try again"),
      })
    } finally {
      setSaving(false)
    }
  }

  const selectedClass = classes.find((c) => c.id === classId)

  // After student self check-in: show the marks students made (unless there are unsaved edits here)
  const handleSelfCheckInChange = async (updated?: AttendanceRegister) => {
    if (updated) {
      applyRegister(updated)
      return
    }
    if (!register || pending.length > 0) return
    try {
      applyRegister(await registersApi.open(register.classId, date))
    } catch {
      // The register on screen stays as it was
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-6 sm:py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold sm:text-2xl">Class Register</CardTitle>
          <CardDescription>Choose a class and date, mark each student, then save. Saved registers can be corrected.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-4 md:grid-cols-[minmax(0,18rem)_auto_1fr] md:items-end">
            <div className="space-y-1.5">
              <label htmlFor="register-class" className="text-sm font-medium text-gray-700">
                Class
              </label>
              <Select value={classId} onValueChange={setClassId} disabled={classesLoading || classes.length === 0}>
                <SelectTrigger id="register-class" aria-label="Class">
                  <SelectValue placeholder={classesLoading ? "Loading classes…" : "Select a class"} />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="register-date" className="text-sm font-medium text-gray-700">
                Date
              </label>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-gray-500" aria-hidden="true" />
                <input
                  id="register-date"
                  type="date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setDate(e.target.value)}
                  className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand md:w-auto md:text-sm"
                />
              </div>
            </div>

            {register && students.length > 0 && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center md:justify-end">
                <p className="text-sm text-gray-600" aria-live="polite">
                  Marked {markedCount} / {students.length}
                  {unmarked > 0 && <span className="ml-1 font-medium text-amber-700">({unmarked} unmarked)</span>}
                  {pending.length > 0 && <span className="ml-1 text-brand-strong">· {pending.length} unsaved</span>}
                </p>
                <Button variant="outline" onClick={markRestPresent} disabled={loading || saving || unmarked === 0}>
                  Mark rest Present
                </Button>
                <Button onClick={handleSave} disabled={loading || saving || pending.length === 0} className="gap-2">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isCorrection ? "Save corrections" : "Save register"}
                </Button>
              </div>
            )}
          </div>

          {!classesLoading && classes.length === 0 ? (
            <EmptyState icon={<Users className="h-8 w-8" />} text="No active classes yet. An administrator needs to create a class and enrol students." />
          ) : blocked ? (
            <EmptyState icon={<Lock className="h-8 w-8" />} text={blocked} />
          ) : !classId ? (
            <EmptyState icon={<Users className="h-8 w-8" />} text="Select a class to open its register." />
          ) : loading ? (
            <div className="space-y-3" aria-busy="true">
              <span className="sr-only">Opening register…</span>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : register && students.length === 0 ? (
            <EmptyState
              icon={<Users className="h-8 w-8" />}
              text={`No students were enrolled in ${selectedClass?.name ?? "this class"} when this register was opened.`}
            />
          ) : register ? (
            <>
              <p className="mb-3 text-sm text-gray-600">
                <span
                  className={`mr-2 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                    isCorrection ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {isCorrection ? "Saved" : "Not saved yet"}
                </span>
                {register.className} · {format(new Date(`${date}T00:00:00`), "EEEE d MMMM yyyy")} · roster fixed when first opened
              </p>
              <ClassCheckIn register={register} isToday={date === today} onRegisterChanged={handleSelfCheckInChange} />
              <ul className="divide-y rounded-lg border">
                {students.map((student, index) => {
                  const entry = entries[student.studentId]
                  const name = `${student.firstName} ${student.lastName}`
                  const isUnmarked = !entry?.status
                  const isSaved = !isUnmarked && sameEntry(entry, savedEntries[student.studentId])
                  return (
                    <li
                      key={student.studentId}
                      className={`grid gap-3 p-3 sm:p-4 md:grid-cols-[2rem_minmax(0,1fr)_auto_minmax(10rem,14rem)] md:items-center ${
                        isUnmarked ? "bg-amber-50" : ""
                      }`}
                    >
                      <span className="hidden text-sm text-gray-500 md:block">{index + 1}</span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {name}
                          {isSaved && <Check className="ml-1 inline h-4 w-4 text-green-600" aria-label="Saved" />}
                        </p>
                        <p className="truncate text-xs text-gray-500">{student.admissionId}</p>
                      </div>
                      <StatusPicker
                        label={`Attendance for ${name}`}
                        value={entry?.status ?? null}
                        onChange={(status) => setStatus(student.studentId, status)}
                        disabled={saving}
                      />
                      <RemarksInput
                        label={`Remarks for ${name}`}
                        value={entry?.remarks ?? ""}
                        onChange={(value) => setRemarks(student.studentId, value)}
                        disabled={saving}
                      />
                    </li>
                  )
                })}
              </ul>
              <AttendanceLegend />
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-gray-500">
      <span className="text-gray-400">{icon}</span>
      <p className="max-w-md">{text}</p>
    </div>
  )
}
