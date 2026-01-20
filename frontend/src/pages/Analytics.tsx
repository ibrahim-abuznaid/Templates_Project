import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';
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
  Wrench,
  AlertTriangle,
  Eye,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import type { IdeaStatus } from '../types';

interface FreelancerDetails {
  freelancer: {
    id: number;
    username: string;
    email: string;
  };
  period: string;
  periodInfo: {
    type: string;
    startDate: string | null;
    endDate: string | null;
  };
  summary: {
    total: number;
    submitted: number;
    needs_fixes: number;
    reviewed: number;
    published: number;
    total_earnings: number;
    completed_earnings: number;
  };
  templates: Array<{
    id: number;
    flowName: string;
    status: string;
    price: number;
    fixCount: number;
    createdAt: string;
    submittedAt: string;
    updatedAt: string;
  }>;
}

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

const Analytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [freelancerReports, setFreelancerReports] = useState<FreelancerReport[]>([]);
  const [creationData, setCreationData] = useState<CreationData | null>(null);
  const [reportPeriod, setReportPeriod] = useState<'weekly' | 'past_week' | 'monthly' | 'all' | 'custom'>('monthly');
  const [maintenanceIssues, setMaintenanceIssues] = useState(0);
  
  // Custom date range
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Freelancer details modal
  const [selectedFreelancer, setSelectedFreelancer] = useState<FreelancerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    loadData();
  }, [period, reportPeriod, customStartDate, customEndDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [summaryRes, freelancerRes, creationRes, incompleteRes] = await Promise.all([
        analyticsApi.getSummary(),
        analyticsApi.getFreelancerReport(
          reportPeriod, 
          undefined, 
          reportPeriod === 'custom' ? customStartDate : undefined,
          reportPeriod === 'custom' ? customEndDate : undefined
        ),
        analyticsApi.getCreationRate(period),
        analyticsApi.getIncompletePublished(),
      ]);

      setSummary(summaryRes.data);
      setFreelancerReports(freelancerRes.data.reports);
      setCreationData(creationRes.data);
      setMaintenanceIssues(incompleteRes.data.count);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFreelancerDetails = async (freelancerId: number) => {
    setDetailsLoading(true);
    setShowDetailsModal(true);
    try {
      const res = await analyticsApi.getFreelancerDetails(
        freelancerId,
        reportPeriod,
        reportPeriod === 'custom' ? customStartDate : undefined,
        reportPeriod === 'custom' ? customEndDate : undefined
      );
      setSelectedFreelancer(res.data);
    } catch (error) {
      console.error('Failed to load freelancer details:', error);
    } finally {
      setDetailsLoading(false);
    }
  };

  const applyCustomDateRange = () => {
    if (customStartDate && customEndDate) {
      setReportPeriod('custom');
      setShowDatePicker(false);
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
          <h1 className="text-3xl font-bold text-gray-900">Performance Dashboard</h1>
          <p className="text-gray-500 mt-1">Track template progress, team productivity, and creator metrics</p>
        </div>
        <div className="flex items-center gap-3">
          {maintenanceIssues > 0 && (
            <Link
              to="/maintenance"
              className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-lg border border-amber-200 hover:bg-amber-100 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" />
              <span className="font-medium">{maintenanceIssues} issue{maintenanceIssues !== 1 ? 's' : ''}</span>
            </Link>
          )}
          
          <Link
            to="/maintenance"
            className="btn-secondary flex items-center gap-2"
          >
            <Wrench className="w-4 h-4" />
            Maintenance
          </Link>
          
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
              onChange={(e) => {
                const val = e.target.value as any;
                if (val === 'custom') {
                  setShowDatePicker(true);
                } else {
                  setReportPeriod(val);
                  setShowDatePicker(false);
                }
              }}
              className="input-field w-44"
            >
              <option value="weekly">This Week</option>
              <option value="past_week">Past Week</option>
              <option value="monthly">Monthly</option>
              <option value="all">All Time</option>
              <option value="custom">Custom Range</option>
            </select>
            
            {/* Custom date range picker */}
            {(showDatePicker || reportPeriod === 'custom') && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="input-field w-36 text-sm"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="input-field w-36 text-sm"
                />
                {showDatePicker && (
                  <button
                    onClick={applyCustomDateRange}
                    disabled={!customStartDate || !customEndDate}
                    className="btn-primary text-sm px-3 py-2"
                  >
                    Apply
                  </button>
                )}
              </div>
            )}
            
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
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {freelancerReports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
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
                    <td className="text-center py-3 px-4">
                      <button
                        onClick={() => loadFreelancerDetails(report.freelancer_id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Freelancer Details Modal */}
      {showDetailsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedFreelancer?.freelancer.username}'s Templates
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  {reportPeriod === 'custom' 
                    ? `${customStartDate} to ${customEndDate}`
                    : reportPeriod === 'weekly' 
                      ? 'This Week (Thu 2PM - Thu 2PM Jordan Time)'
                      : reportPeriod === 'past_week'
                        ? 'Past Week'
                        : reportPeriod === 'monthly'
                          ? 'Last 30 Days'
                          : 'All Time'
                  }
                </p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedFreelancer(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6">
              {detailsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader className="w-8 h-8 animate-spin text-primary-600" />
                </div>
              ) : selectedFreelancer ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-primary-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-primary-700">{selectedFreelancer.summary.total}</p>
                      <p className="text-sm text-primary-600">Total Submitted</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-green-700">{selectedFreelancer.summary.published}</p>
                      <p className="text-sm text-green-600">Published</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-emerald-700">{selectedFreelancer.summary.reviewed}</p>
                      <p className="text-sm text-emerald-600">Reviewed</p>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-amber-700">${selectedFreelancer.summary.completed_earnings.toFixed(2)}</p>
                      <p className="text-sm text-amber-600">Earnings</p>
                    </div>
                  </div>

                  {/* Templates Table */}
                  {selectedFreelancer.templates.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                      No templates submitted in this period
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Template</th>
                            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Status</th>
                            <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Fixes</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Price</th>
                            <th className="text-right py-3 px-4 text-sm font-semibold text-gray-600">Submitted</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedFreelancer.templates.map((template) => (
                            <tr key={template.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 px-4">
                                <Link 
                                  to={`/ideas/${template.id}`}
                                  className="font-medium text-primary-600 hover:text-primary-700 hover:underline"
                                  onClick={() => setShowDetailsModal(false)}
                                >
                                  {template.flowName || `Template #${template.id}`}
                                </Link>
                              </td>
                              <td className="text-center py-3 px-4">
                                <StatusBadge status={template.status as IdeaStatus} />
                              </td>
                              <td className="text-center py-3 px-4">
                                {template.fixCount > 0 ? (
                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                    {template.fixCount}x
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </td>
                              <td className="text-right py-3 px-4 font-medium">
                                ${template.price.toFixed(2)}
                              </td>
                              <td className="text-right py-3 px-4 text-sm text-gray-500">
                                {new Date(template.submittedAt).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default Analytics;

