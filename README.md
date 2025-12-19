# Template Management Dashboard

A full-stack web application for managing automation template ideas with role-based access control, real-time notifications, invoicing system, and blocker tracking. Built with React (Vite) frontend and Node.js (Express) backend with PostgreSQL database.

## 🚀 Quick Deploy to DigitalOcean

See **[DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md)** for complete deployment instructions.

---

## Features

### 🎯 Role-Based Access Control

- **Admin**: Full access - create ideas, assign to freelancers, review submissions, manage invoices, publish templates
- **Freelancer**: View assigned ideas, fill in template details, submit work, track earnings

### ✨ Core Functionality

- **Use Case Management**: Create, edit, and delete template use cases with comprehensive fields
- **Department Classification**: Organize by department (HR, Finance, Marketing, Sales, IT, Operations, Customer Service, Legal, Other)
- **Self-Assignment**: Freelancers can browse and assign themselves to available ideas
- **Workflow States**: Track through lifecycle (New → Assigned → In Progress → Submitted → Needs Fixes → Reviewed → Published → Archived)
- **Comments & Feedback**: Add comments for collaboration
- **Activity Logging**: Track all actions and changes
- **Real-time Updates**: WebSocket-powered live notifications

### 💰 Invoicing System

- Track freelancer earnings by completed templates
- Generate invoices with CSV export
- Invoice history and management

### 🚧 Blocker Tracking

- Report and track blockers on templates
- Priority levels and discussion threads
- Resolution tracking

### 🔔 Real-time Notifications

- Live notification inbox
- Mentions in comments (@username)
- Status change alerts

---

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **Axios** for API calls
- **TailwindCSS** for styling
- **Lucide React** for icons
- **Socket.IO Client** for real-time updates

### Backend
- **Node.js** with Express
- **PostgreSQL** database
- **JWT** authentication
- **bcrypt** for password hashing
- **Socket.IO** for WebSockets

---

## Local Development Setup

### Prerequisites
- Node.js (v18 or higher)
- PostgreSQL (v14 or higher)
- npm

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/template-management-dashboard.git
cd template-management-dashboard
```

### 2. Install Dependencies

```bash
# Install all dependencies (root, frontend, backend)
npm run install:all

# Or manually:
npm install
cd frontend && npm install
cd ../backend && npm install
cd ..
```

### 3. Configure PostgreSQL

Create a PostgreSQL database:

```sql
CREATE DATABASE template_management;
CREATE USER template_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE template_management TO template_user;
```

### 4. Configure Environment Variables

Create `backend/.env`:

```env
PORT=3001
NODE_ENV=development
DATABASE_URL=postgresql://template_user:your_password@localhost:5432/template_management
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
FRONTEND_URL=http://localhost:5173

# Activepieces Public Library API (optional - runs in mock mode if not set)
PUBLIC_LIBRARY_API_URL=https://cloud.activepieces.com/api/v1/admin/templates
PUBLIC_LIBRARY_API_KEY=your-templates-api-key-here
```

### 5. Start the Application

```bash
# Run both frontend and backend together
npm run dev

# Or run separately:
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 6. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **Health Check**: http://localhost:3001/api/health

---

## Default Login Credentials

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Freelancer | `freelancer` | `freelancer123` |

⚠️ **Change these in production!**

---

## Project Structure

```
Templates_Project/
├── .do/                      # DigitalOcean App Platform config
│   └── app.yaml
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React context (Auth, Socket)
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── types/           # TypeScript types
│   │   └── ...
│   ├── package.json
│   └── vite.config.ts
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── database/        # Database setup
│   │   ├── middleware/      # Express middleware
│   │   ├── routes/          # API routes
│   │   ├── server.js        # Express server
│   │   └── socket.js        # WebSocket setup
│   ├── prisma/              # Prisma schema (optional)
│   └── package.json
├── package.json             # Root package.json
├── DIGITALOCEAN_DEPLOYMENT.md
└── README.md
```

---

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register new user

### Ideas/Templates
- `GET /api/ideas` - Get all ideas
- `GET /api/ideas/:id` - Get idea details
- `POST /api/ideas` - Create new idea
- `PUT /api/ideas/:id` - Update idea
- `DELETE /api/ideas/:id` - Delete idea (also deletes from Public Library if published)
- `POST /api/ideas/:id/assign` - Assign idea
- `POST /api/ideas/:id/self-assign` - Self-assign
- `POST /api/ideas/:id/comments` - Add comment
- `POST /api/ideas/:id/flow-json` - Upload flow JSON for template
- `GET /api/ideas/:id/publish-preview` - Preview what will be sent to Public Library
- `POST /api/ideas/:id/sync-public-library` - Sync published template with Public Library

### Views/Departments
- `GET /api/views/departments` - Get department summaries
- `GET /api/views/departments/:department/templates` - Get department templates

### Notifications
- `GET /api/notifications` - Get notifications
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/mark-all-read` - Mark all as read

### Invoices
- `GET /api/invoices/pending` - Get pending invoices
- `POST /api/invoices/generate/:freelancerId` - Generate invoice
- `GET /api/invoices/history` - Get invoice history

### Blockers
- `GET /api/blockers/all` - Get all blockers
- `POST /api/blockers` - Create blocker
- `PUT /api/blockers/:id` - Update blocker

---

## Deployment

### DigitalOcean App Platform (Recommended)

See **[DIGITALOCEAN_DEPLOYMENT.md](./DIGITALOCEAN_DEPLOYMENT.md)** for step-by-step instructions.

**Estimated Cost**: $5-20/month depending on database choice

### Environment Variables for Production

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production` |
| `PORT` | Backend port (usually 3001) |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Strong random string (64+ chars) |
| `FRONTEND_URL` | Your frontend URL |
| `VITE_API_URL` | Backend API URL (for frontend build) |
| `PUBLIC_LIBRARY_API_URL` | Activepieces Public Library API URL (default: `https://cloud.activepieces.com/api/v1/admin/templates`) |
| `PUBLIC_LIBRARY_API_KEY` | API key for Activepieces Public Library (templates-api-key) |

### Activepieces Public Library Integration

The application integrates with the [Activepieces](https://cloud.activepieces.com) Public Library API to publish, update, and manage templates. 

**API Endpoints Used:**
- **Create Template**: `POST /api/v1/admin/templates`
- **Update Template**: `PATCH /api/v1/admin/templates/{template-id}`
- **Change Status**: `PATCH /api/v1/admin/templates/{template-id}` (with `status: "PUBLISH"` or `"ARCHIVED"`)
- **Delete Template**: `DELETE /api/v1/admin/templates/{template-id}`

**Valid Template Categories:**
- `ANALYTICS`, `COMMUNICATION`, `CONTENT`, `CUSTOMER_SUPPORT`
- `DEVELOPMENT`, `E_COMMERCE`, `FINANCE`, `HR`
- `IT_OPERATIONS`, `MARKETING`, `PRODUCTIVITY`, `SALES`

**How It Works:**
1. When a template status changes to `published`, it's automatically published to the Public Library
2. When a template is `archived`, it's archived in the Public Library (not deleted)
3. When a template is deleted locally, it's also deleted from the Public Library
4. Use the "Sync with Public Library" action to manually update published templates

---

## Workflow

### Admin Workflow
1. Create new use cases with details and pricing
2. Assign to freelancers (or let them self-assign)
3. Monitor progress and review submissions
4. Approve or request fixes with feedback
5. Publish completed templates
6. Manage invoices for freelancers

### Freelancer Workflow
1. View available and assigned ideas
2. Self-assign to available ideas
3. Work on templates (status: In Progress)
4. Fill in required fields and submit
5. Address feedback if fixes requested
6. Track earnings in My Earnings page

---

## Security

- ✅ JWT-based authentication
- ✅ Role-based access control
- ✅ Password hashing with bcrypt
- ✅ Protected API endpoints
- ✅ SSL for database in production
- ✅ CORS configuration

---

## Troubleshooting

### Port Already in Use
```bash
# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F

# Mac/Linux
lsof -i :3001
kill -9 <PID>
```

### Database Connection Issues
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure database exists and user has permissions

### CORS Issues
- Check `FRONTEND_URL` environment variable
- Multiple URLs can be comma-separated

---

## Scripts

```bash
# Development
npm run dev              # Run frontend + backend
npm run dev:frontend     # Run frontend only
npm run dev:backend      # Run backend only

# Build
npm run build:frontend   # Build frontend for production

# Database (from backend/)
npm run db:studio        # Open Prisma Studio
npm run db:generate      # Generate Prisma client
```

---

## License

MIT License

---

## Support

For issues or questions, please open an issue in the repository.
