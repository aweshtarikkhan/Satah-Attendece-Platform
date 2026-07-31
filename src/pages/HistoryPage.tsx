import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, parseISO, subMonths } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function HistoryPage({ session }: { session: any }) {
  const [employee, setEmployee] = useState<any>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
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
          
          const { data: monthData } = await supabase
            .from('attendances')
            .select('*')
            .eq('employee_id', empData.id)
            .gte('date', start)
            .lte('date', end)
            .order('date', { ascending: false });

          setRecords(monthData || []);
        }
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [session, currentMonth]);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (next <= new Date()) setCurrentMonth(next);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'present': return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case 'absent': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'half-day': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'present': return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800';
      case 'absent': return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      case 'half-day': return 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      default: return 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Attendance History</h1>
        <div className="flex items-center space-x-4 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg border border-gray-200 dark:border-slate-700 shadow-sm">
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
                <th className="px-6 py-4 text-right">Actions</th>
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
                records.map((record) => (
                  <tr key={record.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                      {format(parseISO(record.date), 'EEE, MMM dd')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusColor(record.status)}`}>
                        {getStatusIcon(record.status)}
                        <span className="ml-2 capitalize">{record.status}</span>
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
                      {(!record.clock_in_time || !record.clock_out_time) && record.status !== 'absent' && (
                        <Button variant="link" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 p-0 h-auto font-medium">
                          Regularize
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
