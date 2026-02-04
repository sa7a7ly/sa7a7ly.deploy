const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/assignments', require('./routes/assignment.routes'));
app.use('/api/submissions', require('./routes/submission.routes'));
app.use('/api/admin', require('./routes/admin.routes'));

module.exports = app;