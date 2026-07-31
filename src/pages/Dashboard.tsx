import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, KeyRound, CheckCircle2, XCircle, AlertCircle, Calendar as CalendarIcon, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday, subMonths, addMonths } from 'date-fns';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNavigate } from 'react-router-dom';

export default function Dashboard({ session }: { session: any }) {
  const [employee, setEmployee] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [monthRecords, setMonthRecords] = useState<any[]>([]);
  const [monthHolidays, setMonthHolidays] = useState<any[]>([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState<any[]>([]);
  const [leaveStats, setLeaveStats] = useState({ casual: 10, sick: 5, paid: 15 }); // Mocked for now
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start, end });
  const startDayOfWeek = getDay(start); // 0 = Sunday

  const loadData = async () => {
    try {
      const { data: empData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

      if (empError || !empData) throw new Error('Employee profile not found');
      setEmployee(empData);

      const { data: orgData } = await supabase
        .from('organizations')
        .select('attendance_location_compulsory, weekly_offs')
        .eq('id', empData.org_id)
        .single();
        
      setOrg(orgData);

      const todayStr = format(currentMonth, 'yyyy-MM-dd');
      const startStr = format(start, 'yyyy-MM-dd');
      const endStr = format(end, 'yyyy-MM-dd');
      
      const { data: attData } = await supabase
        .from('attendances')
        .select('*')
        .eq('employee_id', empData.id)
        .gte('date', startStr)
        .lte('date', endStr);

      setMonthRecords(attData || []);
      const tr = attData?.find(r => r.date === todayStr);
      setTodayRecord(tr || null);

      const { data: monthHols } = await supabase
        .from('holidays')
        .select('*')
        .eq('org_id', empData.org_id)
        .gte('date', startStr)
        .lte('date', endStr);
      setMonthHolidays(monthHols || []);

      const { data: upcomingHols } = await supabase
        .from('holidays')
        .select('*')
        .eq('org_id', empData.org_id)
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(5);

      setUpcomingHolidays(upcomingHols || []);

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session, currentMonth]);

  const getLocation = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser"));
      } else {
        navigator.geolocation.getCurrentPosition(
          (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, accuracy: position.coords.accuracy }),
          (err) => reject(new Error("Please enable location permissions to clock in.")),
          { enableHighAccuracy: true }
        );
      }
    });
  };

  const handleClockInOut = async (type: 'in' | 'out') => {
    setActionLoading(true);
    try {
      let location = null;
      if (org?.attendance_location_compulsory) {
        location = await getLocation();
      } else {
        try { location = await getLocation(); } catch (e) { /* ignore */ }
      }

      const todayStr = format(new Date(), 'yyyy-MM-dd');
      const now = new Date().toISOString();

      if (type === 'in') {
        const { error } = await supabase.from('attendances').upsert({
          org_id: employee.org_id,
          employee_id: employee.id,
          date: todayStr,
          clock_in_time: todayRecord?.clock_in_time || now,
          clock_in_location: todayRecord?.clock_in_location || location,
          status: 'present'
        }, { onConflict: 'employee_id,date' });
        if (error) throw error;
        toast({ title: "Clocked In", description: "Your attendance has been recorded." });
      } else {
        const { error } = await supabase.from('attendances').upsert({
          org_id: employee.org_id,
          employee_id: employee.id,
          date: todayStr,
          ...(todayRecord || {}),
          clock_out_time: now,
          clock_out_location: location,
          status: 'present'
        }, { onConflict: 'employee_id,date' });
        if (error) throw error;
        toast({ title: "Clocked Out", description: "Have a great rest of your day!" });
      }
      loadData();
    } catch (err: any) {
      toast({ title: 'Action Failed', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    setActionLoading(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setActionLoading(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Password updated successfully" });
      setChangePasswordOpen(false);
      setNewPassword("");
    }
  };

  if (loading && !employee) {
    return <div className="flex items-center justify-center h-full dark:text-slate-300">Loading your dashboard...</div>;
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4 dark:text-slate-300">
        <p>No employee profile associated with this account.</p>
      </div>
    );
  }

  const isClockedIn = todayRecord?.clock_in_time != null;
  const isClockedOut = todayRecord?.clock_out_time != null;

  const presentDays = monthRecords.filter(r => r.status === 'present').length;
  const halfDays = monthRecords.filter(r => r.status === 'half-day').length;
  const absentDays = monthRecords.filter(r => r.status === 'absent').length;

  const getDayStatusColor = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const record = monthRecords.find(r => r.date === dateStr);
    const isHol = monthHolidays.some(h => h.date === dateStr);
    
    if (isHol) return "bg-blue-100 text-blue-700 font-bold border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800";
    if (!record) {
      // Future dates or weekends
      const weeklyOffs = org?.weekly_offs || [0];
      if (weeklyOffs.includes(getDay(date))) return "bg-gray-100 text-gray-400 dark:bg-slate-800 dark:text-slate-500 border-transparent"; // weekend
      if (date > new Date()) return "bg-white text-gray-800 hover:bg-gray-50 border-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700"; // future
      return "bg-white text-gray-800 border-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"; // past no record
    }
    
    switch(record.status) {
      case 'present': return "bg-green-100 text-green-700 font-semibold border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800";
      case 'absent': return "bg-red-100 text-red-700 font-semibold border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800";
      case 'half-day': return "bg-yellow-100 text-yellow-700 font-semibold border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800";
      case 'paid-leave': return "bg-purple-100 text-purple-700 font-semibold border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800";
      default: return "bg-white text-gray-800 border-gray-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Level Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome back, {employee.name.split(' ')[0]}!</h1>
        <div className="flex gap-3">
          <Button variant="outline" className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => navigate('/leaves')}>Apply for Leave</Button>
          <Button variant="outline" className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800" onClick={() => setChangePasswordOpen(true)}>Change Password</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-gray-200 dark:border-slate-700 bg-green-50/50 dark:bg-green-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500 mb-1" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{presentDays}</p>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Present</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 dark:border-slate-700 bg-red-50/50 dark:bg-red-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <XCircle className="w-5 h-5 text-red-600 dark:text-red-500 mb-1" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{absentDays}</p>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Absent</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 dark:border-slate-700 bg-yellow-50/50 dark:bg-yellow-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-500 mb-1" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{halfDays}</p>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Half Days</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 dark:border-slate-700 bg-blue-50/50 dark:bg-blue-900/10">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <CalendarIcon className="w-5 h-5 text-blue-600 dark:text-blue-500 mb-1" />
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{leaveStats.paid}</p>
                <p className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Leaves Left</p>
              </CardContent>
            </Card>
          </div>

          {/* Visual Calendar Widget */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-700 overflow-hidden dark:bg-slate-800">
            <CardHeader className="bg-gray-50/50 dark:bg-slate-800 pb-4 border-b border-gray-100 dark:border-slate-700 flex flex-row items-center justify-between">
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 dark:hover:bg-slate-700" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="w-4 h-4 dark:text-slate-300" />
                </Button>
                <CardTitle className="text-lg dark:text-white min-w-[120px] text-center">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 dark:hover:bg-slate-700" 
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                  disabled={new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1) > new Date()}
                >
                  <ChevronRight className="w-4 h-4 dark:text-slate-300" />
                </Button>
              </div>
              <div className="flex gap-2 text-xs dark:text-slate-300">
                <span className="flex items-center"><span className="w-3 h-3 bg-green-200 dark:bg-green-700 rounded-sm mr-1"></span>Present</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-red-200 dark:bg-red-700 rounded-sm mr-1"></span>Absent</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-yellow-200 dark:bg-yellow-700 rounded-sm mr-1"></span>Leave</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-blue-200 dark:bg-blue-700 rounded-sm mr-1"></span>Holiday</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-500 dark:text-slate-400 py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-14 bg-gray-50/30 dark:bg-slate-800/50 rounded-lg"></div>
                ))}
                
                {daysInMonth.map(date => {
                  const colorClass = getDayStatusColor(date);
                  const todayClass = isToday(date) ? "ring-2 ring-indigo-500 ring-offset-1" : "";
                  return (
                    <div 
                      key={date.toISOString()} 
                      className={`h-14 rounded-lg flex items-center justify-center text-sm border ${colorClass} ${todayClass} transition-colors cursor-default`}
                      title={format(date, 'MMM dd, yyyy')}
                    >
                      {format(date, 'd')}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
          
        </div>

        {/* Sidebar Area */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Clock In / Out Widget */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader className="bg-gray-50/50 dark:bg-slate-800 pb-4 border-b border-gray-100 dark:border-slate-700">
              <CardTitle className="flex justify-between items-center text-lg dark:text-white">
                Today's Action
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isClockedOut ? 'bg-gray-200 text-gray-700 dark:bg-slate-700 dark:text-slate-300' : isClockedIn ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'}`}>
                  {isClockedOut ? 'Finished' : isClockedIn ? 'Active' : 'Not Started'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-8 pb-6 space-y-6">
              {!isClockedIn ? (
                <Button 
                  size="lg" 
                  className="w-full h-14 text-base rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 transition-all hover:shadow-lg dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white"
                  onClick={() => handleClockInOut('in')}
                  disabled={actionLoading}
                >
                  <MapPin className="w-4 h-4 mr-2" /> 
                  {actionLoading ? "Processing..." : "Clock In Now"}
                </Button>
              ) : !isClockedOut ? (
                <div className="space-y-4 w-full text-center">
                  <p className="text-gray-600 dark:text-green-400 font-medium flex items-center justify-center bg-green-50 dark:bg-green-900/20 text-green-700 py-2 rounded-lg">
                    <Clock className="w-4 h-4 mr-2" />
                    In at {format(new Date(todayRecord.clock_in_time), "hh:mm a")}
                  </p>
                  <Button 
                    size="lg" 
                    variant="destructive"
                    className="w-full h-14 text-base rounded-xl shadow-md transition-all hover:shadow-lg dark:bg-red-600 dark:hover:bg-red-700 dark:text-white"
                    onClick={() => handleClockInOut('out')}
                    disabled={actionLoading}
                  >
                    <MapPin className="w-4 h-4 mr-2" /> 
                    {actionLoading ? "Processing..." : "Clock Out"}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3 w-full bg-gray-50 dark:bg-slate-900/50 p-4 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2" />
                  <p className="font-semibold text-lg text-gray-900 dark:text-white">Shift Completed</p>
                  <div className="text-sm text-gray-500 dark:text-slate-400 space-y-1 flex justify-center gap-4">
                    <p>In: {format(new Date(todayRecord.clock_in_time), "hh:mm a")}</p>
                    <p>Out: {format(new Date(todayRecord.clock_out_time), "hh:mm a")}</p>
                  </div>
                </div>
              )}
              
              <Button variant="link" size="sm" className="text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white">
                Missed a punch? Regularize
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Holidays Widget */}
          <Card className="shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader className="bg-gray-50/50 dark:bg-slate-800 pb-4 border-b border-gray-100 dark:border-slate-700 flex flex-row justify-between items-center">
              <CardTitle className="text-lg dark:text-white">Upcoming Holidays</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 dark:text-blue-400 p-0 hover:bg-transparent dark:hover:bg-transparent" onClick={() => navigate('/holidays')}>View All</Button>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingHolidays.length === 0 ? (
                <div className="p-6 text-center text-gray-500 dark:text-slate-400 flex flex-col items-center">
                  <CalendarDays className="w-8 h-8 text-gray-300 dark:text-slate-600 mb-2" />
                  <p className="text-sm">No upcoming holidays scheduled.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {upcomingHolidays.map((h, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white text-sm">{h.name}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 capitalize">{h.type} Holiday</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600 dark:text-blue-400 text-sm">{format(new Date(h.date), 'MMM dd')}</p>
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase">{format(new Date(h.date), 'EEEE')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent className="dark:bg-slate-800 dark:text-white dark:border-slate-700">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription className="dark:text-slate-400">Update your portal login password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="dark:text-slate-300">New Password</Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Must be at least 6 characters"
                className="dark:bg-slate-900 dark:border-slate-700 dark:text-white"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)} className="dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={actionLoading || newPassword.length < 6}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
