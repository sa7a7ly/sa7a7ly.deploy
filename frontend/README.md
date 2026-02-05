# AI Classroom Frontend

A modern React frontend for an AI-powered classroom system with intelligent assignment grading.

## Features

- **Authentication**: Simple user registration and login
- **Teacher Dashboard**: Create classrooms and manage assignments
- **Student Dashboard**: Join classrooms and submit assignments
- **Assignment Grading**: AI-powered grading with feedback
- **File Upload**: PDF upload with drag-and-drop support
- **Modern UI**: Built with Tailwind CSS

## Setup

### Prerequisites
- Node.js (v14+)
- npm or yarn

### Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

The frontend will run on `http://localhost:3000`

### Backend

Make sure the backend is running on `http://localhost:5000`

## Project Structure

```
src/
├── components/          # Reusable components
├── context/            # React context (Auth)
├── pages/              # Page components
├── services/           # API service utilities
├── App.js              # Main app component
├── index.js            # Entry point
└── index.css           # Global styles
```

## Pages

### Landing Page
- Login and Register buttons

### Register Page
- Form with name, email, password, role
- POST to `/api/users`
- Auto-login and redirect based on role

### Teacher Dashboard
- View all classrooms
- Create new classroom
- Display join code for each classroom

### Classroom (Teacher)
- Display join code
- List assignments
- Create assignment with PDF upload

### Student Dashboard
- Join classroom with join code
- View enrolled classrooms

### Classroom (Student)
- List assignments
- Submit button for each assignment

### Submit Assignment
- Drag-drop PDF upload
- POST to `/api/submissions`
- Display grade and feedback immediately

## Tech Stack

- **React** - UI library
- **React Router** - Client-side routing
- **Axios** - HTTP client
- **Tailwind CSS** - Styling
- **localStorage** - User persistence

## API Integration

All API calls are configured in `src/services/api.js`:

- **Users**: POST `/api/users`
- **Classrooms**: GET, POST `/api/classrooms`
- **Join Classroom**: POST `/api/classrooms/join`
- **Assignments**: GET, POST `/api/assignments`
- **Submissions**: POST `/api/submissions`

## Authentication

Users are stored in localStorage after registration/login. A simple context (`AuthContext`) manages user state across the app.

## Field Names

PDF uploads use the field name `pdf` to match backend requirements.

## Development

### Available Scripts

- `npm start` - Start development server
- `npm build` - Build for production
- `npm test` - Run tests

### Styling

The project uses Tailwind CSS for styling. Customize theme in `tailwind.config.js`.

## Notes

- No JWT authentication yet (simple user creation)
- Join codes are generated on the backend
- AI grading happens server-side and returns grade + feedback
- All field names must match backend specifications

## License

MIT
