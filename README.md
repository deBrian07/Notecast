# Notecast

A modern application for converting documents into podcasts using AI-powered text-to-speech technology.

## 🚀 Quick Start

### Prerequisites

- **Python 3.8+** (for backend)
- **Node.js 16+** (for frontend)
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/deBrian07/Notecast.git
cd Notecast
```

### 2. Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Linux/Mac:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env  # or create manually (see Environment Variables section)

# Initialize database
python create_db.py

# Start the backend server
python app.py
```

The backend will be available at `http://localhost:8000`

### 3. Frontend Setup

```bash
# Navigate to client directory (from project root)
cd client

# Install dependencies
npm install

# Start the development server
npm run dev
```

The frontend will be available at `http://localhost:5173`

## 🔧 Environment Variables

Create a `.env` file in the `backend` directory with the following variables:

```env
# Database
DATABASE_URL=sqlite:///./data/notecast.db

# Security
SECRET_KEY=your-super-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Directories
UPLOAD_DIR=./data/uploads
TEXT_DIR=./data/text
PODCAST_DIR=./data/podcasts

# AI/LLM Configuration
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=llama2

# Text-to-Speech Configuration
TTS_VOICE_FEMALE=ljspeech
TTS_VOICE_MALE=male_voice
TTS_SAMPLE_RATE=22050

# Development
DEBUG=true
```

## 📁 Project Structure

```
Notecast/
├── backend/                 # FastAPI backend
│   ├── models/             # Database models
│   ├── routers/            # API routes
│   ├── services/           # Business logic
│   ├── core/               # Configuration and security
│   ├── data/               # Database and file storage
│   ├── alembic/            # Database migrations
│   ├── app.py              # Main application entry point
│   └── requirements.txt    # Python dependencies
├── client/                 # React frontend
│   ├── src/                # Source code
│   ├── public/             # Static assets
│   ├── package.json        # Node.js dependencies
│   └── vite.config.js      # Vite configuration
└── README.md
```

## 🛠 Development

### Backend Development

```bash
cd backend

# Run with auto-reload
python app.py

# Run database migrations
alembic upgrade head

# Create new migration
alembic revision --autogenerate -m "Description"
```

### Frontend Development

```bash
cd client

# Development server with hot reload
npm run dev

# Build for production
npm run build

# Preview production build
npm run serve
```

## 📚 API Documentation

Once the backend is running, visit:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

## 🎯 Features

- **Document Upload**: Support for PDF and DOCX files
- **AI-Powered Content Generation**: Convert documents to podcast scripts
- **Text-to-Speech**: Generate audio from text with multiple voice options
- **User Authentication**: Secure user registration and login
- **Project Management**: Organize documents and podcasts into projects
- **Modern UI**: Responsive design with Tailwind CSS

## 🔍 Usage

1. **Register/Login**: Create an account or sign in
2. **Create Project**: Organize your work into projects
3. **Upload Documents**: Add PDF or DOCX files to your project
4. **Generate Podcast**: Convert documents to podcast scripts using AI
5. **Text-to-Speech**: Generate audio files from your scripts
6. **Download**: Get your finished podcast files

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
- Check if all environment variables are set
- Ensure Python virtual environment is activated
- Verify all dependencies are installed: `pip install -r requirements.txt`

**Frontend won't start:**
- Check Node.js version: `node --version` (should be 16+)
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Check if port 5173 is available

**Database issues:**
- Run `python create_db.py` to initialize the database
- Check if `data` directory exists and is writable

**TTS not working:**
- Ensure TTS models are properly installed
- Check TTS configuration in environment variables

## 🚀 Production Deployment

### Backend

```bash
# Install production dependencies
pip install gunicorn

# Run with Gunicorn
gunicorn app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

### Frontend

```bash
# Build for production
npm run build

# Serve static files (dist folder) with your preferred web server
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes
4. Run tests (if available)
5. Commit your changes: `git commit -m 'Add feature'`
6. Push to the branch: `git push origin feature-name`
7. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions:
1. Check the troubleshooting section above
2. Search existing issues in the repository
3. Create a new issue with detailed information about your problem

---

**Happy podcasting! 🎙️**