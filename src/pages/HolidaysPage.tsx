import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { CalendarDays, MapPin } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function HolidaysPage({ session }: { session: any }) {
  const [holidays, setHolidays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadHolidays = async () => {
      try {
        setLoading(true);
        const { data: empData } = await supabase
          .from('employees')
          .select('org_id')
          .eq('auth_user_id', session.user.id)
          .single();

        if (empData) {
          const { data } = await supabase
            .from('holidays')
            .select('*')
            .eq('org_id', empData.org_id)
            .order('date', { ascending: true });
          
          setHolidays(data || []);
        }
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadHolidays();
  }, [session]);

  const upcomingHolidays = holidays.filter(h => new Date(h.date) >= new Date());
  const pastHolidays = holidays.filter(h => new Date(h.date) < new Date());

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Company Holidays</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Public and company holidays for the year.</p>
        </div>
      </div>

      {loading ? (
        <p className="text-gray-500 dark:text-slate-400 py-8 text-center">Loading holidays...</p>
      ) : (
        <div className="space-y-8">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Upcoming Holidays</h2>
            {upcomingHolidays.length === 0 ? (
              <Card className="bg-gray-50 dark:bg-slate-800/50 border-gray-200 dark:border-slate-700 border-dashed">
                <CardContent className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-slate-400">
                  <CalendarDays className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                  <p>No upcoming holidays found.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {upcomingHolidays.map((holiday) => (
                  <Card key={holiday.id} className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-shadow dark:bg-slate-800 dark:border-y-slate-700 dark:border-r-slate-700">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white">{holiday.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">{holiday.type} Holiday</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-blue-600 dark:text-blue-400">{format(parseISO(holiday.date), 'MMM dd')}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{format(parseISO(holiday.date), 'EEEE')}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {pastHolidays.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Past Holidays</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-60">
                {pastHolidays.map((holiday) => (
                  <Card key={holiday.id} className="border-gray-200 dark:border-slate-700 shadow-none bg-gray-50 dark:bg-slate-900/50">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-gray-700 dark:text-slate-300">{holiday.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-slate-400 capitalize">{holiday.type} Holiday</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-600 dark:text-slate-300">{format(parseISO(holiday.date), 'MMM dd')}</p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">{format(parseISO(holiday.date), 'EEEE')}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
