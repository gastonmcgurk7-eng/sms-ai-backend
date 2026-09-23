import { useState, useEffect, useCallback } from 'react';
import { 
  Phone, 
  MessageSquare, 
  Settings, 
  Activity, 
  Play, 
  Copy, 
  Check, 
  RotateCw, 
  Terminal, 
  ArrowRight, 
  ShieldAlert, 
  Trash2, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  Search,
  X,
  Calendar,
  Info,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces for State Management
interface AppSettings {
  forwarding_number: string;
  twilio_account_sid: string;
  twilio_auth_token: string;
  twilio_phone_number: string;
  sms_message: string;
}

interface AppointmentLead {
  id: string;
  customer_name: string;
  requested_time: string;
  issue_description: string;
  phone_number: string;
  timestamp: string;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  type: string; // 'call' or 'sms' or 'system' or 'call_outcome' or 'sms_inbound' or 'sms_outbound'
  call_sid?: string;
  from?: string;
  to?: string;
  direction?: string;
  status?: string;
  action_taken?: string;
  raw_twiml?: string;
  dial_status?: string;
  dial_duration?: string;
  sms_sent?: boolean;
  sms_error?: string;
  sms_sid?: string;
  message_sid?: string;
  body?: string;
  message?: string;
  notes?: string;
  action?: string;
  related_call_sid?: string;
}

export default function App() {
  // Application URL & Endpoint generation
  const appUrl = window.location.origin;
  const voiceWebhookUrl = `${appUrl}/voice`;
  const statusWebhookUrl = `${appUrl}/call-status`;

  // Server Settings & Logs State
  const [settings, setSettings] = useState<AppSettings>({
    forwarding_number: '+15550199999',
    twilio_account_sid: '',
    twilio_auth_token: '',
    twilio_phone_number: '',
    sms_message: 'Hi! Sorry we missed your call. How can we help you today?'
  });

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [leads, setLeads] = useState<AppointmentLead[]>([]);
  
  // Leads Filtering State
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leadStartDate, setLeadStartDate] = useState('');
  const [leadEndDate, setLeadEndDate] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [copiedText, setCopiedText] = useState<'voice' | 'status' | null>(null);

  // Simulation State
  const [simCaller, setSimCaller] = useState('+14155552671');
  const [simOutcome, setSimOutcome] = useState<'no-answer' | 'busy' | 'failed' | 'completed'>('no-answer');
  const [simulating, setSimulating] = useState(false);
  const [simStep, setSimStep] = useState<number>(0);
  const [simLogs, setSimLogs] = useState<string[]>([]);
  const [simTwiML, setSimTwiML] = useState<string>('');
  const [simResultSMS, setSimResultSMS] = useState<any>(null);

  // New SMS Simulation states
  const [simType, setSimType] = useState<'voice' | 'sms'>('voice');
  const [simSmsBody, setSimSmsBody] = useState('My car is leaking oil. Do you have a repair opening today?');
  const [simSmsResult, setSimSmsResult] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Active Tab: 'dashboard' | 'leads' | 'simulator' | 'settings' | 'logs'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'simulator' | 'settings' | 'logs'>('dashboard');

  // Call Forwarding Guide States
  const [selectedCarrier, setSelectedCarrier] = useState<'att' | 'verizon' | 'tmobile' | 'iphone' | 'android'>('att');
  const [checklist, setChecklist] = useState({
    step1: false,
    step2: false,
    step3: false,
  });
  const [copiedCarrierCode, setCopiedCarrierCode] = useState<string | null>(null);

  // Auto-Refresh logs setting
  const [autoRefreshLogs, setAutoRefreshLogs] = useState<boolean>(() => {
    const saved = localStorage.getItem('autoRefreshLogs');
    return saved !== null ? saved === 'true' : true;
  });

  useEffect(() => {
    localStorage.setItem('autoRefreshLogs', String(autoRefreshLogs));
  }, [autoRefreshLogs]);

  const copyCode = (text: string, codeId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCarrierCode(codeId);
    setTimeout(() => setCopiedCarrierCode(null), 2000);
  };

  const fetchLogs = useCallback(async () => {
    try {
      const logsRes = await fetch('/api/logs');
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data);
      }
      // Also silently fetch leads here to keep dashboard updated
      const leadsRes = await fetch('/api/leads');
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data);
      }
    } catch (err: any) {
      if (err instanceof TypeError || (err.message && err.message.includes('fetch'))) {
        console.warn('Backend server is temporarily starting up or unreachable. Retrying...');
      } else {
        console.error('Failed to retrieve activity logs:', err);
      }
    }
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const settingsRes = await fetch('/api/settings');
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data);
      }
      await fetchLogs();
      await fetchLeads();
    } catch (err) {
      console.error('Failed to load initial backend settings:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const leadsRes = await fetch('/api/leads');
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data);
      }
    } catch (err: any) {
      if (err instanceof TypeError || (err.message && err.message.includes('fetch'))) {
        console.warn('Backend server is temporarily starting up or unreachable. Retrying...');
      } else {
        console.error('Failed to retrieve appointment leads:', err);
      }
    }
  };

  const fetchChatHistory = async (callerNum: string) => {
    try {
      const res = await fetch(`/api/chat/history?caller=${encodeURIComponent(callerNum)}`);
      if (res.ok) {
        const data = await res.json();
        setChatMessages(data);
      }
    } catch (err) {
      console.error('Failed to load chat history:', err);
    }
  };

  const handleResetChat = async (callerNum: string) => {
    try {
      const formData = new FormData();
      formData.append('caller', callerNum);
      const res = await fetch('/api/chat/reset', {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        setChatMessages([]);
        setSimSmsBody('My car is leaking oil. Do you have a repair opening today?');
        setSimStep(0);
        setSimLogs([]);
        setSimTwiML('');
        setSimSmsResult(null);
        await fetchLogs();
      }
    } catch (err) {
      console.error('Failed to reset chat conversation:', err);
    }
  };

  // Load configuration and logs on mount
  useEffect(() => {
    fetchData();
  }, []);

  // Poll logs every 5 seconds if autoRefreshLogs is active
  useEffect(() => {
    if (!autoRefreshLogs) return;
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, [autoRefreshLogs, fetchLogs]);

  useEffect(() => {
    if (activeTab === 'simulator') {
      fetchChatHistory(simCaller);
    }
  }, [simCaller, activeTab]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
        fetchLogs();
      } else {
        setSaveStatus('error');
      }
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const handleClearLogs = async () => {
    if (!window.confirm('Are you sure you want to clear all logs?')) return;
    try {
      await fetch('/api/logs/clear', { method: 'POST' });
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear logs:', err);
    }
  };

  const handleClearLeads = async () => {
    if (!window.confirm('Are you sure you want to clear all appointment leads and reset related counters to zero?')) return;
    try {
      await fetch('/api/leads/clear', { method: 'POST' });
      await fetch('/api/logs/clear', { method: 'POST' });
      setLeads([]);
      setLogs([]);
    } catch (err) {
      console.error('Failed to clear leads and logs:', err);
    }
  };

  const handleDeleteLead = async (leadId: string) => {
    if (!window.confirm('Are you sure you want to delete this specific lead?')) return;
    try {
      const res = await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
      if (res.ok) {
        setLeads(prev => prev.filter(l => l.id !== leadId));
        fetchLogs();
      } else {
        console.error('Failed to delete lead:', await res.text());
      }
    } catch (err) {
      console.error('Error deleting lead:', err);
    }
  };

  const handleExportToCsv = () => {
    if (leads.length === 0) return;
    
    const headers = ['ID', 'Customer Name', 'Requested Slot', 'Service/Issue Description', 'Phone Number', 'Captured Timestamp'];
    
    const rows = leads.map(lead => [
      lead.id,
      lead.customer_name,
      lead.requested_time,
      lead.issue_description,
      lead.phone_number,
      lead.timestamp
    ]);
    
    const formatCell = (val: string) => {
      if (val === undefined || val === null) return '';
      const stringified = String(val);
      if (stringified.includes(',') || stringified.includes('"') || stringified.includes('\n')) {
        return `"${stringified.replace(/"/g, '""')}"`;
      }
      return stringified;
    };
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(formatCell).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `appointment_leads_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, type: 'voice' | 'status') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2500);
  };

  // Live Webhook Simulation Flow
  const runSimulation = async () => {
    setSimulating(true);
    setSimStep(1);
    setSimResultSMS(null);
    setSimSmsResult(null);
    setSimLogs([]);
    setSimTwiML('');
    
    const uniqueCallSid = `CA${Math.random().toString(36).substr(2, 9).toUpperCase()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
    const twilioNum = settings.twilio_phone_number || '+15005550006';

    const addSimLog = (msg: string) => {
      setSimLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      // Step 1: Initiate simulated call to /voice webhook
      addSimLog(`Simulating incoming call from ${simCaller} to Twilio number ${twilioNum}...`);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      const voiceRes = await fetch(`/api/simulate/voice?caller=${encodeURIComponent(simCaller)}&twilio_num=${encodeURIComponent(twilioNum)}&call_sid=${uniqueCallSid}`, {
        method: 'POST'
      });
      
      if (!voiceRes.ok) throw new Error('Simulating /voice webhook failed');
      const voiceData = await voiceRes.json();
      
      setSimTwiML(voiceData.xml_twiml);
      addSimLog(`Twilio webhook '/voice' hit successfully!`);
      addSimLog(`TwiML Response returned:\n${voiceData.xml_twiml}`);
      
      // Step 2: Forwarding Dial
      setSimStep(2);
      addSimLog(`Attempting to Dial forwarding destination: ${settings.forwarding_number}...`);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Step 3: Callback status report to /call-status
      setSimStep(3);
      addSimLog(`Simulating call outcome reporting with status: '${simOutcome}'...`);
      await new Promise(resolve => setTimeout(resolve, 1200));

      const statusRes = await fetch('/api/simulate/call-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller: simCaller,
          twilio_num: twilioNum,
          call_sid: uniqueCallSid,
          dial_status: simOutcome,
          dial_duration: simOutcome === 'completed' ? '45' : '0'
        })
      });

      if (!statusRes.ok) throw new Error('Simulating /call-status webhook failed');
      const statusData = await statusRes.json();
      
      addSimLog(`Twilio callback webhook '/call-status' hit with status '${simOutcome}'!`);
      
      // Step 4: Outcome & SMS check
      setSimStep(4);
      const wasMissed = ['no-answer', 'busy', 'failed'].includes(simOutcome);
      
      if (wasMissed) {
        addSimLog(`Auto-Responder logic matched status '${simOutcome}'!`);
        if (statusData.sms_log) {
          setSimResultSMS(statusData.sms_log);
          addSimLog(`SMS auto-reply triggered to caller ${simCaller}.`);
          addSimLog(`Message Sent: "${statusData.sms_log.message}"`);
          addSimLog(`SMS Mode: ${statusData.sms_log.status === 'simulated' ? 'SIMULATED (No real credentials)' : 'REAL SMS SENT'}`);
        } else {
          addSimLog(`Auto-reply was matched, but SMS details could not be parsed.`);
        }
      } else {
        addSimLog(`Call outcome marked as completed. No SMS follow-up triggered.`);
      }
      
      await fetchLogs();
    } catch (err: any) {
      addSimLog(`Error in simulation: ${err.message || err}`);
    } finally {
      setSimulating(false);
    }
  };

  const runSmsSimulation = async () => {
    setSimulating(true);
    setSimStep(1);
    setSimResultSMS(null);
    setSimSmsResult(null);
    setSimLogs([]);
    setSimTwiML('');
    
    // In the simulated lead submission handler:
    let bookingDate = new Date();
    const incomingBody = simSmsBody;
    const text = incomingBody.toLowerCase();

    if (text.includes('tomorrow')) {
      bookingDate.setDate(bookingDate.getDate() + 1);
    } else {
      // Match formats like "23 sep", "23rd september", "sep 23", "september 23"
      const dateRegex = /(?:(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*)|(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(\d{1,2})(?:st|nd|rd|th)?)/i;
      const match = text.match(dateRegex);
      
      if (match) {
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const day = parseInt(match[1] || match[4], 10);
        const monthStr = (match[2] || match[3]).toLowerCase().slice(0, 3);
        const monthIndex = monthNames.indexOf(monthStr);
        
        if (monthIndex !== -1 && !isNaN(day)) {
          bookingDate = new Date(bookingDate.getFullYear(), monthIndex, day);
        }
      }
    }

    // Extract requested time (e.g., 3 PM or 3:00 PM)
    const timeMatch = text.match(/(\d{1,2}(?::\d{2})?\s*(?:am|pm))/i);
    const requestedTime = timeMatch ? timeMatch[0].toUpperCase() : '3:00 PM';

    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = `${bookingDate.toLocaleDateString('en-US', options)} at ${requestedTime}`;

    const uniqueMsgSid = `SM${Math.random().toString(36).substr(2, 9).toUpperCase()}${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    const addSimLog = (msg: string) => {
      setSimLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    try {
      // Step 1: Send simulated SMS to /sms webhook
      addSimLog(`Simulating incoming SMS from ${simCaller} with body: "${simSmsBody}"...`);
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      // Step 2: Hit /api/simulate/sms
      setSimStep(2);
      addSimLog(`Invoking /sms webhook with Form data...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const smsRes = await fetch('/api/simulate/sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caller: simCaller,
          body: simSmsBody,
          message_sid: uniqueMsgSid,
          override_date: formattedDate
        })
      });
      
      if (!smsRes.ok) throw new Error('Simulating /sms webhook failed');
      const smsData = await smsRes.json();
      
      // Step 3: Parse response and display Gemini result
      setSimStep(3);
      addSimLog(`Twilio webhook '/sms' hit successfully!`);
      addSimLog(`TwiML XML Response returned:\n${smsData.xml_twiml}`);
      
      setSimStep(4);
      if (smsData.outbound_log) {
        setSimSmsResult(smsData.outbound_log);
        addSimLog(`Gemini auto-response generated successfully.`);
        addSimLog(`AI Reply: "${smsData.outbound_log.message}"`);
        addSimLog(`SMS Mode: ${smsData.outbound_log.status === 'simulated' ? 'SIMULATED (Gemini Sandbox Mode)' : 'REAL GEMINI API RESPONSE'}`);
      } else {
        addSimLog(`Auto-reply generated successfully, but details could not be parsed.`);
      }
      
      await fetchLogs();
      await fetchLeads();
      await fetchChatHistory(simCaller);
      setSimSmsBody(''); // Clear text input after successful send
    } catch (err: any) {
      addSimLog(`Error in SMS simulation: ${err.message || err}`);
    } finally {
      setSimulating(false);
    }
  };

  // Derived state: Filtered appointment leads
  const filteredLeads = leads.filter(lead => {
    // 1. Search query (matches customer name, phone number, or issue description)
    if (leadSearchQuery.trim()) {
      const query = leadSearchQuery.toLowerCase();
      const matchesName = lead.customer_name?.toLowerCase().includes(query);
      const matchesPhone = lead.phone_number?.toLowerCase().includes(query);
      const matchesIssue = lead.issue_description?.toLowerCase().includes(query);
      if (!matchesName && !matchesPhone && !matchesIssue) {
        return false;
      }
    }

    // 2. Date range (matches timestamp of lead creation)
    if (lead.timestamp) {
      try {
        const leadDate = new Date(lead.timestamp);
        const leadDateMidnight = new Date(leadDate.getFullYear(), leadDate.getMonth(), leadDate.getDate()).getTime();

        if (leadStartDate) {
          const start = new Date(leadStartDate);
          const startMidnight = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
          if (leadDateMidnight < startMidnight) {
            return false;
          }
        }

        if (leadEndDate) {
          const end = new Date(leadEndDate);
          const endMidnight = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
          if (leadDateMidnight > endMidnight) {
            return false;
          }
        }
      } catch (err) {
        console.error("Error parsing lead timestamp:", err);
      }
    }

    return true;
  });

  // Derived state: KPI Metrics for the Analytics Dashboard
  const totalCalls = logs.filter(log => log.type === 'call').length;
  const totalSmsDispatched = logs.filter(log => log.type === 'sms' || log.type === 'sms_outbound').length;
  const totalBooked = leads.length;
  const conversionRate = totalCalls > 0 ? Math.round((totalBooked / totalCalls) * 100) : 0;

  // Derived state: 7-day trend data dynamically calculated from logs and leads timestamps
  const get7DayTrendData = () => {
    const data = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateString = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      
      // Filter calls on this day
      const callsCount = logs.filter(log => {
        if (log.type !== 'call') return false;
        const logTime = new Date(log.timestamp).getTime();
        return logTime >= dayStart && logTime < dayEnd;
      }).length;
      
      // Filter bookings on this day
      const bookingsCount = leads.filter(lead => {
        const leadTime = new Date(lead.timestamp).getTime();
        return leadTime >= dayStart && leadTime < dayEnd;
      }).length;
      
      data.push({
        date: dateString,
        calls: callsCount,
        bookings: bookingsCount
      });
    }
    return data;
  };
  
  const trendData = get7DayTrendData();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Floating Toast Notification */}
      <AnimatePresence>
        {saveStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: -24, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -24, scale: 0.95 }}
            transition={{ type: 'spring', duration: 0.4 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-50 border border-emerald-200 text-emerald-800 px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 font-semibold text-xs min-w-[280px] justify-center"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow-sm">
              <Check className="w-3.5 h-3.5" strokeWidth={3} />
            </div>
            <span>Settings saved successfully!</span>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Upper Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/85 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 text-white p-2.5 rounded-xl shadow-sm shadow-indigo-100">
            <Phone className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Twilio Webhook Call Director</h1>
            <p className="text-xs text-slate-500 font-medium">Forward calls, log statuses, & send auto-reply SMS text notifications on missed calls</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          {[
            { id: 'dashboard', label: 'Overview', icon: Activity },
            { id: 'leads', label: 'Appointment Leads', icon: Sparkles },
            { id: 'simulator', label: 'Call Simulator', icon: Play },
            { id: 'settings', label: 'Settings', icon: Settings },
            { id: 'logs', label: 'Activity Logs', icon: Terminal }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto p-6 md:p-8 space-y-8">
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RotateCw className="w-8 h-8 text-indigo-600 animate-spin" />
            <p className="text-sm text-slate-500 font-medium animate-pulse">Establishing contact with FastAPI backend...</p>
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* TAB: DASHBOARD / OVERVIEW */}
            {activeTab === 'dashboard' && (
              <div className="space-y-8 animate-fade-in">
                
                {/* 4 KPI Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                  {/* KPI 1 */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-indigo-100 hover:shadow-md transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Inbound / Missed Calls</span>
                      <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalCalls}</span>
                    </div>
                  </div>
                  
                  {/* KPI 2 */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-blue-100 hover:shadow-md transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100/60 flex items-center justify-center text-blue-600">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block font-sans">Auto-SMS Dispatched</span>
                      <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalSmsDispatched}</span>
                    </div>
                  </div>

                  {/* KPI 3 */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-emerald-100 hover:shadow-md transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100/60 flex items-center justify-center text-emerald-600">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Appointments Booked</span>
                      <span className="text-2xl font-bold text-slate-900 tracking-tight">{totalBooked}</span>
                    </div>
                  </div>

                  {/* KPI 4 */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center gap-4 hover:border-violet-100 hover:shadow-md transition-all duration-300">
                    <div className="w-12 h-12 rounded-xl bg-violet-50 border border-violet-100/60 flex items-center justify-center text-violet-600">
                      <Activity className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Conversion Rate</span>
                      <span className="text-2xl font-bold text-slate-900 tracking-tight">{conversionRate}%</span>
                    </div>
                  </div>
                </div>

                {/* Interactive Chart Panel */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4 hover:shadow-md transition-all duration-300">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">7-Day Performance Trend</h3>
                      <p className="text-xs text-slate-500 mt-0.5">Comparing dynamic missed calls vs AI booked appointments over the last 7 calendar days.</p>
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-indigo-500"></span>
                        <span>Missed Calls</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-md bg-emerald-500"></span>
                        <span>Appointments</span>
                      </div>
                    </div>
                  </div>

                  {/* SVG Chart */}
                  <div className="h-64 w-full relative pt-4">
                    {/* Vertical Grid Lines and labels */}
                    <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-400 font-medium pb-8 pointer-events-none">
                      {[10, 8, 6, 4, 2, 0].map((val) => (
                        <div key={val} className="flex items-center gap-3 w-full">
                          <span className="w-6 text-right font-mono">{val}</span>
                          <div className="flex-1 border-t border-slate-100"></div>
                        </div>
                      ))}
                    </div>

                    {/* Columns representation */}
                    <div className="absolute inset-0 pl-10 pr-2 flex justify-between items-end pb-8">
                      {trendData.map((day, index) => {
                        // Max value calculation for scaling
                        const maxVal = Math.max(10, ...trendData.map(d => Math.max(d.calls, d.bookings)));
                        const callHeight = (day.calls / maxVal) * 100;
                        const bookingHeight = (day.bookings / maxVal) * 100;

                        return (
                          <div key={index} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end relative">
                            <div className="flex items-end justify-center gap-1.5 h-full w-full">
                              {/* Missed Call Bar */}
                              <div className="w-6 sm:w-8 relative group/bar flex items-end h-full">
                                <div 
                                  className="w-full bg-indigo-500 hover:bg-indigo-600 rounded-t-lg transition-all duration-300 relative cursor-pointer min-h-[4px]" 
                                  style={{ height: `${Math.max(4, callHeight)}%` }}
                                >
                                  {/* Hover Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/bar:opacity-100 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-20 shadow-md">
                                    Calls: {day.calls}
                                  </div>
                                </div>
                              </div>

                              {/* Booking Bar */}
                              <div className="w-6 sm:w-8 relative group/bar flex items-end h-full">
                                <div 
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-lg transition-all duration-300 relative cursor-pointer min-h-[4px]" 
                                  style={{ height: `${Math.max(4, bookingHeight)}%` }}
                                >
                                  {/* Hover Tooltip */}
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover/bar:opacity-100 bg-slate-900 text-white text-[9px] font-bold px-1.5 py-0.5 rounded pointer-events-none transition-opacity whitespace-nowrap z-20 shadow-md">
                                    Booked: {day.bookings}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Label */}
                            <span className="text-[10px] text-slate-500 font-semibold truncate absolute top-full mt-2 w-full text-center">{day.date}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                  
                  {/* Left side: Webhook details */}
                  <div className="lg:col-span-7 space-y-6">
                    
                    {/* Webhook Configuration Panel */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="flex h-2.5 w-2.5 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <h2 className="font-semibold text-slate-900 text-sm tracking-tight">Active Live Webhook URLs</h2>
                      </div>
                      <p className="text-xs text-slate-500 mb-6 leading-relaxed">
                        Copy these endpoints and configure them in your Twilio Console (Phone Numbers &gt; Active Numbers &gt; Configure Voice Webhooks) to route actual voice traffic.
                      </p>

                      <div className="space-y-4">
                        {/* Webhook Endpoint 1: Voice */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Incoming Voice Webhook (POST)</label>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">TwiML Response</span>
                          </div>
                          <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-3 items-center justify-between gap-3 font-mono text-xs text-slate-700 overflow-hidden">
                            <span className="truncate select-all">{voiceWebhookUrl}</span>
                            <button 
                              onClick={() => copyToClipboard(voiceWebhookUrl, 'voice')}
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-1.5 rounded-lg transition-all"
                              title="Copy to clipboard"
                            >
                              {copiedText === 'voice' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Webhook Endpoint 2: Status */}
                        <div className="space-y-1.5">
                          <div className="flex justify-between items-center">
                            <label className="text-[11px] font-bold tracking-wider uppercase text-slate-400">Call Status Callback (POST)</label>
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded font-mono">SMS Trigger</span>
                          </div>
                          <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-2.5 pl-3 items-center justify-between gap-3 font-mono text-xs text-slate-700 overflow-hidden">
                            <span className="truncate select-all">{statusWebhookUrl}</span>
                            <button 
                              onClick={() => copyToClipboard(statusWebhookUrl, 'status')}
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 p-1.5 rounded-lg transition-all"
                              title="Copy to clipboard"
                            >
                              {copiedText === 'status' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Twilio Setup Instructions Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <h3 className="font-semibold text-slate-900 text-sm">How to Configure in Twilio</h3>
                      <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed">
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-[10px]">1</div>
                          <p>Sign in to your <strong className="text-slate-800">Twilio Console</strong> and navigate to <strong className="text-slate-800">Phone Numbers &gt; Active Numbers</strong>.</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-[10px]">2</div>
                          <p>Select your active phone number, scroll down to the <strong className="text-slate-800">Voice & Fax</strong> settings.</p>
                        </div>
                        <div className="flex gap-3">
                          <div className="flex-shrink-0 w-5 h-5 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-full flex items-center justify-center font-bold text-[10px]">3</div>
                          <p>Under <strong className="text-slate-800">"A Call Comes In"</strong>, select <strong className="text-slate-800">Webhook</strong> and paste the <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">/voice</code> URL above. Ensure the HTTP method is set to <strong className="text-slate-800">HTTP POST</strong>.</p>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right side: Quick Status & Call Flow */}
                  <div className="lg:col-span-5 space-y-6">
                    
                    {/* Current Active Settings Summary Card */}
                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md space-y-5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold tracking-wider uppercase text-indigo-300">Active Routing Configuration</span>
                        <Sparkles className="w-4 h-4 text-indigo-300" />
                      </div>

                      <div className="space-y-4">
                        <div>
                          <span className="text-[10px] text-indigo-200 block uppercase font-bold tracking-wide">Call Forward Destination</span>
                          <span className="text-lg font-semibold block mt-0.5 tracking-tight font-mono">{settings.forwarding_number}</span>
                        </div>

                        <div className="border-t border-indigo-800/60 my-3"></div>

                        <div>
                          <span className="text-[10px] text-indigo-200 block uppercase font-bold tracking-wide">Auto-Response SMS Text Message</span>
                          <p className="text-xs text-indigo-100 mt-1 leading-relaxed bg-indigo-950/40 p-3 rounded-xl border border-indigo-800/40">
                            "{settings.sms_message}"
                          </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2 text-[11px] text-indigo-300">
                          <span className={`w-2 h-2 rounded-full ${settings.twilio_account_sid ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <span>
                            {settings.twilio_account_sid 
                              ? 'Twilio Cloud Gateway Connected' 
                              : 'Running in Simulator Mode (Configure credentials in settings)'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Launch Simulator Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between gap-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 text-sm">Verify and Test Webhooks</h3>
                        <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                          Don't have Twilio credentials yet? Test and review the exact TwiML XML and SMS routing behavior immediately inside our mock execution engine.
                        </p>
                      </div>
                      <button 
                        onClick={() => setActiveTab('simulator')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm shadow-indigo-100 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" />
                        Open Live Call Simulator
                        <ChevronRight className="w-3.5 h-3.5 ml-1" />
                      </button>
                    </div>

                  </div>
                </div>
              </div>
            )}


            {/* TAB: INTERACTIVE WEBHOOK SIMULATOR */}
            {activeTab === 'simulator' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                {/* Simulation Control Card */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
                    <div>
                      <h2 className="font-semibold text-slate-900 text-sm tracking-tight">Setup Webhook Simulation</h2>
                      <p className="text-xs text-slate-500 mt-1">Configure parameters to trace webhook execution.</p>
                    </div>

                    {/* Flow Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/60">
                      <button
                        onClick={() => { setSimType('voice'); setSimLogs([]); setSimStep(0); setSimResultSMS(null); setSimSmsResult(null); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          simType === 'voice' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Inbound Voice Call
                      </button>
                      <button
                        onClick={() => { setSimType('sms'); setSimLogs([]); setSimStep(0); setSimResultSMS(null); setSimSmsResult(null); }}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          simType === 'sms' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Inbound SMS Message
                      </button>
                    </div>

                    <div className="space-y-4">
                      {/* Sim Field 1: Caller Number */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Simulated Caller Number</label>
                        <input
                          type="text"
                          value={simCaller}
                          onChange={(e) => setSimCaller(e.target.value)}
                          placeholder="+14155552671"
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {simType === 'voice' ? (
                        <>
                          {/* Sim Field 2: Selected Outcome */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-700">Simulated Dial Outcome</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: 'no-answer', label: 'No Answer', desc: 'Auto-responds' },
                                { id: 'busy', label: 'Busy Signal', desc: 'Auto-responds' },
                                { id: 'failed', label: 'Call Failed', desc: 'Auto-responds' },
                                { id: 'completed', label: 'Completed', desc: 'Call answered' }
                              ].map(opt => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setSimOutcome(opt.id as any)}
                                  className={`p-3 rounded-xl border text-left transition-all ${
                                    simOutcome === opt.id 
                                      ? 'bg-indigo-50/50 border-indigo-500 text-indigo-900' 
                                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                                  }`}
                                >
                                  <div className="font-semibold text-xs">{opt.label}</div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">{opt.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Start Voice Simulation Action */}
                          <button
                            onClick={runSimulation}
                            disabled={simulating}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all mt-4"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            {simulating ? 'Running Live Trace...' : 'Initiate Mock Call Trace'}
                          </button>
                        </>
                      ) : (
                        <>
                          {/* Live Chat Thread inside Simulator */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-slate-700">SMS Chat Thread History ({simCaller})</label>
                              <button
                                type="button"
                                onClick={() => handleResetChat(simCaller)}
                                className="text-[10px] text-red-600 hover:text-red-700 font-bold flex items-center gap-1 transition-colors bg-red-50 px-2 py-1 rounded"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                                Clear Chat Context
                              </button>
                            </div>
                            
                            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-[160px] max-h-[260px] overflow-y-auto space-y-3 font-sans">
                              {chatMessages.length === 0 ? (
                                <div className="text-center text-slate-400 py-12 text-xs">
                                  <MessageSquare className="w-6 h-6 mx-auto text-slate-300 mb-1" />
                                  No previous conversation messages. Let's start the chat!
                                </div>
                              ) : (
                                chatMessages.map((msg, i) => {
                                  const isUser = msg.role === 'user';
                                  // Find text part if any
                                  const textPart = msg.parts?.find((p: any) => p.text)?.text || msg.text || '';
                                  const fcPart = msg.parts?.find((p: any) => p.function_call);
                                  const frPart = msg.parts?.find((p: any) => p.function_response);
                                  
                                  if (!textPart && !fcPart && !frPart) return null;
                                  
                                  return (
                                    <div key={i} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                                      {textPart && (
                                        <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                          isUser 
                                            ? 'bg-indigo-600 text-white rounded-tr-none' 
                                            : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-sm'
                                        }`}>
                                          {textPart}
                                        </div>
                                      )}
                                      
                                      {fcPart && (
                                        <div className="max-w-[85%] bg-amber-50 border border-amber-200 text-amber-900 rounded-xl px-3 py-2 text-[10px] font-mono mt-1 space-y-1">
                                          <div className="font-bold flex items-center gap-1">🛠️ Tool Called: {fcPart.function_call.name}</div>
                                          <pre className="text-[9px] bg-amber-100/50 p-1.5 rounded overflow-x-auto">{JSON.stringify(fcPart.function_call.args, null, 2)}</pre>
                                        </div>
                                      )}
                                      
                                      {frPart && (
                                        <div className="max-w-[85%] bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl px-3 py-2 text-[10px] font-mono mt-1 space-y-1">
                                          <div className="font-bold flex items-center gap-1">✅ Tool Output (Saved Lead)</div>
                                          <pre className="text-[9px] bg-emerald-100/40 p-1.5 rounded overflow-x-auto">{JSON.stringify(frPart.function_response.response, null, 2)}</pre>
                                        </div>
                                      )}
                                      
                                      <span className="text-[8px] text-slate-400 mt-0.5 px-1 font-mono">
                                        {isUser ? 'Customer' : 'Gemini Assistant'}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          {/* Sim Field 2: SMS Body Text */}
                          <div className="space-y-1.5 mt-4">
                            <div className="flex justify-between items-center">
                              <label className="text-xs font-semibold text-slate-700">Type Simulated Reply</label>
                              <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 font-mono">Form POST</span>
                            </div>
                            <textarea
                              rows={2}
                              value={simSmsBody}
                              onChange={(e) => setSimSmsBody(e.target.value)}
                              placeholder="Type your reply (e.g. My name is Gaston, tomorrow at 3pm, cracked phone screen)..."
                              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                            />
                          </div>

                          {/* Start SMS Simulation Action */}
                          <button
                            onClick={runSmsSimulation}
                            disabled={simulating || !simSmsBody.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all mt-4"
                          >
                            <Sparkles className="w-3.5 h-3.5 fill-current" />
                            {simulating ? 'Synthesizing Response...' : 'Initiate AI Chatbot Response'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Simulator Concept Callout */}
                  <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-5 space-y-2.5">
                    <div className="flex gap-2 items-center text-indigo-900 font-semibold text-xs">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      How Webhook Processing Operates
                    </div>
                    <p className="text-xs text-indigo-800/80 leading-relaxed">
                      {simType === 'voice' ? (
                        <span>This simulator executes the exact sequence an actual incoming call triggers. It hits the <code className="bg-indigo-100/50 px-1 py-0.5 rounded font-mono text-[11px]">/voice</code> endpoint, evaluates the returned XML dial command, executes a timeout/busy callback, and fires the corresponding auto-reply handler to dispatch an SMS.</span>
                      ) : (
                        <span>This simulator sends a standard Form POST message to the <code className="bg-indigo-100/50 px-1 py-0.5 rounded font-mono text-[11px]">/sms</code> webhook endpoint. The backend initializes Gemini, feeds it your request under a repair-clinic clinic persona (restricted to 160 characters), logs the transaction, and returns Twilio MessagingResponse XML.</span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Simulation Debug Output / Console Terminal */}
                <div className="lg:col-span-7 space-y-6">
                  
                  {/* Step visualizer */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-5">
                    <h3 className="font-semibold text-slate-900 text-sm">Visual Live Routing Trace</h3>
                    
                    {simType === 'voice' ? (
                      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        {/* Step 1 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 1 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>1</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">Caller Ringing</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Inbound Call</div>
                          </div>
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />

                        {/* Step 2 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 2 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>2</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">TwiML Forward</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Forwarding Dial</div>
                          </div>
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />

                        {/* Step 3 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 3 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>3</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">Call Outcomes</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Status Check</div>
                          </div>
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />

                        {/* Step 4 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 4 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>4</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">SMS Responder</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Auto-Reply</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        {/* Step 1 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 1 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>1</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">SMS Received</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Inbound Text</div>
                          </div>
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />

                        {/* Step 2 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 2 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>2</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">Gemini Parsing</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">AI Synthesis</div>
                          </div>
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />

                        {/* Step 3 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 3 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>3</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">TwiML Response</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">TwiML Output</div>
                          </div>
                        </div>

                        <ChevronRight className="hidden md:block w-4 h-4 text-slate-300" />

                        {/* Step 4 */}
                        <div className="flex items-center gap-3 md:flex-col md:items-center md:text-center flex-1">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            simStep >= 4 ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 text-slate-400'
                          }`}>4</div>
                          <div>
                            <div className="text-[11px] font-bold text-slate-800">Chatbot Sent</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">AI Auto-Reply</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terminal Log */}
                  <div className="bg-slate-900 text-indigo-300 rounded-2xl border border-slate-800 shadow-md overflow-hidden flex flex-col h-[350px]">
                    <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
                      <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
                        <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
                        <span className="ml-1 font-semibold text-[11px]">webhook-trace-terminal</span>
                      </div>
                      {simulating && <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded animate-pulse font-mono">Tracing...</span>}
                    </div>

                    <div className="p-4 overflow-y-auto flex-1 font-mono text-xs space-y-3 scrollbar-thin">
                      {simLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-slate-500 text-center px-4">
                          {simType === 'voice' 
                            ? 'Click "Initiate Mock Call Trace" to start webhook debugger console.'
                            : 'Click "Initiate AI Chatbot Response" to start Gemini chatbot debugger console.'}
                        </div>
                      ) : (
                        <div className="space-y-2.5">
                          {simLogs.map((log, idx) => (
                            <div key={idx} className="whitespace-pre-wrap leading-relaxed border-b border-slate-800/40 pb-2 text-slate-300">
                              {log}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Simulated SMS Preview Bubble */}
                  <AnimatePresence>
                    {simResultSMS && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <MessageSquare className="w-4 h-4 text-emerald-500" />
                            Auto-Reply Dispatched
                          </div>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded font-mono ${
                            simResultSMS.status === 'simulated' 
                              ? 'bg-amber-50 text-amber-600 border border-amber-200/50' 
                              : 'bg-emerald-50 text-emerald-600 border border-emerald-200/50'
                          }`}>
                            {simResultSMS.status === 'simulated' ? 'SIMULATED DISPATCH' : 'REAL TWILIO GATEWAY'}
                          </span>
                        </div>

                        {/* Visual Mock Phone Bubble */}
                        <div className="max-w-[340px] bg-slate-100 rounded-2xl p-3.5 text-xs text-slate-800 border border-slate-200 font-medium relative ml-auto">
                          <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">To: {simResultSMS.to}</div>
                          {simResultSMS.message}
                          <div className="text-[8px] text-right text-slate-400 mt-1 font-semibold">{new Date(simResultSMS.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      </motion.div>
                    )}

                    {simSmsResult && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-3"
                      >
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                            <Sparkles className="w-4 h-4 text-purple-500" />
                            Gemini Chatbot Auto-Response
                          </div>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded font-mono bg-purple-50 text-purple-600 border border-purple-200/50">
                            GEMINI 1.5 FLASH (AI RESPONSE)
                          </span>
                        </div>

                        {/* Visual Mock Phone Bubble */}
                        <div className="max-w-[340px] bg-indigo-50/70 rounded-2xl p-3.5 text-xs text-indigo-950 border border-indigo-100 font-medium relative ml-auto">
                          <div className="text-[9px] font-bold text-indigo-400 uppercase mb-1">From AI Assistant to: {simSmsResult.to}</div>
                          {simSmsResult.message}
                          <div className="text-[8px] text-right text-indigo-400 mt-1 font-semibold">{new Date(simSmsResult.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                </div>

              </div>
            )}


            {/* TAB: SETTINGS & TWILIO CONFIGURATION */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900 text-sm">System Configuration & Integration Credentials</h2>
                  <p className="text-xs text-slate-500 mt-1">Configure real business routing destinations and Twilio API credentials.</p>
                </div>

                <form onSubmit={handleSaveSettings} className="p-6 space-y-6">
                  {/* Part 1: Voice Forwarding Settings */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Voice Forwarding Settings</h3>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-700">Real Business Phone Number</label>
                        <span className="text-[10px] text-slate-400 font-medium">Format: E.164 (e.g. +15551234567)</span>
                      </div>
                      <input
                        type="text"
                        required
                        value={settings.forwarding_number}
                        onChange={(e) => setSettings(prev => ({ ...prev, forwarding_number: e.target.value }))}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100"></div>

                  {/* Part 2: SMS Text settings */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">SMS Auto-Reply Response</h3>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-semibold text-slate-700">SMS Outbound Message Body</label>
                        <span className="text-[10px] text-slate-400 font-medium">Character limit recommended: 160</span>
                      </div>
                      <textarea
                        required
                        rows={3}
                        value={settings.sms_message}
                        onChange={(e) => setSettings(prev => ({ ...prev, sms_message: e.target.value }))}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors resize-none leading-relaxed"
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100"></div>

                  {/* Part 3: Twilio API Gateway */}
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Twilio Gateway Credentials (Optional)</h3>
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Secure Server Proxy</span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      If left empty, call simulator continues to fully execute all routing actions but simulates final SMS delivery. Enter valid keys to enable authentic SMS sending.
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Account SID */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Account SID</label>
                        <input
                          type="text"
                          value={settings.twilio_account_sid}
                          onChange={(e) => setSettings(prev => ({ ...prev, twilio_account_sid: e.target.value }))}
                          placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>

                      {/* Twilio Phone Number */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">Twilio Phone Number</label>
                        <input
                          type="text"
                          value={settings.twilio_phone_number}
                          onChange={(e) => setSettings(prev => ({ ...prev, twilio_phone_number: e.target.value }))}
                          placeholder="+15005550006"
                          className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                    </div>

                    {/* Auth Token */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-700">Auth Token</label>
                      <input
                        type="password"
                        value={settings.twilio_auth_token}
                        onChange={(e) => setSettings(prev => ({ ...prev, twilio_auth_token: e.target.value }))}
                        placeholder="••••••••••••••••••••••••••••••••"
                        className="w-full text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Submission Status & Action */}
                  <div className="pt-4 flex items-center justify-between gap-4 border-t border-slate-100">
                    <div>
                      {saveStatus === 'success' && (
                        <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5">
                          <Check className="w-4 h-4" /> Config saved successfully!
                        </p>
                      )}
                      {saveStatus === 'error' && (
                        <p className="text-xs font-semibold text-red-600 flex items-center gap-1.5">
                          <ShieldAlert className="w-4 h-4" /> Error processing save request
                        </p>
                      )}
                    </div>
                    <button
                      type="submit"
                      disabled={saveStatus === 'saving'}
                      className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white text-xs font-semibold py-2.5 px-6 rounded-xl transition-all shadow-sm"
                    >
                      {saveStatus === 'saving' ? 'Saving Config...' : 'Apply Config Settings'}
                    </button>
                  </div>

                </form>
              </div>

              {/* Application Preferences Card */}
              <div className="max-w-2xl mx-auto mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Settings className="w-4 h-4 text-indigo-600 animate-spin [animation-duration:12s]" />
                    Application UI Preferences
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Configure client-side workspace features and interface interaction settings.</p>
                </div>

                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200/80 rounded-xl hover:bg-slate-100/30 transition-all duration-200">
                    <div className="space-y-1 pr-4">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        Auto-Refresh Activity Logs
                      </label>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Enables continuous 5-second polling of latest webhook events and logs. Pause to inspect detailed JSON entries without list-reloads or jumping.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoRefreshLogs ? 'bg-indigo-600' : 'bg-slate-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          autoRefreshLogs ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Call Forwarding Guide Section */}
              <div className="max-w-2xl mx-auto mt-6 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                    <Phone className="w-4 h-4 text-indigo-600" />
                    Conditional Call Forwarding Setup
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">Keep your current business number. Forward unanswered/missed calls to our AI system.</p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Tabs/Pills selector */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Select Your Phone Carrier or Device</span>
                    <div className="flex flex-wrap gap-1.5 p-1 bg-slate-50 border border-slate-200/60 rounded-xl">
                      {[
                        { id: 'att', label: 'AT&T' },
                        { id: 'verizon', label: 'Verizon' },
                        { id: 'tmobile', label: 'T-Mobile' },
                        { id: 'iphone', label: 'iPhone Direct' },
                        { id: 'android', label: 'Android Direct' }
                      ].map((carrier) => (
                        <button
                          key={carrier.id}
                          type="button"
                          onClick={() => setSelectedCarrier(carrier.id as any)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                            selectedCarrier === carrier.id
                              ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/50'
                              : 'text-slate-600 hover:text-slate-900 border border-transparent'
                          }`}
                        >
                          {carrier.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Instruction Content */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 space-y-4">
                    {selectedCarrier === 'att' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800">AT&T Integration Codes</h4>
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold uppercase">No Answer & Busy</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          To forward calls when your line is busy or when you do not answer, dial the MMI codes below on your AT&T handset and hit call:
                        </p>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                            <div className="font-mono text-xs text-slate-800">
                              *61*{settings.twilio_phone_number || "+15550199999"}#
                            </div>
                            <button
                              type="button"
                              onClick={() => copyCode(`*61*${settings.twilio_phone_number || "+15550199999"}#`, 'att-noanswer')}
                              className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                            >
                              {copiedCarrierCode === 'att-noanswer' ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">Code *61* forwards calls if they are unanswered.</span>
                          
                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                            <div className="font-mono text-xs text-slate-800">
                              *67*{settings.twilio_phone_number || "+15550199999"}#
                            </div>
                            <button
                              type="button"
                              onClick={() => copyCode(`*67*${settings.twilio_phone_number || "+15550199999"}#`, 'att-busy')}
                              className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                            >
                              {copiedCarrierCode === 'att-busy' ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">Code *67* forwards calls when your line is busy.</span>
                        </div>
                      </div>
                    )}

                    {selectedCarrier === 'verizon' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800">Verizon Integration Code</h4>
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold uppercase">No Answer & Busy</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          Verizon simplifies this with a single conditional forwarding dial string. Dial the code below on your Verizon phone and press Call:
                        </p>
                        
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                          <div className="font-mono text-xs text-slate-800">
                            *71{settings.twilio_phone_number || "+15550199999"}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyCode(`*71${settings.twilio_phone_number || "+15550199999"}`, 'verizon')}
                            className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                          >
                            {copiedCarrierCode === 'verizon' ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium block">Code *71 activates call forwarding for busy lines and no answer.</span>
                      </div>
                    )}

                    {selectedCarrier === 'tmobile' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800">T-Mobile Integration Codes</h4>
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold uppercase">No Answer & Busy</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          To forward calls when your line is busy or when you do not answer, dial the MMI codes below on your T-Mobile handset and hit call:
                        </p>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                            <div className="font-mono text-xs text-slate-800">
                              **61*{settings.twilio_phone_number || "+15550199999"}#
                            </div>
                            <button
                              type="button"
                              onClick={() => copyCode(`**61*${settings.twilio_phone_number || "+15550199999"}#`, 'tmobile-noanswer')}
                              className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                            >
                              {copiedCarrierCode === 'tmobile-noanswer' ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">Code **61* forwards calls if they are unanswered.</span>
                          
                          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                            <div className="font-mono text-xs text-slate-800">
                              **62*{settings.twilio_phone_number || "+15550199999"}#
                            </div>
                            <button
                              type="button"
                              onClick={() => copyCode(`**62*${settings.twilio_phone_number || "+15550199999"}#`, 'tmobile-busy')}
                              className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                            >
                              {copiedCarrierCode === 'tmobile-busy' ? (
                                <Check className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Copy className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                          <span className="text-[10px] text-slate-400 font-medium block">Code **62* forwards calls when your phone is unreachable/busy.</span>
                        </div>
                      </div>
                    )}

                    {selectedCarrier === 'iphone' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800">iPhone Device Settings</h4>
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold uppercase">iOS Direct</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          To manually forward all calls from your iPhone:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-600 font-medium">
                          <li>Open the <span className="font-bold text-slate-700">Settings</span> app on your iPhone.</li>
                          <li>Scroll down and tap on <span className="font-bold text-slate-700">Phone</span>.</li>
                          <li>Select <span className="font-bold text-slate-700">Call Forwarding</span>.</li>
                          <li>Turn <span className="font-bold text-slate-700">Call Forwarding</span> ON.</li>
                          <li>Tap <span className="font-bold text-slate-700">Forward To</span> and enter the number below:</li>
                        </ol>
                        
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                          <div className="font-mono text-xs text-slate-800">
                            {settings.twilio_phone_number || "+15550199999"}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyCode(settings.twilio_phone_number || "+15550199999", 'iphone')}
                            className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                          >
                            {copiedCarrierCode === 'iphone' ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedCarrier === 'android' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-800">Android Device Settings</h4>
                          <span className="text-[9px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold uppercase">Android Direct</span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">
                          To manually configure conditional forwarding in Android:
                        </p>
                        <ol className="list-decimal pl-4 space-y-1.5 text-[11px] text-slate-600 font-medium">
                          <li>Open your native <span className="font-bold text-slate-700">Phone App</span>.</li>
                          <li>Tap the <span className="font-bold text-slate-700">Menu</span> button (3 dots) on top-right and open <span className="font-bold text-slate-700">Settings</span>.</li>
                          <li>Tap on <span className="font-bold text-slate-700">Supplementary Services</span> or <span className="font-bold text-slate-700">Call Forwarding</span>.</li>
                          <li>Select <span className="font-bold text-slate-700">Voice Call</span> if prompted.</li>
                          <li>Select <span className="font-bold text-slate-700">Forward when unanswered</span> and enter the number below:</li>
                        </ol>
                        
                        <div className="flex items-center justify-between bg-white border border-slate-200 rounded-lg p-2">
                          <div className="font-mono text-xs text-slate-800">
                            {settings.twilio_phone_number || "+15550199999"}
                          </div>
                          <button
                            type="button"
                            onClick={() => copyCode(settings.twilio_phone_number || "+15550199999", 'android')}
                            className="text-slate-500 hover:text-indigo-600 p-1.5 transition-colors flex items-center justify-center"
                          >
                            {copiedCarrierCode === 'android' ? (
                              <Check className="w-4 h-4 text-emerald-600" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-slate-100"></div>

                  {/* Verification & Testing Checklist */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Verification & Testing Checklist</h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed">
                      Follow these three validation steps to ensure your phone is routing correctly to the AI System:
                    </p>
                    
                    <div className="space-y-2">
                      <label className="flex items-start gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={checklist.step1}
                          onChange={(e) => setChecklist(prev => ({ ...prev, step1: e.target.checked }))}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Step 1: Dial the forwarding code</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Activate forwarding with your carrier using the ready dial strings above.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={checklist.step2}
                          onChange={(e) => setChecklist(prev => ({ ...prev, step2: e.target.checked }))}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Step 2: Simulate a missed business call</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Call your business number from another phone and let it ring until it redirects to the AI system.</p>
                        </div>
                      </label>

                      <label className="flex items-start gap-3 bg-slate-50 border border-slate-100 p-3 rounded-xl cursor-pointer hover:bg-slate-100/50 transition-colors">
                        <input
                          type="checkbox"
                          checked={checklist.step3}
                          onChange={(e) => setChecklist(prev => ({ ...prev, step3: e.target.checked }))}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 w-4 h-4"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800">Step 3: Receive Auto-Reply Confirmation</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Confirm the caller handset receives the follow-up text prompt automatically triggered by the AI.</p>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}


            {/* TAB: CAPTURED APPOINTMENT LEADS */}
            {activeTab === 'leads' && (
              <div className="space-y-6">
                {/* Header Controls */}
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm tracking-tight flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-indigo-600" />
                      Gemini-Captured Appointment Leads
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Real-time appointments booked automatically by Gemini AI Tools & Function Calling.</p>
                  </div>
                  
                   <div className="flex items-center gap-2">
                    <button
                      onClick={fetchLeads}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                      Refresh
                    </button>
                    <button
                      disabled={leads.length === 0}
                      onClick={handleExportToCsv}
                      title="Export Leads to CSV"
                      className="bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 text-indigo-700 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export CSV
                    </button>
                    <button
                      disabled={leads.length === 0}
                      onClick={handleClearLeads}
                      className="bg-red-50 hover:bg-red-100 border border-red-200/60 text-red-700 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Database
                    </button>
                  </div>
                </div>

                {/* Search & Filter Bar */}
                {leads.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
                      
                      {/* Name / Keyword Search */}
                      <div className="flex-1 space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Search Leads</label>
                        <div className="relative">
                          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input
                            type="text"
                            value={leadSearchQuery}
                            onChange={(e) => setLeadSearchQuery(e.target.value)}
                            placeholder="Filter by customer name, phone, or issue..."
                            className="w-full text-xs pl-10 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-colors"
                          />
                          {leadSearchQuery && (
                            <button
                              onClick={() => setLeadSearchQuery('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5 rounded-full hover:bg-slate-100"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Date Range Fields */}
                      <div className="flex flex-col sm:flex-row gap-3 items-end">
                        <div className="space-y-1 w-full sm:w-44">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" /> Start Date
                          </label>
                          <input
                            type="date"
                            value={leadStartDate}
                            onChange={(e) => setLeadStartDate(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1 w-full sm:w-44">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-slate-400" /> End Date
                          </label>
                          <input
                            type="date"
                            value={leadEndDate}
                            onChange={(e) => setLeadEndDate(e.target.value)}
                            className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
                          />
                        </div>

                        {(leadSearchQuery || leadStartDate || leadEndDate) && (
                          <button
                            onClick={() => {
                              setLeadSearchQuery('');
                              setLeadStartDate('');
                              setLeadEndDate('');
                            }}
                            className="w-full sm:w-auto text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl border border-red-100 transition-colors flex items-center justify-center gap-1 h-9"
                          >
                            <X className="w-3.5 h-3.5" />
                            Clear Filters
                          </button>
                        )}
                      </div>

                    </div>
                  </div>
                )}

                {leads.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-2xl mx-auto space-y-4">
                    <div className="bg-indigo-50 text-indigo-600 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">No appointment leads yet</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        To test this, head over to the **Call Simulator** and send an inbound SMS mentioning your name, issue, and requesting to schedule/book an appointment.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('simulator')}
                      className="bg-indigo-600 text-white text-xs font-semibold py-2 px-5 rounded-xl hover:bg-indigo-700 transition-all shadow-sm"
                    >
                      Test Booking in Simulator
                    </button>
                  </div>
                ) : filteredLeads.length === 0 ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm max-w-2xl mx-auto space-y-4">
                    <div className="bg-slate-50 text-slate-400 w-12 h-12 rounded-2xl flex items-center justify-center mx-auto shadow-sm border border-slate-100">
                      <Search className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 text-sm">No matching leads found</h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
                        No appointment leads match your current search query or date range filters.
                      </p>
                    </div>
                    <button 
                      onClick={() => {
                        setLeadSearchQuery('');
                        setLeadStartDate('');
                        setLeadEndDate('');
                      }}
                      className="bg-slate-100 text-slate-700 text-xs font-semibold py-2 px-5 rounded-xl hover:bg-slate-200 transition-all border border-slate-200"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredLeads.map((lead) => (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={lead.id}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4 relative overflow-hidden"
                      >
                        {/* Upper Card Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-bold flex items-center justify-center uppercase shadow-sm">
                              {lead.customer_name.charAt(0) || "A"}
                            </div>
                            <div>
                              <h3 className="font-semibold text-slate-900 text-xs">{lead.customer_name}</h3>
                              <p className="text-[10px] text-slate-500 font-mono font-medium">{lead.phone_number}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-emerald-50 text-emerald-700 font-bold border border-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider">
                              <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                              Lead Captured
                            </span>
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              title="Delete Lead"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors border border-transparent hover:border-red-100/40"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Middle details block */}
                        <div className="space-y-2 text-xs">
                          <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-start gap-2 text-slate-600">
                            <span className="text-slate-400 font-bold mt-0.5 select-none">🗓️</span>
                            <div>
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400">Requested Slot</span>
                                <div className="group relative inline-block cursor-help">
                                  <Info className="w-3 h-3 text-slate-400 hover:text-indigo-500 transition-colors" />
                                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 p-2 bg-slate-900 text-white text-[10px] leading-normal font-medium rounded-lg shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-bottom z-10 text-center">
                                    Format dynamically generated by Gemini AI based on the customer's natural language request.
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-slate-900"></div>
                                  </div>
                                </div>
                              </div>
                              <span className="font-semibold text-slate-800">{lead.requested_time}</span>
                            </div>
                          </div>

                          <div className="p-3 bg-indigo-50/40 border border-indigo-50 rounded-xl text-slate-700 space-y-1">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-400 block">Issue Details</span>
                            <p className="italic text-indigo-900 font-medium">"{lead.issue_description}"</p>
                          </div>
                        </div>

                        {/* Card Footer: timestamp details */}
                        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                          <span>ID: {lead.id}</span>
                          <span className="font-mono">{new Date(lead.timestamp).toLocaleString()}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>
            )}


            {/* TAB: SYSTEM & WEBHOOK ACTIVITY LOGS */}
            {activeTab === 'logs' && (
              <div className="space-y-6">
                
                {/* Header Controls */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="font-semibold text-slate-900 text-sm tracking-tight">Active Activity Logging Stream</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Historical records of simulated and authentic webhook events.</p>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Inline Auto-Refresh Toggle Switch */}
                    <div className="flex items-center gap-2.5 bg-slate-50 border border-slate-200/80 rounded-xl px-3 py-1.5 shadow-sm hover:bg-slate-100/40 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${autoRefreshLogs ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`}></span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                          {autoRefreshLogs ? 'Live Polling' : 'Paused'}
                        </span>
                      </div>
                      <div className="h-4 border-l border-slate-200"></div>
                      <button
                        type="button"
                        onClick={() => setAutoRefreshLogs(!autoRefreshLogs)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          autoRefreshLogs ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                            autoRefreshLogs ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <button
                      onClick={fetchLogs}
                      className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                      <RotateCw className={`w-3.5 h-3.5 ${autoRefreshLogs ? 'animate-spin [animation-duration:5s]' : ''}`} />
                      Refresh Log Stream
                    </button>
                    <button
                      disabled={logs.length === 0}
                      onClick={handleClearLogs}
                      className="bg-red-50 hover:bg-red-100 border border-red-200/60 text-red-700 text-xs font-semibold py-1.5 px-3 rounded-lg flex items-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear Logs
                    </button>
                  </div>
                </div>

                {/* Log display listing */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  {logs.length === 0 ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
                      <Terminal className="w-8 h-8 text-slate-300" />
                      <p className="text-xs font-semibold">No webhook hits logged yet.</p>
                      <button 
                        onClick={() => setActiveTab('simulator')}
                        className="bg-indigo-50 text-indigo-600 text-xs font-semibold py-1.5 px-4 rounded-xl hover:bg-indigo-100 transition-all"
                      >
                        Launch Call Simulator
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 text-xs">
                      {logs.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors space-y-2.5">
                          
                          {/* Log item Header */}
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                            <div className="flex items-center gap-2.5">
                              {/* Type tag badge */}
                              {log.type === 'call' && (
                                <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[9px] flex items-center gap-1">
                                  <Phone className="w-2.5 h-2.5" /> Call Inbound
                                </span>
                              )}
                              {log.type === 'call_outcome' && (
                                <span className={`font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[9px] flex items-center gap-1 ${
                                  ['no-answer', 'busy', 'failed'].includes(log.dial_status?.toLowerCase() || '') 
                                    ? 'bg-amber-50 border border-amber-200 text-amber-700' 
                                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                }`}>
                                  <Phone className="w-2.5 h-2.5" /> Outcome Callback
                                </span>
                              )}
                              {log.type === 'sms' && (
                                <span className={`font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[9px] flex items-center gap-1 ${
                                  log.status === 'simulated'
                                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                                    : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                                }`}>
                                  <MessageSquare className="w-2.5 h-2.5" /> Auto-SMS
                                </span>
                              )}
                              {log.type === 'sms_inbound' && (
                                <span className="bg-purple-50 border border-purple-200 text-purple-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[9px] flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5" /> SMS Inbound (Customer)
                                </span>
                              )}
                              {log.type === 'sms_outbound' && (
                                <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[9px] flex items-center gap-1">
                                  <Sparkles className="w-2.5 h-2.5" /> SMS Auto-Reply (Gemini AI)
                                </span>
                              )}
                              {log.type === 'system' && (
                                <span className="bg-slate-100 border border-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded uppercase tracking-wider text-[9px]">
                                  System Event
                                </span>
                              )}

                              {/* Target Number */}
                              <span className="font-semibold text-slate-800 font-mono">
                                {log.from && `From: ${log.from}`}
                                {log.to && log.type === 'sms' && `To: ${log.to}`}
                                {log.to && log.type === 'sms_outbound' && `To: ${log.to}`}
                                {log.action && log.action}
                              </span>
                            </div>

                            {/* Timestamp */}
                            <span className="text-[10px] text-slate-400 font-medium font-mono">
                              {new Date(log.timestamp).toLocaleString()}
                            </span>
                          </div>

                          {/* Log item details */}
                          <div className="bg-slate-50/50 p-3 rounded-xl border border-slate-150 text-slate-600 leading-relaxed font-mono text-[11px] whitespace-pre-wrap">
                            {log.type === 'call' && (
                              <div className="space-y-1">
                                <div><strong className="text-slate-800">Call SID:</strong> {log.call_sid}</div>
                                <div><strong className="text-slate-800">Action:</strong> {log.action_taken}</div>
                                <details className="mt-2 text-[10px]">
                                  <summary className="cursor-pointer text-indigo-600 hover:underline">View Raw XML TwiML Response</summary>
                                  <pre className="bg-slate-900 text-indigo-300 p-2.5 rounded-lg mt-1 overflow-x-auto border border-slate-850 max-h-40">{log.raw_twiml}</pre>
                                </details>
                              </div>
                            )}

                            {log.type === 'call_outcome' && (
                              <div className="space-y-1">
                                <div><strong className="text-slate-800">Call SID:</strong> {log.call_sid}</div>
                                <div><strong className="text-slate-800">Dial Status:</strong> <span className="font-bold underline">{log.dial_status}</span></div>
                                {log.dial_duration && <div><strong className="text-slate-800">Duration:</strong> {log.dial_duration} seconds</div>}
                                <div><strong className="text-slate-800">Resolution Handler:</strong> {log.action_taken}</div>
                                {log.sms_error && <div className="text-red-600 font-bold"><strong className="text-slate-800">Error:</strong> {log.sms_error}</div>}
                              </div>
                            )}

                            {log.type === 'sms' && (
                              <div className="space-y-1">
                                <div><strong className="text-slate-800">SMS SID:</strong> {log.sms_sid}</div>
                                <div><strong className="text-slate-800">Related Call:</strong> {log.related_call_sid || 'None'}</div>
                                <div><strong className="text-slate-800">Message Text:</strong> "{log.message}"</div>
                                {log.notes && <div className="text-slate-400 italic">*{log.notes}</div>}
                              </div>
                            )}

                            {log.type === 'sms_inbound' && (
                              <div className="space-y-1">
                                <div><strong className="text-slate-800">Message SID:</strong> {log.message_sid}</div>
                                <div><strong className="text-slate-800">From Number:</strong> {log.from}</div>
                                <div className="mt-1.5 p-2 bg-slate-100 rounded-lg text-slate-800 font-medium">"{log.body}"</div>
                              </div>
                            )}

                            {log.type === 'sms_outbound' && (
                              <div className="space-y-1">
                                <div><strong className="text-slate-800">Message SID:</strong> {log.message_sid}</div>
                                <div><strong className="text-slate-800">To Number:</strong> {log.to}</div>
                                <div className="mt-1.5 p-2 bg-indigo-50 border border-indigo-100 text-indigo-900 rounded-lg font-medium">"{log.message}"</div>
                              </div>
                            )}

                            {log.type === 'system' && (
                              <div>{log.message}</div>
                            )}
                          </div>

                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* Persistent informative footer footer */}
      <footer className="mt-16 bg-white border-t border-slate-200 py-8 px-6 text-center text-xs text-slate-500 space-y-2">
        <p className="font-medium">Twilio Webhook Call Forwarding and Auto-Responder Platform</p>
        <p className="text-[10px] text-slate-400">Written in Python (FastAPI backend) and TypeScript (React 19 + Tailwind UI)</p>
      </footer>

    </div>
  );
}
