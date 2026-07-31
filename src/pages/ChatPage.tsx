import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Send, UserCircle2, Users, ArrowLeft } from 'lucide-react';

export default function ChatPage({ session }: { session: any }) {
  const [employee, setEmployee] = useState<any>(null);
  const [isHR, setIsHR] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // HR-specific state
  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);

  // Load current employee profile
  useEffect(() => {
    const loadEmployee = async () => {
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .single();

      if (empData) {
        setEmployee(empData);
        const hrCheck = empData.designation?.toLowerCase().includes('hr') || empData.role === 'hr';
        setIsHR(hrCheck);
      }
    };
    loadEmployee();
  }, [session]);

  // Load messages once employee is known
  useEffect(() => {
    if (!employee) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('chat_messages')
          .select('*')
          .order('created_at', { ascending: true });

        if (isHR && selectedEmployee) {
          // HR viewing a specific employee's thread
          query = query.or(`and(sender_id.eq.${selectedEmployee.id},receiver_id.eq.${employee.id}),and(sender_id.eq.${employee.id},receiver_id.eq.${selectedEmployee.id})`);
        } else if (isHR && !selectedEmployee) {
          // HR hasn't selected an employee yet — skip loading
          setMessages([]);
          setLoading(false);
          return;
        } else {
          // Regular employee — show messages where they are sender or receiver
          query = query.or(`sender_id.eq.${employee.id},receiver_id.eq.${employee.id}`);
        }

        const { data, error } = await query;
        if (error) throw error;
        setMessages(data || []);
      } catch (err: any) {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    loadMessages();

    // Load employee list for HR
    if (isHR) {
      const loadEmployeeList = async () => {
        const { data } = await supabase
          .from('employees')
          .select('id, name, designation')
          .eq('org_id', employee.org_id)
          .neq('id', employee.id)
          .order('name');
        setEmployeeList(data || []);
      };
      loadEmployeeList();
    }

    // Realtime subscription
    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          const msg = payload.new as any;
          // Only add if relevant to this user
          if (msg.sender_id === employee.id || msg.receiver_id === employee.id) {
            setMessages(prev => {
              if (prev.find(m => m.id === msg.id)) return prev;
              return [...prev, msg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, isHR, selectedEmployee]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !employee) return;

    // Determine receiver
    let receiverId: string | null = null;
    if (isHR && selectedEmployee) {
      receiverId = selectedEmployee.id;
    } else if (!isHR) {
      // Employee sends to HR — find HR employee in the org
      const { data: hrEmp } = await supabase
        .from('employees')
        .select('id')
        .eq('org_id', employee.org_id)
        .or(`designation.ilike.%hr%,role.eq.hr`)
        .limit(1)
        .single();
      receiverId = hrEmp?.id || null;
    }

    if (!receiverId) {
      toast({ title: 'Cannot send', description: 'No HR representative found in your organization.', variant: 'destructive' });
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          org_id: employee.org_id,
          sender_id: employee.id,
          receiver_id: receiverId,
          message: newMessage.trim(),
        });

      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  if (!employee) {
    return <div className="flex items-center justify-center h-full dark:text-slate-300">Loading...</div>;
  }

  // HR View — show employee list on the left
  if (isHR) {
    return (
      <div className="max-w-5xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Chat</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Chat with your team members.</p>
        </div>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Employee List */}
          <Card className="w-64 flex flex-col shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800 shrink-0">
            <CardHeader className="py-3 border-b border-gray-200 dark:border-slate-700">
              <CardTitle className="text-sm font-medium flex items-center dark:text-white">
                <Users className="w-4 h-4 mr-2 text-blue-500" />
                Employees
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-0">
              {employeeList.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-slate-400 text-sm">No employees found.</div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-slate-700">
                  {employeeList.map(emp => (
                    <button
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                        selectedEmployee?.id === emp.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500' : ''
                      }`}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{emp.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{emp.designation || 'Employee'}</p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800">
            <CardHeader className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 py-3">
              <CardTitle className="text-sm font-medium flex items-center dark:text-white">
                <UserCircle2 className="w-5 h-5 mr-2 text-blue-500" />
                {selectedEmployee ? selectedEmployee.name : 'Select an employee to start chatting'}
              </CardTitle>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/50">
              {!selectedEmployee ? (
                <div className="text-center text-gray-500 dark:text-slate-400 py-12 flex flex-col items-center">
                  <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                  <p>Select an employee from the list to view their messages.</p>
                </div>
              ) : loading ? (
                <div className="text-center text-gray-500 dark:text-slate-400 py-4">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 dark:text-slate-400 py-12 flex flex-col items-center">
                  <UserCircle2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
                  <p>No messages yet with {selectedEmployee.name}.</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.sender_id === employee.id;
                  return (
                    <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                      <div
                        className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                          isMine
                            ? 'bg-blue-600 text-white rounded-tr-sm'
                            : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-600 rounded-tl-sm'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      </div>
                      <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 px-1">
                        {format(new Date(msg.created_at), 'hh:mm a')}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {selectedEmployee && (
              <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Reply to ${selectedEmployee.name}...`}
                    className="flex-1 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
                    disabled={sending}
                  />
                  <Button type="submit" disabled={!newMessage.trim() || sending} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700">
                    <Send className="w-4 h-4" />
                  </Button>
                </form>
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // Regular Employee View
  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Support & HR Chat</h1>
        <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Chat directly with the HR team for any assistance.</p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800">
        <CardHeader className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 py-3">
          <CardTitle className="text-sm font-medium flex items-center dark:text-white">
            <UserCircle2 className="w-5 h-5 mr-2 text-blue-500" />
            HR Support Team
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/50">
          {loading ? (
            <div className="text-center text-gray-500 dark:text-slate-400 py-4">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-gray-500 dark:text-slate-400 py-12 flex flex-col items-center">
              <UserCircle2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />
              <p>No messages yet.</p>
              <p className="text-sm">Send a message to start chatting with HR.</p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.sender_id === employee.id;
              return (
                <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                      isMine
                        ? 'bg-blue-600 text-white rounded-tr-sm'
                        : 'bg-white dark:bg-slate-700 text-gray-800 dark:text-slate-200 border border-gray-200 dark:border-slate-600 rounded-tl-sm'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-slate-500 mt-1 px-1">
                    {format(new Date(msg.created_at), 'hh:mm a')}
                  </span>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </CardContent>

        <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message here..."
              className="flex-1 dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              disabled={sending}
            />
            <Button type="submit" disabled={!newMessage.trim() || sending} className="bg-blue-600 hover:bg-blue-700 text-white dark:bg-blue-600 dark:hover:bg-blue-700">
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
