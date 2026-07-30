import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { MapPin, Clock, KeyRound, CheckCircle2, XCircle, AlertCircle, Calendar as CalendarIcon, CalendarDays } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
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

  const currentMonth = new Date();
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
  }, [session]);

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
        const { error } = await supabase.from('attendances').insert({
          org_id: employee.org_id,
          employee_id: employee.id,
          date: todayStr,
          clock_in_time: now,
          clock_in_location: location,
          status: 'present'
        });
        if (error) throw error;
        toast({ title: "Clocked In", description: "Your attendance has been recorded." });
      } else {
        const { error } = await supabase.from('attendances').update({
          clock_out_time: now,
          clock_out_location: location
        }).eq('id', todayRecord.id);
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

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading your dashboard...</div>;
  }

  if (!employee) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
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
    
    if (isHol) return "bg-blue-100 text-blue-700 font-bold border-blue-200";
    if (!record) {
      // Future dates or weekends
      const weeklyOffs = org?.weekly_offs || [0];
      if (weeklyOffs.includes(getDay(date))) return "bg-gray-100 text-gray-400"; // weekend
      if (date > new Date()) return "bg-white text-gray-800 hover:bg-gray-50 border-gray-100"; // future
      return "bg-white text-gray-800 border-gray-100"; // past no record
    }
    
    switch(record.status) {
      case 'present': return "bg-green-100 text-green-700 font-semibold border-green-200";
      case 'absent': return "bg-red-100 text-red-700 font-semibold border-red-200";
      case 'half-day': return "bg-yellow-100 text-yellow-700 font-semibold border-yellow-200";
      case 'paid-leave': return "bg-purple-100 text-purple-700 font-semibold border-purple-200";
      default: return "bg-white text-gray-800 border-gray-100";
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Level Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back, {employee.name.split(' ')[0]}!</h1>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/leaves')}>Apply for Leave</Button>
          <Button variant="outline" onClick={() => setChangePasswordOpen(true)}>Change Password</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm border-gray-200 bg-green-50/50">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <CheckCircle2 className="w-5 h-5 text-green-600 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{presentDays}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Present</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 bg-red-50/50">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <XCircle className="w-5 h-5 text-red-600 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{absentDays}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Absent</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 bg-yellow-50/50">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <AlertCircle className="w-5 h-5 text-yellow-600 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{halfDays}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Half Days</p>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-gray-200 bg-blue-50/50">
              <CardContent className="p-4 flex flex-col justify-center items-center text-center space-y-1 h-full">
                <CalendarIcon className="w-5 h-5 text-blue-600 mb-1" />
                <p className="text-2xl font-bold text-gray-900">{leaveStats.paid}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Leaves Left</p>
              </CardContent>
            </Card>
          </div>

          {/* Visual Calendar Widget */}
          <Card className="shadow-sm border-gray-200 overflow-hidden">
            <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100 flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Monthly Attendance ({format(currentMonth, 'MMMM yyyy')})</CardTitle>
              <div className="flex gap-2 text-xs">
                <span className="flex items-center"><span className="w-3 h-3 bg-green-200 rounded-sm mr-1"></span>Present</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-red-200 rounded-sm mr-1"></span>Absent</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-yellow-200 rounded-sm mr-1"></span>Leave</span>
                <span className="flex items-center"><span className="w-3 h-3 bg-blue-200 rounded-sm mr-1"></span>Holiday</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center text-xs font-semibold text-gray-500 py-1">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-14 bg-gray-50/30 rounded-lg"></div>
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
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100">
              <CardTitle className="flex justify-between items-center text-lg">
                Today's Action
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${isClockedOut ? 'bg-gray-200 text-gray-700' : isClockedIn ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {isClockedOut ? 'Finished' : isClockedIn ? 'Active' : 'Not Started'}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center pt-8 pb-6 space-y-6">
              {!isClockedIn ? (
                <Button 
                  size="lg" 
                  className="w-full h-14 text-base rounded-xl shadow-md bg-blue-600 hover:bg-blue-700 transition-all hover:shadow-lg"
                  onClick={() => handleClockInOut('in')}
                  disabled={actionLoading}
                >
                  <MapPin className="w-4 h-4 mr-2" /> 
                  {actionLoading ? "Processing..." : "Clock In Now"}
                </Button>
              ) : !isClockedOut ? (
                <div className="space-y-4 w-full text-center">
                  <p className="text-gray-600 font-medium flex items-center justify-center bg-green-50 text-green-700 py-2 rounded-lg">
                    <Clock className="w-4 h-4 mr-2" />
                    In at {format(new Date(todayRecord.clock_in_time), "hh:mm a")}
                  </p>
                  <Button 
                    size="lg" 
                    variant="destructive"
                    className="w-full h-14 text-base rounded-xl shadow-md transition-all hover:shadow-lg"
                    onClick={() => handleClockInOut('out')}
                    disabled={actionLoading}
                  >
                    <MapPin className="w-4 h-4 mr-2" /> 
                    {actionLoading ? "Processing..." : "Clock Out"}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-3 w-full bg-gray-50 p-4 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-green-500 mb-2" />
                  <p className="font-semibold text-lg text-gray-900">Shift Completed</p>
                  <div className="text-sm text-gray-500 space-y-1 flex justify-center gap-4">
                    <p>In: {format(new Date(todayRecord.clock_in_time), "hh:mm a")}</p>
                    <p>Out: {format(new Date(todayRecord.clock_out_time), "hh:mm a")}</p>
                  </div>
                </div>
              )}
              
              <Button variant="link" size="sm" className="text-gray-500 hover:text-gray-900">
                Missed a punch? Regularize
              </Button>
            </CardContent>
          </Card>

          {/* Upcoming Holidays Widget */}
          <Card className="shadow-sm border-gray-200">
            <CardHeader className="bg-gray-50/50 pb-4 border-b border-gray-100 flex flex-row justify-between items-center">
              <CardTitle className="text-lg">Upcoming Holidays</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 text-xs text-blue-600 p-0 hover:bg-transparent" onClick={() => navigate('/holidays')}>View All</Button>
            </CardHeader>
            <CardContent className="p-0">
              {upcomingHolidays.length === 0 ? (
                <div className="p-6 text-center text-gray-500 flex flex-col items-center">
                  <CalendarDays className="w-8 h-8 text-gray-300 mb-2" />
                  <p className="text-sm">No upcoming holidays scheduled.</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {upcomingHolidays.map((h, i) => (
                    <div key={i} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="font-semibold text-gray-900 text-sm">{h.name}</p>
                        <p className="text-xs text-gray-500 capitalize">{h.type} Holiday</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600 text-sm">{format(new Date(h.date), 'MMM dd')}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">{format(new Date(h.date), 'EEEE')}</p>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Update your portal login password.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input 
                type="password" 
                value={newPassword} 
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Must be at least 6 characters"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={actionLoading || newPassword.length < 6}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
