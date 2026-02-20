import React, { useEffect, useState } from 'react';
import { analyticsApi } from '../services/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  ComposedChart,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Loader,
  BarChart3,
  PieChart as PieChartIcon,
  Download,
  Eye,
  Activity,
  Globe,
  ArrowUpRight,
  RefreshCw,
  Puzzle,
  Zap,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Flame,
  Award,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  XCircle,
  Lightbulb,
  Target,
  Star,
  Wrench,
  ShieldAlert,
  ChevronDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const COLORS = ['#6D28D9', '#22c55e', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316'];

interface TemplateAnalyticsOverview {
  overview: {
    totalViews: number;
    totalInstalls: number;
    totalActiveFlows: number;
    uniqueUsersInstalled: number;
    conversionRate: number;
    publishedTemplates: number;
    trackedTemplates: number;
  };
  explore: {
    totalClicks: number;
    uniqueUsers: number;
  };
  topByInstalls: Array<{
    ideaId: number;
    flowName: string;
    publicLibraryId: string;
    totalViews: number;
    totalInstalls: number;
  }>;
  topByViews: Array<{
    ideaId: number;
    flowName: string;
    publicLibraryId: string;
    totalViews: number;
    totalInstalls: number;
  }>;
}

interface CategoryAnalytics {
  departmentId: number;
  category: string;
  availableTemplates: number;
  totalViews: number;
  totalInstalls: number;
  installedAtLeastOnce: number;
  activeFlows: number;
  avgInstallsPerTemplate: number;
  conversionRate: number;
}

interface TemplateWithAnalytics {
  ideaId: number;
  flowName: string;
  publicLibraryId: string;
  category: string;
  totalViews: number;
  totalInstalls: number;
  activeFlows: number;
  uniqueUsers: number;
  conversionRate: number;
  isComplete: boolean;
  performanceScore: number;
  installedByUserIds: string[];
}

interface HealthData {
  lowPerformers: Array<{ ideaId: number; flowName: string; publicLibraryId: string; category: string; totalViews: number; totalInstalls: number; conversionRate: number }>;
  zeroTraction: Array<{ ideaId: number; flowName: string; publicLibraryId: string; category: string; totalViews: number; totalInstalls: number; createdAt: string }>;
  highFixCount: Array<{ ideaId: number; flowName: string; publicLibraryId: string; category: string; fixCount: number; totalViews: number; totalInstalls: number }>;
  openBlockers: Array<{ ideaId: number; flowName: string; publicLibraryId: string; category: string; openBlockerCount: number; blockerTypes: string[]; priorities: string[] }>;
  incompleteFields: Array<{ ideaId: number; flowName: string; publicLibraryId: string; category: string; missingCount: number; missingFields: string[] }>;
  counts: { lowPerformers: number; zeroTraction: number; highFixCount: number; openBlockers: number; incompleteFields: number };
}

interface InsightsData {
  topOpportunities: Array<{ ideaId: number; flowName: string; publicLibraryId: string; category: string; totalViews: number; totalInstalls: number; conversionRate: number; avgConversion: number; potentialInstalls: number }>;
  categoryGaps: Array<{ departmentId: number; category: string; templateCount: number; totalInstalls: number; avgInstallsPerTemplate: number }>;
  integrationGaps: Array<{ pieceName: string; displayName: string; templateCount: number; totalInstalls: number }>;
  bestPractices: { avgDescriptionLength: number; blogUrlPercent: number; avgIntegrations: number; topCategories: Array<{ name: string; count: number }>; sampleSize: number };
  meta: { avgConversion: number; totalPublished: number };
}

interface IntegrationStats {
  pieceName: string;
  displayName: string;
  templateCount: number;
  totalInstalls: number;
  triggerCount: number;
  actionCount: number;
  templates?: Array<{
    id: number;
    flowName: string;
    installs: number;
  }>;
}

interface IntegrationAnalytics {
  summary: {
    totalPieces: number;
    totalTemplatesWithPieces: number;
    totalTemplates: number;
  };
  topByTemplateCount: IntegrationStats[];
  topByInstalls: IntegrationStats[];
  allPieces: IntegrationStats[];
}

interface TimelineDataPoint {
  month: string;
  label: string;
  newTemplates: number;
  installs: number;
  views: number;
  cumulativeInstalls: number;
  cumulativeViews: number;
  cumulativeTemplates: number;
}

interface TimelineAnalytics {
  period: string;
  timeline: TimelineDataPoint[];
  summary: {
    totalMonths: number;
    totalInstalls: number;
    totalViews: number;
    peakInstallMonth: { label: string; count: number } | null;
    peakViewMonth: { label: string; count: number } | null;
    momInstallGrowth: number | null;
  };
}

type TimelinePeriod = '3m' | '6m' | '12m' | '24m' | 'all';
type TimelineMetric = 'installs' | 'views' | 'both';
type TimelineMode = 'cumulative' | 'monthly';

const TemplateAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<TemplateAnalyticsOverview | null>(null);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics[]>([]);
  const [allTemplates, setAllTemplates] = useState<TemplateWithAnalytics[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'installs' | 'views' | 'activeFlows' | 'conversion' | 'score'>('installs');
  const [integrationAnalytics, setIntegrationAnalytics] = useState<IntegrationAnalytics | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Timeline state
  const [timelineData, setTimelineData] = useState<TimelineAnalytics | null>(null);
  const [timelinePeriod, setTimelinePeriod] = useState<TimelinePeriod>('12m');
  const [timelineMetric, setTimelineMetric] = useState<TimelineMetric>('both');
  const [timelineMode, setTimelineMode] = useState<TimelineMode>('monthly');
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Health & Insights state
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [healthTab, setHealthTab] = useState<'lowPerformers' | 'zeroTraction' | 'highFixCount' | 'openBlockers' | 'incompleteFields'>('lowPerformers');
  const [healthLoading, setHealthLoading] = useState(false);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadTimeline();
  }, [timelinePeriod]);

  const loadTimeline = async () => {
    setTimelineLoading(true);
    try {
      const res = await analyticsApi.getTimelineAnalytics(timelinePeriod);
      setTimelineData(res.data);
    } catch (error) {
      console.error('Failed to load timeline analytics:', error);
    } finally {
      setTimelineLoading(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [overviewRes, categoryRes, templatesRes, integrationsRes] = await Promise.all([
        analyticsApi.getTemplatesAnalyticsOverview(),
        analyticsApi.getCategoryAnalytics(),
        analyticsApi.getPublishedTemplatesAnalytics(),
        analyticsApi.getIntegrationAnalytics(),
      ]);
      setOverview(overviewRes.data);
      setCategoryAnalytics(categoryRes.data.categories || []);
      setAllTemplates(templatesRes.data.templates || []);
      setIntegrationAnalytics(integrationsRes.data);
    } catch (error) {
      console.error('Failed to load template analytics:', error);
    } finally {
      setLoading(false);
    }
    // Load heavy sections in background
    loadHealth();
    loadInsights();
  };

  const loadHealth = async () => {
    setHealthLoading(true);
    try {
      const res = await analyticsApi.getTemplateHealth();
      setHealthData(res.data);
    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setHealthLoading(false);
    }
  };

  const loadInsights = async () => {
    setInsightsLoading(true);
    try {
      const res = await analyticsApi.getTemplateInsights();
      setInsightsData(res.data);
    } catch (error) {
      console.error('Failed to load insights data:', error);
    } finally {
      setInsightsLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    try {
      const [overviewRes, categoryRes, templatesRes, integrationsRes, timelineRes, healthRes, insightsRes] = await Promise.all([
        analyticsApi.getTemplatesAnalyticsOverview(),
        analyticsApi.getCategoryAnalytics(),
        analyticsApi.getPublishedTemplatesAnalytics(),
        analyticsApi.getIntegrationAnalytics(),
        analyticsApi.getTimelineAnalytics(timelinePeriod),
        analyticsApi.getTemplateHealth(),
        analyticsApi.getTemplateInsights(),
      ]);
      setOverview(overviewRes.data);
      setCategoryAnalytics(categoryRes.data.categories || []);
      setAllTemplates(templatesRes.data.templates || []);
      setIntegrationAnalytics(integrationsRes.data);
      setTimelineData(timelineRes.data);
      setHealthData(healthRes.data);
      setInsightsData(insightsRes.data);
    } catch (error) {
      console.error('Failed to refresh template analytics:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const filteredTemplates = allTemplates
    .filter(t => selectedCategory === 'all' || t.category === selectedCategory)
    .sort((a, b) => {
      switch (sortBy) {
        case 'installs': return b.totalInstalls - a.totalInstalls;
        case 'views': return b.totalViews - a.totalViews;
        case 'activeFlows': return b.activeFlows - a.activeFlows;
        case 'conversion': return b.conversionRate - a.conversionRate;
        case 'score': return (b.performanceScore ?? 0) - (a.performanceScore ?? 0);
        default: return 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredTemplates.length / itemsPerPage);
  const paginatedTemplates = filteredTemplates.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, sortBy]);

  const categories = [...new Set(allTemplates.map(t => t.category))].filter(Boolean);

  // Data for pie chart
  const categoryPieData = categoryAnalytics
    .filter(c => c.totalInstalls > 0)
    .map(c => ({
      name: c.category,
      value: c.totalInstalls,
    }));

  // Peak month for reference line
  const peakMonth = timelineData?.timeline.reduce(
    (best, r) => (!best || r.installs > best.installs ? r : best),
    null as TimelineDataPoint | null
  );

  const periodLabels: Record<TimelinePeriod, string> = {
    '3m': '3 Months',
    '6m': '6 Months',
    '12m': '12 Months',
    '24m': '24 Months',
    'all': 'All Time',
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-sm min-w-[160px]">
        <p className="font-semibold text-gray-800 mb-2 border-b pb-1">{label}</p>
        {payload.map((entry: any) => (
          <div key={entry.dataKey} className="flex items-center justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5 text-gray-600">
              <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: entry.color }} />
              {entry.name}
            </span>
            <span className="font-semibold text-gray-900">{entry.value?.toLocaleString()}</span>
          </div>
        ))}
      </div>
    );
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
          <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
          <p className="text-gray-500 mt-1">Track views, installs, and usage of your published templates</p>
        </div>
        <button
          onClick={refreshData}
          disabled={refreshing}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Overview Cards */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-blue-600 mb-1">
              <Eye className="w-4 h-4" />
              <span className="text-xs font-medium">Total Views</span>
            </div>
            <div className="text-2xl font-bold text-blue-800">
              {overview.overview.totalViews.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-green-600 mb-1">
              <Download className="w-4 h-4" />
              <span className="text-xs font-medium">Total Installs</span>
            </div>
            <div className="text-2xl font-bold text-green-800">
              {overview.overview.totalInstalls.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-purple-600 mb-1">
              <Activity className="w-4 h-4" />
              <span className="text-xs font-medium">Active Flows</span>
            </div>
            <div className="text-2xl font-bold text-purple-800">
              {overview.overview.totalActiveFlows.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-amber-600 mb-1">
              <Users className="w-4 h-4" />
              <span className="text-xs font-medium">Unique Users</span>
            </div>
            <div className="text-2xl font-bold text-amber-800">
              {overview.overview.uniqueUsersInstalled.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-emerald-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-medium">Conversion</span>
            </div>
            <div className="text-2xl font-bold text-emerald-800">
              {overview.overview.conversionRate.toFixed(1)}%
            </div>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-indigo-600 mb-1">
              <Globe className="w-4 h-4" />
              <span className="text-xs font-medium">Discover Clicks</span>
            </div>
            <div className="text-2xl font-bold text-indigo-800">
              {overview.explore.totalClicks.toLocaleString()}
            </div>
          </div>
          <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 text-pink-600 mb-1">
              <FileText className="w-4 h-4" />
              <span className="text-xs font-medium">Published</span>
            </div>
            <div className="text-2xl font-bold text-pink-800">
              {overview.overview.publishedTemplates}
            </div>
          </div>
        </div>
      )}

      {/* ── Engagement Quality Row ── */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(() => {
            const installToActive = overview.overview.totalInstalls > 0
              ? ((overview.overview.totalActiveFlows / overview.overview.totalInstalls) * 100).toFixed(1)
              : '0';
            const avgPerUser = overview.overview.uniqueUsersInstalled > 0
              ? (overview.overview.totalInstalls / overview.overview.uniqueUsersInstalled).toFixed(1)
              : '0';
            const coverage = overview.overview.publishedTemplates > 0
              ? ((overview.overview.trackedTemplates / overview.overview.publishedTemplates) * 100).toFixed(0)
              : '0';
            const exploreToInstall = overview.explore.totalClicks > 0
              ? ((overview.overview.totalInstalls / overview.explore.totalClicks) * 100).toFixed(2)
              : '0';
            return (
              <>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                    <Activity className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Install → Active</div>
                    <div className="text-xl font-bold text-gray-900">{installToActive}%</div>
                    <div className="text-xs text-gray-400">of installs stay active</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                    <Users className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Avg / User</div>
                    <div className="text-xl font-bold text-gray-900">{avgPerUser}</div>
                    <div className="text-xs text-gray-400">installs per unique user</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                    <BarChart3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Tracking Coverage</div>
                    <div className="text-xl font-bold text-gray-900">{coverage}%</div>
                    <div className="text-xs text-gray-400">{overview.overview.trackedTemplates} of {overview.overview.publishedTemplates} templates</div>
                  </div>
                </div>
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                    <Globe className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Explore → Install</div>
                    <div className="text-xl font-bold text-gray-900">{exploreToInstall}%</div>
                    <div className="text-xs text-gray-400">from discover page</div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Conversion Funnel ── */}
      {overview && (
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Conversion Funnel</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">user journey</span>
          </div>
          {(() => {
            const stages = [
              { label: 'Explore Page Views', value: overview.explore.totalClicks, color: 'bg-indigo-500', textColor: 'text-indigo-700', bg: 'bg-indigo-50' },
              { label: 'Template Detail Views', value: overview.overview.totalViews, color: 'bg-blue-500', textColor: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Installs', value: overview.overview.totalInstalls, color: 'bg-green-500', textColor: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Active Flows', value: overview.overview.totalActiveFlows, color: 'bg-purple-500', textColor: 'text-purple-700', bg: 'bg-purple-50' },
            ];
            const maxVal = Math.max(...stages.map(s => s.value), 1);
            return (
              <div className="space-y-3">
                {stages.map((stage, i) => {
                  const pct = ((stage.value / maxVal) * 100).toFixed(0);
                  const dropOff = i > 0 && stages[i - 1].value > 0
                    ? ((1 - stage.value / stages[i - 1].value) * 100).toFixed(1)
                    : null;
                  const convRate = i > 0 && stages[i - 1].value > 0
                    ? ((stage.value / stages[i - 1].value) * 100).toFixed(1)
                    : null;
                  const rateNum = convRate ? parseFloat(convRate) : 100;
                  const rateColor = rateNum >= 10 ? 'text-green-600' : rateNum >= 5 ? 'text-amber-600' : 'text-red-500';
                  return (
                    <div key={stage.label}>
                      {i > 0 && dropOff !== null && (
                        <div className="flex items-center gap-2 my-1 pl-4">
                          <ChevronDown className="w-3 h-3 text-gray-300" />
                          <span className={`text-xs font-semibold ${rateColor}`}>{convRate}% passed through</span>
                          <span className="text-xs text-gray-400">({dropOff}% dropped off)</span>
                        </div>
                      )}
                      <div className={`rounded-xl px-5 py-3 flex items-center justify-between gap-4 ${stage.bg}`}
                           style={{ width: `${Math.max(parseFloat(pct), 30)}%`, minWidth: '240px', maxWidth: '100%' }}>
                        <span className={`text-sm font-semibold ${stage.textColor}`}>{stage.label}</span>
                        <span className={`text-lg font-bold ${stage.textColor}`}>{stage.value.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ── Template Health Dashboard ── */}
      <div className="card">
        <div className="flex items-center gap-2 mb-5">
          <ShieldAlert className="w-5 h-5 text-rose-600" />
          <h2 className="text-lg font-semibold text-gray-900">Template Health</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">issues to fix now</span>
          {healthData && (
            <span className="ml-auto text-xs text-gray-400">
              {Object.values(healthData.counts).reduce((a, b) => a + b, 0)} issues across {Object.values(healthData.counts).filter(c => c > 0).length} categories
            </span>
          )}
        </div>

        {healthLoading ? (
          <div className="h-48 flex items-center justify-center">
            <Loader className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        ) : !healthData ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Could not load health data</div>
        ) : (
          <>
            {/* Tab bar */}
            <div className="flex flex-wrap gap-2 mb-5">
              {[
                { key: 'lowPerformers' as const, label: 'Low Conversion', count: healthData.counts.lowPerformers, icon: TrendingDown, color: 'red' },
                { key: 'zeroTraction' as const, label: 'Zero Traction', count: healthData.counts.zeroTraction, icon: XCircle, color: 'orange' },
                { key: 'highFixCount' as const, label: 'High Fix Count', count: healthData.counts.highFixCount, icon: Wrench, color: 'amber' },
                { key: 'openBlockers' as const, label: 'Open Blockers', count: healthData.counts.openBlockers, icon: AlertTriangle, color: 'yellow' },
                { key: 'incompleteFields' as const, label: 'Incomplete', count: healthData.counts.incompleteFields, icon: AlertCircle, color: 'blue' },
              ].map(({ key, label, count, icon: Icon, color }) => {
                const isActive = healthTab === key;
                const colorMap: Record<string, string> = {
                  red: isActive ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
                  orange: isActive ? 'bg-orange-600 text-white border-orange-600' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
                  amber: isActive ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
                  yellow: isActive ? 'bg-yellow-600 text-white border-yellow-600' : 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100',
                  blue: isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
                };
                return (
                  <button key={key} onClick={() => setHealthTab(key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${colorMap[color]}`}>
                    <Icon className="w-3.5 h-3.5" />
                    {label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${isActive ? 'bg-white/20' : 'bg-white border border-current/20'}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* Tab content */}
            <div className="overflow-x-auto">
              {healthTab === 'lowPerformers' && (
                healthData.lowPerformers.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">No low-conversion templates found.</p>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Template</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Category</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium text-right">Views</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium text-right">Installs</th>
                      <th className="pb-2 text-xs text-gray-400 font-medium text-right">Conversion</th>
                    </tr></thead>
                    <tbody>{healthData.lowPerformers.map(t => (
                      <tr key={t.ideaId} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3"><Link to={`/ideas/${t.ideaId}`} className="font-medium text-gray-800 hover:text-primary-600 flex items-center gap-1">{t.flowName}<ArrowUpRight className="w-3 h-3 text-gray-400" /></Link></td>
                        <td className="py-2 pr-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span></td>
                        <td className="py-2 pr-3 text-right text-blue-600 font-medium">{t.totalViews.toLocaleString()}</td>
                        <td className="py-2 pr-3 text-right text-green-600 font-medium">{t.totalInstalls.toLocaleString()}</td>
                        <td className="py-2 text-right"><span className="text-red-600 font-semibold">{t.conversionRate.toFixed(1)}%</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
              )}
              {healthTab === 'zeroTraction' && (
                healthData.zeroTraction.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">All published templates have some activity.</p>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Template</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Category</th>
                      <th className="pb-2 text-xs text-gray-400 font-medium">Status</th>
                    </tr></thead>
                    <tbody>{healthData.zeroTraction.map(t => (
                      <tr key={t.ideaId} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3"><Link to={`/ideas/${t.ideaId}`} className="font-medium text-gray-800 hover:text-primary-600 flex items-center gap-1">{t.flowName}<ArrowUpRight className="w-3 h-3 text-gray-400" /></Link></td>
                        <td className="py-2 pr-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span></td>
                        <td className="py-2"><span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium">0 views · 0 installs</span></td>
                      </tr>
                    ))}</tbody>
                  </table>
              )}
              {healthTab === 'highFixCount' && (
                healthData.highFixCount.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">No templates with high fix counts.</p>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Template</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Category</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium text-center">Fix Count</th>
                      <th className="pb-2 text-xs text-gray-400 font-medium text-right">Installs</th>
                    </tr></thead>
                    <tbody>{healthData.highFixCount.map(t => (
                      <tr key={t.ideaId} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3"><Link to={`/ideas/${t.ideaId}`} className="font-medium text-gray-800 hover:text-primary-600 flex items-center gap-1">{t.flowName}<ArrowUpRight className="w-3 h-3 text-gray-400" /></Link></td>
                        <td className="py-2 pr-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span></td>
                        <td className="py-2 pr-3 text-center"><span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-bold">{t.fixCount}x fixes</span></td>
                        <td className="py-2 text-right text-green-600 font-medium">{t.totalInstalls.toLocaleString()}</td>
                      </tr>
                    ))}</tbody>
                  </table>
              )}
              {healthTab === 'openBlockers' && (
                healthData.openBlockers.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">No open blockers on published templates.</p>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Template</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Category</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium text-center">Open Blockers</th>
                      <th className="pb-2 text-xs text-gray-400 font-medium">Types</th>
                    </tr></thead>
                    <tbody>{healthData.openBlockers.map(t => (
                      <tr key={t.ideaId} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3"><Link to={`/ideas/${t.ideaId}`} className="font-medium text-gray-800 hover:text-primary-600 flex items-center gap-1">{t.flowName}<ArrowUpRight className="w-3 h-3 text-gray-400" /></Link></td>
                        <td className="py-2 pr-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span></td>
                        <td className="py-2 pr-3 text-center"><span className="text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full text-xs font-bold">{t.openBlockerCount}</span></td>
                        <td className="py-2"><div className="flex flex-wrap gap-1">{t.blockerTypes.slice(0, 3).map(bt => <span key={bt} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{bt.replace('_', ' ')}</span>)}</div></td>
                      </tr>
                    ))}</tbody>
                  </table>
              )}
              {healthTab === 'incompleteFields' && (
                healthData.incompleteFields.length === 0
                  ? <p className="text-sm text-gray-400 py-6 text-center">All published templates have complete fields.</p>
                  : <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-100 text-left">
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Template</th>
                      <th className="pb-2 pr-3 text-xs text-gray-400 font-medium">Category</th>
                      <th className="pb-2 text-xs text-gray-400 font-medium">Missing Fields</th>
                    </tr></thead>
                    <tbody>{healthData.incompleteFields.map(t => (
                      <tr key={t.ideaId} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="py-2 pr-3"><Link to={`/ideas/${t.ideaId}`} className="font-medium text-gray-800 hover:text-primary-600 flex items-center gap-1">{t.flowName}<ArrowUpRight className="w-3 h-3 text-gray-400" /></Link></td>
                        <td className="py-2 pr-3"><span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{t.category}</span></td>
                        <td className="py-2"><div className="flex flex-wrap gap-1">{t.missingFields.map(f => <span key={f} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">{f}</span>)}</div></td>
                      </tr>
                    ))}</tbody>
                  </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Actionable Insights ── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h2 className="text-xl font-bold text-gray-900">Actionable Insights</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full ml-1">what to work on next</span>
        </div>

        {insightsLoading ? (
          <div className="h-48 flex items-center justify-center card">
            <Loader className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        ) : !insightsData ? (
          <div className="h-48 flex items-center justify-center card text-gray-400 text-sm">Could not load insights</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Opportunities */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-rose-600" />
                <h3 className="font-semibold text-gray-900">High-View, Low-Conversion Templates</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">These templates get views but don't convert. Improving descriptions or fixing flows here will have the biggest install impact.</p>
              {insightsData.topOpportunities.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm py-4"><CheckCircle className="w-4 h-4" /> All high-view templates are performing well!</div>
              ) : (
                <div className="space-y-2">
                  {insightsData.topOpportunities.slice(0, 6).map((t, i) => (
                    <div key={t.ideaId} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg border border-rose-100 hover:bg-rose-100 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-full bg-rose-200 text-rose-800 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span>
                        <div className="min-w-0">
                          <Link to={`/ideas/${t.ideaId}`} className="text-sm font-medium text-gray-800 hover:text-primary-600 truncate block">{t.flowName}</Link>
                          <span className="text-xs text-gray-500">{t.totalViews.toLocaleString()} views · {t.conversionRate.toFixed(1)}% CR vs {t.avgConversion.toFixed(1)}% avg</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-3">
                        <div className="text-xs font-semibold text-rose-700">+{t.potentialInstalls} potential</div>
                        <div className="text-xs text-gray-400">installs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Best Practices */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Star className="w-4 h-4 text-amber-500" />
                <h3 className="font-semibold text-gray-900">What Top Templates Have in Common</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Analysis of your top {insightsData.bestPractices.sampleSize} best-performing templates by install count.</p>
              {insightsData.bestPractices.sampleSize === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Not enough data yet.</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm text-gray-700">Avg. description length</span>
                    <span className="font-bold text-amber-800">{insightsData.bestPractices.avgDescriptionLength} chars</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm text-gray-700">Have a blog/article URL</span>
                    <span className="font-bold text-amber-800">{insightsData.bestPractices.blogUrlPercent}%</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                    <span className="text-sm text-gray-700">Avg. integrations used</span>
                    <span className="font-bold text-amber-800">{insightsData.bestPractices.avgIntegrations}</span>
                  </div>
                  {insightsData.bestPractices.topCategories.length > 0 && (
                    <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg">
                      <span className="text-sm text-gray-700">Top performing categories</span>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {insightsData.bestPractices.topCategories.map(c => (
                          <span key={c.name} className="text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-medium">{c.name}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Category Gaps */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-gray-900">Category Demand vs Supply</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Categories with high avg. installs per template = high demand. Build more templates there.</p>
              <div className="space-y-2">
                {insightsData.categoryGaps.slice(0, 8).map(cat => {
                  const maxAvg = insightsData.categoryGaps[0]?.avgInstallsPerTemplate || 1;
                  const barPct = maxAvg > 0 ? (cat.avgInstallsPerTemplate / maxAvg) * 100 : 0;
                  return (
                    <div key={cat.departmentId} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-gray-700 truncate max-w-[160px]">{cat.category}</span>
                        <span className="text-gray-500 flex-shrink-0 ml-2">{cat.templateCount} templates · {cat.avgInstallsPerTemplate.toFixed(1)} avg installs</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${barPct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Integration Gaps */}
            <div className="card">
              <div className="flex items-center gap-2 mb-4">
                <Puzzle className="w-4 h-4 text-violet-600" />
                <h3 className="font-semibold text-gray-900">High-Demand Integrations (Underused)</h3>
              </div>
              <p className="text-xs text-gray-500 mb-4">Integrations that drive many installs but appear in fewer templates than average. Build more templates with these.</p>
              {insightsData.integrationGaps.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm py-4"><CheckCircle className="w-4 h-4" /> Good coverage across all high-install integrations.</div>
              ) : (
                <div className="space-y-2">
                  {insightsData.integrationGaps.map((piece) => (
                    <div key={piece.pieceName} className="flex items-center justify-between p-3 bg-violet-50 rounded-lg border border-violet-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                          {piece.displayName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-gray-800">{piece.displayName}</span>
                          <div className="text-xs text-gray-500">{piece.templateCount} template{piece.templateCount !== 1 ? 's' : ''}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold text-violet-700">{piece.totalInstalls.toLocaleString()}</div>
                        <div className="text-xs text-gray-400">installs</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top by Installs */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <Download className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-semibold text-gray-900">Top Templates by Installs</h2>
          </div>
          {overview && overview.topByInstalls.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={overview.topByInstalls.slice(0, 10)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 12 }} />
                <YAxis
                  dataKey="flowName"
                  type="category"
                  width={150}
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  tickFormatter={(value) => value.length > 20 ? value.substring(0, 20) + '...' : value}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="totalInstalls" fill="#22c55e" name="Installs" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-gray-500">
              No install data yet
            </div>
          )}
        </div>

        {/* Installs by Category Pie */}
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <PieChartIcon className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Installs by Category</h2>
          </div>
          {categoryPieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                  labelLine={false}
                >
                  {categoryPieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
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
              No category data yet
            </div>
          )}
        </div>
      </div>

      {/* Category Analytics Table */}
      {categoryAnalytics.length > 0 && (
        <div className="card">
          <div className="flex items-center gap-2 mb-6">
            <BarChart3 className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Analytics by Category</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Templates</th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 w-32">Views vs Installs</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Views</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Installs</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Active Flows</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Avg Installs</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Conversion</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Health</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Growth Potential</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const avgCR = categoryAnalytics.filter(c => c.conversionRate > 0).reduce((s, c) => s + c.conversionRate, 0) / Math.max(categoryAnalytics.filter(c => c.conversionRate > 0).length, 1);
                  const maxViews = Math.max(...categoryAnalytics.map(c => c.totalViews), 1);
                  const maxInstalls = Math.max(...categoryAnalytics.map(c => c.totalInstalls), 1);
                  const maxAvgInstalls = Math.max(...categoryAnalytics.map(c => c.avgInstallsPerTemplate), 1);
                  return categoryAnalytics.map((cat) => (
                    <tr key={cat.departmentId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-800">{cat.category}</span>
                      </td>
                      <td className="text-center py-3 px-4 text-sm text-gray-600">
                        {cat.availableTemplates}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 w-28">
                          <div className="flex items-center gap-1">
                            <div className="h-2 rounded-full bg-blue-400" style={{ width: `${(cat.totalViews / maxViews) * 100}%`, minWidth: cat.totalViews > 0 ? '4px' : '0' }} />
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="h-2 rounded-full bg-green-500" style={{ width: `${(cat.totalInstalls / maxInstalls) * 100}%`, minWidth: cat.totalInstalls > 0 ? '4px' : '0' }} />
                          </div>
                        </div>
                      </td>
                      <td className="text-center py-3 px-4 text-sm text-blue-600 font-medium">
                        {cat.totalViews.toLocaleString()}
                      </td>
                      <td className="text-center py-3 px-4 text-sm text-green-600 font-medium">
                        {cat.totalInstalls.toLocaleString()}
                      </td>
                      <td className="text-center py-3 px-4 text-sm text-purple-600 font-medium">
                        {cat.activeFlows.toLocaleString()}
                      </td>
                      <td className="text-center py-3 px-4 text-sm text-gray-600">
                        {cat.avgInstallsPerTemplate.toFixed(1)}
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`text-sm font-medium ${
                          cat.conversionRate >= 10 ? 'text-green-600' :
                          cat.conversionRate >= 5 ? 'text-amber-600' :
                          'text-gray-500'
                        }`}>
                          {cat.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        {cat.totalInstalls === 0
                          ? <span title="No installs"><XCircle className="w-4 h-4 text-red-400 mx-auto" /></span>
                          : cat.conversionRate >= avgCR
                          ? <span title="Above average conversion"><CheckCircle className="w-4 h-4 text-green-500 mx-auto" /></span>
                          : <span title="Below average conversion"><AlertCircle className="w-4 h-4 text-amber-400 mx-auto" /></span>}
                      </td>
                      <td className="text-center py-3 px-4">
                        <div className="flex items-center justify-center gap-1">
                          <div className="h-1.5 w-12 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(cat.avgInstallsPerTemplate / maxAvgInstalls) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-500">{((cat.avgInstallsPerTemplate / maxAvgInstalls) * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  ));
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Templates Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">All Published Templates</h2>
            <span className="text-sm text-gray-500">({filteredTemplates.length})</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field w-40"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="input-field w-40"
            >
              <option value="installs">Sort by Installs</option>
              <option value="views">Sort by Views</option>
              <option value="activeFlows">Sort by Active Flows</option>
              <option value="conversion">Sort by Conversion</option>
              <option value="score">Sort by Score</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Template</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600">Category</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Views</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Installs</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Active</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Users</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">CR</th>
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Score</th>
              </tr>
            </thead>
            <tbody>
              {paginatedTemplates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No templates with analytics data
                  </td>
                </tr>
              ) : (
                paginatedTemplates.map((template) => (
                    <tr key={template.ideaId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <Link
                          to={`/ideas/${template.ideaId}`}
                          className="font-medium text-gray-800 hover:text-primary-600 flex items-center gap-2"
                        >
                          {template.flowName}
                          <ArrowUpRight className="w-3 h-3 text-gray-400" />
                        </Link>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{template.publicLibraryId}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                          {template.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-sm text-blue-600 font-medium">{template.totalViews.toLocaleString()}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-sm text-green-600 font-medium">{template.totalInstalls.toLocaleString()}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-sm text-purple-600 font-medium">{template.activeFlows.toLocaleString()}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className="text-sm text-amber-600 font-medium">{template.uniqueUsers}</span>
                      </td>
                      <td className="text-center py-3 px-4">
                        <span className={`text-sm font-medium ${
                          template.conversionRate >= 10 ? 'text-green-600' :
                          template.conversionRate >= 5 ? 'text-amber-600' :
                          'text-gray-500'
                        }`}>
                          {template.conversionRate.toFixed(1)}%
                        </span>
                      </td>
                      <td className="text-center py-3 px-4">
                        {template.performanceScore !== undefined ? (
                          <span className={`inline-flex items-center justify-center w-9 h-6 rounded-full text-xs font-bold ${
                            template.performanceScore >= 70 ? 'bg-green-100 text-green-700' :
                            template.performanceScore >= 40 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700'
                          }`}>
                            {template.performanceScore}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredTemplates.length)} of {filteredTemplates.length} templates
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-gray-100 text-gray-600'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Time-Based Analysis ── */}
      <div className="card">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Time-Based Analysis</h2>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              by publish date
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Mode toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              {(['monthly', 'cumulative'] as TimelineMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => setTimelineMode(m)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    timelineMode === m
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m === 'monthly' ? 'Monthly' : 'Cumulative'}
                </button>
              ))}
            </div>

            {/* Metric toggle */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              {(['installs', 'views', 'both'] as TimelineMetric[]).map(m => (
                <button
                  key={m}
                  onClick={() => setTimelineMetric(m)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                    timelineMetric === m
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {/* Period selector */}
            <div className="flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              {(['3m', '6m', '12m', '24m', 'all'] as TimelinePeriod[]).map(p => (
                <button
                  key={p}
                  onClick={() => setTimelinePeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    timelinePeriod === p
                      ? 'bg-primary-600 text-white shadow'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p === 'all' ? 'All' : p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        {timelineData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-violet-600 mb-1">
                <Calendar className="w-4 h-4" />
                <span className="text-xs font-medium">Period</span>
              </div>
              <div className="text-xl font-bold text-violet-800">
                {periodLabels[timelinePeriod]}
              </div>
              <div className="text-xs text-violet-600 mt-0.5">
                {timelineData.summary.totalMonths} month{timelineData.summary.totalMonths !== 1 ? 's' : ''} of data
              </div>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-green-600 mb-1">
                <Flame className="w-4 h-4" />
                <span className="text-xs font-medium">Peak Install Month</span>
              </div>
              <div className="text-xl font-bold text-green-800 truncate">
                {timelineData.summary.peakInstallMonth?.label ?? '—'}
              </div>
              <div className="text-xs text-green-600 mt-0.5">
                {timelineData.summary.peakInstallMonth
                  ? `${timelineData.summary.peakInstallMonth.count.toLocaleString()} installs`
                  : 'No data'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-600 mb-1">
                <Award className="w-4 h-4" />
                <span className="text-xs font-medium">Peak View Month</span>
              </div>
              <div className="text-xl font-bold text-blue-800 truncate">
                {timelineData.summary.peakViewMonth?.label ?? '—'}
              </div>
              <div className="text-xs text-blue-600 mt-0.5">
                {timelineData.summary.peakViewMonth
                  ? `${timelineData.summary.peakViewMonth.count.toLocaleString()} views`
                  : 'No data'}
              </div>
            </div>

            <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-600 mb-1">
                {timelineData.summary.momInstallGrowth !== null && timelineData.summary.momInstallGrowth >= 0
                  ? <TrendingUp className="w-4 h-4" />
                  : <TrendingDown className="w-4 h-4" />}
                <span className="text-xs font-medium">MoM Growth</span>
              </div>
              <div className={`text-xl font-bold ${
                timelineData.summary.momInstallGrowth === null ? 'text-amber-800' :
                timelineData.summary.momInstallGrowth >= 0 ? 'text-green-700' : 'text-red-600'
              }`}>
                {timelineData.summary.momInstallGrowth === null
                  ? '—'
                  : `${timelineData.summary.momInstallGrowth >= 0 ? '+' : ''}${timelineData.summary.momInstallGrowth}%`}
              </div>
              <div className="text-xs text-amber-600 mt-0.5">vs previous month</div>
            </div>
          </div>
        )}

        {/* Chart */}
        {timelineLoading ? (
          <div className="h-80 flex items-center justify-center">
            <Loader className="w-6 h-6 animate-spin text-primary-400" />
          </div>
        ) : !timelineData || timelineData.timeline.length === 0 ? (
          <div className="h-80 flex flex-col items-center justify-center text-gray-400 gap-2">
            <Calendar className="w-10 h-10 opacity-30" />
            <p className="text-sm">No time-series data available for this period.</p>
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={360}>
              <ComposedChart data={timelineData.timeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="installGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fill: '#c4b5fd', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }}
                  iconType="circle"
                  iconSize={8}
                />

                {/* New templates published as bars (right axis) */}
                <Bar
                  yAxisId="right"
                  dataKey="newTemplates"
                  name="New Templates"
                  fill="#c4b5fd"
                  opacity={0.5}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />

                {/* Peak reference line */}
                {peakMonth && (
                  <ReferenceLine
                    yAxisId="left"
                    x={peakMonth.label}
                    stroke="#f59e0b"
                    strokeDasharray="4 2"
                    label={{ value: 'Peak', position: 'insideTopRight', fontSize: 10, fill: '#f59e0b' }}
                  />
                )}

                {/* Installs area */}
                {(timelineMetric === 'installs' || timelineMetric === 'both') && (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey={timelineMode === 'cumulative' ? 'cumulativeInstalls' : 'installs'}
                    name={timelineMode === 'cumulative' ? 'Cumulative Installs' : 'Installs'}
                    stroke="#22c55e"
                    strokeWidth={2.5}
                    fill="url(#installGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#22c55e' }}
                  />
                )}

                {/* Views area */}
                {(timelineMetric === 'views' || timelineMetric === 'both') && (
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey={timelineMode === 'cumulative' ? 'cumulativeViews' : 'views'}
                    name={timelineMode === 'cumulative' ? 'Cumulative Views' : 'Views'}
                    stroke="#3b82f6"
                    strokeWidth={2.5}
                    fill="url(#viewGrad)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#3b82f6' }}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>

            {/* Monthly breakdown mini table */}
            <div className="mt-6 border-t pt-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Monthly Breakdown</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="pb-2 pr-4 text-xs text-gray-400 font-medium">Month</th>
                      <th className="pb-2 pr-4 text-xs text-gray-400 font-medium text-center">New Templates</th>
                      <th className="pb-2 pr-4 text-xs text-gray-400 font-medium text-right">Installs</th>
                      <th className="pb-2 pr-4 text-xs text-gray-400 font-medium text-right">Views</th>
                      <th className="pb-2 text-xs text-gray-400 font-medium text-right">Install Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...timelineData.timeline].reverse().map((row) => {
                      const isPeak = peakMonth?.month === row.month;
                      const installRate = row.views > 0 ? ((row.installs / row.views) * 100).toFixed(1) : '—';
                      return (
                        <tr
                          key={row.month}
                          className={`border-t border-gray-50 ${isPeak ? 'bg-amber-50' : 'hover:bg-gray-50'}`}
                        >
                          <td className="py-2 pr-4 font-medium text-gray-800 flex items-center gap-1.5">
                            {isPeak && <Flame className="w-3 h-3 text-amber-500 flex-shrink-0" />}
                            {row.label}
                          </td>
                          <td className="py-2 pr-4 text-center">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-violet-50 text-violet-700 font-medium">
                              +{row.newTemplates}
                            </span>
                          </td>
                          <td className="py-2 pr-4 text-right text-green-600 font-medium">
                            {row.installs.toLocaleString()}
                          </td>
                          <td className="py-2 pr-4 text-right text-blue-600 font-medium">
                            {row.views.toLocaleString()}
                          </td>
                          <td className="py-2 text-right text-gray-500">
                            {installRate === '—' ? '—' : `${installRate}%`}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Integration Analytics Section */}
      {integrationAnalytics && integrationAnalytics.topByTemplateCount.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Puzzle className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Most Used Integrations</h2>
              <span className="text-sm text-gray-500">
                ({integrationAnalytics.summary.totalPieces} pieces across {integrationAnalytics.summary.totalTemplatesWithPieces} templates)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top by Template Count */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-purple-600" />
                Most Used in Templates
              </h3>
              <div className="space-y-2">
                {integrationAnalytics.topByTemplateCount.slice(0, 10).map((piece, index) => (
                  <div
                    key={piece.pieceName}
                    className="flex items-center justify-between bg-gradient-to-r from-purple-50 to-white rounded-lg p-3 border border-purple-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                        {piece.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-800">
                          {piece.displayName}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          {piece.triggerCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Zap className="w-3 h-3 text-amber-500" />
                              {piece.triggerCount} trigger{piece.triggerCount !== 1 ? 's' : ''}
                            </span>
                          )}
                          {piece.actionCount > 0 && (
                            <span className="flex items-center gap-1">
                              <Activity className="w-3 h-3 text-purple-500" />
                              {piece.actionCount} action{piece.actionCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-purple-600">
                        {piece.templateCount} template{piece.templateCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Top by Installs */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Download className="w-4 h-4 text-green-600" />
                Most Installed (by template installs)
              </h3>
              <div className="space-y-2">
                {integrationAnalytics.topByInstalls.slice(0, 10).map((piece, index) => (
                  <div
                    key={piece.pieceName}
                    className="flex items-center justify-between bg-gradient-to-r from-green-50 to-white rounded-lg p-3 border border-green-100"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
                        {piece.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-800">
                          {piece.displayName}
                        </span>
                        <div className="text-xs text-gray-500">
                          in {piece.templateCount} template{piece.templateCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold text-green-600">
                        {piece.totalInstalls.toLocaleString()} install{piece.totalInstalls !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateAnalytics;
