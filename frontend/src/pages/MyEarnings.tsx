import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { invoicesApi } from '../services/api';
import type { InvoiceItem, Invoice } from '../types';
import { DollarSign, Clock, CheckCircle, Calendar, TrendingUp, Loader } from 'lucide-react';

const MyEarnings: React.FC = () => {
  const { user } = useAuth();
  const [pendingItems, setPendingItems] = useState<InvoiceItem[]>([]);
  const [pendingSummary, setPendingSummary] = useState<any>(null);
  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadPendingWork();
      loadInvoiceHistory();
    }
  }, [user]);

  const loadPendingWork = async () => {
    try {
      setLoading(true);
      const response = await invoicesApi.getPendingForFreelancer(user!.id);
      setPendingItems(response.data.items);
      setPendingSummary(response.data.summary);
    } catch (error) {
      console.error('Failed to load pending work:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceHistory = async () => {
    try {
      const response = await invoicesApi.getHistory(user!.id, 10);
      setInvoiceHistory(response.data);
    } catch (error) {
      console.error('Failed to load invoice history:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  const totalEarned = invoiceHistory.reduce((sum, inv) => sum + inv.total_amount, 0);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Earnings</h1>
        <p className="text-gray-600">Track your completed work and payments</p>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700 mb-1">Pending Payment</p>
              <p className="text-3xl font-bold text-orange-900">
                ${pendingSummary?.total_amount ? Number(pendingSummary.total_amount).toFixed(2) : '0.00'}
              </p>
              <p className="text-xs text-orange-600 mt-1">
                {pendingSummary?.item_count || 0} templates
              </p>
            </div>
            <Clock className="w-12 h-12 text-orange-400" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-700 mb-1">Total Earned</p>
              <p className="text-3xl font-bold text-green-900">${Number(totalEarned).toFixed(2)}</p>
              <p className="text-xs text-green-600 mt-1">
                {invoiceHistory.length} invoices paid
              </p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
        </div>

        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 mb-1">Average per Template</p>
              <p className="text-3xl font-bold text-blue-900">
                ${pendingSummary?.item_count > 0
                  ? (Number(pendingSummary.total_amount) / pendingSummary.item_count).toFixed(2)
                  : '0.00'}
              </p>
              <p className="text-xs text-blue-600 mt-1">Current period</p>
            </div>
            <TrendingUp className="w-12 h-12 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Pending Work */}
      <div className="card mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-orange-500" />
          <span>Pending Payment ({pendingItems.length})</span>
        </h2>

        {pendingItems.length === 0 ? (
          <div className="text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No pending work</p>
            <p className="text-sm text-gray-400 mt-1">Complete and submit templates to start earning!</p>
          </div>
        ) : (
          <>
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
                      <td className="px-4 py-3">
                        {item.department && (
                          <span className="px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs">
                            {item.department}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(item.completed_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        ${Number(item.amount).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 font-bold">
                    <td colSpan={3} className="px-4 py-3 text-right">Total Pending:</td>
                    <td className="px-4 py-3 text-right text-lg text-green-600">
                      ${pendingSummary?.total_amount ? Number(pendingSummary.total_amount).toFixed(2) : '0.00'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>💡 Note:</strong> These earnings will be paid on the next invoice cycle. 
                Invoices are typically processed at the beginning of each month by the admin.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Payment History */}
      <div className="card">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          <span>Payment History</span>
        </h2>

        {invoiceHistory.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No payment history yet</p>
        ) : (
          <div className="space-y-4">
            {invoiceHistory.map(invoice => (
              <div
                key={invoice.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="font-mono text-sm text-gray-600">{invoice.invoice_number}</span>
                    <div className="flex items-center space-x-2 mt-1">
                      <Calendar className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {new Date(invoice.period_start).toLocaleDateString()} - {new Date(invoice.period_end).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">
                      ${Number(invoice.total_amount).toFixed(2)}
                    </div>
                    <span className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded">
                      Paid
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Paid on {invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString() : 'N/A'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MyEarnings;

