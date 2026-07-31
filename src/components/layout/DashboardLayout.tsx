import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, History, CalendarDays, Umbrella, HelpCircle, Bell, LogOut, MessageCircle, Moon, Sun, X, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';

export default function DashboardLayout() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employee, setEmployee] = useState<any>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Update live clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const fetchEmployee = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', user.id)
        .single();
      
      if (!error && data) {
        setEmployee(data);
        
        // Fetch notifications
        const fetchNotifications = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .or(`user_id.eq.${user?.id},user_id.is.null`)
            .eq('org_id', data.org_id)
            .order('created_at', { ascending: false })
            .limit(10);
          if (notifs) setNotifications(notifs);
        };
        fetchNotifications();

        // Subscribe to real-time notifications
        const channel = supabase.channel('realtime-notifications')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'notifications' },
            (payload) => {
              const newNotif = payload.new as any;
              if (newNotif.org_id === data.org_id) {
                setNotifications(prev => [newNotif, ...prev].slice(0, 10));
              }
            }
          )
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      }
    };
    fetchEmployee();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const isHR = employee?.designation?.toLowerCase().includes('hr') || employee?.role === 'hr';

  const navItems = [
    { name: 'My Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Attendance History', path: '/history', icon: History },
    { name: 'Leave Management', path: '/leaves', icon: Umbrella },
    { name: 'Holidays List', path: '/holidays', icon: CalendarDays },
    { name: isHR ? 'Team Chat' : 'Chat with HR', path: '/chat', icon: MessageCircle },
  ];

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAsRead = async () => {
    if (unreadCount === 0) return;
    const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden transition-colors">
      {/* Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-gray-200 dark:border-slate-700 flex flex-col transition-colors">
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Attendance Portal</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400'
                    : 'text-gray-700 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/50'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3 shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          <button 
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 dark:text-slate-300 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            <HelpCircle className="w-5 h-5 mr-3 shrink-0" />
            Help Desk
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between px-8 z-10 shrink-0 shadow-sm transition-colors">
          <div className="flex items-center">
            {/* Live Clock & Date */}
            <div className="text-sm">
              <div className="font-semibold text-gray-900 dark:text-white">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-gray-500 dark:text-slate-400 text-xs">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            
            {/* Theme Toggle */}
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-full transition-colors"
              title="Toggle Theme"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) markAllAsRead();
                }}
                className="relative p-2 text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border border-white dark:border-slate-800">
                    {unreadCount}
                  </span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-gray-200 dark:border-slate-700 z-50 overflow-hidden">
                  <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Notifications</h3>
                    <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-gray-500 dark:text-slate-400 text-sm">
                        No notifications yet.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                        {notifications.map(n => (
                          <div key={n.id} className={`p-4 hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors ${!n.is_read ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}`}>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{n.title}</p>
                            <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{n.message}</p>
                            <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-2">
                              {format(new Date(n.created_at), 'MMM d, h:mm a')}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="w-px h-8 bg-gray-200 dark:bg-slate-700"></div>

            {/* Profile */}
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold mr-3 shrink-0">
                {employee?.name?.charAt(0) || 'E'}
              </div>
              <div className="flex flex-col mr-4">
                <span className="text-sm font-semibold text-gray-900 dark:text-white">{employee?.name || 'Employee'}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">{employee?.designation || 'Staff'}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gray-50 dark:bg-slate-900 p-8 transition-colors">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
