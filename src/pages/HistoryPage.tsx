import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, parseISO, subMonths, eachDayOfInterval } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { getEffectiveAttendanceStatus } from '@/lib/shift-utils';
import { RegularizeDialog } from '@/components/shared/RegularizeDialog';

export default function HistoryPage({ session }: { session: any }) {
  const [employee, setEmployee] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<any[]>([]);
  const [employeeShift, setEmployeeShift] = useState<any>(null);
  const [regularizationsMap, setRegularizationsMap] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Dialog state
  const [regDialogOpen, setRegDialogOpen] = useState(false);
  const [selectedRegDate, setSelectedRegDate] = useState<string>('');
  const [selectedClockIn, setSelectedClockIn] = useState<string | null>(null);
  const [selectedClockOut, setSelectedClockOut] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

      if (empData) {
        setEmployee(empData);
        const start = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
        const end = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
        
        const [
          { data: monthData },
          { data: orgData },
          { data: holsData },
          { data: leavesData },
          { data: shiftData },
          { data: regData }
        ] = await Promise.all([
          supabase
            .from('attendances')
            .select('*')
            .eq('employee_id', empData.id)
            .gte('date', start)
            .lte('date', end),
          supabase
            .from('organizations')
            .select('weekly_offs')
            .eq('id', empData.org_id)
            .single(),
          supabase
            .from('holidays')
            .select('*')
            .eq('org_id', empData.org_id)
            .gte('date', start)
            .lte('date', end),
          supabase
            .from('leaves')
            .select('*')
            .eq('employee_id', empData.id)
            .eq('status', 'approved')
            .lte('start_date', end)
            .gte('end_date', start),
          (supabase as any)
            .from('employee_shifts')
            .select('*, shifts(*)')
            .eq('employee_id', empData.id)
            .maybeSingle(),
          supabase
            .from('attendance_regularizations')
            .select('*')
            .eq('employee_id', empData.id)
            .gte('date', start)
            .lte('date', end)
        ]);

        let shift = shiftData?.shifts || null;
        if (!shift) {
          const { data: orgShifts } = await (supabase as any)
            .from('shifts')
            .select('*')
            .eq('org_id', empData.org_id)
            .order('is_default', { ascending: false });
          if (orgShifts && orgShifts.length > 0) {
            shift = orgShifts.find((s: any) => s.is_default) || orgShifts[0];
          }
        }
        setEmployeeShift(shift);

        const rMap: Record<string, any> = {};
        (regData || []).forEach((r: any) => {
          rMap[r.date] = r;
        });
        setRegularizationsMap(rMap);

        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const weeklyOffs = orgData?.weekly_offs || [0];
        const holidays = holsData || [];
        const leaves = leavesData || [];
        const attMap: Record<string, any> = {};
        (monthData || []).forEach(r => { attMap[r.date] = r; });

        const monthDays = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
        // Show days up to today for past/current month
        const eligibleDays = monthDays.filter(d => format(d, 'yyyy-MM-dd') <= todayStr);

        const fullRecords = eligibleDays.map(d => {
          const ds = format(d, 'yyyy-MM-dd');
          const isWeekOff = weeklyOffs.includes(d.getDay());
          const isHol = holidays.some(h => h.date === ds);
          const hasLeave = leaves.some(l => ds >= l.start_date && ds <= l.end_date);
          const existing = attMap[ds];

          if (existing) {
            const calculatedStatus = getEffectiveAttendanceStatus(existing, shift);
            return {
              ...existing,
              status: calculatedStatus
            };
          }
          if (isWeekOff || isHol) {
            return {
              id: `hol-${ds}`,
              date: ds,
              status: 'holiday',
              clock_in_time: null,
              clock_out_time: null
            };
          }
          if (hasLeave) {
            return {
              id: `leave-${ds}`,
              date: ds,
              status: 'approved_leave',
              clock_in_time: null,
              clock_out_time: null
            };
          }
          // Past day without attendance -> Absent
          return {
            id: `absent-${ds}`,
            date: ds,
            status: 'absent',
            clock_in_time: null,
            clock_out_time: null
          };
        });

        setRecords(fullRecords.reverse());
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session, currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (next <= new Date()) setCurrentMonth(next);
  };

  const openRegularizeModal = (dateStr: string, inTime: string | null, outTime: string | null) => {
    setSelectedRegDate(dateStr);
    setSelectedClockIn(inTime);
    setSelectedClockOut(outTime);
    setRegDialogOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case 'late': return <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'absent': return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case 'half-day': case 'half_day': return <AlertCircle className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case 'approved_leave': case 'paid_leave': return <AlertCircle className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case 'holiday': return <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      default: return <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'late': return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
      case 'absent': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'half-day': case 'half_day': return 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
      case 'approved_leave': case 'paid_leave': return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
      case 'holiday': return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      default: return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
    }
  };

  const formatStatusLabel = (status: string) => {
    switch (status) {
      case 'present': return 'Present';
      case 'late': return 'Late Coming';
      case 'half-day': case 'half_day': return 'Half Day';
      case 'absent': return 'Absent';
      case 'approved_leave': return 'Approved Leave';
      case 'paid_leave': return 'Paid Leave';
      case 'holiday': return 'Holiday / Off';
      default: return status;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance History</h1>
          {employeeShift && (
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
              Shift: {employeeShift.name} ({employeeShift.start_time?.slice(0,5)} - {employeeShift.end_time?.slice(0,5)}) &bull; Grace: {employeeShift.grace_minutes ?? 15}m
            </p>
          )}
        </div>
        <div className="flex items-center space-x-4 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm self-start sm:self-auto">
          <Button variant="ghost" size="icon" onClick={handlePrevMonth} className="dark:hover:bg-slate-700">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-slate-300" />
          </Button>
          <span className="font-semibold text-gray-800 dark:text-white w-32 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={handleNextMonth}
            disabled={new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) > new Date()}
            className="dark:hover:bg-slate-700"
          >
            <ChevronRight className="w-5 h-5 text-gray-600 dark:text-slate-300" />
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-gray-200 dark:border-slate-700 overflow-hidden dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-slate-900/50 text-gray-600 dark:text-slate-400 font-medium border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Clock In</th>
                <th className="px-6 py-4">Clock Out</th>
                <th className="px-6 py-4 text-right">Action / Regularization</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">Loading records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-slate-400">No attendance records found for this month.</td>
                </tr>
              ) : (
                records.map((record) => {
                  const reg = regularizationsMap[record.date];
                  const isPendingReg = reg && reg.status === 'pending';
                  const isApprovedReg = reg && reg.status === 'approved';
                  const isRejectedReg = reg && reg.status === 'rejected';

                  return (
                    <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {format(parseISO(record.date), 'EEE, MMM dd')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(record.status)}`}>
                          {getStatusIcon(record.status)}
                          <span className="ml-1.5">{formatStatusLabel(record.status)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-slate-300">
                        {record.clock_in_time ? (
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1.5 text-gray-400 dark:text-slate-500" />
                            {format(new Date(record.clock_in_time), 'hh:mm a')}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600 dark:text-slate-300">
                        {record.clock_out_time ? (
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1.5 text-gray-400 dark:text-slate-500" />
                            {format(new Date(record.clock_out_time), 'hh:mm a')}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {isPendingReg ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800" title={`Reason: ${reg.reason}`}>
                            <Clock className="w-3 h-3 mr-1 text-amber-600" /> Regularization Pending
                          </span>
                        ) : isApprovedReg ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-800 border border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800">
                            <CheckCircle2 className="w-3 h-3 mr-1 text-green-600" /> Regularized
                          </span>
                        ) : (
                          record.status !== 'holiday' && record.status !== 'approved_leave' && (
                            <Button 
                              variant="link" 
                              onClick={() => openRegularizeModal(record.date, record.clock_in_time, record.clock_out_time)}
                              className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-0 h-auto font-medium"
                            >
                              Regularize
                            </Button>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <RegularizeDialog
        open={regDialogOpen}
        onOpenChange={setRegDialogOpen}
        employee={employee}
        defaultDate={selectedRegDate}
        defaultClockIn={selectedClockIn}
        defaultClockOut={selectedClockOut}
        onSuccess={loadData}
      />
    </div>
  );
}
