#!/bin/bash

# Template Management Dashboard Setup Script for Linux/Mac

echo "🚀 Setting up Template Management Dashboard..."
echo ""

# Check if Node.js is installed
echo "Checking Node.js installation..."
if command -v node &> /dev/null
then
    NODE_VERSION=$(node --version)
    echo "✅ Node.js $NODE_VERSION found"
else
    echo "❌ Node.js not found. Please install Node.js from https://nodejs.org/"
    exit 1
fi

# Install root dependencies
echo ""
echo "Installing root dependencies..."
npm install

# Install frontend dependencies
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install

# Install backend dependencies
cd ../backend
echo ""
echo "Installing backend dependencies..."
npm install

# Create data directory for database
echo ""
echo "Creating database directory..."
if [ ! -d "data" ]; then
    mkdir data
    echo "✅ Database directory created"
else
    echo "✅ Database directory already exists"
fi

cd ..

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start the application:"
echo "  npm run dev"
echo ""
echo "Or start frontend and backend separately:"
echo "  npm run dev:backend"
echo "  npm run dev:frontend"
echo ""
echo "Default login credentials:"
echo "  Admin: admin / admin123"
echo "  Freelancer: freelancer / freelancer123"
echo ""

