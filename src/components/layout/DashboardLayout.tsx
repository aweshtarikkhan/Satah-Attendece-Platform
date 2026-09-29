import React, { useEffect, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {  LayoutDashboard, History, CalendarDays, Umbrella, HelpCircle, Bell, LogOut, MessageCircle, Moon, Sun, X, CheckCircle2, Menu, ChevronRight, Fingerprint, Settings, Home, FileCheck } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import logoImg from '@/assets/logo.png';

export default function DashboardLayout() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [employee, setEmployee] = useState<any>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [unreadLeaves, setUnreadLeaves] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  const [organization, setOrganization] = useState<any>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Force light mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const fetchTodayRecord = async (empData: any) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const { data: todayData } = await supabase
      .from('attendances')
      .select('*')
      .eq('employee_id', empData.id)
      .eq('date', today)
      .maybeSingle();
    setTodayRecord(todayData);
  };

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/login');
      } else {
        let empData = null;
        const { data: empDataList } = await supabase
          .from('employees')
          .select('*')
          .eq('auth_user_id', session.user.id)
          .limit(1);
        if (empDataList && empDataList.length > 0) {
          empData = empDataList[0];
        } else if (session.user?.email) {
          const { data: empByEmail } = await supabase
            .from('employees')
            .select('*')
            .ilike('email', session.user.email)
            .limit(1);
          if (empByEmail && empByEmail.length > 0) {
            empData = empByEmail[0];
            await supabase.from('employees').update({ auth_user_id: session.user.id }).eq('id', empData.id);
          }
        }
        if (empData) setEmployee(empData);
          
          if (empData) {
            await fetchTodayRecord(empData);
            
            const { data: orgData } = await supabase
              .from('organizations')
              .select('*')
              .eq('id', empData.org_id)
              .maybeSingle();
            if (orgData) setOrganization(orgData);
          }
        
        if (empData) {
          const { data: notifs } = await supabase
            .from('notifications').select('*').eq('user_id', empData.auth_user_id)
            .order('created_at', { ascending: false })
            .limit(10);
          if (notifs) {
            setNotifications(notifs);
            // Count unread leave notifications
            const leaveNotifs = notifs.filter((n: any) => !n.is_read && (n.type === 'leave_approved' || n.type === 'leave_rejected' || n.type === 'leave_request'));
            setUnreadLeaves(leaveNotifs.length);
          }

          // Check for unread chat messages
            try {
              const { data: unreadMsgs } = await supabase
                .from('chat_messages')
                .select('*, sender:employees!sender_id(name)')
                .eq('receiver_id', empData.id)
                .eq('status', 'sent');
                
              if (unreadMsgs && unreadMsgs.length > 0) {
                 setUnreadChats(unreadMsgs.length);
                 const chatNotifs = unreadMsgs.map(m => ({
                    id: 'chat-' + m.id,
                    title: 'New Message from ' + (m.sender?.name || 'Someone'),
                    message: m.message || (m.file_url ? 'Sent an attachment' : 'Sent a message'),
                    is_read: false,
                    type: 'chat',
                    created_at: m.created_at
                 }));
                 setNotifications(prev => {
                    const combined = [...chatNotifs, ...prev];
                    combined.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                    return combined.slice(0, 15);
                 });
              } else {
                 setUnreadChats(0);
              }
            } catch (err) {
              setUnreadChats(0);
            }
          }
      }
    };
    checkUser();
  }, [navigate]);

  const handleClockInOut = async (type: 'in' | 'out') => {
    if (!employee) return;
    
    const confirmMessage = type === 'in' ? "Are you sure you want to Clock In?" : "Are you sure you want to Clock Out?";
    if (!window.confirm(confirmMessage)) return;

    setActionLoading(true);
    try {
      const now = new Date().toISOString();
      const today = format(new Date(), 'yyyy-MM-dd');

      // Capture GPS location with fallback
      let locationData: { lat: number; lng: number; address?: string } | null = null;
      try {
        if (navigator.geolocation) {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 10000,
              enableHighAccuracy: true,
              maximumAge: 0,
            });
          });
          locationData = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          // Try to reverse-geocode for address
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${locationData.lat}&lon=${locationData.lng}&format=json`
            );
            const geo = await res.json();
            if (geo?.display_name) locationData.address = geo.display_name;
          } catch { /* ignore geocoding error */ }
        } else {
           throw new Error("Geolocation not supported by this browser");
        }
      } catch (err: any) { 
        console.warn("GPS failed, trying IP fallback...", err);
      }

      // Fallback to IP geolocation if GPS failed
      if (!locationData) {
        try {
          const ipRes = await fetch('https://ipapi.co/json/');
          const ipGeo = await ipRes.json();
          if (ipGeo && ipGeo.latitude && ipGeo.longitude) {
            locationData = {
              lat: ipGeo.latitude,
              lng: ipGeo.longitude,
              address: `${ipGeo.city || ''}, ${ipGeo.region || ''}, ${ipGeo.country_name || ''} (IP Based)`.replace(/^[,\s]+|[,\s]+$/g, '')
            };
          }
        } catch (e) {
          console.warn("IP Geolocation also failed", e);
        }
      }

      if (!locationData) {
        toast({ title: 'Location Warning', description: 'Could not detect location. Please enable GPS/Location permissions.', variant: 'destructive' });
      }

      if (type === 'in') {
        const { error, data } = await supabase.from('attendances').upsert({
          employee_id: employee.id,
          org_id: employee.org_id,
          date: today,
          clock_in_time: now,
          clock_in_location: locationData,
          status: 'present'
        }, { onConflict: 'employee_id,date' }).select().single();
        if (error) throw error;
        setTodayRecord(data);
        toast({ title: 'Clocked In', description: locationData ? 'Attendance marked with location.' : 'Attendance marked.' });
        window.dispatchEvent(new Event('attendance_updated'));
      } else {
        const { error, data } = await supabase.from('attendances').update({
          clock_out_time: now,
          clock_out_location: locationData,
        }).eq('id', todayRecord.id).select().single();
        if (error) throw error;
        setTodayRecord(data);
        toast({ title: 'Clocked Out', description: locationData ? 'Clock-out saved with location.' : 'Your shift has ended.' });
        window.dispatchEvent(new Event('attendance_updated'));
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };


  const playNotificationSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {
      // Audio autoplay policy
    }
  };

  useEffect(() => {
    if (!employee) return;

    // Real-time listener for new chat messages
    const chatChannel = supabase
      .channel('dashboard-chat-msgs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_messages' },
          (payload) => {
            // If it's a DM to us, and it became read
            if (payload.new.receiver_id === employee.id && payload.new.status === 'read') {
              setNotifications(prev => prev.filter(n => n.id !== 'chat-' + payload.new.id));
              setUnreadChats(prev => Math.max(0, prev - 1));
            }
          }
        )
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const newMsg = payload.new;
          
          if (newMsg.sender_id === employee.id) return; // Ignore own messages
          
          let isRelevant = false;
          let notifTitle = '';

          if (newMsg.receiver_id === employee.id) {
            isRelevant = true;
          } else if (newMsg.group_id) {
            // Check if user is in this group
            const { data: member } = await supabase
              .from('chat_group_members')
              .select('id')
              .eq('group_id', newMsg.group_id)
              .eq('employee_id', employee.id)
              .maybeSingle();
              
            if (member) {
              isRelevant = true;
            }
          }

          if (!isRelevant) return;

          // Fetch sender name
          const { data: senderData } = await supabase
            .from('employees')
            .select('name')
            .eq('id', newMsg.sender_id)
            .single();
            
          const senderName = senderData?.name || 'Someone';

          if (newMsg.group_id) {
            const { data: groupData } = await supabase.from('chat_groups').select('name').eq('id', newMsg.group_id).maybeSingle();
            notifTitle = `Message from ${senderName} in ${groupData?.name || 'Group'}`;
          } else {
            notifTitle = `New Message from ${senderName}`;
          }
          
          // Audio chime
          playNotificationSound();

          // Pop a toast notification
          toast({
            title: notifTitle,
            description: newMsg.message || 'Sent an attachment',
            duration: 5000,
          });
          
          // Add to notifications list
          setNotifications(prev => {
            const newNotif = {
              id: 'chat-' + newMsg.id,
              title: notifTitle,
              message: newMsg.message || 'Sent an attachment',
              is_read: false,
              type: 'chat',
              created_at: newMsg.created_at
            };
            return [newNotif, ...prev].slice(0, 15);
          });
          setUnreadChats(prev => prev + 1);
        }
      )
      .subscribe();

    // Real-time listener for notifications table (for group chat notifications)
    const notifChannel = supabase
      .channel('dashboard-notifications-' + employee.id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${employee.auth_user_id}` },
        (payload) => {
          const notif = payload.new as any;
          // Only add if not already present (chat notifications are added via chatChannel too)
          if (notif.type !== 'chat') {
            setNotifications(prev => {
              if (prev.find(n => n.id === notif.id)) return prev;
              return [notif, ...prev].slice(0, 15);
            });
          }
          // Update leave unread count
          if (['leave_approved', 'leave_rejected', 'leave_request'].includes(notif.type)) {
            setUnreadLeaves(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatChannel);
      supabase.removeChannel(notifChannel);
    };
  }, [employee]);

  // Auto-clear leave notifications when visiting /leaves
  useEffect(() => {
    if (location.pathname === '/leaves' && employee) {
      setNotifications(prev => prev.filter(n => !['leave_approved', 'leave_rejected', 'leave_request'].includes(n.type)));
      supabase.from('notifications')
        .update({ is_read: true })
        .in('type', ['leave_approved', 'leave_rejected', 'leave_request'])
        .eq('user_id', employee.auth_user_id)
        .eq('is_read', false)
        .then();
    }
  }, [location.pathname, employee]);

  // Auto-clear chat notifications when visiting /chat
  useEffect(() => {
    if (location.pathname === '/chat' && employee) {
      setNotifications(prev => prev.filter(n => n.type !== 'chat'));
      setUnreadChats(0);
      supabase.from('chat_messages')
        .update({ status: 'read' })
        .eq('receiver_id', employee.id)
        .eq('status', 'sent')
        .then();
    }
  }, [location.pathname, employee]);

  // Listen for custom 'chat-read' event to instantly clear badges
  useEffect(() => {
    const handleChatRead = () => {
      setUnreadChats(0);
      setNotifications(prev => prev.filter(n => n.type !== 'chat'));
    };
    window.addEventListener('chat-read', handleChatRead);
    return () => window.removeEventListener('chat-read', handleChatRead);
  }, []);

  // Fast polling check for unread messages (every 4 seconds)
  useEffect(() => {
    if (!employee) return;
    const pollUnread = async () => {
      if (location.pathname === '/chat') return;
      try {
        const { data: unreadMsgs } = await supabase
          .from('chat_messages')
          .select('id, sender_id, message, created_at, sender:employees!sender_id(name)')
          .eq('receiver_id', employee.id)
          .eq('status', 'sent');

        if (unreadMsgs && unreadMsgs.length > 0) {
          setUnreadChats(unreadMsgs.length);
          const chatNotifs = unreadMsgs.map((m: any) => ({
            id: 'chat-' + m.id,
            title: 'New Message from ' + (m.sender?.name || 'Someone'),
            message: m.message || 'Sent a message',
            is_read: false,
            type: 'chat',
            created_at: m.created_at
          }));
          setNotifications(prev => {
            const nonChat = prev.filter(n => n.type !== 'chat');
            const combined = [...chatNotifs, ...nonChat];
            combined.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            return combined.slice(0, 15);
          });
        } else {
          setUnreadChats(0);
          setNotifications(prev => prev.filter(n => n.type !== 'chat'));
        }
      } catch (err) {
        // ignore
      }
    };
    const timer = setInterval(pollUnread, 4000);
    return () => clearInterval(timer);
  }, [employee, location.pathname]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAllAsRead = async () => {
    if (!employee) return;
    await supabase
      .from('notifications')
      .update({ is_read: true }).eq('user_id', employee.auth_user_id)
      .eq('is_read', false);
    await supabase
      .from('chat_messages')
      .update({ status: 'read' })
      .eq('receiver_id', employee.id)
      .eq('status', 'sent');
    setNotifications(notifications.map(n => ({ ...n, is_read: true })));
    setUnreadLeaves(0);
    setUnreadChats(0);
  };

  const navItems = [
    { name: 'History', icon: History, path: '/history' },
    { name: 'Leaves', icon: Umbrella, path: '/leaves' },
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'Chat', icon: MessageCircle, path: '/chat' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  const sidebarNavItems = [
    { name: 'Home', icon: Home, path: '/dashboard' },
    { name: 'History', icon: History, path: '/history' },
    { name: 'Leaves', icon: Umbrella, path: '/leaves' },
    { name: 'Documents', icon: FileCheck, path: '/documents' },
    { name: 'Chat', icon: MessageCircle, path: '/chat' },
    { name: 'Settings', icon: Settings, path: '/settings' },
  ];

  // Get dot indicator for nav items
  const getNavDot = (itemName: string) => {
    if (itemName === 'Leaves' && unreadLeaves > 0) return true;
    if (itemName === 'Chat' && unreadChats > 0) return true;
    return false;
  };
  
  const sidebarContent = (
    <>
      <div className="h-16 flex items-center px-6 border-b border-white/10 bg-[#0a192f] text-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white/95 px-4 py-2 rounded-xl shadow-sm w-full flex justify-center border border-white/20">
            <img src={logoImg} alt="AassayBiz" className="h-9 w-auto object-contain" />
          </div>
        </div>
      </div>
      
      {/* Profile section in sidebar */}
      <NavLink to="/profile" onClick={() => setMobileMenuOpen(false)} className="p-4 border-b border-white/10 bg-[#0d213b] hover:bg-white/5 transition-colors flex items-center justify-between cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold text-lg shadow-sm shrink-0 overflow-hidden">
            {employee?.avatar_url || employee?.profile_image ? (
              <img src={employee.avatar_url || employee.profile_image} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              employee?.name?.charAt(0) || 'E'
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-white">{employee?.name || 'Employee'}</span>
            <span className="text-xs text-blue-200">{employee?.designation || 'Staff'}</span>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-white/50" />
      </NavLink>

      <nav className="flex-1 px-4 py-6 space-y-1.5 overflow-y-auto bg-[#0a192f]">
        {sidebarNavItems.map((item) => {
          const hasDot = getNavDot(item.name);
          return (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-3 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isActive
                    ? 'bg-orange-500 text-white shadow-md shadow-orange-500/20'
                    : 'text-blue-100 hover:bg-white/10'
                }`
              }
            >
              <div className="flex items-center">
                <div className="relative mr-3 shrink-0">
                  <item.icon className="w-5 h-5" />
                  {hasDot && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0a192f] animate-pulse" />
                  )}
                </div>
                <span>{item.name}</span>
              </div>
              {hasDot && item.name === 'Chat' && unreadChats > 0 && (
                <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm">
                  {unreadChats}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-white/10 bg-[#0a192f]">
        <button 
          onClick={handleLogout}
          className="flex items-center justify-center w-full px-4 py-2.5 text-sm font-medium text-white bg-white/10 border border-white/20 rounded-lg hover:bg-red-500 hover:border-red-500 transition-all shadow-sm active:scale-95"
        >
          <LogOut className="w-4 h-4 mr-2 shrink-0" />
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] w-full bg-gray-50 dark:bg-slate-900 overflow-hidden transition-colors">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-[#0a192f] flex-col transition-colors z-20 shadow-xl">
        {sidebarContent}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
        {/* Header - Dark Blue AassayBiz Theme */}
        <header className="h-14 bg-[#0a192f] flex items-center justify-between px-4 md:px-8 z-10 shrink-0 shadow-md">
          <div className="flex items-center">
            {/* Mobile App Name */}
            <div className="md:hidden flex items-center">
              <div className="text-white font-bold text-lg tracking-wide capitalize">
                {organization?.name || 'AassayBiz'}
              </div>
            </div>

            {/* Desktop Title / Clock */}
            <div className="hidden md:block text-sm text-white">
              <div className="font-bold tracking-wide text-base capitalize">
                {organization?.name || 'AassayBiz'}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 md:space-x-4">

            {/* Notifications */}
            <div className="relative">
              <button 
                onClick={() => {
                  setShowNotifications(!showNotifications);
                  if (!showNotifications && unreadCount > 0) markAllAsRead();
                }}
                className="relative p-2 text-white/80 hover:bg-white/10 rounded-full transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center rounded-full border-2 border-[#0a192f]">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>

            {/* Profile - Mobile Hidden (since we have bottom nav and sidebar) */}
            <div className="hidden md:flex items-center ml-2">
              <div className="w-9 h-9 rounded-full bg-orange-500 flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-orange-400 overflow-hidden">
                {employee?.avatar_url || employee?.profile_image ? (
                  <img src={employee.avatar_url || employee.profile_image} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  employee?.name?.charAt(0) || 'E'
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Notification Panel - Fixed overlay on top */}
        {showNotifications && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
            <div className="fixed top-14 left-0 right-0 md:left-auto md:right-8 md:w-96 z-50 mx-4 md:mx-0">
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 overflow-hidden max-h-[70vh]">
                <div className="p-4 border-b border-gray-100 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-900/50">
                  <h3 className="font-bold text-gray-900 dark:text-white">Notifications</h3>
                    <div className="flex items-center gap-2">
                      {notifications.length > 0 && (
                        <button 
                          onClick={async () => {
                            setNotifications([]);
                            setUnreadChats(0);
                            setUnreadLeaves(0);
                            if (employee) {
                              await supabase.from('notifications').update({ is_read: true }).eq('user_id', employee.auth_user_id);
                              await supabase.from('chat_messages').update({ status: 'read' }).eq('receiver_id', employee.id).eq('status', 'sent');
                            }
                          }} 
                          className="text-xs text-orange-600 dark:text-orange-400 hover:underline mr-2"
                        >
                          Clear All
                        </button>
                      )}
                      <button onClick={() => setShowNotifications(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700">
                    <X className="w-4 h-4" />
                    </button>
                  </div>
                  </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 dark:text-slate-400 text-sm">
                      No notifications yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-slate-700/50">
                      {notifications.map(n => (
                        <div 
                          key={n.id} 
                          onClick={async () => {
                            setShowNotifications(false);
                            setNotifications(prev => prev.filter(item => item.id !== n.id));
                            if (n.type === 'chat') {
                              setUnreadChats(0);
                              if (String(n.id).startsWith('chat-')) {
                                const rawMsgId = String(n.id).replace('chat-', '');
                                await supabase.from('chat_messages').update({ status: 'read' }).eq('id', rawMsgId);
                              } else {
                                await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                              }
                              navigate('/chat');
                            } else {
                              if (!String(n.id).startsWith('chat-')) {
                                await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                              }
                              if (n.type?.startsWith('leave')) {
                                navigate('/leaves');
                              }
                            }
                          }}
                          className={`p-4 relative group transition-colors cursor-pointer hover:bg-orange-50/70 dark:hover:bg-slate-700/50 ${!n.is_read ? 'bg-orange-50/50 dark:bg-orange-900/10' : ''}`}
                        >
                            <div className="pr-6">
                              <p className="text-sm font-bold text-gray-900 dark:text-white">{n.title}</p>
                              <p className="text-xs text-gray-600 dark:text-slate-300 mt-1">{n.message}</p>
                            </div>
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                setNotifications(prev => prev.filter(item => item.id !== n.id));
                                if (n.type === 'chat') {
                                  setUnreadChats(prev => Math.max(0, prev - 1));
                                  if (String(n.id).startsWith('chat-')) {
                                    const rawMsgId = String(n.id).replace('chat-', '');
                                    await supabase.from('chat_messages').update({ status: 'read' }).eq('id', rawMsgId);
                                  } else {
                                    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                                  }
                                } else {
                                  if (!String(n.id).startsWith('chat-')) {
                                    await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
                                  }
                                }
                              }}
                              className="absolute right-4 top-4 p-1 text-gray-400 hover:text-red-500 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Clear notification"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Page Content */}
        {location.pathname === '/chat' ? (
          <div className="flex-1 min-h-0 overflow-hidden bg-gray-50 dark:bg-slate-900 transition-colors relative flex flex-col pb-[70px] md:pb-0">
            <Outlet />
          </div>
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-slate-900 transition-colors relative pb-28 md:pb-8 pt-4 md:pt-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <div className="min-h-full flex flex-col">
              <div className="flex-1">
                <Outlet />
              </div>
              <div className="w-full flex items-center justify-center gap-2 text-xs font-semibold text-gray-500 dark:text-slate-400 mt-8 shrink-0 pb-4">
                <span>Powered by</span>
                <img src={logoImg} alt="AassayBiz" className="h-8 md:h-9 w-auto object-contain opacity-95" />
              </div>
            </div>
          </div>
        )}

        {/* Mobile Bottom Navigation - AassayBiz Style */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 w-full bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800 flex justify-around items-end px-2 pb-safe pt-2 z-[9999] shadow-[0_-10px_30px_rgba(0,0,0,0.15)] min-h-[70px]" style={{ paddingBottom: "env(safe-area-inset-bottom, 20px)" }}>
          {navItems.map((item, index) => {
            const isCenter = index === 2; // Home button at index 2
            const hasDot = getNavDot(item.name);
            
            if (isCenter) {
              return (
                <div key={item.name} className="flex-1 flex justify-center z-[10000]">
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `-mt-8 w-14 h-14 rounded-full flex items-center justify-center shadow-lg border-4 border-white dark:border-slate-900 transition-transform active:scale-95 ${
                        isActive ? 'bg-orange-600' : 'bg-orange-500 hover:bg-orange-600'
                      }`
                    }
                  >
                    <div className="flex flex-col items-center">
                      <item.icon className="w-6 h-6 text-white" />
                      <span className="text-[8px] font-bold text-white mt-0.5">HOME</span>
                    </div>
                  </NavLink>
                </div>
              );
            }
            
            return (
              <div key={item.name} className="flex-1 flex justify-center">
                <NavLink
                  to={item.path}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 p-1 relative ${
                      isActive ? 'text-orange-500' : 'text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300'
                    }`
                  }
                >
                  <div className="relative">
                    <item.icon className="w-6 h-6" />
                    {hasDot && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] font-medium">{item.name}</span>
                </NavLink>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

