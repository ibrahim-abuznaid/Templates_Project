# Template Management Dashboard

A full-stack web application for managing automation template ideas with role-based access control. Built with React (Vite) frontend and Node.js (Express) backend.

## Features

### 🎯 Role-Based Access Control

- **Admin**: Full access - create ideas, assign to freelancers, review submissions, approve/reject work, and publish templates
- **Freelancer**: View assigned ideas, fill in template details, submit work for review

### ✨ Core Functionality

- **Use Case Management**: Create, edit, and delete template use cases with comprehensive fields
- **Department Classification**: Organize use cases by department (HR, Finance, Marketing, Sales, IT, Operations, Customer Service, Legal, Other)
- **Self-Assignment**: Freelancers can browse and assign themselves to available ideas
- **Assignment System**: Admins can assign ideas to specific freelancers, or freelancers can self-assign
- **Workflow States**: Track ideas through their lifecycle (New → Assigned → In Progress → Submitted → Needs Fixes → Reviewed → Published)
- **Comments & Feedback**: Add comments to ideas for collaboration
- **Activity Logging**: Track all actions and changes
- **Real-time Dashboard**: View statistics and filter ideas by status
- **Tags System**: Categorize use cases with custom tags
- **Multiple URLs**: Support for Template URL and Scribe URL documentation

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **React Router** for navigation
- **Axios** for API calls
- **TailwindCSS** for styling
- **Lucide React** for icons

### Backend
- **Node.js** with Express
- **SQLite** database with better-sqlite3
- **JWT** authentication
- **bcrypt** for password hashing

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### Setup Instructions

1. **Clone or navigate to the project directory**
   ```bash
   cd Templates_Project
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install frontend dependencies
   cd frontend
   npm install

   # Install backend dependencies
   cd ../backend
   npm install
   cd ..
   ```

3. **Configure backend environment**
   
   Create a `.env` file in the `backend` directory:
   ```env
   PORT=3001
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   NODE_ENV=development
   FRONTEND_URL=http://localhost:5173
   ```

4. **Start the application**

   **Option A: Run both frontend and backend together (Recommended)**
   ```bash
   npm run dev
   ```

   **Option B: Run separately**
   ```bash
   # Terminal 1 - Backend
   cd backend
   npm run dev

   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

5. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/api

## Default Login Credentials

The application comes with two pre-configured demo accounts:

| Role | Username | Password |
|------|----------|----------|
| Admin | `admin` | `admin123` |
| Freelancer | `freelancer` | `freelancer123` |

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/auth/register` - Register new user (admin only)

### Ideas
- `GET /api/ideas` - Get all ideas (filtered by role)
- `GET /api/ideas/:id` - Get idea details
- `POST /api/ideas` - Create new idea (admin only)
- `PUT /api/ideas/:id` - Update idea
- `DELETE /api/ideas/:id` - Delete idea (admin only)
- `POST /api/ideas/:id/assign` - Assign idea to freelancer (admin only)
- `POST /api/ideas/:id/comments` - Add comment to idea
- `GET /api/ideas/users/freelancers` - Get all freelancers (admin only)

## Workflow

### Admin Workflow
1. Create a new use case with the following information:
   - **Use Case**: Category/type of automation (e.g., "Employee Onboarding", "Invoice Processing")
   - **Department**: Select from predefined departments (HR, Finance, Marketing, Sales, IT, Operations, Customer Service, Legal, Other)
   - **Flow Name**: The main display title that users will see (e.g., "Automated Employee Onboarding Flow")
   - **Short Description**: Brief summary
   - **Description**: Detailed information
   - **Tags**: Keywords for categorization
   - **Reviewer Name**: Person responsible for review
   - **Price**: Compensation amount
2. Assign the idea to a freelancer (or freelancer can self-assign)
3. Monitor progress and review submissions
4. Approve or request fixes with feedback
5. Publish completed templates

### Freelancer Workflow
1. View "My Ideas" (assigned to them) and "Available Ideas" (can self-assign)
2. Click on any available idea and assign to yourself
3. Start working on an idea (status: In Progress)
4. Fill in required fields:
   - **Flow Name**: Main display title (what users see on the dashboard)
   - **Short Description**: Brief summary of the use case
   - **Description**: Detailed explanation
   - **Setup Guide**: Step-by-step instructions
   - **Template URL**: Link to the template
   - **Scribe URL**: Link to Scribe documentation
   - **Tags**: Keywords for categorization
5. Submit for review
6. Address feedback if fixes are requested
7. Resubmit until approved

### Admin Review Workflow
1. Review submitted ideas from freelancers
2. Check template quality and completeness
3. Approve or request fixes with comments
4. Publish approved templates

## Project Structure

```
Templates_Project/
├── frontend/                 # React frontend
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── context/         # React context (Auth)
│   │   ├── pages/           # Page components
│   │   ├── services/        # API service layer
│   │   ├── types/           # TypeScript types
│   │   ├── App.tsx          # Main app component
│   │   ├── main.tsx         # Entry point
│   │   └── index.css        # Global styles
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
│
├── backend/                  # Node.js backend
│   ├── src/
│   │   ├── database/        # Database setup and initialization
│   │   ├── middleware/      # Express middleware (auth)
│   │   ├── routes/          # API routes
│   │   └── server.js        # Express server
│   ├── data/                # SQLite database (auto-created)
│   ├── package.json
│   └── .env                 # Environment variables
│
├── package.json             # Root package.json
└── README.md
```

## Development

### Building for Production

1. **Build frontend**
   ```bash
   cd frontend
   npm run build
   ```

2. **Start backend in production mode**
   ```bash
   cd backend
   npm start
   ```

### Database

The SQLite database is automatically created and initialized on first run. It includes:
- Users table with role-based access
- Ideas/Templates table with workflow states
- Comments table for feedback
- Activity log for audit trail

Database file location: `backend/data/database.db`

## Features in Detail

### Dashboard
- Statistics overview showing counts by status
- Filter ideas by status
- Quick access to all ideas
- Create new ideas (admin only)

### Idea Detail Page
- View and edit all template fields
- Role-based action buttons
- Comments section for feedback
- Activity log showing all changes
- Status workflow management

### Security
- JWT-based authentication
- Role-based access control
- Password hashing with bcrypt
- Protected API endpoints

## Troubleshooting

### Port Already in Use
If ports 3001 or 5173 are already in use:
- Change `PORT` in `backend/.env`
- Change port in `frontend/vite.config.ts`

### Database Issues
To reset the database, delete `backend/data/database.db` and restart the backend.

### CORS Issues
Ensure `FRONTEND_URL` in `backend/.env` matches your frontend URL.

## Future Enhancements

- [ ] Integration with Activepieces API for template publishing
- [ ] File upload for template assets
- [ ] Email notifications for status changes
- [ ] Advanced search and filtering
- [ ] User management interface for admins
- [ ] Template versioning
- [ ] Analytics and reporting

## License

This project is licensed under the MIT License.

## Support

For issues or questions, please open an issue in the project repository.

