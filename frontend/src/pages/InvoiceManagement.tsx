import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { invoicesApi } from '../services/api';
import type { Invoice, InvoiceItem } from '../types';
import { 
  Download, Loader, User, CheckCircle, Clock, Undo2, Plus, Trash2, 
  Edit2, X, DollarSign, FileText, Users, ChevronDown, ChevronRight,
  ExternalLink, Calendar, Save
} from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import html2pdf from 'html2pdf.js';

interface Freelancer {
  id: number;
  username: string;
  email: string;
  handle: string;
  is_active: boolean;
  pending_items: number;
  pending_total: number;
}

const InvoiceManagement: React.FC = () => {
  const [freelancers, setFreelancers] = useState<Freelancer[]>([]);
  const [selectedFreelancer, setSelectedFreelancer] = useState<Freelancer | null>(null);
  const [pendingItems, setPendingItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InvoiceItem | null>(null);
  const [expandedSection, setExpandedSection] = useState<'pending' | 'history' | null>('pending');
  
  // Add item form state
  const [newItem, setNewItem] = useState({
    description: '',
    amount: '',
    completed_at: new Date().toISOString().split('T')[0]
  });
  
  // Modal state
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

  const showModal = (config: Partial<typeof modal> & { title: string; message: string }) => {
    setModal({ ...modal, isOpen: true, showCancel: true, ...config });
  };

  const closeModal = () => {
    setModal({ ...modal, isOpen: false });
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadFreelancers(),
      loadInvoiceHistory()
    ]);
    setLoading(false);
  };

  const loadFreelancers = async () => {
    try {
      const response = await invoicesApi.getAllFreelancers();
      setFreelancers(response.data);
    } catch (error) {
      console.error('Failed to load freelancers:', error);
    }
  };

  const loadInvoiceHistory = async () => {
    try {
      const response = await invoicesApi.getHistory(undefined, 20);
      setInvoiceHistory(response.data);
    } catch (error) {
      console.error('Failed to load invoice history:', error);
    }
  };

  const loadPendingItems = async (freelancer: Freelancer) => {
    try {
      const response = await invoicesApi.getPendingForFreelancer(freelancer.id);
      setPendingItems(response.data.items);
      setSelectedFreelancer(freelancer);
    } catch (error) {
      console.error('Failed to load pending items:', error);
    }
  };

  const handleAddManualItem = async () => {
    if (!selectedFreelancer || !newItem.description || !newItem.amount) {
      showModal({
        type: 'error',
        title: 'Missing Fields',
        message: 'Please fill in description and amount',
        showCancel: false,
        confirmText: 'OK'
      });
      return;
    }

    try {
      setProcessing(true);
      await invoicesApi.addManualItem({
        freelancer_id: selectedFreelancer.id,
        description: newItem.description,
        amount: parseFloat(newItem.amount),
        completed_at: new Date(newItem.completed_at).toISOString()
      });
      
      setShowAddItemModal(false);
      setNewItem({ description: '', amount: '', completed_at: new Date().toISOString().split('T')[0] });
      
      // Reload data
      await loadFreelancers();
      await loadPendingItems(selectedFreelancer);
      
      showModal({
        type: 'success',
        title: 'Item Added',
        message: `Manual item added to ${selectedFreelancer.username}'s invoice`,
        showCancel: false,
        confirmText: 'OK'
      });
    } catch (error: any) {
      showModal({
        type: 'error',
        title: 'Failed',
        message: error.response?.data?.error || 'Failed to add item',
        showCancel: false,
        confirmText: 'OK'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleDeleteItem = (item: InvoiceItem) => {
    showModal({
      type: 'warning',
      title: 'Delete Item',
      message: `Are you sure you want to delete "${item.idea_title || item.flow_name}"?\n\nAmount: $${Number(item.amount).toFixed(2)}`,
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          setProcessing(true);
          await invoicesApi.deleteItem(item.id);
          
          // Reload data
          await loadFreelancers();
          if (selectedFreelancer) {
            await loadPendingItems(selectedFreelancer);
          }
          
          showModal({
            type: 'success',
            title: 'Item Deleted',
            message: 'Item has been removed from the pending invoice',
            showCancel: false,
            confirmText: 'OK'
          });
        } catch (error: any) {
          showModal({
            type: 'error',
            title: 'Delete Failed',
            message: error.response?.data?.error || 'Failed to delete item',
            showCancel: false,
            confirmText: 'OK'
          });
        } finally {
          setProcessing(false);
        }
      }
    });
  };

  const handleUpdateItem = async () => {
    if (!editingItem) return;
    
    try {
      setProcessing(true);
      await invoicesApi.updateItem(editingItem.id, {
        amount: editingItem.amount
      });
      
      setEditingItem(null);
      
      // Reload data
      await loadFreelancers();
      if (selectedFreelancer) {
        await loadPendingItems(selectedFreelancer);
      }
    } catch (error: any) {
      showModal({
        type: 'error',
        title: 'Update Failed',
        message: error.response?.data?.error || 'Failed to update item',
        showCancel: false,
        confirmText: 'OK'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleRevertInvoice = (invoice: Invoice) => {
    showModal({
      type: 'warning',
      title: 'Revert Invoice',
      message: `Are you sure you want to revert invoice ${invoice.invoice_number}?\n\nThis will move all ${invoice.freelancer_name}'s items back to pending status so they can be paid again.`,
      confirmText: 'Yes, Revert',
      onConfirm: async () => {
        try {
          setProcessing(true);
          const response = await invoicesApi.revertInvoice(invoice.id);
          
          showModal({
            type: 'success',
            title: 'Invoice Reverted',
            message: response.data.message,
            showCancel: false,
            confirmText: 'OK',
          });
          
          // Reload data
          await loadAllData();
        } catch (error: any) {
          showModal({
            type: 'error',
            title: 'Revert Failed',
            message: error.response?.data?.error || 'Failed to revert invoice',
            showCancel: false,
            confirmText: 'OK',
          });
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const handleGenerateInvoice = (freelancerId: number, freelancerName: string) => {
    showModal({
      type: 'confirm',
      title: 'Generate Invoice',
      message: `Generate and pay invoice for ${freelancerName}?\n\nThis will download the invoice as CSV and PDF files.`,
      confirmText: 'Generate & Pay',
      onConfirm: async () => {
        try {
          setProcessing(true);
          const response = await invoicesApi.generateInvoice(freelancerId);
          
          // Download CSV
          downloadFile(response.data.csv, `invoice_${response.data.invoice.invoice_number}.csv`, 'text/csv');
          
          // Download PDF
          await downloadPDF(response.data.pdfHtml, `invoice_${response.data.invoice.invoice_number}.pdf`);
          
          showModal({
            type: 'success',
            title: 'Invoice Generated',
            message: `Invoice ${response.data.invoice.invoice_number} generated!\n\nTotal: $${response.data.invoice.total_amount}\n\nFiles have been downloaded.`,
            showCancel: false,
            confirmText: 'OK',
          });
          
          // Reload data
          setSelectedFreelancer(null);
          setPendingItems([]);
          await loadAllData();
        } catch (error: any) {
          showModal({
            type: 'error',
            title: 'Invoice Generation Failed',
            message: error.response?.data?.error || 'Failed to generate invoice',
            showCancel: false,
            confirmText: 'OK',
          });
        } finally {
          setProcessing(false);
        }
      },
    });
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const downloadPDF = async (htmlContent: string, filename: string) => {
    // Create an iframe to render the HTML properly
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.left = '-9999px';
    iframe.style.top = '0';
    iframe.style.width = '210mm';
    iframe.style.height = '297mm';
    document.body.appendChild(iframe);

    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!iframeDoc) {
      document.body.removeChild(iframe);
      return;
    }

    iframeDoc.open();
    iframeDoc.write(htmlContent);
    iframeDoc.close();

    // Wait for content to render
    await new Promise(resolve => setTimeout(resolve, 500));

    const options = {
      margin: 10,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, windowWidth: 800 },
      jsPDF: { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const }
    };

    try {
      await html2pdf().set(options).from(iframeDoc.body).save();
    } finally {
      document.body.removeChild(iframe);
    }
  };

  const totalPendingAmount = freelancers.reduce((sum, f) => sum + Number(f.pending_total || 0), 0);
  const totalPendingItems = freelancers.reduce((sum, f) => sum + Number(f.pending_items || 0), 0);
  const freelancersWithPending = freelancers.filter(f => f.pending_items > 0).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Confirm/Alert Modal */}
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice Management</h1>
        <p className="text-gray-600">Manage template creator invoices, add manual items, and process payments</p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-blue-700 font-medium">Template Creators</p>
              <p className="text-2xl font-bold text-blue-900">{freelancers.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500 rounded-lg">
              <Clock className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-amber-700 font-medium">With Pending</p>
              <p className="text-2xl font-bold text-amber-900">{freelancersWithPending}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-4 border border-violet-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-500 rounded-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-violet-700 font-medium">Pending Items</p>
              <p className="text-2xl font-bold text-violet-900">{totalPendingItems}</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-green-700 font-medium">Total Pending</p>
              <p className="text-2xl font-bold text-green-900">${totalPendingAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Freelancers List */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-gray-500" />
                Template Creators
              </h2>
              <p className="text-sm text-gray-500 mt-1">Select to view & manage pending items</p>
            </div>
            <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
              {freelancers.map(freelancer => (
                <button
                  key={freelancer.id}
                  onClick={() => loadPendingItems(freelancer)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                    selectedFreelancer?.id === freelancer.id ? 'bg-primary-50 border-l-4 border-primary-500' : ''
                  } ${!freelancer.is_active ? 'opacity-60' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                        freelancer.pending_items > 0 ? 'bg-amber-500' : 'bg-gray-400'
                      }`}>
                        {freelancer.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{freelancer.username}</p>
                        <p className="text-xs text-gray-500">@{freelancer.handle}</p>
                      </div>
                    </div>
                    {freelancer.pending_items > 0 ? (
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-600">${Number(freelancer.pending_total).toFixed(2)}</p>
                        <p className="text-xs text-gray-500">{freelancer.pending_items} items</p>
                      </div>
                    ) : (
                      <span className="text-xs px-2 py-1 bg-gray-100 text-gray-500 rounded">No pending</span>
                    )}
                  </div>
                </button>
              ))}
              {freelancers.length === 0 && (
                <p className="p-4 text-center text-gray-500">No template creators found</p>
              )}
            </div>
          </div>
        </div>

        {/* Selected Freelancer Details */}
        <div className="lg:col-span-2">
          {selectedFreelancer ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Freelancer Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-full bg-primary-500 flex items-center justify-center text-white text-xl font-bold">
                      {selectedFreelancer.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{selectedFreelancer.username}</h3>
                      <p className="text-sm text-gray-500">{selectedFreelancer.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowAddItemModal(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Item
                    </button>
                    {pendingItems.length > 0 && (
                      <button
                        onClick={() => handleGenerateInvoice(selectedFreelancer.id, selectedFreelancer.username)}
                        disabled={processing}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                      >
                        <Download className="w-4 h-4" />
                        Pay & Export
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Pending Items */}
              <div className="p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  Pending Items ({pendingItems.length})
                </h4>
                
                {pendingItems.length === 0 ? (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
                    <p className="text-gray-500">No pending items</p>
                    <button
                      onClick={() => setShowAddItemModal(true)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium"
                    >
                      + Add a manual item
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pendingItems.map(item => (
                      <div 
                        key={item.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${
                          item.is_manual 
                            ? 'bg-violet-50 border-violet-200' 
                            : 'bg-gray-50 border-gray-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {item.idea_id ? (
                            <Link 
                              to={`/ideas/${item.idea_id}`}
                              className="text-primary-600 hover:text-primary-700"
                              title="View template"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          ) : (
                            <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded font-medium">
                              Manual
                            </span>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {item.flow_name || item.idea_title || item.use_case}
                            </p>
                            <p className="text-xs text-gray-500">
                              {item.department && <span className="mr-2">{item.department}</span>}
                              {new Date(item.completed_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {editingItem?.id === item.id ? (
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400">$</span>
                              <input
                                type="number"
                                value={editingItem.amount}
                                onChange={(e) => setEditingItem({ ...editingItem, amount: parseFloat(e.target.value) || 0 })}
                                className="w-20 px-2 py-1 border rounded text-right text-sm"
                                step="0.01"
                              />
                              <button
                                onClick={handleUpdateItem}
                                disabled={processing}
                                className="p-1 text-green-600 hover:bg-green-100 rounded"
                              >
                                <Save className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingItem(null)}
                                className="p-1 text-gray-400 hover:bg-gray-100 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="font-bold text-green-600">
                                ${Number(item.amount).toFixed(2)}
                              </span>
                              <button
                                onClick={() => setEditingItem(item)}
                                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                title="Edit amount"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                                title="Delete item"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                    
                    {/* Total */}
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200 mt-4">
                      <span className="font-semibold text-green-800">Total</span>
                      <span className="text-xl font-bold text-green-700">
                        ${pendingItems.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center">
              <User className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Select a Template Creator</h3>
              <p className="text-gray-500">Choose a template creator from the list to view and manage their pending invoice items</p>
            </div>
          )}
        </div>
      </div>

      {/* Invoice History */}
      <div className="mt-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <button
            onClick={() => setExpandedSection(expandedSection === 'history' ? null : 'history')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              Recent Invoices ({invoiceHistory.length})
            </h2>
            {expandedSection === 'history' ? (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-400" />
            )}
          </button>
          
          {expandedSection === 'history' && (
            <div className="border-t border-gray-200">
              {invoiceHistory.length === 0 ? (
                <p className="text-gray-500 text-center py-8">No invoice history</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Invoice #</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Template Creator</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Period</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Paid</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">Amount</th>
                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {invoiceHistory.map(invoice => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-sm">{invoice.invoice_number}</td>
                          <td className="px-4 py-3">{invoice.freelancer_name}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-green-600">
                            ${Number(invoice.total_amount).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <button
                              onClick={() => handleRevertInvoice(invoice)}
                              disabled={processing}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-orange-700 bg-orange-100 hover:bg-orange-200 rounded-md transition-colors disabled:opacity-50"
                              title="Revert this invoice and move items back to pending"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              Revert
                            </button>
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
      </div>

      {/* Add Item Modal */}
      {showAddItemModal && selectedFreelancer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Add Manual Item</h3>
              <button
                onClick={() => setShowAddItemModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-violet-50 rounded-lg p-3 border border-violet-200">
                <p className="text-sm text-violet-700">
                  Adding item for <span className="font-semibold">{selectedFreelancer.username}</span>
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={newItem.description}
                  onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                  placeholder="e.g., Bonus, Extra work, Adjustment"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">$</span>
                  <input
                    type="number"
                    value={newItem.amount}
                    onChange={(e) => setNewItem({ ...newItem, amount: e.target.value })}
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <input
                    type="date"
                    value={newItem.completed_at}
                    onChange={(e) => setNewItem({ ...newItem, completed_at: e.target.value })}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-200 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowAddItemModal(false)}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManualItem}
                disabled={processing || !newItem.description || !newItem.amount}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {processing ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Add Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoiceManagement;
