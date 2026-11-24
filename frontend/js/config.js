// Change this to your deployed Render backend URL once live.
// Example: 'https://herform-backend.onrender.com/api'
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : 'https://herform-backend.onrender.com/api';