import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ideasApi, departmentsApi } from '../services/api';
import type { Department, User } from '../types';
import { 
  Zap, 
  Upload, 
  X, 
  ChevronDown, 
  CheckCircle, 
  AlertCircle,
  FileJson,
  Loader
} from 'lucide-react';

// Format normalization helpers
const normalizeCostPerYear = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (/^\$[\d,]+\/year$/i.test(trimmed)) return trimmed;
  const numericMatch = trimmed.replace(/,/g, '').match(/[\d.]+/);
  if (!numericMatch) return value;
  const numericValue = parseFloat(numericMatch[0]);
  if (isNaN(numericValue)) return value;
  const formattedNumber = numericValue.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `$${formattedNumber}/year`;
};

const normalizeTimeSavePerWeek = (value: string): string => {
  if (!value || typeof value !== 'string') return value;
  const trimmed = value.trim().toLowerCase();
  if (/^[\d.]+\s+(hours?|minutes?)$/i.test(trimmed)) {
    const match = trimmed.match(/^([\d.]+)\s*(hours?|minutes?)$/i);
    if (match) {
      const num = match[1];
      const unit = match[2].toLowerCase();
      const normalizedUnit = unit.startsWith('hour') 
        ? (parseFloat(num) === 1 ? 'hour' : 'hours')
        : (parseFloat(num) === 1 ? 'minute' : 'minutes');
      return `${num} ${normalizedUnit}`;
    }
  }
  const numericMatch = trimmed.match(/^([\d.]+)/);
  if (!numericMatch) return value;
  const numericValue = parseFloat(numericMatch[1]);
  if (isNaN(numericValue)) return value;
  const isMinutes = /min|m$|mins/i.test(trimmed);
  if (isMinutes) {
    return `${numericValue} ${numericValue === 1 ? 'minute' : 'minutes'}`;
  }
  return `${numericValue} ${numericValue === 1 ? 'hour' : 'hours'}`;
};

const QuickPublish: React.FC = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Loading state reserved for future use
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    ideaId?: number;
    publishedToLibrary?: boolean;
  } | null>(null);
  
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [freelancers, setFreelancers] = useState<User[]>([]);
  const [selectedDepartmentIds, setSelectedDepartmentIds] = useState<number[]>([]);
  const [showDeptDropdown, setShowDeptDropdown] = useState(false);
  
  const [formData, setFormData] = useState({
    flow_name: '',
    summary: '',
    description: '',
    time_save_per_week: '',
    cost_per_year: '',
    author: 'Activepieces Team',
    idea_notes: '',
    scribe_url: '',
    reviewer_name: '',
    price: '',
    assigned_to: '',
  });
  
  const [flowJson, setFlowJson] = useState<string | null>(null);
  const [flowFileName, setFlowFileName] = useState<string>('');
  const [flowCount, setFlowCount] = useState<number>(0);
  const [flowError, setFlowError] = useState<string>('');

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    loadDepartments();
    loadFreelancers();
  }, [isAdmin, navigate]);

  const loadDepartments = async () => {
    try {
      const response = await departmentsApi.getAll();
      setAllDepartments(response.data);
    } catch (error) {
      console.error('Failed to load departments:', error);
    }
  };

  const loadFreelancers = async () => {
    try {
      const response = await ideasApi.getFreelancers();
      setFreelancers(response.data);
    } catch (error) {
      console.error('Failed to load freelancers:', error);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFlowError('');
    setFlowFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        
        // Validate that it has a flows array
        if (!parsed.flows || !Array.isArray(parsed.flows)) {
          setFlowError('Invalid file format. File must contain a "flows" array. Export your flow from Activepieces using the template export option.');
          setFlowJson(null);
          setFlowCount(0);
          return;
        }
        
        setFlowJson(content);
        setFlowCount(parsed.flows.length);
        
        // Auto-fill name if empty
        if (!formData.flow_name && parsed.name) {
          setFormData(prev => ({ ...prev, flow_name: parsed.name }));
        }
        // Auto-fill summary if empty
        if (!formData.summary && parsed.summary) {
          setFormData(prev => ({ ...prev, summary: parsed.summary }));
        }
        // Auto-fill description if empty
        if (!formData.description && parsed.description) {
          setFormData(prev => ({ ...prev, description: parsed.description }));
        }
        // Auto-fill author if different
        if (parsed.author && parsed.author !== 'Activepieces Team') {
          setFormData(prev => ({ ...prev, author: parsed.author }));
        }
      } catch (err) {
        setFlowError('Invalid JSON file');
        setFlowJson(null);
        setFlowCount(0);
      }
    };
    reader.readAsText(file);
  };

  const removeFile = () => {
    setFlowJson(null);
    setFlowFileName('');
    setFlowCount(0);
    setFlowError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!flowJson) {
      setFlowError('Please upload a flow JSON file');
      return;
    }
    
    if (selectedDepartmentIds.length === 0) {
      return;
    }

    setPublishing(true);
    setResult(null);

    try {
      const response = await ideasApi.quickPublish({
        flow_name: formData.flow_name,
        summary: formData.summary,
        description: formData.description,
        department_ids: selectedDepartmentIds,
        time_save_per_week: formData.time_save_per_week,
        cost_per_year: formData.cost_per_year,
        author: formData.author,
        idea_notes: formData.idea_notes,
        scribe_url: formData.scribe_url,
        reviewer_name: formData.reviewer_name,
        price: parseFloat(formData.price) || 0,
        assigned_to: formData.assigned_to ? parseInt(formData.assigned_to) : undefined,
        flow_json: flowJson,
      });

      const data = response.data;
      
      setResult({
        success: true,
        message: data._publishedToLibrary 
          ? `Template "${data.flow_name}" published successfully to the Public Library!`
          : `Template "${data.flow_name}" created but failed to publish to Public Library: ${data._publishError}`,
        ideaId: data.id,
        publishedToLibrary: data._publishedToLibrary,
      });

      // Reset form for next template
      setFormData({
        flow_name: '',
        summary: '',
        description: '',
        time_save_per_week: '',
        cost_per_year: '',
        author: 'Activepieces Team',
        idea_notes: '',
        scribe_url: '',
        reviewer_name: '',
        price: '',
        assigned_to: '',
      });
      setSelectedDepartmentIds([]);
      removeFile();
      
    } catch (error: any) {
      console.error('Quick publish error:', error);
      setResult({
        success: false,
        message: error.response?.data?.error || 'Failed to publish template',
      });
    } finally {
      setPublishing(false);
    }
  };

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-amber-400 to-orange-500 rounded-xl shadow-lg">
            <Zap className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Quick Publish</h1>
        </div>
        <p className="text-gray-600">
          Quickly publish templates directly to the Public Library. This page is designed for importing 
          existing templates from external sources like Notion.
        </p>
      </div>

      {/* Result Banner */}
      {result && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
          result.success && result.publishedToLibrary
            ? 'bg-green-50 border border-green-200'
            : result.success
            ? 'bg-yellow-50 border border-yellow-200'
            : 'bg-red-50 border border-red-200'
        }`}>
          {result.success && result.publishedToLibrary ? (
            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
              result.success ? 'text-yellow-600' : 'text-red-600'
            }`} />
          )}
          <div className="flex-1">
            <p className={`font-medium ${
              result.success && result.publishedToLibrary
                ? 'text-green-800'
                : result.success
                ? 'text-yellow-800'
                : 'text-red-800'
            }`}>
              {result.message}
            </p>
            {result.ideaId && (
              <button
                onClick={() => navigate(`/ideas/${result.ideaId}`)}
                className="text-sm text-primary-600 hover:text-primary-700 mt-1"
              >
                View Template →
              </button>
            )}
          </div>
          <button onClick={() => setResult(null)} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="card">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-5">
            {/* Flow JSON Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Flow JSON File *
              </label>
              <div 
                className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
                  flowJson 
                    ? 'border-green-300 bg-green-50' 
                    : flowError 
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-primary-400 hover:bg-primary-50'
                }`}
              >
                {flowJson ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileJson className="w-8 h-8 text-green-600" />
                    <div className="text-left">
                      <p className="font-medium text-green-800">{flowFileName}</p>
                      <p className="text-sm text-green-600">{flowCount} flow(s) detected</p>
                    </div>
                    <button
                      type="button"
                      onClick={removeFile}
                      className="p-1 hover:bg-green-100 rounded-full"
                    >
                      <X className="w-5 h-5 text-green-600" />
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="flow-json-upload"
                    />
                    <label htmlFor="flow-json-upload" className="cursor-pointer">
                      <Upload className={`w-10 h-10 mx-auto mb-2 ${flowError ? 'text-red-400' : 'text-gray-400'}`} />
                      <p className={`font-medium ${flowError ? 'text-red-700' : 'text-gray-700'}`}>
                        Click to upload flow JSON
                      </p>
                      <p className="text-sm text-gray-500 mt-1">
                        Export your template from Activepieces
                      </p>
                    </label>
                  </>
                )}
              </div>
              {flowError && (
                <p className="text-sm text-red-600 mt-2">{flowError}</p>
              )}
            </div>

            {/* Flow Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Flow Name *
              </label>
              <input
                type="text"
                value={formData.flow_name}
                onChange={(e) => setFormData({ ...formData, flow_name: e.target.value })}
                className="input-field"
                placeholder="e.g., Instant Message Alerts"
                required
              />
            </div>

            {/* Summary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Summary
              </label>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="input-field"
                rows={2}
                placeholder="Brief summary for public library"
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="input-field"
                rows={3}
                placeholder="Detailed description"
              />
            </div>

            {/* Scribe URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Scribe URL (Article/Blog URL)
              </label>
              <input
                type="url"
                value={formData.scribe_url}
                onChange={(e) => setFormData({ ...formData, scribe_url: e.target.value })}
                className="input-field"
                placeholder="https://..."
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Departments */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Departments *
              </label>
              <button
                type="button"
                onClick={() => setShowDeptDropdown(!showDeptDropdown)}
                className="input-field w-full text-left flex items-center justify-between"
              >
                <span className={selectedDepartmentIds.length === 0 ? 'text-gray-400' : 'text-gray-900'}>
                  {selectedDepartmentIds.length === 0 
                    ? 'Select departments...' 
                    : `${selectedDepartmentIds.length} selected`}
                </span>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDeptDropdown ? 'rotate-180' : ''}`} />
              </button>
              
              {selectedDepartmentIds.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedDepartmentIds.map(id => {
                    const dept = allDepartments.find(d => d.id === id);
                    return dept ? (
                      <span 
                        key={id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 text-primary-700 rounded text-xs"
                      >
                        {dept.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDepartmentIds(selectedDepartmentIds.filter(dId => dId !== id));
                          }}
                          className="hover:text-primary-900"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {showDeptDropdown && (
                <>
                  {/* Click outside overlay */}
                  <div 
                    className="fixed inset-0 z-[5]" 
                    onClick={() => setShowDeptDropdown(false)}
                  />
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {allDepartments.map((dept) => (
                      <label
                        key={dept.id}
                        className="flex items-center px-3 py-2 hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDepartmentIds.includes(dept.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDepartmentIds([...selectedDepartmentIds, dept.id]);
                            } else {
                              setSelectedDepartmentIds(selectedDepartmentIds.filter(id => id !== dept.id));
                            }
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-2"
                        />
                        <span className="text-sm text-gray-700">{dept.name}</span>
                      </label>
                    ))}
                  </div>
                </>
              )}
              
              {selectedDepartmentIds.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Select at least one department</p>
              )}
            </div>

            {/* Time Save & Cost */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Save / Week
                </label>
                <input
                  type="text"
                  value={formData.time_save_per_week}
                  onChange={(e) => setFormData({ ...formData, time_save_per_week: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, time_save_per_week: normalizeTimeSavePerWeek(e.target.value) })}
                  className="input-field"
                  placeholder="e.g., 2 hours"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-formats to "X hours" or "X minutes"</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost Savings / Year
                </label>
                <input
                  type="text"
                  value={formData.cost_per_year}
                  onChange={(e) => setFormData({ ...formData, cost_per_year: e.target.value })}
                  onBlur={(e) => setFormData({ ...formData, cost_per_year: normalizeCostPerYear(e.target.value) })}
                  className="input-field"
                  placeholder="e.g., $150/year"
                />
                <p className="text-xs text-gray-400 mt-1">Auto-formats to "$X/year"</p>
              </div>
            </div>

            {/* Author */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Author <span className="text-xs text-gray-500">(for Public Library)</span>
              </label>
              <input
                type="text"
                value={formData.author}
                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                className="input-field"
                placeholder="Activepieces Team"
              />
            </div>

            {/* Assigned To (Template Creator) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Assigned To <span className="text-xs text-gray-500">(Template Creator)</span>
              </label>
              <select
                value={formData.assigned_to}
                onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
                className="input-field"
              >
                <option value="">Not assigned</option>
                {freelancers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.username} ({user.email})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Who created this template (different from Author in Public Library)
              </p>
            </div>

            {/* Internal Fields Section */}
            <div className="border-t pt-4">
              <p className="text-xs text-gray-500 mb-3 font-medium">Internal Fields (not sent to Public Library)</p>
              
              {/* Idea Notes */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Idea Notes
                </label>
                <textarea
                  value={formData.idea_notes}
                  onChange={(e) => setFormData({ ...formData, idea_notes: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder="Internal notes about the template idea..."
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reviewer
                  </label>
                  <input
                    type="text"
                    value={formData.reviewer_name}
                    onChange={(e) => setFormData({ ...formData, reviewer_name: e.target.value })}
                    className="input-field"
                    placeholder="Reviewer name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Price ($)
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="input-field"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Template will be created with <span className="font-medium text-green-600">Published</span> status 
              and sent to the Public Library.
            </p>
            <button
              type="submit"
              disabled={publishing || !flowJson || selectedDepartmentIds.length === 0 || !formData.flow_name}
              className="btn-primary flex items-center gap-2 px-6"
            >
              {publishing ? (
                <>
                  <Loader className="w-5 h-5 animate-spin" />
                  Publishing...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Publish Template
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default QuickPublish;

