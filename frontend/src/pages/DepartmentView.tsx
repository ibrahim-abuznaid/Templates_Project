import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { viewsApi } from '../services/api';
import type { DepartmentSummary, DepartmentTemplate } from '../types';
import { ArrowLeft, Loader, Package, CheckCircle, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const DepartmentView: React.FC = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<DepartmentSummary[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [templates, setTemplates] = useState<DepartmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templatesLoading, setTemplatesLoading] = useState(false);

  useEffect(() => {
    loadDepartments();
  }, []);

  const loadDepartments = async () => {
    try {
      setLoading(true);
      const response = await viewsApi.getDepartments();
      setDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDepartmentTemplates = async (department: string) => {
    try {
      setTemplatesLoading(true);
      const response = await viewsApi.getDepartmentTemplates(department);
      setTemplates(response.data);
      setSelectedDepartment(department);
    } catch (error) {
      console.error('Failed to load department templates:', error);
    } finally {
      setTemplatesLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (selectedDepartment) {
    const dept = departments.find(d => d.department === selectedDepartment);
    
    return (
      <div>
        <div className="mb-6">
          <button
            onClick={() => setSelectedDepartment(null)}
            className="flex items-center space-x-2 text-primary-600 hover:text-primary-700 transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back to Departments</span>
          </button>
          
          {dept && (
            <div className="card bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
              <div className="mb-4">
                <h2 className="text-3xl font-bold text-gray-900">{selectedDepartment} Department</h2>
                <p className="text-gray-600 mt-1">{dept.template_count} templates total</p>
              </div>
              
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-green-600 font-bold text-xl">{dept.published_count}</div>
                  <div className="text-xs text-gray-600">Published</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-yellow-600 font-bold text-xl">{dept.in_progress_count}</div>
                  <div className="text-xs text-gray-600">In Progress</div>
                </div>
                <div className="bg-white rounded-lg p-3 text-center">
                  <div className="text-blue-600 font-bold text-xl">{dept.new_count}</div>
                  <div className="text-xs text-gray-600">New</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {templatesLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader className="w-8 h-8 animate-spin text-primary-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-500">No templates found in this department.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {templates.map((template) => (
              <div 
                key={template.id} 
                onClick={() => navigate(`/ideas/${template.id}`)}
                className="card hover:shadow-lg transition-all cursor-pointer hover:border-primary-300 transform hover:-translate-y-1"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {template.use_case}
                      </h3>
                      <ExternalLink className="w-4 h-4 text-primary-600" />
                    </div>
                    {template.flow_name && (
                      <p className="text-sm text-gray-600 mb-2">{template.flow_name}</p>
                    )}
                    {template.short_description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{template.short_description}</p>
                    )}
                  </div>
                  <StatusBadge status={template.status} fixCount={template.fix_count} />
                </div>

                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                  {template.assigned_to && (
                    <div className="flex items-center space-x-1">
                      <Package className="w-4 h-4 text-blue-600" />
                      <span>Assigned to: <span className="font-medium">{template.assigned_to}</span></span>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span>Updated: {new Date(template.updated_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">View by Department</h1>
        <p className="text-gray-600">Click on a department to see all templates</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => (
          <div
            key={dept.department}
            onClick={() => loadDepartmentTemplates(dept.department)}
            className="card cursor-pointer hover:shadow-xl transition-all transform hover:-translate-y-1 bg-gradient-to-br from-white to-gray-50"
          >
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-2xl font-bold text-gray-900">{dept.department}</h2>
              <div className="bg-primary-100 text-primary-600 font-bold text-xl rounded-full w-12 h-12 flex items-center justify-center">
                {dept.template_count}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                </div>
                <div className="text-lg font-bold text-green-600">{dept.published_count}</div>
                <div className="text-xs text-gray-600">Published</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <Clock className="w-4 h-4 text-yellow-600" />
                </div>
                <div className="text-lg font-bold text-yellow-600">{dept.in_progress_count}</div>
                <div className="text-xs text-gray-600">In Progress</div>
              </div>
              
              <div className="text-center">
                <div className="flex items-center justify-center mb-1">
                  <AlertCircle className="w-4 h-4 text-blue-600" />
                </div>
                <div className="text-lg font-bold text-blue-600">{dept.new_count}</div>
                <div className="text-xs text-gray-600">New</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {departments.length === 0 && (
        <div className="card text-center py-12">
          <p className="text-gray-500">No departments found. Create some templates to get started!</p>
        </div>
      )}
    </div>
  );
};

export default DepartmentView;

