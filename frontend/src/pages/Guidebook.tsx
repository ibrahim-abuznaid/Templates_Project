import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { guidebookApi } from '../services/api';
import type { GuidebookSection } from '../types';
import {
  Book,
  Workflow,
  FileText,
  AlignLeft,
  Clock,
  CheckSquare,
  BookOpen,
  ChevronDown,
  Edit3,
  Save,
  X,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RotateCcw,
  Sparkles,
  Check,
  Copy,
  AlertCircle,
  Loader2,
} from 'lucide-react';

// Icon mapping for sections
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Workflow,
  FileText,
  AlignLeft,
  Clock,
  CheckSquare,
  BookOpen,
  Book,
  Sparkles,
};

// Simple markdown-like renderer (handles basic formatting)
const renderContent = (content: string) => {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = '';
  let listItems: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="space-y-2 my-4 ml-4">
          {listItems.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-slate-600">
              <span className="text-emerald-500 mt-1.5">•</span>
              <span dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  const flushTable = () => {
    if (tableRows.length > 1) {
      const [header, ...body] = tableRows;
      elements.push(
        <div key={`table-${elements.length}`} className="my-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-50">
              <tr>
                {header.map((cell, i) => (
                  <th key={i} className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    {cell.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {body.filter(row => !row.every(cell => cell.match(/^[-|]+$/))).map((row, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  {row.map((cell, j) => (
                    <td key={j} className="px-4 py-3 text-sm text-slate-600">
                      {cell.trim()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  const formatInline = (text: string): string => {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-slate-800">$1</strong>')
      .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-slate-100 text-rose-600 rounded text-sm font-mono">$1</code>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-700 underline underline-offset-2">$1</a>')
      .replace(/✅/g, '<span class="text-emerald-500">✅</span>')
      .replace(/❌/g, '<span class="text-rose-500">❌</span>');
  };

  lines.forEach((line, lineIndex) => {
    // Handle code blocks
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <pre key={`code-${elements.length}`} className="my-4 p-4 bg-slate-900 text-slate-100 rounded-lg overflow-x-auto text-sm font-mono">
            <code>{codeContent.trim()}</code>
          </pre>
        );
        codeContent = '';
        inCodeBlock = false;
      } else {
        flushList();
        flushTable();
        inCodeBlock = true;
      }
      return;
    }

    if (inCodeBlock) {
      codeContent += line + '\n';
      return;
    }

    // Handle tables
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushList();
      if (!inTable) inTable = true;
      const cells = line.split('|').filter(cell => cell.trim() !== '');
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable();
    }

    // Handle headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3 key={`h3-${lineIndex}`} className="text-lg font-semibold text-slate-800 mt-6 mb-3 flex items-center gap-2">
          <span className="w-1 h-5 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full" />
          {line.slice(4)}
        </h3>
      );
      return;
    }

    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2 key={`h2-${lineIndex}`} className="text-xl font-bold text-slate-800 mt-8 mb-4">
          {line.slice(3)}
        </h2>
      );
      return;
    }

    // Handle list items
    if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
      listItems.push(line.trim().slice(2));
      return;
    }

    // Handle numbered lists
    if (line.trim().match(/^\d+\.\s/)) {
      flushList();
      const match = line.trim().match(/^(\d+)\.\s(.+)$/);
      if (match) {
        elements.push(
          <div key={`num-${lineIndex}`} className="flex items-start gap-3 my-2 ml-4">
            <span className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
              {match[1]}
            </span>
            <span className="text-slate-600 pt-0.5" dangerouslySetInnerHTML={{ __html: formatInline(match[2]) }} />
          </div>
        );
      }
      return;
    }

    // Handle empty lines
    if (line.trim() === '') {
      flushList();
      return;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p key={`p-${lineIndex}`} className="text-slate-600 leading-relaxed my-3" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
    );
  });

  flushList();
  flushTable();

  return elements;
};

const Guidebook: React.FC = () => {
  const { isAdmin } = useAuth();
  const [sections, setSections] = useState<GuidebookSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [editMode, setEditMode] = useState(false);
  const [editingSection, setEditingSection] = useState<GuidebookSection | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [checkedItems, setCheckedItems] = useState<Record<string, Set<number>>>({});
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    fetchSections();
  }, []);

  // Set first section as active on load
  useEffect(() => {
    if (sections.length > 0 && !activeSection) {
      setActiveSection(sections[0].slug);
      setExpandedSections(new Set([sections[0].slug]));
    }
  }, [sections]);

  const fetchSections = async () => {
    try {
      setLoading(true);
      const response = await guidebookApi.getAll(isAdmin);
      setSections(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load guidebook');
    } finally {
      setLoading(false);
    }
  };

  const scrollToSection = (slug: string) => {
    setActiveSection(slug);
    setExpandedSections(prev => new Set([...prev, slug]));
    sectionRefs.current[slug]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const toggleSection = (slug: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(slug)) {
        newSet.delete(slug);
      } else {
        newSet.add(slug);
      }
      return newSet;
    });
    setActiveSection(slug);
  };

  const handleCheckItem = (sectionSlug: string, index: number) => {
    setCheckedItems(prev => {
      const sectionChecked = new Set(prev[sectionSlug] || []);
      if (sectionChecked.has(index)) {
        sectionChecked.delete(index);
      } else {
        sectionChecked.add(index);
      }
      return { ...prev, [sectionSlug]: sectionChecked };
    });
  };

  const handleSaveSection = async (section: GuidebookSection) => {
    try {
      setSaving(true);
      await guidebookApi.update(section.id, {
        title: section.title,
        icon: section.icon || undefined,
        content: section.content,
        checklist_items: section.checklist_items,
        is_active: section.is_active,
      });
      await fetchSections();
      setEditingSection(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save section');
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = async (data: Partial<GuidebookSection>) => {
    try {
      setSaving(true);
      await guidebookApi.create({
        slug: data.slug || '',
        title: data.title || '',
        icon: data.icon || undefined,
        content: data.content || '',
        checklist_items: data.checklist_items || undefined,
        display_order: sections.length + 1,
        is_active: true,
      });
      await fetchSections();
      setShowAddForm(false);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create section');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSection = async (id: number) => {
    if (!confirm('Are you sure you want to delete this section?')) return;
    try {
      await guidebookApi.delete(id);
      await fetchSections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete section');
    }
  };

  const handleToggleVisibility = async (section: GuidebookSection) => {
    try {
      await guidebookApi.update(section.id, { is_active: !section.is_active });
      await fetchSections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update section');
    }
  };

  const handleResetToDefaults = async () => {
    if (!confirm('This will delete all custom sections and restore defaults. Are you sure?')) return;
    try {
      await guidebookApi.resetToDefaults();
      await fetchSections();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reset guidebook');
    }
  };

  const copyAllChecklists = (slug: string) => {
    const section = sections.find(s => s.slug === slug);
    if (!section?.checklist_items) return;
    
    const text = section.checklist_items.map(item => `☐ ${item}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedSection(slug);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const getIcon = (iconName: string | null) => {
    const IconComponent = ICON_MAP[iconName || 'Book'] || Book;
    return IconComponent;
  };

  const getProgress = (slug: string, total: number) => {
    const checked = checkedItems[slug]?.size || 0;
    return Math.round((checked / total) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-indigo-500 animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading guidebook...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">{error}</p>
          <button onClick={fetchSections} className="btn-primary">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen -mt-8 -mx-4 sm:-mx-6 lg:-mx-8">
      {/* Hero Header */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 text-white overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }} />
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-10 left-10 w-32 h-32 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 right-20 w-48 h-48 bg-purple-400/10 rounded-full blur-3xl" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                  <Book className="w-8 h-8" />
                </div>
                <span className="px-3 py-1 bg-white/10 backdrop-blur-sm rounded-full text-sm font-medium">
                  Best Practices
                </span>
              </div>
              <h1 className="text-4xl font-bold mb-3">Template Builder Guidebook</h1>
              <p className="text-lg text-white/80 max-w-2xl">
                Your comprehensive guide to building high-quality, consistent ActivePieces templates. 
                Follow these guidelines to ensure your templates meet our standards.
              </p>
            </div>
            
            {isAdmin && (
              <div className="hidden lg:flex items-center gap-2">
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    editMode 
                      ? 'bg-white text-indigo-600' 
                      : 'bg-white/10 text-white hover:bg-white/20'
                  }`}
                >
                  {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
                  {editMode ? 'View Mode' : 'Edit Mode'}
                </button>
                {editMode && (
                  <button
                    onClick={handleResetToDefaults}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium bg-white/10 text-white hover:bg-white/20 transition-all"
                    title="Reset to defaults"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-24">
              <nav className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4 px-3">
                  Contents
                </h3>
                <ul className="space-y-1">
                  {sections.filter(s => editMode || s.is_active).map((section) => {
                    const IconComponent = getIcon(section.icon);
                    const isActive = activeSection === section.slug;
                    
                    return (
                      <li key={section.slug}>
                        <button
                          onClick={() => scrollToSection(section.slug)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 group ${
                            isActive
                              ? 'bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-700'
                              : 'text-slate-600 hover:bg-slate-50'
                          } ${!section.is_active ? 'opacity-50' : ''}`}
                        >
                          <span className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            isActive 
                              ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200' 
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                          }`}>
                            <IconComponent className="w-4 h-4" />
                          </span>
                          <span className="font-medium text-sm flex-1 truncate">{section.title.split('—')[0].trim()}</span>
                          {section.checklist_items && section.checklist_items.length > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              isActive ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {checkedItems[section.slug]?.size || 0}/{section.checklist_items.length}
                            </span>
                          )}
                          {!section.is_active && <EyeOff className="w-4 h-4 text-slate-400" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                
                {editMode && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span className="font-medium text-sm">Add Section</span>
                  </button>
                )}
              </nav>
              
              {/* Quick Stats */}
              <div className="mt-4 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span className="text-sm font-semibold text-emerald-800">Quick Reference</span>
                </div>
                <ul className="space-y-2 text-sm text-emerald-700">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5" />
                    <span>{sections.length} sections total</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>{sections.reduce((acc, s) => acc + (s.checklist_items?.length || 0), 0)} checklist items</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            {/* Mobile Section Selector */}
            <div className="lg:hidden mb-6">
              <select
                value={activeSection || ''}
                onChange={(e) => scrollToSection(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {sections.filter(s => editMode || s.is_active).map(section => (
                  <option key={section.slug} value={section.slug}>
                    {section.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Sections */}
            <div className="space-y-6">
              {sections.filter(s => editMode || s.is_active).map((section) => {
                const IconComponent = getIcon(section.icon);
                const isExpanded = expandedSections.has(section.slug);
                const isEditing = editingSection?.id === section.id;
                
                return (
                  <div
                    key={section.id}
                    ref={el => sectionRefs.current[section.slug] = el}
                    className={`bg-white rounded-2xl shadow-sm border transition-all duration-300 scroll-mt-24 ${
                      activeSection === section.slug 
                        ? 'border-indigo-200 shadow-md shadow-indigo-100/50' 
                        : 'border-slate-100 hover:shadow-md'
                    } ${!section.is_active ? 'opacity-60' : ''}`}
                  >
                    {/* Section Header */}
                    <button
                      onClick={() => !isEditing && toggleSection(section.slug)}
                      className="w-full px-6 py-5 flex items-center gap-4 text-left"
                      disabled={isEditing}
                    >
                      <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                        isExpanded
                          ? 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-lg shadow-indigo-200'
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        <IconComponent className="w-6 h-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h2 className="text-lg font-semibold text-slate-800 truncate">
                          {section.title}
                        </h2>
                        {section.checklist_items && section.checklist_items.length > 0 && (
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex-1 max-w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-emerald-400 to-teal-400 transition-all duration-500"
                                style={{ width: `${getProgress(section.slug, section.checklist_items.length)}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500">
                              {checkedItems[section.slug]?.size || 0}/{section.checklist_items.length} complete
                            </span>
                          </div>
                        )}
                      </div>
                      
                      {editMode && (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleVisibility(section)}
                            className={`p-2 rounded-lg transition-all ${
                              section.is_active 
                                ? 'text-slate-400 hover:text-slate-600 hover:bg-slate-100' 
                                : 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                            }`}
                            title={section.is_active ? 'Hide section' : 'Show section'}
                          >
                            {section.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => setEditingSection(section)}
                            className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                            title="Edit section"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteSection(section.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                            title="Delete section"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                      
                      <ChevronDown
                        className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {/* Section Content */}
                    {isExpanded && (
                      <div className="px-6 pb-6 animate-fade-in">
                        <div className="border-t border-slate-100 pt-6">
                          {isEditing ? (
                            <SectionEditor
                              section={editingSection!}
                              onSave={handleSaveSection}
                              onCancel={() => setEditingSection(null)}
                              saving={saving}
                            />
                          ) : (
                            <>
                              {/* Rendered Content */}
                              <div className="prose prose-slate max-w-none">
                                {renderContent(section.content)}
                              </div>

                              {/* Checklist */}
                              {section.checklist_items && section.checklist_items.length > 0 && (
                                <div className="mt-8 p-5 bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-xl border border-slate-200">
                                  <div className="flex items-center justify-between mb-4">
                                    <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                                      <CheckSquare className="w-5 h-5 text-indigo-500" />
                                      Checklist
                                    </h4>
                                    <button
                                      onClick={() => copyAllChecklists(section.slug)}
                                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                    >
                                      {copiedSection === section.slug ? (
                                        <>
                                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                                          <span className="text-emerald-600">Copied!</span>
                                        </>
                                      ) : (
                                        <>
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>Copy all</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                  <ul className="space-y-2">
                                    {section.checklist_items.map((item, index) => {
                                      const isChecked = checkedItems[section.slug]?.has(index);
                                      return (
                                        <li key={index}>
                                          <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                                            isChecked 
                                              ? 'bg-emerald-50 border border-emerald-200' 
                                              : 'bg-white border border-slate-200 hover:border-indigo-200'
                                          }`}>
                                            <div className="relative flex-shrink-0 mt-0.5">
                                              <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleCheckItem(section.slug, index)}
                                                className="sr-only"
                                              />
                                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                                                isChecked 
                                                  ? 'bg-emerald-500 border-emerald-500' 
                                                  : 'border-slate-300 hover:border-indigo-400'
                                              }`}>
                                                {isChecked && <Check className="w-3 h-3 text-white" />}
                                              </div>
                                            </div>
                                            <span className={`text-sm transition-all ${
                                              isChecked ? 'text-emerald-700 line-through' : 'text-slate-600'
                                            }`}>
                                              {item}
                                            </span>
                                          </label>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Add Section Modal */}
      {showAddForm && (
        <AddSectionModal
          onSave={handleAddSection}
          onCancel={() => setShowAddForm(false)}
          saving={saving}
        />
      )}
    </div>
  );
};

// Section Editor Component
const SectionEditor: React.FC<{
  section: GuidebookSection;
  onSave: (section: GuidebookSection) => void;
  onCancel: () => void;
  saving: boolean;
}> = ({ section, onSave, onCancel, saving }) => {
  const [editedSection, setEditedSection] = useState(section);
  const [checklistText, setChecklistText] = useState(
    section.checklist_items?.join('\n') || ''
  );

  const handleSave = () => {
    const checklist_items = checklistText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    onSave({
      ...editedSection,
      checklist_items: checklist_items.length > 0 ? checklist_items : null,
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
        <input
          type="text"
          value={editedSection.title}
          onChange={e => setEditedSection({ ...editedSection, title: e.target.value })}
          className="input-field"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
        <select
          value={editedSection.icon || 'Book'}
          onChange={e => setEditedSection({ ...editedSection, icon: e.target.value })}
          className="input-field"
        >
          {Object.keys(ICON_MAP).map(icon => (
            <option key={icon} value={icon}>{icon}</option>
          ))}
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Content (Markdown supported)
        </label>
        <textarea
          value={editedSection.content}
          onChange={e => setEditedSection({ ...editedSection, content: e.target.value })}
          rows={15}
          className="input-field font-mono text-sm"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Checklist Items (one per line)
        </label>
        <textarea
          value={checklistText}
          onChange={e => setChecklistText(e.target.value)}
          rows={5}
          placeholder="Enter checklist items, one per line..."
          className="input-field font-mono text-sm"
        />
      </div>
      
      <div className="flex items-center gap-3 pt-4">
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-primary flex items-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
        <button onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>
    </div>
  );
};

// Add Section Modal
const AddSectionModal: React.FC<{
  onSave: (data: Partial<GuidebookSection>) => void;
  onCancel: () => void;
  saving: boolean;
}> = ({ onSave, onCancel, saving }) => {
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    icon: 'Book',
    content: '',
    checklistText: '',
  });

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const handleSave = () => {
    const checklist_items = formData.checklistText
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);
    
    onSave({
      title: formData.title,
      slug: formData.slug,
      icon: formData.icon,
      content: formData.content,
      checklist_items: checklist_items.length > 0 ? checklist_items : undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">Add New Section</h2>
          <button onClick={onCancel} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g., Error Handling Guidelines"
              className="input-field"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">URL Slug</label>
            <input
              type="text"
              value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value })}
              placeholder="error-handling-guidelines"
              className="input-field"
            />
            <p className="text-xs text-slate-500 mt-1">Auto-generated from title, can be customized</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Icon</label>
            <select
              value={formData.icon}
              onChange={e => setFormData({ ...formData, icon: e.target.value })}
              className="input-field"
            >
              {Object.keys(ICON_MAP).map(icon => (
                <option key={icon} value={icon}>{icon}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Content (Markdown) *</label>
            <textarea
              value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })}
              rows={10}
              placeholder="### Section Header&#10;&#10;Your content here with **bold** and `code` formatting..."
              className="input-field font-mono text-sm"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Checklist Items (optional, one per line)
            </label>
            <textarea
              value={formData.checklistText}
              onChange={e => setFormData({ ...formData, checklistText: e.target.value })}
              rows={4}
              placeholder="First checklist item&#10;Second checklist item"
              className="input-field font-mono text-sm"
            />
          </div>
        </div>
        
        <div className="sticky bottom-0 bg-white border-t border-slate-100 px-6 py-4 flex items-center justify-end gap-3">
          <button onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !formData.title || !formData.content}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add Section
          </button>
        </div>
      </div>
    </div>
  );
};

export default Guidebook;

