import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { analyticsApi, ideasApi } from '../services/api';
import {
  Wrench,
  AlertTriangle,
  CheckCircle,
  Loader,
  RefreshCw,
  ExternalLink,
  Clock,
  FileX,
  FolderX,
  Copy,
  Zap,
  ChevronDown,
  ChevronUp,
  Calendar,
  Bell,
  Send,
  User,
  Cloud,
} from 'lucide-react';

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
  assigned_to: number | null;
  assigned_username: string | null;
  assigned_email: string | null;
}

interface StaleTemplate {
  id: number;
  flow_name: string;
  status: string;
  assigned_to: number;
  assigned_username: string;
  updated_at: string;
  days_since_update: number;
}

interface OrphanedTemplate {
  id: number;
  flow_name: string;
  status: string;
  created_at: string;
}

interface DuplicateGroup {
  flow_name: string;
  count: number;
  templates: Array<{
    id: number;
    status: string;
    created_at: string;
  }>;
}

interface SyncPreview {
  stats: { total: number; needsUpdate: number; alreadyCorrect: number; publishedNeedsUpdate: number };
  needsUpdate: Array<{
    id: number;
    flow_name: string;
    time_save_per_week: { current: string; normalized: string | null };
    cost_per_year: { current: string; normalized: string | null };
    isPublished: boolean;
  }>;
}

interface MaintenanceStats {
  incompletePublished: number;
  staleAssigned: number;
  noDepartments: number;
  noFlowJson: number;
  duplicates: number;
  formatIssues: number;
}

const Maintenance: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<MaintenanceStats>({
    incompletePublished: 0,
    staleAssigned: 0,
    noDepartments: 0,
    noFlowJson: 0,
    duplicates: 0,
    formatIssues: 0,
  });

  // Section data
  const [incompleteTemplates, setIncompleteTemplates] = useState<IncompleteTemplate[]>([]);
  const [staleTemplates, setStaleTemplates] = useState<StaleTemplate[]>([]);
  const [orphanedTemplates, setOrphanedTemplates] = useState<OrphanedTemplate[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [noFlowJsonTemplates, setNoFlowJsonTemplates] = useState<OrphanedTemplate[]>([]);

  // Format sync state
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; publicLibrarySynced?: number } | null>(null);

  // Public Library bulk sync state
  const [bulkSyncLoading, setBulkSyncLoading] = useState(false);
  const [bulkSyncResult, setBulkSyncResult] = useState<{
    success: boolean;
    message: string;
    stats?: { total: number; synced: number; skippedValidation: number; errors: number; notInLibrary: number };
  } | null>(null);

  // Expanded sections
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    incomplete: true,
    format: false,
    stale: false,
    orphaned: false,
    noFlow: false,
    duplicates: false,
  });

  // Notification state
  const [sendingReminder, setSendingReminder] = useState<number | null>(null);
  const [reminderSuccess, setReminderSuccess] = useState<Record<number, boolean>>({});
  const [sendingBulk, setSendingBulk] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [incompleteRes, maintenanceRes, formatPreviewRes] = await Promise.all([
        analyticsApi.getIncompletePublished(),
        analyticsApi.getMaintenanceData(),
        ideasApi.previewFormatSync(),
      ]);

      setIncompleteTemplates(incompleteRes.data.templates);
      setStaleTemplates(maintenanceRes.data.stale_assigned);
      setOrphanedTemplates(maintenanceRes.data.no_departments);
      setDuplicateGroups(maintenanceRes.data.duplicates);
      setNoFlowJsonTemplates(maintenanceRes.data.no_flow_json);
      setSyncPreview(formatPreviewRes.data);

      setStats({
        incompletePublished: incompleteRes.data.count,
        staleAssigned: maintenanceRes.data.stale_assigned.length,
        noDepartments: maintenanceRes.data.no_departments.length,
        noFlowJson: maintenanceRes.data.no_flow_json.length,
        duplicates: maintenanceRes.data.duplicates.length,
        formatIssues: formatPreviewRes.data.stats.needsUpdate,
      });
    } catch (error) {
      console.error('Failed to load maintenance data:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const executeSyncFormats = async () => {
    setSyncLoading(true);
    try {
      const response = await ideasApi.syncFormats();
      setSyncResult({
        success: true,
        message: response.data.message,
        publicLibrarySynced: response.data.stats.publicLibrarySynced,
      });
      // Refresh data
      const formatPreviewRes = await ideasApi.previewFormatSync();
      setSyncPreview(formatPreviewRes.data);
      setStats(prev => ({ ...prev, formatIssues: formatPreviewRes.data.stats.needsUpdate }));
    } catch (error) {
      console.error('Failed to sync formats:', error);
      setSyncResult({ success: false, message: 'Failed to sync formats' });
    } finally {
      setSyncLoading(false);
    }
  };

  const executeBulkSyncPublicLibrary = async () => {
    if (!confirm('This will UPDATE all templates that are already in the Public Library.\n\n⚠️ Safety Features:\n• Only updates existing templates (no new creations)\n• Validates all required fields before syncing\n• Rate-limited to avoid API overload\n\nContinue?')) {
      return;
    }
    
    setBulkSyncLoading(true);
    setBulkSyncResult(null);
    try {
      const response = await ideasApi.syncAllToPublicLibrary();
      setBulkSyncResult({
        success: true,
        message: response.data.message,
        stats: response.data.stats,
      });
    } catch (error) {
      console.error('Failed to bulk sync to Public Library:', error);
      setBulkSyncResult({ success: false, message: 'Failed to sync templates to Public Library' });
    } finally {
      setBulkSyncLoading(false);
    }
  };

  const sendReminder = async (userId: number, ideaId: number, reminderType: string) => {
    setSendingReminder(ideaId);
    try {
      await analyticsApi.sendReminder(userId, ideaId, reminderType);
      setReminderSuccess(prev => ({ ...prev, [ideaId]: true }));
      // Clear success indicator after 3 seconds
      setTimeout(() => {
        setReminderSuccess(prev => ({ ...prev, [ideaId]: false }));
      }, 3000);
    } catch (error) {
      console.error('Failed to send reminder:', error);
    } finally {
      setSendingReminder(null);
    }
  };

  const sendBulkReminders = async (templates: Array<{ id: number; assigned_to: number | null }>, reminderType: string) => {
    const remindersToSend = templates
      .filter(t => t.assigned_to)
      .map(t => ({
        user_id: t.assigned_to!,
        idea_id: t.id,
        reminder_type: reminderType,
      }));

    if (remindersToSend.length === 0) {
      alert('No templates with assigned users to send reminders to.');
      return;
    }

    setSendingBulk(true);
    try {
      const response = await analyticsApi.sendBulkReminders(remindersToSend);
      alert(response.data.message);
      // Mark all as sent
      const newSuccesses: Record<number, boolean> = {};
      remindersToSend.forEach(r => { newSuccesses[r.idea_id] = true; });
      setReminderSuccess(prev => ({ ...prev, ...newSuccesses }));
      setTimeout(() => {
        setReminderSuccess({});
      }, 3000);
    } catch (error) {
      console.error('Failed to send bulk reminders:', error);
      alert('Failed to send reminders');
    } finally {
      setSendingBulk(false);
    }
  };

  const totalIssues = stats.incompletePublished + stats.staleAssigned + stats.noDepartments + 
                      stats.noFlowJson + stats.duplicates + stats.formatIssues;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary-600" />
            Maintenance Center
          </h1>
          <p className="text-gray-500 mt-1">Monitor and fix data quality issues across your templates</p>
        </div>
        <button
          onClick={loadData}
          className="btn-secondary flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          label="Incomplete Published"
          count={stats.incompletePublished}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="amber"
          critical
        />
        <StatCard
          label="Format Issues"
          count={stats.formatIssues}
          icon={<Zap className="w-5 h-5" />}
          color="purple"
        />
        <StatCard
          label="Stale Assigned"
          count={stats.staleAssigned}
          icon={<Clock className="w-5 h-5" />}
          color="orange"
        />
        <StatCard
          label="No Department"
          count={stats.noDepartments}
          icon={<FolderX className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          label="No Flow JSON"
          count={stats.noFlowJson}
          icon={<FileX className="w-5 h-5" />}
          color="red"
        />
        <StatCard
          label="Duplicates"
          count={stats.duplicates}
          icon={<Copy className="w-5 h-5" />}
          color="gray"
        />
      </div>

      {/* Health Status */}
      {totalIssues === 0 ? (
        <div className="card bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-xl">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-green-900">All Clear!</h2>
              <p className="text-green-700">No maintenance issues found. Your templates are in great shape.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-100 rounded-xl">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-amber-900">{totalIssues} Issue{totalIssues !== 1 ? 's' : ''} Found</h2>
              <p className="text-amber-700">Review the sections below to fix data quality issues.</p>
            </div>
          </div>
        </div>
      )}

      {/* Public Library Sync */}
      <div className="card bg-gradient-to-br from-sky-50 to-indigo-50 border-2 border-sky-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-100 rounded-xl">
              <Cloud className="w-8 h-8 text-sky-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-sky-900">Public Library Sync</h2>
              <p className="text-sky-700">Update existing templates in the Activepieces Public Library</p>
              <p className="text-xs text-sky-600 mt-1">⚠️ Only updates existing templates • Validates required fields • Rate-limited</p>
            </div>
          </div>
          <button
            onClick={executeBulkSyncPublicLibrary}
            disabled={bulkSyncLoading}
            className="btn-primary flex items-center gap-2 bg-sky-600 hover:bg-sky-700"
          >
            {bulkSyncLoading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {bulkSyncLoading ? 'Syncing...' : 'Sync Existing Templates'}
          </button>
        </div>

        {bulkSyncResult && (
          <div className={`mt-4 p-4 rounded-xl ${bulkSyncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-start gap-3">
              {bulkSyncResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <div className="flex-1">
                <p className={`font-medium ${bulkSyncResult.success ? 'text-green-800' : 'text-red-800'}`}>
                  {bulkSyncResult.message}
                </p>
                {bulkSyncResult.stats && (
                  <>
                    <div className="mt-3 grid grid-cols-5 gap-3">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-gray-900">{bulkSyncResult.stats.total}</p>
                        <p className="text-xs text-gray-500">In Library</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-green-600">{bulkSyncResult.stats.synced}</p>
                        <p className="text-xs text-gray-500">Updated</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-amber-600">{bulkSyncResult.stats.skippedValidation}</p>
                        <p className="text-xs text-gray-500">Skipped</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-red-600">{bulkSyncResult.stats.errors}</p>
                        <p className="text-xs text-gray-500">Errors</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-gray-400">{bulkSyncResult.stats.notInLibrary}</p>
                        <p className="text-xs text-gray-500">Not in Library</p>
                      </div>
                    </div>
                    {bulkSyncResult.stats.notInLibrary > 0 && (
                      <p className="mt-2 text-xs text-gray-500">
                        💡 {bulkSyncResult.stats.notInLibrary} published template(s) are not yet in the Public Library. 
                        Use the template detail page to publish them individually.
                      </p>
                    )}
                    {bulkSyncResult.stats.skippedValidation > 0 && (
                      <p className="mt-1 text-xs text-amber-600">
                        ⚠️ {bulkSyncResult.stats.skippedValidation} template(s) skipped due to missing required fields (flow_name, summary, description, or flow_json).
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Incomplete Published Templates */}
      {stats.incompletePublished > 0 && (
        <CollapsibleSection
          title="Published Templates Missing Required Fields"
          subtitle={`${stats.incompletePublished} template${stats.incompletePublished !== 1 ? 's' : ''} need attention`}
          icon={<AlertTriangle className="w-5 h-5 text-amber-600" />}
          color="amber"
          expanded={expandedSections.incomplete}
          onToggle={() => toggleSection('incomplete')}
          critical
          headerAction={
            incompleteTemplates.some(t => t.assigned_to) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  sendBulkReminders(
                    incompleteTemplates.map(t => ({ id: t.id, assigned_to: t.assigned_to })),
                    'incomplete_fields'
                  );
                }}
                disabled={sendingBulk}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {sendingBulk ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Notify All
              </button>
            )
          }
        >
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {incompleteTemplates.map((template) => (
              <div
                key={template.id}
                className={`bg-white rounded-xl p-4 border transition-colors ${
                  reminderSuccess[template.id] 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-amber-200 hover:border-amber-300'
                }`}
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
                    {template.assigned_username && (
                      <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-600">
                        <User className="w-3.5 h-3.5" />
                        <span>Assigned to: <span className="font-medium text-gray-800">{template.assigned_username}</span></span>
                      </div>
                    )}
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
                  <div className="flex items-center gap-2 shrink-0">
                    {template.assigned_to && (
                      <button
                        onClick={() => sendReminder(template.assigned_to!, template.id, 'incomplete_fields')}
                        disabled={sendingReminder === template.id || reminderSuccess[template.id]}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                          reminderSuccess[template.id]
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-amber-100 hover:text-amber-700'
                        } disabled:opacity-50`}
                        title="Send reminder notification"
                      >
                        {sendingReminder === template.id ? (
                          <Loader className="w-3.5 h-3.5 animate-spin" />
                        ) : reminderSuccess[template.id] ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Bell className="w-3.5 h-3.5" />
                        )}
                        {reminderSuccess[template.id] ? 'Sent!' : 'Notify'}
                      </button>
                    )}
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {template.missing_count} missing
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Format Sync */}
      {(syncPreview && syncPreview.stats.needsUpdate > 0) && (
        <CollapsibleSection
          title="Format Normalization"
          subtitle={`${syncPreview.stats.needsUpdate} template${syncPreview.stats.needsUpdate !== 1 ? 's' : ''} need format updates`}
          icon={<Zap className="w-5 h-5 text-purple-600" />}
          color="purple"
          expanded={expandedSections.format}
          onToggle={() => toggleSection('format')}
        >
          {syncResult && (
            <div className={`mb-4 p-4 rounded-xl ${syncResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
              <div className="flex items-center gap-2">
                {syncResult.success ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                <div>
                  <span className="font-medium">{syncResult.message}</span>
                  {syncResult.success && syncResult.publicLibrarySynced !== undefined && syncResult.publicLibrarySynced > 0 && (
                    <p className="text-sm mt-1">📚 {syncResult.publicLibrarySynced} templates also synced to Public Library</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-gray-900">{syncPreview.stats.total}</p>
              <p className="text-xs text-gray-500">Total Templates</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-amber-600">{syncPreview.stats.needsUpdate}</p>
              <p className="text-xs text-amber-700">Need Update</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{syncPreview.stats.alreadyCorrect}</p>
              <p className="text-xs text-green-700">Already Correct</p>
            </div>
          </div>

          {syncPreview.needsUpdate.length > 0 && (
            <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
              {syncPreview.needsUpdate.slice(0, 10).map((item) => (
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
              {syncPreview.needsUpdate.length > 10 && (
                <p className="text-center text-gray-500 text-sm py-2">
                  ... and {syncPreview.needsUpdate.length - 10} more
                </p>
              )}
            </div>
          )}

          <button
            onClick={executeSyncFormats}
            disabled={syncLoading}
            className="btn-primary flex items-center gap-2"
          >
            {syncLoading ? <Loader className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Apply Format Changes ({syncPreview.stats.needsUpdate} templates)
          </button>
        </CollapsibleSection>
      )}

      {/* Stale Assigned Templates */}
      {stats.staleAssigned > 0 && (
        <CollapsibleSection
          title="Stale Assigned Templates"
          subtitle={`${stats.staleAssigned} template${stats.staleAssigned !== 1 ? 's' : ''} assigned but inactive for 14+ days`}
          icon={<Clock className="w-5 h-5 text-orange-600" />}
          color="orange"
          expanded={expandedSections.stale}
          onToggle={() => toggleSection('stale')}
          headerAction={
            <button
              onClick={(e) => {
                e.stopPropagation();
                sendBulkReminders(
                  staleTemplates.map(t => ({ id: t.id, assigned_to: t.assigned_to })),
                  'stale'
                );
              }}
              disabled={sendingBulk}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
            >
              {sendingBulk ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Notify All
            </button>
          }
        >
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {staleTemplates.map((template) => (
              <div 
                key={template.id} 
                className={`bg-white rounded-lg p-3 border flex items-center justify-between ${
                  reminderSuccess[template.id] 
                    ? 'border-green-300 bg-green-50' 
                    : 'border-orange-200'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/ideas/${template.id}`}
                    className="font-medium text-gray-900 hover:text-primary-600 flex items-center gap-2"
                  >
                    {template.flow_name || `Template #${template.id}`}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                  <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      <span className="font-medium text-gray-700">{template.assigned_username}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {template.days_since_update} days ago
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => sendReminder(template.assigned_to, template.id, 'stale')}
                    disabled={sendingReminder === template.id || reminderSuccess[template.id]}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      reminderSuccess[template.id]
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-700 hover:bg-orange-100 hover:text-orange-700'
                    } disabled:opacity-50`}
                    title="Send reminder notification"
                  >
                    {sendingReminder === template.id ? (
                      <Loader className="w-3.5 h-3.5 animate-spin" />
                    ) : reminderSuccess[template.id] ? (
                      <CheckCircle className="w-3.5 h-3.5" />
                    ) : (
                      <Bell className="w-3.5 h-3.5" />
                    )}
                    {reminderSuccess[template.id] ? 'Sent!' : 'Notify'}
                  </button>
                  <StatusBadge status={template.status} />
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* No Department */}
      {stats.noDepartments > 0 && (
        <CollapsibleSection
          title="Templates Without Department"
          subtitle={`${stats.noDepartments} template${stats.noDepartments !== 1 ? 's' : ''} not assigned to any department`}
          icon={<FolderX className="w-5 h-5 text-blue-600" />}
          color="blue"
          expanded={expandedSections.orphaned}
          onToggle={() => toggleSection('orphaned')}
        >
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {orphanedTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg p-3 border border-blue-200 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/ideas/${template.id}`}
                    className="font-medium text-gray-900 hover:text-primary-600 flex items-center gap-2"
                  >
                    {template.flow_name || `Template #${template.id}`}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                </div>
                <StatusBadge status={template.status} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* No Flow JSON */}
      {stats.noFlowJson > 0 && (
        <CollapsibleSection
          title="Templates Without Flow JSON"
          subtitle={`${stats.noFlowJson} non-new template${stats.noFlowJson !== 1 ? 's' : ''} missing flow file`}
          icon={<FileX className="w-5 h-5 text-red-600" />}
          color="red"
          expanded={expandedSections.noFlow}
          onToggle={() => toggleSection('noFlow')}
        >
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {noFlowJsonTemplates.map((template) => (
              <div key={template.id} className="bg-white rounded-lg p-3 border border-red-200 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/ideas/${template.id}`}
                    className="font-medium text-gray-900 hover:text-primary-600 flex items-center gap-2"
                  >
                    {template.flow_name || `Template #${template.id}`}
                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                  </Link>
                </div>
                <StatusBadge status={template.status} />
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}

      {/* Duplicates */}
      {stats.duplicates > 0 && (
        <CollapsibleSection
          title="Potential Duplicate Templates"
          subtitle={`${stats.duplicates} group${stats.duplicates !== 1 ? 's' : ''} of templates with identical names`}
          icon={<Copy className="w-5 h-5 text-gray-600" />}
          color="gray"
          expanded={expandedSections.duplicates}
          onToggle={() => toggleSection('duplicates')}
        >
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {duplicateGroups.map((group, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-gray-900">{group.flow_name}</span>
                  <span className="text-sm text-gray-500">{group.count} templates</span>
                </div>
                <div className="space-y-2">
                  {group.templates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-lg px-3 py-2">
                      <Link
                        to={`/ideas/${t.id}`}
                        className="text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
                      >
                        #{t.id}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                      <div className="flex items-center gap-3">
                        <span className="text-gray-500">{new Date(t.created_at).toLocaleDateString()}</span>
                        <StatusBadge status={t.status} small />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
};

// Helper Components
const StatCard: React.FC<{
  label: string;
  count: number;
  icon: React.ReactNode;
  color: string;
  critical?: boolean;
}> = ({ label, count, icon, color, critical }) => {
  const colorClasses: Record<string, string> = {
    amber: 'from-amber-50 to-amber-100/50 border-amber-200 text-amber-600',
    purple: 'from-purple-50 to-purple-100/50 border-purple-200 text-purple-600',
    orange: 'from-orange-50 to-orange-100/50 border-orange-200 text-orange-600',
    blue: 'from-blue-50 to-blue-100/50 border-blue-200 text-blue-600',
    red: 'from-red-50 to-red-100/50 border-red-200 text-red-600',
    gray: 'from-gray-50 to-gray-100/50 border-gray-200 text-gray-600',
    green: 'from-green-50 to-green-100/50 border-green-200 text-green-600',
  };

  return (
    <div className={`rounded-xl p-4 bg-gradient-to-br border ${colorClasses[color]} ${critical && count > 0 ? 'ring-2 ring-amber-300' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="opacity-80">{icon}</div>
        <span className={`text-2xl font-bold ${count === 0 ? 'text-green-600' : ''}`}>
          {count === 0 ? '✓' : count}
        </span>
      </div>
      <p className="text-xs font-medium mt-2 text-gray-600">{label}</p>
    </div>
  );
};

const CollapsibleSection: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  critical?: boolean;
  headerAction?: React.ReactNode;
}> = ({ title, subtitle, icon, color, expanded, onToggle, children, critical, headerAction }) => {
  const borderColors: Record<string, string> = {
    amber: 'border-amber-200',
    purple: 'border-purple-200',
    orange: 'border-orange-200',
    blue: 'border-blue-200',
    red: 'border-red-200',
    gray: 'border-gray-200',
  };

  const bgColors: Record<string, string> = {
    amber: 'from-amber-50 to-orange-50',
    purple: 'from-purple-50 to-indigo-50',
    orange: 'from-orange-50 to-amber-50',
    blue: 'from-blue-50 to-sky-50',
    red: 'from-red-50 to-rose-50',
    gray: 'from-gray-50 to-slate-50',
  };

  return (
    <div className={`card border-2 ${borderColors[color]} ${critical ? 'bg-gradient-to-br ' + bgColors[color] : ''}`}>
      <div className="flex items-center justify-between">
        <button
          onClick={onToggle}
          className="flex-1 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-white shadow-sm border ${borderColors[color]}`}>
              {icon}
            </div>
            <div className="text-left">
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              <p className="text-sm text-gray-600">{subtitle}</p>
            </div>
          </div>
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>
        {headerAction && <div className="ml-3">{headerAction}</div>}
      </div>
      {expanded && <div className="mt-4 pt-4 border-t border-gray-200">{children}</div>}
    </div>
  );
};

const StatusBadge: React.FC<{ status: string; small?: boolean }> = ({ status, small }) => {
  const statusColors: Record<string, string> = {
    new: 'bg-blue-100 text-blue-700',
    assigned: 'bg-purple-100 text-purple-700',
    in_progress: 'bg-amber-100 text-amber-700',
    submitted: 'bg-indigo-100 text-indigo-700',
    needs_fixes: 'bg-red-100 text-red-700',
    reviewed: 'bg-emerald-100 text-emerald-700',
    published: 'bg-green-100 text-green-700',
    archived: 'bg-gray-100 text-gray-700',
  };

  const formatStatus = (s: string) => s.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-medium ${statusColors[status] || 'bg-gray-100 text-gray-700'} ${small ? 'text-xs' : 'text-xs'}`}>
      {formatStatus(status)}
    </span>
  );
};

export default Maintenance;

