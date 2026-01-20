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
} from 'recharts';
import {
  TrendingUp,
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
  installedByUserIds: string[];
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

const TemplateAnalytics: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [overview, setOverview] = useState<TemplateAnalyticsOverview | null>(null);
  const [categoryAnalytics, setCategoryAnalytics] = useState<CategoryAnalytics[]>([]);
  const [allTemplates, setAllTemplates] = useState<TemplateWithAnalytics[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'installs' | 'views' | 'activeFlows' | 'conversion'>('installs');
  const [showUserIds, setShowUserIds] = useState<number | null>(null);
  const [integrationAnalytics, setIntegrationAnalytics] = useState<IntegrationAnalytics | null>(null);

  useEffect(() => {
    loadData();
  }, []);

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
  };

  const refreshData = async () => {
    setRefreshing(true);
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
        default: return 0;
      }
    });

  const categories = [...new Set(allTemplates.map(t => t.category))].filter(Boolean);

  // Data for pie chart
  const categoryPieData = categoryAnalytics
    .filter(c => c.totalInstalls > 0)
    .map(c => ({
      name: c.category,
      value: c.totalInstalls,
    }));

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
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Views</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Installs</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Active Flows</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Avg Installs</th>
                  <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {categoryAnalytics.map((cat) => (
                  <tr key={cat.departmentId} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-medium text-gray-800">{cat.category}</span>
                    </td>
                    <td className="text-center py-3 px-4 text-sm text-gray-600">
                      {cat.availableTemplates}
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
                  </tr>
                ))}
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
                <th className="text-center py-3 px-4 text-sm font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTemplates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    No templates with analytics data
                  </td>
                </tr>
              ) : (
                filteredTemplates.map((template) => (
                  <React.Fragment key={template.ideaId}>
                    <tr className="border-b border-gray-100 hover:bg-gray-50">
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
                        {template.uniqueUsers > 0 && (
                          <button
                            onClick={() => setShowUserIds(showUserIds === template.ideaId ? null : template.ideaId)}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            {showUserIds === template.ideaId ? 'Hide' : 'Show'} Users
                          </button>
                        )}
                      </td>
                    </tr>
                    {showUserIds === template.ideaId && template.installedByUserIds && template.installedByUserIds.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={8} className="py-3 px-4">
                          <div className="text-xs text-gray-600 mb-2 font-medium">
                            User IDs who installed this template:
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {template.installedByUserIds.map((userId, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center px-2 py-1 bg-white text-gray-700 text-xs rounded border border-gray-200 font-mono"
                                title={userId}
                              >
                                {userId.length > 30 ? userId.substring(0, 30) + '...' : userId}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
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
