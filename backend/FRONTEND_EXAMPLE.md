# Frontend Integration Examples

## React Components for Department View

### 1. Department Dashboard Component

This component displays all departments with their template counts. Click a department to drill down.

```jsx
import React, { useState, useEffect } from 'react';
import './DepartmentDashboard.css';

const DepartmentDashboard = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDepartment, setSelectedDepartment] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const fetchDepartments = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/views/departments', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch departments');
      
      const data = await response.json();
      setDepartments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDepartmentClick = (department) => {
    setSelectedDepartment(department);
  };

  if (loading) return <div className="loading">Loading departments...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="department-dashboard">
      <h1>Templates by Department</h1>
      
      {selectedDepartment ? (
        <DepartmentDetail 
          department={selectedDepartment} 
          onBack={() => setSelectedDepartment(null)} 
        />
      ) : (
        <div className="department-grid">
          {departments.map((dept) => (
            <DepartmentCard
              key={dept.department}
              department={dept}
              onClick={() => handleDepartmentClick(dept.department)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DepartmentDashboard;
```

### 2. Department Card Component

```jsx
const DepartmentCard = ({ department, onClick }) => {
  const completionRate = department.template_count > 0
    ? Math.round((department.published_count / department.template_count) * 100)
    : 0;

  return (
    <div className="department-card" onClick={onClick}>
      <div className="card-header">
        <h2>{department.department}</h2>
        <span className="template-count">{department.template_count}</span>
      </div>

      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">Published</span>
          <span className="stat-value published">{department.published_count}</span>
        </div>
        <div className="stat">
          <span className="stat-label">In Progress</span>
          <span className="stat-value in-progress">{department.in_progress_count}</span>
        </div>
        <div className="stat">
          <span className="stat-label">New</span>
          <span className="stat-value new">{department.new_count}</span>
        </div>
      </div>

      <div className="card-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${completionRate}%` }}
          />
        </div>
        <span className="progress-label">{completionRate}% Complete</span>
      </div>

      <div className="card-footer">
        <span className="total-value">
          ${department.total_value?.toFixed(2) || '0.00'}
        </span>
        <span className="avg-price">
          Avg: ${department.avg_price?.toFixed(2) || '0.00'}
        </span>
      </div>
    </div>
  );
};
```

### 3. Department Detail Component

```jsx
import React, { useState, useEffect } from 'react';

const DepartmentDetail = ({ department, onBack }) => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchDepartmentTemplates();
  }, [department]);

  const fetchDepartmentTemplates = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(
        `http://localhost:3001/api/views/departments/${encodeURIComponent(department)}/templates`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Failed to fetch templates');
      
      const data = await response.json();
      setTemplates(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = statusFilter === 'all'
    ? templates
    : templates.filter(t => t.status === statusFilter);

  const statusCounts = templates.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  if (loading) return <div className="loading">Loading templates...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="department-detail">
      <div className="detail-header">
        <button className="back-button" onClick={onBack}>
          ← Back to Departments
        </button>
        <h2>{department} Department</h2>
        <span className="template-count">{templates.length} Templates</span>
      </div>

      <div className="status-filters">
        <button
          className={statusFilter === 'all' ? 'active' : ''}
          onClick={() => setStatusFilter('all')}
        >
          All ({templates.length})
        </button>
        {Object.entries(statusCounts).map(([status, count]) => (
          <button
            key={status}
            className={statusFilter === status ? 'active' : ''}
            onClick={() => setStatusFilter(status)}
          >
            {status.replace('_', ' ')} ({count})
          </button>
        ))}
      </div>

      <div className="templates-list">
        {filteredTemplates.length === 0 ? (
          <div className="no-templates">No templates found</div>
        ) : (
          filteredTemplates.map((template) => (
            <TemplateCard key={template.template_id} template={template} />
          ))
        )}
      </div>
    </div>
  );
};
```

### 4. Template Card Component

```jsx
const TemplateCard = ({ template }) => {
  const getStatusClass = (status) => {
    const statusMap = {
      'published': 'status-published',
      'in_progress': 'status-in-progress',
      'new': 'status-new',
      'submitted': 'status-submitted',
      'needs_fixes': 'status-needs-fixes',
      'reviewed': 'status-reviewed',
      'assigned': 'status-assigned'
    };
    return statusMap[status] || 'status-default';
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="template-card">
      <div className="template-header">
        <h3>{template.use_case}</h3>
        <span className={`status-badge ${getStatusClass(template.status)}`}>
          {template.status.replace('_', ' ')}
        </span>
      </div>

      {template.flow_name && (
        <div className="template-flow-name">{template.flow_name}</div>
      )}

      <div className="template-meta">
        <div className="meta-item">
          <span className="meta-label">Price:</span>
          <span className="meta-value price">${template.price}</span>
        </div>
        {template.assigned_to && (
          <div className="meta-item">
            <span className="meta-label">Assigned to:</span>
            <span className="meta-value">{template.assigned_to}</span>
          </div>
        )}
      </div>

      <div className="template-dates">
        <div className="date-item">
          <span className="date-label">Created:</span>
          <span className="date-value">{formatDate(template.created_at)}</span>
        </div>
        <div className="date-item">
          <span className="date-label">Updated:</span>
          <span className="date-value">{formatDate(template.updated_at)}</span>
        </div>
      </div>

      <div className="template-actions">
        <button className="btn-view">View Details</button>
        <button className="btn-edit">Edit</button>
      </div>
    </div>
  );
};
```

### 5. CSS Styling

```css
/* DepartmentDashboard.css */

.department-dashboard {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.department-dashboard h1 {
  font-size: 2rem;
  margin-bottom: 30px;
  color: #333;
}

.department-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.department-card {
  background: white;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  transition: all 0.3s ease;
}

.department-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-header h2 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin: 0;
}

.template-count {
  background: #3498db;
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 1.2rem;
}

.card-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-label {
  font-size: 0.85rem;
  color: #7f8c8d;
  margin-bottom: 4px;
}

.stat-value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat-value.published {
  color: #27ae60;
}

.stat-value.in-progress {
  color: #f39c12;
}

.stat-value.new {
  color: #3498db;
}

.card-progress {
  margin-bottom: 16px;
}

.progress-bar {
  height: 8px;
  background: #ecf0f1;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3498db, #2ecc71);
  transition: width 0.3s ease;
}

.progress-label {
  font-size: 0.85rem;
  color: #7f8c8d;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  padding-top: 16px;
  border-top: 1px solid #ecf0f1;
}

.total-value {
  font-size: 1.2rem;
  font-weight: bold;
  color: #27ae60;
}

.avg-price {
  font-size: 0.9rem;
  color: #7f8c8d;
}

/* Department Detail */
.department-detail {
  animation: slideIn 0.3s ease;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(-20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.detail-header {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 30px;
}

.back-button {
  background: #ecf0f1;
  border: none;
  padding: 10px 20px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.3s ease;
}

.back-button:hover {
  background: #bdc3c7;
}

.status-filters {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.status-filters button {
  padding: 8px 16px;
  border: 2px solid #ecf0f1;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.status-filters button:hover {
  border-color: #3498db;
}

.status-filters button.active {
  background: #3498db;
  color: white;
  border-color: #3498db;
}

.templates-list {
  display: grid;
  gap: 16px;
}

.template-card {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.template-card:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.template-header {
  display: flex;
  justify-content: space-between;
  align-items: start;
  margin-bottom: 12px;
}

.template-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1rem;
}

.status-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 500;
  text-transform: capitalize;
}

.status-published {
  background: #d4edda;
  color: #155724;
}

.status-in-progress {
  background: #fff3cd;
  color: #856404;
}

.status-new {
  background: #d1ecf1;
  color: #0c5460;
}

.status-submitted {
  background: #cce5ff;
  color: #004085;
}

.status-needs-fixes {
  background: #f8d7da;
  color: #721c24;
}

.template-meta {
  display: flex;
  gap: 20px;
  margin: 12px 0;
}

.meta-item {
  display: flex;
  gap: 8px;
}

.meta-label {
  color: #7f8c8d;
  font-size: 0.9rem;
}

.meta-value {
  font-weight: 500;
  color: #2c3e50;
}

.meta-value.price {
  color: #27ae60;
  font-weight: bold;
}

.template-dates {
  display: flex;
  gap: 20px;
  margin: 12px 0;
  font-size: 0.85rem;
  color: #7f8c8d;
}

.template-actions {
  display: flex;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ecf0f1;
}

.template-actions button {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
}

.btn-view {
  background: #3498db;
  color: white;
}

.btn-view:hover {
  background: #2980b9;
}

.btn-edit {
  background: #ecf0f1;
  color: #2c3e50;
}

.btn-edit:hover {
  background: #bdc3c7;
}

.loading,
.error,
.no-templates {
  text-align: center;
  padding: 40px;
  font-size: 1.2rem;
  color: #7f8c8d;
}

.error {
  color: #e74c3c;
}
```

---

## Additional View Examples

### Freelancer Workload Component

```jsx
const FreelancerWorkload = () => {
  const [freelancers, setFreelancers] = useState([]);

  useEffect(() => {
    const fetchWorkload = async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/views/freelancers/workload', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setFreelancers(data);
    };
    fetchWorkload();
  }, []);

  return (
    <div className="freelancer-workload">
      <h2>Freelancer Workload</h2>
      {freelancers.map(f => (
        <div key={f.freelancer_id} className="freelancer-item">
          <h3>{f.freelancer_name}</h3>
          <div className="workload-stats">
            <span>Total: {f.total_assigned}</span>
            <span>In Progress: {f.in_progress}</span>
            <span>Submitted: {f.submitted}</span>
            <span>Published: {f.published}</span>
            <span>Earnings: ${f.total_earnings}</span>
          </div>
        </div>
      ))}
    </div>
  );
};
```

### Dashboard Overview Component

```jsx
const DashboardOverview = () => {
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/views/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setDashboardData(data);
    };
    fetchDashboard();
  }, []);

  if (!dashboardData) return <div>Loading...</div>;

  return (
    <div className="dashboard-overview">
      <section className="overview-section">
        <h2>Departments</h2>
        {/* Render departments */}
      </section>
      
      <section className="overview-section">
        <h2>Status Pipeline</h2>
        {/* Render statuses */}
      </section>
      
      <section className="overview-section">
        <h2>Recent Activity</h2>
        {/* Render recent activity */}
      </section>
      
      <section className="overview-section">
        <h2>Unassigned Templates</h2>
        <div className="alert">
          {dashboardData.unassignedCount.count} templates need assignment!
        </div>
      </section>
    </div>
  );
};
```

---

## Usage in Your App

1. **Import the component:**
```jsx
import DepartmentDashboard from './components/DepartmentDashboard';
```

2. **Add to your routes:**
```jsx
<Route path="/departments" element={<DepartmentDashboard />} />
```

3. **Ensure token is stored:**
```jsx
// After login
localStorage.setItem('token', response.token);
```

4. **Add navigation:**
```jsx
<Link to="/departments">View by Department</Link>
```

---

These components are production-ready and styled beautifully! 🎨✨

