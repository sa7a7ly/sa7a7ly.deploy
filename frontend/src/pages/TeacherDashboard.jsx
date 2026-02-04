import { useState } from 'react';
import api from '../api/axios';

export default function TeacherDashboard() {
  const [title, setTitle] = useState('');
  const [totalMarks, setTotalMarks] = useState('');
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMsg(null);

    const formData = new FormData();
    formData.append('title', title);
    formData.append('totalMarks', totalMarks);
    formData.append('file', file); // MUST be "file"

    try {
      await api.post('/assignments', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setMsg('Assignment created successfully');
      setTitle('');
      setTotalMarks('');
      setFile(null);
    } catch {
      setMsg('Failed to create assignment');
    }
  };

  return (
    <div className="p-6 max-w-md">
      <h2 className="text-xl font-bold mb-4">Create Assignment</h2>

      {msg && <p className="mb-3">{msg}</p>}

      <form onSubmit={handleSubmit}>
        <input
          className="w-full p-2 border rounded mb-3"
          placeholder="Assignment title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <input
          type="number"
          className="w-full p-2 border rounded mb-3"
          placeholder="Total marks"
          value={totalMarks}
          onChange={(e) => setTotalMarks(e.target.value)}
        />

        <input
          type="file"
          className="mb-4"
          onChange={(e) => setFile(e.target.files[0])}
        />

        <button className="bg-blue-600 text-white p-2 rounded">
          Create
        </button>
      </form>
    </div>
  );
}
