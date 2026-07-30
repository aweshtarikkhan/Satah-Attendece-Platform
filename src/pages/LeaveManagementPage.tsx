import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format, parseISO } from 'date-fns';
import { Umbrella, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export default function LeaveManagementPage({ session }: { session: any }) {
  const [employee, setEmployee] = useState<any>(null);
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyOpen, setApplyOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();

  const [leaveData, setLeaveData] = useState({
    startDate: '',
    endDate: '',
    leaveType: 'casual',
    reason: ''
  });

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
        // Note: The leaves table is created by 20260618111949_0ed3c09f-9afd-4656-bf51-2b2ff40e46bf.sql
        const { data: leavesData } = await supabase
          .from('leaves')
          .select('*')
          .eq('employee_id', empData.id)
          .order('created_at', { ascending: false });
        
        setLeaves(leavesData || []);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [session]);

  const handleApplyLeave = async () => {
    if (!leaveData.startDate || !leaveData.endDate || !leaveData.reason) {
      toast({ title: 'Error', description: 'Please fill in all fields', variant: 'destructive' });
      return;
    }
    setActionLoading(true);
    try {
      const days = (new Date(leaveData.endDate).getTime() - new Date(leaveData.startDate).getTime()) / (1000 * 3600 * 24) + 1;
      
      const { error } = await supabase.from('leaves').insert({
        org_id: employee.org_id,
        employee_id: employee.id,
        start_date: leaveData.startDate,
        end_date: leaveData.endDate,
        leave_type: leaveData.leaveType,
        reason: leaveData.reason,
        days: days,
        status: 'pending'
      });

      if (error) throw error;
      
      toast({ title: 'Success', description: 'Leave request submitted successfully' });
      setApplyOpen(false);
      setLeaveData({ startDate: '', endDate: '', leaveType: 'casual', reason: '' });
      loadData();
      
      // Notify HR
      await supabase.from('notifications').insert({
        org_id: employee.org_id,
        title: 'New Leave Request',
        message: `${employee.name} applied for ${days} day(s) leave.`,
        type: 'leave_request'
      });

    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'approved': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" /> Approved</span>;
      case 'rejected': return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200"><XCircle className="w-3 h-3 mr-1" /> Rejected</span>;
      default: return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200"><Clock className="w-3 h-3 mr-1" /> Pending</span>;
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave Management</h1>
          <p className="text-gray-500 text-sm mt-1">Track your leave requests and balances.</p>
        </div>
        <Button onClick={() => setApplyOpen(true)} className="bg-blue-600 hover:bg-blue-700 shadow-sm">
          <Umbrella className="w-4 h-4 mr-2" /> Apply for Leave
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="col-span-1 shadow-sm border-gray-200 bg-white">
          <CardHeader>
            <CardTitle className="text-lg">Leave Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="font-medium text-gray-700">Casual Leave</span>
              <span className="text-lg font-bold text-gray-900">12</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="font-medium text-gray-700">Sick Leave</span>
              <span className="text-lg font-bold text-gray-900">5</span>
            </div>
            <div className="flex justify-between items-center p-3 rounded-lg bg-gray-50 border border-gray-100">
              <span className="font-medium text-gray-700">Paid Leave</span>
              <span className="text-lg font-bold text-gray-900">8</span>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 shadow-sm border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg">Leave History</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-gray-500 text-center py-8">Loading history...</p>
            ) : leaves.length === 0 ? (
              <div className="text-center py-12">
                <Umbrella className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No leave requests found.</p>
                <p className="text-gray-400 text-sm">Your leave history will appear here.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leaves.map((leave) => (
                  <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-100 bg-gray-50 hover:bg-white transition-colors">
                    <div>
                      <div className="flex items-center space-x-3 mb-1">
                        <span className="font-semibold text-gray-900 capitalize">{leave.leave_type} Leave</span>
                        {getStatusBadge(leave.status)}
                      </div>
                      <p className="text-sm text-gray-600">
                        {format(parseISO(leave.start_date), 'MMM dd, yyyy')} - {format(parseISO(leave.end_date), 'MMM dd, yyyy')} 
                        <span className="mx-2 text-gray-300">|</span> 
                        {leave.days} day(s)
                      </p>
                      <p className="text-sm text-gray-500 mt-1 italic">"{leave.reason}"</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
            <DialogDescription>Submit a new leave application to HR.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input 
                  type="date" 
                  value={leaveData.startDate} 
                  onChange={e => setLeaveData({...leaveData, startDate: e.target.value})}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input 
                  type="date" 
                  value={leaveData.endDate} 
                  onChange={e => setLeaveData({...leaveData, endDate: e.target.value})}
                  min={leaveData.startDate || format(new Date(), 'yyyy-MM-dd')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Leave Type</Label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={leaveData.leaveType}
                onChange={e => setLeaveData({...leaveData, leaveType: e.target.value})}
              >
                <option value="casual">Casual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="paid">Paid Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <textarea 
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Brief reason for your leave..."
                value={leaveData.reason}
                onChange={e => setLeaveData({...leaveData, reason: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyLeave} disabled={actionLoading}>
              {actionLoading ? "Submitting..." : "Submit Application"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
