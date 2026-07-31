import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Send, UserCircle2, Users, ArrowLeft, MessageSquare, Plus, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function ChatPage({ session }: { session: any }) {
  const [employee, setEmployee] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const [employeeList, setEmployeeList] = useState<any[]>([]);
  const [groupList, setGroupList] = useState<any[]>([]);
  
  const [selectedType, setSelectedType] = useState<'dm' | 'group' | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<any>(null);
  
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

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
      }
    };
    loadEmployee();
  }, [session]);

  // Load employees and groups
  const loadSidebarData = async () => {
    if (!employee) return;
    
    // Load all other employees in org
    const { data: emps } = await supabase
      .from('employees')
      .select('id, name, username, designation')
      .eq('org_id', employee.org_id)
      .neq('id', employee.id)
      .order('name');
      
    setEmployeeList(emps || []);

    // Load groups user is part of
    const { data: grps } = await supabase
      .from('chat_groups')
      .select('id, name, created_at, chat_group_members!inner(employee_id)')
      .eq('org_id', employee.org_id)
      .eq('chat_group_members.employee_id', employee.id)
      .order('created_at');
      
    setGroupList(grps || []);
  };

  useEffect(() => {
    loadSidebarData();
  }, [employee]);

  // Load messages when target changes
  useEffect(() => {
    if (!employee || !selectedTarget || !selectedType) {
      setMessages([]);
      return;
    }

    const loadMessages = async () => {
      try {
        setLoading(true);
        let query = supabase
          .from('chat_messages')
          .select('*, sender:employees!sender_id(id, name, username)')
          .order('created_at', { ascending: true });

        if (selectedType === 'dm') {
          query = query.or(`and(sender_id.eq.${selectedTarget.id},receiver_id.eq.${employee.id}),and(sender_id.eq.${employee.id},receiver_id.eq.${selectedTarget.id})`);
        } else if (selectedType === 'group') {
          query = query.eq('group_id', selectedTarget.id);
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
  }, [employee, selectedTarget, selectedType]);

  // Realtime subscription
  useEffect(() => {
    if (!employee) return;

    const channel = supabase
      .channel('chat-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new as any;
          
          // Verify relevance to current user
          if (msg.sender_id === employee.id || msg.receiver_id === employee.id || msg.group_id) {
            // Check if it belongs to current active chat
            let isRelevant = false;
            if (selectedType === 'dm' && selectedTarget) {
              isRelevant = !msg.group_id && (msg.sender_id === selectedTarget.id || msg.receiver_id === selectedTarget.id);
            } else if (selectedType === 'group' && selectedTarget) {
              isRelevant = msg.group_id === selectedTarget.id;
            }

            if (isRelevant) {
              // Fetch sender details since realtime doesn't join automatically
              const { data: senderData } = await supabase
                .from('employees')
                .select('id, name, username')
                .eq('id', msg.sender_id)
                .single();
                
              const enrichedMsg = { ...msg, sender: senderData };
              
              setMessages(prev => {
                if (prev.find(m => m.id === enrichedMsg.id)) return prev;
                return [...prev, enrichedMsg];
              });
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [employee, selectedTarget, selectedType]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !employee || !selectedTarget) return;

    setSending(true);
    try {
      const payload: any = {
        org_id: employee.org_id,
        sender_id: employee.id,
        message: newMessage.trim(),
      };
      
      if (selectedType === 'dm') {
        payload.receiver_id = selectedTarget.id;
      } else {
        payload.group_id = selectedTarget.id;
      }

      const { error } = await supabase.from('chat_messages').insert(payload);

      if (error) throw error;
      setNewMessage("");
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };
  
  const handleCreateGroup = async () => {
    if (!newGroupName.trim() || selectedMembers.length === 0) {
      toast({ title: 'Validation', description: 'Enter group name and select at least 1 member.', variant: 'destructive' });
      return;
    }
    
    setCreatingGroup(true);
    try {
      // 1. Create Group
      const { data: groupData, error: groupErr } = await supabase
        .from('chat_groups')
        .insert({
          org_id: employee.org_id,
          name: newGroupName.trim(),
          created_by: employee.id
        })
        .select()
        .single();
        
      if (groupErr) throw groupErr;
      
      // 2. Add members (including self)
      const memberInserts = [...selectedMembers, employee.id].map(id => ({
        group_id: groupData.id,
        employee_id: id
      }));
      
      const { error: memErr } = await supabase
        .from('chat_group_members')
        .insert(memberInserts);
        
      if (memErr) throw memErr;
      
      toast({ title: 'Success', description: 'Group created successfully!' });
      setShowCreateGroup(false);
      setNewGroupName("");
      setSelectedMembers([]);
      loadSidebarData();
      
      setSelectedType('group');
      setSelectedTarget(groupData);
    } catch (err: any) {
      toast({ title: 'Failed to create group', description: err.message, variant: 'destructive' });
    } finally {
      setCreatingGroup(false);
    }
  };

  if (!employee) {
    return <div className="flex items-center justify-center h-full dark:text-slate-300">Loading...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col">
      <div className="mb-4 flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Team Chat</h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">Connect with your team members directly or in groups.</p>
        </div>
        <div className="text-sm text-slate-500 font-medium">Logged in as: <span className="text-blue-600 dark:text-blue-400">@{employee.username}</span></div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        {/* Sidebar */}
        <Card className="w-72 flex flex-col shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800 shrink-0">
          <CardHeader className="py-3 border-b border-gray-200 dark:border-slate-700 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center dark:text-white">
              <MessageSquare className="w-4 h-4 mr-2 text-blue-500" />
              Chats
            </CardTitle>
            <Button variant="ghost" size="icon" onClick={() => setShowCreateGroup(true)} className="h-6 w-6 text-slate-500 hover:text-blue-500">
              <Plus className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {/* Groups Section */}
            <div className="py-2">
              <h3 className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Groups</h3>
              {groupList.length === 0 ? (
                <div className="px-4 py-2 text-xs text-slate-500">No groups yet.</div>
              ) : (
                groupList.map(grp => (
                  <button
                    key={grp.id}
                    onClick={() => { setSelectedType('group'); setSelectedTarget(grp); }}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                      selectedType === 'group' && selectedTarget?.id === grp.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                        #
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{grp.name}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            
            {/* Direct Messages Section */}
            <div className="py-2 border-t border-gray-100 dark:border-slate-700/50">
              <h3 className="px-4 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Direct Messages</h3>
              {employeeList.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => { setSelectedType('dm'); setSelectedTarget(emp); }}
                  className={`w-full text-left px-4 py-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors ${
                    selectedType === 'dm' && selectedTarget?.id === emp.id ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500' : 'border-l-2 border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserCircle2 className="w-6 h-6 text-slate-400 shrink-0" />
                    <div className="overflow-hidden">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{emp.name}</p>
                      <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">@{emp.username} • {emp.designation || 'Member'}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Chat Area */}
        <Card className="flex-1 flex flex-col overflow-hidden shadow-sm border-gray-200 dark:border-slate-700 dark:bg-slate-800">
          <CardHeader className="bg-gray-50 dark:bg-slate-800/80 border-b border-gray-200 dark:border-slate-700 py-3">
            <CardTitle className="text-sm font-medium flex items-center dark:text-white">
              {selectedType === 'group' ? (
                <>
                  <Users className="w-5 h-5 mr-2 text-indigo-500" />
                  {selectedTarget?.name}
                </>
              ) : selectedType === 'dm' ? (
                <>
                  <UserCircle2 className="w-5 h-5 mr-2 text-blue-500" />
                  {selectedTarget?.name} <span className="ml-2 font-normal text-slate-400 text-xs">@{selectedTarget?.username}</span>
                </>
              ) : (
                'Select a chat'
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-slate-900/50">
            {!selectedTarget ? (
              <div className="text-center text-gray-500 dark:text-slate-400 py-12 flex flex-col items-center">
                <MessageSquare className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3 opacity-50" />
                <p>Select a direct message or group from the list.</p>
              </div>
            ) : loading ? (
              <div className="text-center text-gray-500 dark:text-slate-400 py-4">Loading messages...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-gray-500 dark:text-slate-400 py-12 flex flex-col items-center">
                {selectedType === 'group' ? <Users className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" /> : <UserCircle2 className="w-12 h-12 text-gray-300 dark:text-slate-600 mb-3" />}
                <p>No messages yet. Start the conversation!</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMine = msg.sender_id === employee.id;
                const showSender = selectedType === 'group' && !isMine && (idx === 0 || messages[idx-1].sender_id !== msg.sender_id);
                
                return (
                  <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {showSender && (
                      <span className="text-[10px] font-semibold text-slate-500 mb-0.5 ml-1">@{msg.sender?.username}</span>
                    )}
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

          {selectedTarget && (
            <div className="p-4 bg-white dark:bg-slate-800 border-t border-gray-200 dark:border-slate-700">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={`Message ${selectedType === 'group' ? selectedTarget.name : '@'+selectedTarget.username}...`}
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

      {/* Create Group Modal */}
      <Dialog open={showCreateGroup} onOpenChange={setShowCreateGroup}>
        <DialogContent className="sm:max-w-md dark:bg-slate-800 dark:border-slate-700">
          <DialogHeader>
            <DialogTitle className="dark:text-white">Create New Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-slate-200">Group Name</label>
              <Input
                placeholder="e.g. Project Alpha Team"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="dark:bg-slate-900 dark:border-slate-600 dark:text-white"
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium dark:text-slate-200">Select Members</label>
              <div className="border border-slate-200 dark:border-slate-700 rounded-md max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
                {employeeList.map(emp => (
                  <label key={emp.id} className="flex items-center gap-3 p-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedMembers.includes(emp.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedMembers([...selectedMembers, emp.id]);
                        else setSelectedMembers(selectedMembers.filter(id => id !== emp.id));
                      }}
                      className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{emp.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">@{emp.username}</p>
                    </div>
                  </label>
                ))}
                {employeeList.length === 0 && (
                  <div className="p-3 text-sm text-slate-500 text-center">No other employees found.</div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateGroup(false)} disabled={creatingGroup} className="dark:border-slate-600 dark:text-slate-300">
              Cancel
            </Button>
            <Button onClick={handleCreateGroup} disabled={creatingGroup || !newGroupName.trim() || selectedMembers.length === 0} className="bg-blue-600 hover:bg-blue-700 text-white">
              Create Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
