import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { LayoutDashboard, History, CalendarDays, Umbrella, HelpCircle, Bell, LogOut } from 'lucide-react';

export default function DashboardLayout() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employee, setEmployee] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Update live clock every second
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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
        .eq('id', user.id)
        .single();
      
      if (!error && data) {
        setEmployee(data);
      }
    };
    fetchEmployee();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const navItems = [
    { name: 'My Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Attendance History', path: '/history', icon: History },
    { name: 'Leave Management', path: '/leaves', icon: Umbrella },
    { name: 'Holidays List', path: '/holidays', icon: CalendarDays },
  ];

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">Attendance Portal</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="w-5 h-5 mr-3 shrink-0" />
              {item.name}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-gray-200">
          <button 
            className="flex items-center w-full px-3 py-2 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <HelpCircle className="w-5 h-5 mr-3 shrink-0" />
            Help Desk
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 z-10 shrink-0 shadow-sm">
          <div className="flex items-center">
            {/* Live Clock & Date */}
            <div className="text-sm">
              <div className="font-semibold text-gray-900">
                {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <div className="text-gray-500 text-xs">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Notifications */}
            <button className="relative p-2 text-gray-500 hover:bg-gray-100 rounded-full transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
            </button>

            <div className="w-px h-8 bg-gray-200"></div>

            {/* Profile */}
            <div className="flex items-center">
              <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold mr-3 shrink-0">
                {employee?.name?.charAt(0) || 'E'}
              </div>
              <div className="flex flex-col mr-4">
                <span className="text-sm font-semibold text-gray-900">{employee?.name || 'Employee'}</span>
                <span className="text-xs text-gray-500">{employee?.designation || 'Staff'}</span>
              </div>
              <button 
                onClick={handleLogout}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 overflow-auto bg-gray-50 p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
