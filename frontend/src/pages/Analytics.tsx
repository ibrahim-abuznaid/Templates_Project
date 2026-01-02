import React, { useEffect, useState } from 'react';
import { analyticsApi, ideasApi } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  CheckCircle,
  Clock,
  Calendar,
  Loader,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  RefreshCw,
  Eye,
  Zap,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { Link } from 'react-router-dom';

// Color palette
const COLORS = ['#6D28D9', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];
const STATUS_COLORS: Record<string, string> = {
  new: '#3b82f6',
  assigned: '#8b5cf6',
  in_progress: '#f59e0b',
  submitted: '#6366f1',
  needs_fixes: '#ef4444',
  reviewed: '#22c55e',
  published: '#10b981',
  archived: '#6b7280',
};

interface SummaryData {
  overall: {
    total_templates: number;
    published: number;
    reviewed: number;
    in_progress: number;
    new_templates: number;
    total_value: number;
  };
  this_month: { created: number; published: number };
  last_month: { created: number; published: number };
  active_freelancers: number;
  total_freelancers: number;
  month_over_month_growth: string;
}

interface FreelancerReport {
  freelancer_id: number;
  username: string;
  email: string;
  total_templates: number;
  published: number;
  reviewed: number;
  submitted: number;
  in_progress: number;
  needs_fixes: number;
  assigned: number;
  total_earnings: number;
  completed_earnings: number;
}

interface CreationData {
  creation_over_time: Array<{ date: string; created: number; published: number }>;
  status_distribution: Array<{ status: string; count: number }>;
  top_freelancers: Array<{ username: string; templates_count: number; published_count: number }>;
}

interface IncompleteTemplate {
  id: number;
  flow_name: string;
  summary: string | null;
  description: string | null;
  time_save_per_week: string | null;
  cost_per_year: string | null;
  author: string | null;
  scribe_url: string | null;
  template_url: string | null;
  flow_json: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  missing_fields: string[];
  missing_count: number;
}

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [freelancerReports, setFreelancerReports] = useState<FreelancerReport[]>([]);
  const [creationData, setCreationData] = useState<CreationData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'weekly' | 'monthly' | 'all'>('monthly');
  const [incompleteTemplates, setIncompleteTemplates] = useState<IncompleteTemplate[]>([]);
  
  // Format sync state
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncPreview, setSyncPreview] = useState<{
    stats: { total: number; needsUpdate: number; alreadyCorrect: number; publishedNeedsUpdate: number };
    needsUpdate: Array<{
      id: number;
      flow_name: string;
      time_save_per_week: { current: string; normalized: string | null };
      cost_per_year: { current: string; normalized: string | null };
      isPublished: boolean;
    }>;
  } | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; publicLibrarySynced?: number } | null>(null);

  useEffect(() => {
    loadData();
  }, [period, reportPeriod]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, freelancerRes, creationRes, incompleteRes] = await Promise.all([
        analyticsApi.getSummary(),
        analyticsApi.getFreelancerReport(reportPeriod),
        analyticsApi.getCreationRate(period),
        analyticsApi.getIncompletePublished(),
      ]);

      setSummary(summaryRes.data);
      setFreelancerReports(freelancerRes.data.reports);
      setCreationData(creationRes.data);
      setIncompleteTemplates(incompleteRes.data.templates);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (dateStr.includes('-W')) {
      // Week format: 2024-W01
      return `Week ${dateStr.split('-W')[1]}`;
    }
    const date = new Date(dateStr);
    if (period === 'yearly') {
      return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const exportReport = () => {
    if (!freelancerReports.length) return;

    const headers = ['Username', 'Email', 'Total Templates', 'Published', 'Reviewed', 'In Progress', 'Needs Fixes', 'Completed Earnings'];
    const rows = freelancerReports.map(r => [
      r.username,
      r.email,
      r.total_templates,
      r.published,
      r.reviewed,
      r.in_progress,
      r.needs_fixes,
      `$${Number(r.completed_earnings || 0).toFixed(2)}`
    ]);

    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `freelancer-report-${reportPeriod}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Format sync functions
  const loadSyncPreview = async () => {
    setSyncLoading(true);
    setSyncResult(null);
    try {
      const response = await ideasApi.previewFormatSync();
      setSyncPreview(response.data);
      setShowSyncModal(true);
    } catch (error) {
      console.error('Failed to load sync preview:', error);
      setSyncResult({ success: false, message: 'Failed to load preview' });
    } finally {
      setSyncLoading(false);
    }
  };

  const executeSyncFormats = async () => {
    setSyncLoading(true);
    try {
      const response = await ideasApi.syncFormats();
      setSyncResult({ 
        success: true, 
        message: response.data.message,
        publicLibrarySynced: response.data.stats.publicLibrarySynced
      });
      // Refresh the preview to show updated stats
      const previewResponse = await ideasApi.previewFormatSync();
      setSyncPreview(previewResponse.data);
    } catch (error) {
      console.error('Failed to sync formats:', error);
      setSyncResult({ success: false, message: 'Failed to sync formats' });
    } finally {
      setSyncLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Track template creation and freelancer performance</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Format Sync Button */}
          <button
            onClick={loadSyncPreview}
            disabled={syncLoading}
            className="btn-secondary flex items-center gap-2"
            title="Sync all template formats (cost/time)"
          >
            {syncLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync Formats
          </button>
          
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="input-field w-40"
          >
            <option value="weekly">Last 7 days</option>
            <option value="monthly">Last 30 days</option>
            <option value="quarterly">Last 90 days</option>
            <option value="yearly">Last 12 months</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card bg-gradient-to-br from-primary-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Templates</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.overall.total_templates}</p>
                <div className="flex items-center mt-2 text-sm">
                  {parseFloat(summary.month_over_month_growth) >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-green-500 mr-1" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500 mr-1" />
                  )}
                  <span className={parseFloat(summary.month_over_month_growth) >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {summary.month_over_month_growth}% vs last month
                  </span>
                </div>
              </div>
              <div className="p-3 bg-primary-100 rounded-xl">
                <FileText className="w-8 h-8 text-primary-600" />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-green-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Published</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.overall.published}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {summary.this_month.published} this month
                </p>
              </div>
              <div className="p-3 bg-green-100 rounded-xl">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-amber-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">In Progress</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.overall.in_progress}</p>
                <p className="text-sm text-gray-500 mt-2">
                  {summary.overall.new_templates} new available
                </p>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <Clock className="w-8 h-8 text-amber-600" />
              </div>
            </div>
          </div>

          <div className="card bg-gradient-to-br from-blue-50 to-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">Active Freelancers</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{summary.active_freelancers}</p>
                <p className="text-sm text-gray-500 mt-2">
                  of {summary.total_freelancers} total
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Incomplete Published Templates Warning */}
      {incompleteTemplates.length > 0 && (
        <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-900">
                Published Templates Missing Required Fields
              </h2>
              <p className="text-sm text-amber-700">
                {incompleteTemplates.length} template{incompleteTemplates.length !== 1 ? 's' : ''} published but incomplete. Template URL is optional, all other fields are required.
              </p>
            </div>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {incompleteTemplates.map((template) => (
              <div 
                key={template.id} 
                className="bg-white rounded-xl p-4 border border-amber-200 hover:border-amber-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <Link 
                      to={`/ideas/${template.id}`}
                      className="font-semibold text-gray-900 hover:text-primary-600 transition-colors flex items-center gap-2"
                    >
                      {template.flow_name || `Template #${template.id}`}
                      <ExternalLink className="w-4 h-4 shrink-0" />
                    </Link>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {template.missing_fields.map((field) => (
                        <span 
                          key={field}
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700"
                        >
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {template.missing_count} missing
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Template Creation Over Time */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Template Creation Rate</h2>
            </div>
          </div>
          {creationData && creationData.creation_over_time.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={creationData.creation_over_time}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6D28D9" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6D28D9" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPublished" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="date" 
                  tickFormatter={formatDate}
                  tick={{ fill: '#6b7280', fontSize: 12 }}
                />
                <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} />
                <Tooltip 
                  labelFormatter={formatDate}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="created" 
                  stroke="#6D28D9" 
                  fill="url(#colorCreated)"
                  strokeWidth={2}
                  name="Created"
                />
                <Area 
                  type="monotone" 
                  dataKey="published" 
                  stroke="#22c55e" 
                  fill="url(#colorPublished)"
                  strokeWidth={2}
                  name="Published"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No data available for this period
            </div>
          )}
        </div>

        {/* Status Distribution */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Status Distribution</h2>
          </div>
          {creationData && creationData.status_distribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={creationData.status_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="count"
                  nameKey="status"
                  label={({ name, value }) => `${formatStatus(name as string)}: ${value}`}
                  labelLine={false}
                >
                  {creationData.status_distribution.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={STATUS_COLORS[entry.status] || COLORS[index % COLORS.length]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value, name) => [value, formatStatus(String(name))]}
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No data available for this period
            </div>
          )}
        </div>
      </div>

      {/* Top Freelancers Chart */}
      {creationData && creationData.top_freelancers.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Users className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Top Performing Freelancers</h2>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={creationData.top_freelancers} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
              <YAxis 
                dataKey="username" 
                type="category" 
                width={100}
                tick={{ fill: '#6b7280', fontSize: 12 }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="templates_count" fill="#6D28D9" name="Total Templates" radius={[0, 4, 4, 0]} />
              <Bar dataKey="published_count" fill="#22c55e" name="Published" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Freelancer Reports Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Freelancer Performance Report</h2>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={reportPeriod}
              onChange={(e) => setReportPeriod(e.target.value as any)}
              className="input-field w-40"
            >
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="all">All Time</option>
            </select>
            <button 
              onClick={exportReport}
              className="btn-secondary flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Freelancer</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Total</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Published</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Reviewed</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">In Progress</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Needs Fixes</th>
                <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Earnings</th>
              </tr>
            </thead>
            <tbody>
              {freelancerReports.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-500">
                    No freelancer data for this period
                  </td>
                </tr>
              ) : (
                freelancerReports.map((report) => (
                  <tr key={report.freelancer_id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">{report.username}</p>
                        <p className="text-sm text-gray-500">{report.email}</p>
                      </div>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-primary-100 text-primary-700 font-bold">
                        {report.total_templates}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-700">
                        {report.published}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-emerald-100 text-emerald-700">
                        {report.reviewed}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-700">
                        {report.in_progress}
                      </span>
                    </td>
                    <td className="text-center py-3 px-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                        report.needs_fixes > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {report.needs_fixes}
                      </span>
                    </td>
                    <td className="text-right py-3 px-4">
                      <span className="font-semibold text-gray-900">
                        ${Number(report.completed_earnings || 0).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Format Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Format Sync</h2>
                  <p className="text-sm text-gray-500">Normalize time and cost formats across all templates</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncPreview(null);
                  setSyncResult(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[50vh]">
              {syncResult && (
                <div className={`mb-4 p-4 rounded-xl ${syncResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <div className="flex items-center gap-2">
                    {syncResult.success ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                    )}
                    <div>
                      <span className="font-medium">{syncResult.message}</span>
                      {syncResult.success && syncResult.publicLibrarySynced !== undefined && syncResult.publicLibrarySynced > 0 && (
                        <p className="text-sm mt-1">📚 {syncResult.publicLibrarySynced} templates also synced to Public Library</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {syncPreview && (
                <>
                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{syncPreview.stats.total}</p>
                      <p className="text-sm text-gray-500">Total Templates</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-amber-600">{syncPreview.stats.needsUpdate}</p>
                      <p className="text-sm text-amber-700">Need Update</p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{syncPreview.stats.publishedNeedsUpdate}</p>
                      <p className="text-sm text-purple-700">Published (→ Library)</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{syncPreview.stats.alreadyCorrect}</p>
                      <p className="text-sm text-green-700">Already Correct</p>
                    </div>
                  </div>

                  {/* Info about Public Library sync */}
                  {syncPreview.stats.publishedNeedsUpdate > 0 && (
                    <div className="mb-4 p-3 rounded-lg bg-purple-50 border border-purple-200">
                      <p className="text-sm text-purple-800">
                        <strong>{syncPreview.stats.publishedNeedsUpdate}</strong> templates are published to the Public Library and will be automatically synced there too.
                      </p>
                    </div>
                  )}

                  {/* Preview Changes */}
                  {syncPreview.needsUpdate.length > 0 && (
                    <div>
                      <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Changes Preview
                      </h3>
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {syncPreview.needsUpdate.slice(0, 20).map((item) => (
                          <div key={item.id} className={`rounded-lg p-3 text-sm ${item.isPublished ? 'bg-purple-50 border border-purple-200' : 'bg-gray-50'}`}>
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-medium text-gray-900 truncate flex-1">{item.flow_name}</p>
                              {item.isPublished && (
                                <span className="shrink-0 px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                  📚 Published
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              {item.time_save_per_week.normalized && (
                                <div>
                                  <span className="text-gray-500">Time:</span>{' '}
                                  <span className="line-through text-red-500">{item.time_save_per_week.current || '(empty)'}</span>
                                  {' → '}
                                  <span className="text-green-600 font-medium">{item.time_save_per_week.normalized}</span>
                                </div>
                              )}
                              {item.cost_per_year.normalized && (
                                <div>
                                  <span className="text-gray-500">Cost:</span>{' '}
                                  <span className="line-through text-red-500">{item.cost_per_year.current || '(empty)'}</span>
                                  {' → '}
                                  <span className="text-green-600 font-medium">{item.cost_per_year.normalized}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {syncPreview.needsUpdate.length > 20 && (
                          <p className="text-center text-gray-500 text-sm py-2">
                            ... and {syncPreview.needsUpdate.length - 20} more
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {syncPreview.stats.needsUpdate === 0 && (
                    <div className="text-center py-8">
                      <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                      <p className="text-lg font-medium text-gray-900">All formats are correct!</p>
                      <p className="text-gray-500">No templates need updating.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setShowSyncModal(false);
                  setSyncPreview(null);
                  setSyncResult(null);
                }}
                className="btn-secondary"
              >
                Close
              </button>
              {syncPreview && syncPreview.stats.needsUpdate > 0 && (
                <button
                  onClick={executeSyncFormats}
                  disabled={syncLoading}
                  className="btn-primary flex items-center gap-2"
                >
                  {syncLoading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                  Apply Changes ({syncPreview.stats.needsUpdate} templates)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Analytics;

