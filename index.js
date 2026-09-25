require('dotenv').config();
const express = require('express');
require('./config/db');
require('./config/redis');
require('./workers/fileWorker');

//Routes import
const authRoutes = require('./routes/authRoutes.js');
const uploadRoutes = require('./routes/uploadRoutes.js');

const path = require('path');
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));



app.use('/auth', authRoutes);
app.use('/upload', uploadRoutes);
app.use('/files', uploadRoutes);


const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
    console.log(`Server is Live on : ${PORT}`);
});