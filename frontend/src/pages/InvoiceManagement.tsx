import React, { useEffect, useState } from 'react';
import { invoicesApi } from '../services/api';
import type { PendingInvoiceSummary, Invoice, InvoiceItem } from '../types';
import { Download, Loader, User, CheckCircle, Clock } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const InvoiceManagement: React.FC = () => {
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoiceSummary[]>([]);
  const [selectedFreelancer, setSelectedFreelancer] = useState<number | null>(null);
  const [pendingItems, setPendingItems] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  
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
    loadPendingInvoices();
    loadInvoiceHistory();
  }, []);

  const loadPendingInvoices = async () => {
    try {
      setLoading(true);
      const response = await invoicesApi.getPending();
      setPendingInvoices(response.data);
    } catch (error) {
      console.error('Failed to load pending invoices:', error);
    } finally {
      setLoading(false);
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

  const loadPendingItems = async (freelancerId: number) => {
    try {
      const response = await invoicesApi.getPendingForFreelancer(freelancerId);
      setPendingItems(response.data.items);
      setSelectedFreelancer(freelancerId);
    } catch (error) {
      console.error('Failed to load pending items:', error);
    }
  };

  const handleGenerateInvoice = (freelancerId: number) => {
    showModal({
      type: 'confirm',
      title: 'Generate Invoice',
      message: 'Generate and pay this invoice?\n\nThis will create CSV and PDF files for download.',
      confirmText: 'Generate & Pay',
      onConfirm: async () => {
        try {
          setProcessing(true);
          const response = await invoicesApi.generateInvoice(freelancerId);
          
          // Download CSV
          downloadFile(response.data.csv, `invoice_${response.data.invoice.invoice_number}.csv`, 'text/csv');
          
          // Download PDF (as HTML first, can be printed to PDF)
          downloadFile(response.data.pdfHtml, `invoice_${response.data.invoice.invoice_number}.html`, 'text/html');
          
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
          loadPendingInvoices();
          loadInvoiceHistory();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
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

      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Invoice Management</h1>
        <p className="text-gray-600">Manage template creator invoices and payments</p>
      </div>

      {/* Pending Invoices */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-orange-500" />
          <span>Pending Invoices</span>
        </h2>

        {pendingInvoices.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No pending invoices</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingInvoices.map(invoice => (
              <div
                key={invoice.freelancer_id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => loadPendingItems(invoice.freelancer_id)}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <User className="w-5 h-5 text-gray-400" />
                    <span className="font-semibold text-gray-900">{invoice.freelancer_name}</span>
                  </div>
                  <span className="text-xs px-2 py-1 bg-orange-100 text-orange-700 rounded">
                    Pending
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Items:</span>
                    <span className="font-medium">{invoice.item_count}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total:</span>
                    <span className="font-bold text-green-600">${Number(invoice.total_amount).toFixed(2)}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGenerateInvoice(invoice.freelancer_id);
                  }}
                  disabled={processing}
                  className="w-full mt-4 btn-primary text-sm flex items-center justify-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Pay Now & Export</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Items Detail */}
      {selectedFreelancer && pendingItems.length > 0 && (
        <div className="card mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pending Items Detail</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Template</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Department</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Completed</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pendingItems.map(item => (
                  <tr key={item.id} className="border-t border-gray-200">
                    <td className="px-4 py-3">{item.flow_name || item.use_case}</td>
                    <td className="px-4 py-3">{item.department || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(item.completed_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">${item.amount.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span>Recent Invoices</span>
        </h2>

        {invoiceHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No invoice history</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Invoice #</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Template Creator</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Period</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Paid</th>
                  <th className="px-4 py-2 text-right text-sm font-medium text-gray-700">Amount</th>
                </tr>
              </thead>
              <tbody>
                {invoiceHistory.map(invoice => (
                  <tr key={invoice.id} className="border-t border-gray-200">
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default InvoiceManagement;

