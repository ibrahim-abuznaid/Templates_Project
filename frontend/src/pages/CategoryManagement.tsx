import React, { useEffect, useState, useCallback } from 'react';
import { departmentsApi, ideasApi } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Loader,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Cloud,
  Upload,
  ArrowRightLeft,
  FileText,
  Eye,
  X,
  Info,
  ExternalLink,
  Save,
  ArrowRight,
  Link,
  ArrowRightFromLine,
} from 'lucide-react';

interface CategoryStat {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  created_at: string;
  template_count: number;
  published_count: number;
  in_progress_count: number;
}

interface Template {
  id: number;
  flow_name: string;
  status: string;
  public_library_id: string | null;
  created_at: string;
  updated_at: string;
  assigned_to_name: string | null;
}

interface SyncPreview {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  body: { value: string[] };
}

interface CategoryMapping {
  id: number;
  department_name: string;
  maps_to_category: string;
  maps_to_label: string;
  match_type: 'direct';
}

const CategoryManagement: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<CategoryStat[]>([]);
  const [categoryMappings, setCategoryMappings] = useState<CategoryMapping[]>([]);
  const [hasOrderChanges, setHasOrderChanges] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);

  // Drag state
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);

  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showMigrateModal, setShowMigrateModal] = useState(false);
  const [showSyncPreview, setShowSyncPreview] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);

  // Selected category for operations
  const [selectedCategory, setSelectedCategory] = useState<CategoryStat | null>(null);
  const [categoryTemplates, setCategoryTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  // Form states
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [migrateTargetId, setMigrateTargetId] = useState<number | null>(null);
  const [migrateRemoveSource, setMigrateRemoveSource] = useState(true);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);

  // Sync state
  const [syncPreview, setSyncPreview] = useState<SyncPreview | null>(null);
  const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ success: boolean; message: string; categories?: string[] } | null>(null);
  
  // Template resync state
  const [resyncingTemplates, setResyncingTemplates] = useState(false);
  const [resyncResult, setResyncResult] = useState<{ success: boolean; message: string; stats?: any; details?: any[] } | null>(null);
  const [showResyncDetails, setShowResyncDetails] = useState(false);

  // Confirm modal
  const [modal, setModal] = useState<{
    isOpen: boolean;
    type: 'confirm' | 'success' | 'error' | 'info' | 'warning';
    title: string;
    message: string;
    onConfirm?: () => void;
    showCancel?: boolean;
    confirmText?: string;
  }>({
    isOpen: false,
    type: 'confirm',
    title: '',
    message: '',
    showCancel: true,
  });

  const showConfirmModal = (config: Partial<typeof modal> & { title: string; message: string }) => {
    setModal({ ...modal, isOpen: true, showCancel: true, ...config });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  // Load categories and mapping
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const [statsResponse, mappingResponse] = await Promise.all([
        departmentsApi.getStats(),
        departmentsApi.getMapping()
      ]);
      setCategories(statsResponse.data.departments);
      setCategoryMappings(mappingResponse.data.mappings);
      setHasOrderChanges(false);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Get mapping for a specific category
  const getMappingForCategory = useCallback((categoryName: string): CategoryMapping | null => {
    return categoryMappings.find(m => m.department_name === categoryName) || null;
  }, [categoryMappings]);

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItem(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.currentTarget.outerHTML);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverItem(index);
  };

  const handleDragEnd = () => {
    if (draggedItem !== null && dragOverItem !== null && draggedItem !== dragOverItem) {
      const newCategories = [...categories];
      const draggedCategory = newCategories[draggedItem];
      newCategories.splice(draggedItem, 1);
      newCategories.splice(dragOverItem, 0, draggedCategory);
      
      // Update display_order for all items
      const reordered = newCategories.map((cat, idx) => ({
        ...cat,
        display_order: idx + 1
      }));
      
      setCategories(reordered);
      setHasOrderChanges(true);
    }
    setDraggedItem(null);
    setDragOverItem(null);
  };

  // Save order changes
  const saveOrderChanges = async () => {
    setSavingOrder(true);
    try {
      const order = categories.map((cat, idx) => ({
        id: cat.id,
        display_order: idx + 1
      }));
      
      await departmentsApi.reorder(order);
      setHasOrderChanges(false);
      showConfirmModal({
        type: 'success',
        title: 'Order Saved',
        message: 'Category order has been updated successfully.',
        showCancel: false,
        confirmText: 'OK'
      });
    } catch (error) {
      console.error('Failed to save order:', error);
      showConfirmModal({
        type: 'error',
        title: 'Error',
        message: 'Failed to save category order. Please try again.',
        showCancel: false,
        confirmText: 'OK'
      });
    } finally {
      setSavingOrder(false);
    }
  };

  // Add category
  const handleAddCategory = async () => {
    if (!formName.trim()) return;
    
    try {
      await departmentsApi.create({
        name: formName.trim(),
        description: formDescription.trim() || undefined
      });
      
      setShowAddModal(false);
      setFormName('');
      setFormDescription('');
      loadCategories();
      
      showConfirmModal({
        type: 'success',
        title: 'Category Added',
        message: `"${formName.trim()}" has been added successfully.`,
        showCancel: false,
        confirmText: 'OK'
      });
    } catch (error: any) {
      showConfirmModal({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to add category',
        showCancel: false,
        confirmText: 'OK'
      });
    }
  };

  // Edit category
  const openEditModal = (category: CategoryStat) => {
    setSelectedCategory(category);
    setFormName(category.name);
    setFormDescription(category.description || '');
    setShowEditModal(true);
  };

  const handleEditCategory = async () => {
    if (!selectedCategory || !formName.trim()) return;
    
    try {
      const response = await departmentsApi.update(selectedCategory.id, {
        name: formName.trim(),
        description: formDescription.trim() || undefined
      });
      
      setShowEditModal(false);
      setFormName('');
      setFormDescription('');
      setSelectedCategory(null);
      loadCategories();
      
      const oldName = response.data.old_name;
      if (oldName !== formName.trim()) {
        showConfirmModal({
          type: 'info',
          title: 'Category Renamed',
          message: `Category renamed from "${oldName}" to "${formName.trim()}".\n\n⚠️ Remember to sync with Public Library if this category is used there.`,
          showCancel: false,
          confirmText: 'Got it'
        });
      } else {
        showConfirmModal({
          type: 'success',
          title: 'Category Updated',
          message: 'Category has been updated successfully.',
          showCancel: false,
          confirmText: 'OK'
        });
      }
    } catch (error: any) {
      showConfirmModal({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to update category',
        showCancel: false,
        confirmText: 'OK'
      });
    }
  };

  // Delete category
  const openDeleteModal = (category: CategoryStat) => {
    setSelectedCategory(category);
    setMigrateTargetId(null);
    setShowDeleteModal(true);
  };

  const handleDeleteCategory = async () => {
    if (!selectedCategory) return;
    
    try {
      const response = await departmentsApi.delete(
        selectedCategory.id,
        migrateTargetId || undefined
      );
      
      setShowDeleteModal(false);
      setSelectedCategory(null);
      setMigrateTargetId(null);
      loadCategories();
      
      const msg = response.data.templates_migrated > 0
        ? `Category deleted. ${response.data.templates_migrated} template(s) were migrated.`
        : 'Category deleted successfully.';
      
      showConfirmModal({
        type: 'success',
        title: 'Category Deleted',
        message: msg,
        showCancel: false,
        confirmText: 'OK'
      });
    } catch (error: any) {
      showConfirmModal({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to delete category',
        showCancel: false,
        confirmText: 'OK'
      });
    }
  };

  // Migration
  const openMigrateModal = (category: CategoryStat) => {
    setSelectedCategory(category);
    setMigrateTargetId(null);
    setMigrateRemoveSource(true);
    setSelectedTemplateIds([]);
    setShowMigrateModal(true);
    loadCategoryTemplates(category.id);
  };

  const loadCategoryTemplates = async (categoryId: number) => {
    setLoadingTemplates(true);
    try {
      const response = await departmentsApi.getTemplates(categoryId);
      setCategoryTemplates(response.data.templates);
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleMigrate = async () => {
    if (!selectedCategory || !migrateTargetId) return;
    
    try {
      const response = await departmentsApi.migrate({
        source_id: selectedCategory.id,
        target_id: migrateTargetId,
        template_ids: selectedTemplateIds.length > 0 ? selectedTemplateIds : undefined,
        remove_from_source: migrateRemoveSource
      });
      
      setShowMigrateModal(false);
      setSelectedCategory(null);
      setMigrateTargetId(null);
      setSelectedTemplateIds([]);
      loadCategories();
      
      showConfirmModal({
        type: 'success',
        title: 'Migration Complete',
        message: response.data.message,
        showCancel: false,
        confirmText: 'OK'
      });
    } catch (error: any) {
      showConfirmModal({
        type: 'error',
        title: 'Error',
        message: error.response?.data?.error || 'Failed to migrate templates',
        showCancel: false,
        confirmText: 'OK'
      });
    }
  };

  // View templates
  const openTemplatesModal = async (category: CategoryStat) => {
    setSelectedCategory(category);
    setShowTemplatesModal(true);
    loadCategoryTemplates(category.id);
  };

  // Public Library sync
  const loadSyncPreview = async () => {
    try {
      const response = await departmentsApi.getPublicLibraryPreview();
      setSyncPreview(response.data.preview);
      setSyncWarnings(response.data.warnings);
      setShowSyncPreview(true);
    } catch (error) {
      console.error('Failed to load sync preview:', error);
    }
  };

  const handleSyncToPublicLibrary = async () => {
    showConfirmModal({
      type: 'warning',
      title: 'Sync to Public Library',
      message: 'This will update the category list in the Activepieces Public Library.\n\n⚠️ This action affects production. The category order you have set will be applied.\n\nProceed?',
      confirmText: 'Sync Now',
      onConfirm: async () => {
        setSyncing(true);
        setSyncResult(null);
        try {
          const response = await departmentsApi.syncToPublicLibrary();
          setSyncResult({
            success: true,
            message: response.data.message,
            categories: response.data.synced_categories
          });
        } catch (error: any) {
          setSyncResult({
            success: false,
            message: error.response?.data?.error || 'Failed to sync with Public Library'
          });
        } finally {
          setSyncing(false);
        }
      }
    });
  };

  // Resync all published templates to update their categories
  const handleResyncAllTemplates = async () => {
    showConfirmModal({
      type: 'warning',
      title: 'Resync All Published Templates',
      message: 'This will update ALL published templates in the Public Library with their current category names.\n\n⚠️ This may take a while if you have many templates.\n\nMake sure you have synced categories first!\n\nProceed?',
      confirmText: 'Resync Templates',
      onConfirm: async () => {
        setResyncingTemplates(true);
        setResyncResult(null);
        setShowResyncDetails(false);
        try {
          const response = await ideasApi.syncAllToPublicLibrary();
          setResyncResult({
            success: true,
            message: `Synced ${response.data.stats.synced} templates. ${response.data.stats.skippedValidation} skipped, ${response.data.stats.errors} errors.`,
            stats: response.data.stats,
            details: response.data.details
          });
        } catch (error: any) {
          setResyncResult({
            success: false,
            message: error.response?.data?.error || 'Failed to resync templates'
          });
        } finally {
          setResyncingTemplates(false);
        }
      }
    });
  };

  // Select all/none templates for migration
  const toggleSelectAllTemplates = () => {
    if (selectedTemplateIds.length === categoryTemplates.length) {
      setSelectedTemplateIds([]);
    } else {
      setSelectedTemplateIds(categoryTemplates.map(t => t.id));
    }
  };

  const toggleTemplateSelection = (id: number) => {
    setSelectedTemplateIds(prev =>
      prev.includes(id)
        ? prev.filter(tid => tid !== id)
        : [...prev, id]
    );
  };

  // Status badge component
  const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-700',
      assigned: 'bg-purple-100 text-purple-700',
      in_progress: 'bg-amber-100 text-amber-700',
      submitted: 'bg-indigo-100 text-indigo-700',
      needs_fixes: 'bg-red-100 text-red-700',
      reviewed: 'bg-emerald-100 text-emerald-700',
      published: 'bg-green-100 text-green-700',
      archived: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-700'}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  // Public Library mapping badge - shows the API format for the category
  const MappingBadge: React.FC<{ categoryName: string }> = ({ categoryName }) => {
    const mapping = getMappingForCategory(categoryName);
    if (!mapping) return null;

    return (
      <span 
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border bg-gray-100 text-gray-700 border-gray-200"
        title={`Published as: ${mapping.maps_to_category}`}
      >
        <ArrowRightFromLine className="w-3 h-3" />
        <code className="text-xs">{mapping.maps_to_category}</code>
      </span>
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
    <div className="space-y-6">
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        confirmText={modal.confirmText}
        showCancel={modal.showCancel}
      />

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Tags className="w-8 h-8 text-primary-600" />
            Department Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage departments for templates and sync with the Public Library
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCategories}
            className="btn-secondary flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          <button
            onClick={() => {
              setFormName('');
              setFormDescription('');
              setShowAddModal(true);
            }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        </div>
      </div>

      {/* Order Save Bar */}
      {hasOrderChanges && (
        <div className="sticky top-16 z-40 bg-gradient-to-r from-amber-50 to-yellow-50 border-2 border-amber-300 rounded-xl p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span className="font-medium text-amber-800">
              You have unsaved order changes
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadCategories}
              className="btn-secondary text-sm"
            >
              Discard
            </button>
            <button
              onClick={saveOrderChanges}
              disabled={savingOrder}
              className="btn-primary flex items-center gap-2 text-sm"
            >
              {savingOrder ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Order
            </button>
          </div>
        </div>
      )}

      {/* Public Library Sync Section */}
      <div className="card bg-gradient-to-br from-sky-50 to-indigo-50 border-2 border-sky-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-sky-100 rounded-xl">
              <Cloud className="w-8 h-8 text-sky-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-sky-900">Public Library Sync</h2>
              <p className="text-sky-700">Sync category names and order to Activepieces Public Library</p>
              <p className="text-xs text-sky-600 mt-1">
                ⚠️ Changes here affect the production Public Library • Order matters for display
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSyncPreview}
              className="btn-secondary flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={handleSyncToPublicLibrary}
              disabled={syncing || categories.length === 0}
              className="btn-primary flex items-center gap-2 bg-sky-600 hover:bg-sky-700"
            >
              {syncing ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {syncing ? 'Syncing...' : 'Sync to Public Library'}
            </button>
          </div>
        </div>

        {syncResult && (
          <div className={`mt-4 p-4 rounded-xl ${syncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center gap-3">
              {syncResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-red-600" />
              )}
              <span className={syncResult.success ? 'text-green-800' : 'text-red-800'}>
                {syncResult.message}
              </span>
            </div>
            {syncResult.categories && syncResult.categories.length > 0 && (
              <div className="mt-3">
                <p className="text-sm font-medium text-green-700 mb-2">Categories synced to Public Library:</p>
                <div className="flex flex-wrap gap-2">
                  {syncResult.categories.map((cat, index) => (
                    <span
                      key={index}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-green-100 text-green-800 border border-green-200"
                    >
                      {index + 1}. {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 2: Resync Templates Section */}
      <div className="card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-xl">
              <RefreshCw className="w-8 h-8 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-purple-900">Step 2: Resync All Templates</h2>
              <p className="text-purple-700">Update all published templates with their correct category names</p>
              <p className="text-xs text-purple-600 mt-1">
                ⚠️ Run this AFTER syncing categories to update existing templates in the Public Library
              </p>
            </div>
          </div>
          <button
            onClick={handleResyncAllTemplates}
            disabled={resyncingTemplates}
            className="btn-primary flex items-center gap-2 bg-purple-600 hover:bg-purple-700"
          >
            {resyncingTemplates ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {resyncingTemplates ? 'Resyncing...' : 'Resync All Templates'}
          </button>
        </div>

        {resyncResult && (
          <div className={`mt-4 p-4 rounded-xl ${resyncResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {resyncResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                )}
                <span className={resyncResult.success ? 'text-green-800' : 'text-red-800'}>
                  {resyncResult.message}
                </span>
              </div>
              {resyncResult.details && resyncResult.details.length > 0 && (
                <button
                  onClick={() => setShowResyncDetails(!showResyncDetails)}
                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                >
                  {showResyncDetails ? 'Hide Details' : 'Show Details'}
                </button>
              )}
            </div>
            {resyncResult.stats && (
              <div className="mt-2 flex gap-4 text-sm">
                <span className="text-gray-600">Total: {resyncResult.stats.total}</span>
                <span className="text-green-600">Synced: {resyncResult.stats.synced}</span>
                <span className="text-orange-600">Skipped: {resyncResult.stats.skippedValidation}</span>
                <span className="text-red-600">Errors: {resyncResult.stats.errors}</span>
              </div>
            )}
            
            {/* Sync Details */}
            {showResyncDetails && resyncResult.details && (
              <div className="mt-4 max-h-64 overflow-y-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Template</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {resyncResult.details.map((detail: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-900 max-w-xs truncate" title={detail.flow_name}>
                          {detail.flow_name}
                        </td>
                        <td className="px-3 py-2">
                          {detail.action === 'updated' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              Updated
                            </span>
                          )}
                          {detail.action === 'skipped' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">
                              <AlertTriangle className="w-3 h-3" />
                              Skipped
                            </span>
                          )}
                          {detail.action === 'error' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              <X className="w-3 h-3" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-600 text-xs max-w-xs truncate" title={detail.reason || detail.error || detail.public_library_id}>
                          {detail.reason || detail.error || detail.public_library_id || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Category Mapping Info */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Link className="w-5 h-5 text-blue-600" />
            Category Mapping
          </h2>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Your category names are sent <strong>directly</strong> to the Public Library. Make sure to sync categories first so they are recognized.
        </p>

        {/* Mapping Table */}
        {categoryMappings.length > 0 && (
          <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Your Category</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">→</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sent to Public Library</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categoryMappings.map(mapping => (
                  <tr key={mapping.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{mapping.department_name}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ArrowRight className="w-4 h-4 text-gray-400 mx-auto" />
                    </td>
                    <td className="px-4 py-3">
                      <code className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-800">
                        {mapping.maps_to_category}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How it works:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li><strong>Step 1:</strong> Sync your categories to the Public Library (creates/updates category list)</li>
                <li><strong>Step 2:</strong> Resync all templates (updates existing templates with correct categories)</li>
              </ol>
              <p className="mt-2 text-blue-700">
                Templates will be published under the exact category name you have here.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Categories List */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            Categories ({categories.length})
          </h2>
          <p className="text-sm text-gray-500">
            Drag to reorder • Click actions to manage
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Tags className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No categories yet. Add your first category to get started.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div
                key={category.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`group flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-move ${
                  draggedItem === index
                    ? 'opacity-50 border-primary-400 bg-primary-50'
                    : dragOverItem === index
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {/* Drag Handle */}
                <div className="text-gray-400 group-hover:text-gray-600">
                  <GripVertical className="w-5 h-5" />
                </div>

                {/* Order Number */}
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                  {index + 1}
                </div>

                {/* Category Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold text-gray-900 truncate">
                      {category.name}
                    </h3>
                    <MappingBadge categoryName={category.name} />
                    {category.description && (
                      <span className="text-sm text-gray-500 truncate hidden lg:inline">
                        — {category.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-sm">
                  <button
                    onClick={() => openTemplatesModal(category)}
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-100 transition-colors"
                    title="View templates"
                  >
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-700">{category.template_count}</span>
                    <span className="text-gray-400">templates</span>
                  </button>
                  <div className="hidden md:flex items-center gap-3 text-xs">
                    <span className="px-2 py-1 rounded-full bg-green-100 text-green-700">
                      {category.published_count} published
                    </span>
                    <span className="px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                      {category.in_progress_count} in progress
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {category.template_count > 0 && (
                    <button
                      onClick={() => openMigrateModal(category)}
                      className="p-2 rounded-lg hover:bg-blue-50 text-gray-500 hover:text-blue-600 transition-colors"
                      title="Migrate templates"
                    >
                      <ArrowRightLeft className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openEditModal(category)}
                    className="p-2 rounded-lg hover:bg-amber-50 text-gray-500 hover:text-amber-600 transition-colors"
                    title="Edit category"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openDeleteModal(category)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="card bg-gradient-to-br from-gray-50 to-slate-50 border-gray-200">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-gray-500 mt-0.5" />
          <div className="text-sm text-gray-600">
            <p className="font-medium text-gray-700 mb-2">How Category Sync Works:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Category names and their order are synced to the Public Library</li>
              <li>Reordering here determines the display order in the Public Library</li>
              <li>Renaming a category here won't automatically update templates in the Public Library — you'll need to re-sync affected templates</li>
              <li>Deleting a category requires migrating its templates to another category first</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <Modal onClose={() => setShowAddModal(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary-600" />
              Add New Category
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Marketing"
                  className="input"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleAddCategory}
                disabled={!formName.trim()}
                className="btn-primary"
              >
                Add Category
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Category Modal */}
      {showEditModal && selectedCategory && (
        <Modal onClose={() => setShowEditModal(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-600" />
              Edit Category
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Marketing"
                  className="input"
                  autoFocus
                />
                {formName !== selectedCategory.name && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Renaming will require re-syncing affected templates
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description..."
                  className="input"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleEditCategory}
                disabled={!formName.trim()}
                className="btn-primary"
              >
                Save Changes
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Category Modal */}
      {showDeleteModal && selectedCategory && (
        <Modal onClose={() => setShowDeleteModal(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Delete Category
            </h2>
            
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
              <p className="text-red-800">
                Are you sure you want to delete <strong>"{selectedCategory.name}"</strong>?
              </p>
              {selectedCategory.template_count > 0 && (
                <p className="text-red-700 mt-2 text-sm">
                  This category has <strong>{selectedCategory.template_count}</strong> template(s).
                  You must migrate them to another category before deleting.
                </p>
              )}
            </div>

            {selectedCategory.template_count > 0 && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Migrate templates to: <span className="text-red-500">*</span>
                </label>
                <select
                  value={migrateTargetId || ''}
                  onChange={(e) => setMigrateTargetId(e.target.value ? parseInt(e.target.value) : null)}
                  className="input"
                >
                  <option value="">Select a category...</option>
                  {categories
                    .filter(c => c.id !== selectedCategory.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))
                  }
                </select>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteCategory}
                disabled={selectedCategory.template_count > 0 && !migrateTargetId}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Delete Category
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Migrate Templates Modal */}
      {showMigrateModal && selectedCategory && (
        <Modal onClose={() => setShowMigrateModal(false)} wide>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-blue-600" />
              Migrate Templates
            </h2>
            
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <p className="text-blue-800">
                Move templates from <strong>"{selectedCategory.name}"</strong> to another category.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Target Category <span className="text-red-500">*</span>
                </label>
                <select
                  value={migrateTargetId || ''}
                  onChange={(e) => setMigrateTargetId(e.target.value ? parseInt(e.target.value) : null)}
                  className="input"
                >
                  <option value="">Select target...</option>
                  {categories
                    .filter(c => c.id !== selectedCategory.id)
                    .map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.template_count} templates)</option>
                    ))
                  }
                </select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={migrateRemoveSource}
                    onChange={(e) => setMigrateRemoveSource(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    Remove from "{selectedCategory.name}" after migration
                  </span>
                </label>
              </div>
            </div>

            {/* Template Selection */}
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <span className="font-medium text-gray-700">
                  Select Templates ({selectedTemplateIds.length} of {categoryTemplates.length} selected)
                </span>
                <button
                  onClick={toggleSelectAllTemplates}
                  className="text-sm text-primary-600 hover:text-primary-700"
                >
                  {selectedTemplateIds.length === categoryTemplates.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              
              {loadingTemplates ? (
                <div className="p-8 flex justify-center">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : categoryTemplates.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No templates in this category
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {categoryTemplates.map(template => (
                    <label
                      key={template.id}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedTemplateIds.includes(template.id)}
                        onChange={() => toggleTemplateSelection(template.id)}
                        className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {template.flow_name || `Template #${template.id}`}
                        </p>
                        {template.assigned_to_name && (
                          <p className="text-xs text-gray-500">Assigned to: {template.assigned_to_name}</p>
                        )}
                      </div>
                      <StatusBadge status={template.status} />
                      {template.public_library_id && (
                        <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                          Published
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <p className="text-xs text-gray-500 mt-2">
              Leave empty to migrate all templates from this category.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowMigrateModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={handleMigrate}
                disabled={!migrateTargetId}
                className="btn-primary flex items-center gap-2"
              >
                <ArrowRight className="w-4 h-4" />
                Migrate {selectedTemplateIds.length > 0 ? selectedTemplateIds.length : 'All'} Template(s)
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* View Templates Modal */}
      {showTemplatesModal && selectedCategory && (
        <Modal onClose={() => setShowTemplatesModal(false)} wide>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Templates in "{selectedCategory.name}"
            </h2>

            {loadingTemplates ? (
              <div className="p-12 flex justify-center">
                <Loader className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : categoryTemplates.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <FileText className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p>No templates in this category</p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-xl">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Template</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Assigned To</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Published</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {categoryTemplates.map(template => (
                      <tr key={template.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <a
                            href={`/ideas/${template.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
                          >
                            {template.flow_name || `Template #${template.id}`}
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={template.status} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {template.assigned_to_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          {template.public_library_id ? (
                            <span className="text-green-600 text-sm">✓ Yes</span>
                          ) : (
                            <span className="text-gray-400 text-sm">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTemplatesModal(false)}
                className="btn-secondary"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Sync Preview Modal */}
      {showSyncPreview && syncPreview && (
        <Modal onClose={() => setShowSyncPreview(false)}>
          <div className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Eye className="w-5 h-5 text-sky-600" />
              Public Library Sync Preview
            </h2>

            {syncWarnings.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                {syncWarnings.map((w, i) => (
                  <p key={i} className="text-amber-800 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {w}
                  </p>
                ))}
              </div>
            )}

            <div className="bg-gray-900 rounded-xl p-4 text-sm font-mono overflow-auto">
              <div className="text-green-400 mb-2">
                {syncPreview.method} {syncPreview.endpoint}
              </div>
              <div className="text-gray-400 mb-2">
                Headers:<br />
                <span className="text-blue-300">Content-Type:</span> <span className="text-yellow-300">application/json</span><br />
                <span className="text-blue-300">templates-api-key:</span> <span className="text-yellow-300">{syncPreview.headers['templates-api-key']}</span>
              </div>
              <div className="text-gray-400 mb-1">Body:</div>
              <pre className="text-purple-300 whitespace-pre-wrap">
{JSON.stringify(syncPreview.body, null, 2)}
              </pre>
            </div>

            <p className="text-sm text-gray-500 mt-4">
              This is what will be sent to the Activepieces Public Library API when you sync.
            </p>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowSyncPreview(false)}
                className="btn-secondary"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSyncPreview(false);
                  handleSyncToPublicLibrary();
                }}
                className="btn-primary bg-sky-600 hover:bg-sky-700 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Sync Now
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// Modal Component
const Modal: React.FC<{ children: React.ReactNode; onClose: () => void; wide?: boolean }> = ({ 
  children, 
  onClose,
  wide 
}) => {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div 
          className="fixed inset-0 bg-gray-500/75 transition-opacity"
          onClick={onClose}
        />
        <div className={`relative bg-white rounded-2xl shadow-xl transform transition-all ${wide ? 'max-w-3xl' : 'max-w-lg'} w-full`}>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CategoryManagement;
