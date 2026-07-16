# Phoenix Scientific Platform - Frontend

React + TypeScript + Vite frontend for Phoenix Scientific Platform.

## Features

- Modern React 19 with TypeScript
- User authentication and authorization
- Article submission and management
- Journal browsing and selection
- Payment integration (Click.uz)
- Translation services
- Plagiarism checking
- Responsive design with Tailwind CSS

## Technology Stack

- React 19
- TypeScript
- Vite 6
- React Router DOM
- React Toastify
- Lucide React Icons
- Tailwind CSS (via CDN)

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables (create `.env` file):
```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
VITE_MEDIA_URL=http://127.0.0.1:8000/media/
VITE_GEMINI_API_KEY=your-gemini-api-key
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

5. Preview production build:
```bash
npm run preview
```

## Build Output

Production build output is in the `dist/` directory.

## Project Structure

- `/pages` - Page components
- `/components` - Reusable components
- `/services` - API services
- `/contexts` - React contexts
- `/types.ts` - TypeScript type definitions
