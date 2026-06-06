require('dotenv').config();
const express = require('express');
require('./config/db');
require('./config/redis');

const app = express();
app.use(express.json());

//Basic Server live run route
app.get('/' , (req, res) => {
    res.json({ message : "File upload API is running" })
});

//Authentication Route
const authRoutes = require('./routes/authRoutes.js');
app.use('/auth', authRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, ()=>{
    console.log(`Server is Live on : ${PORT}`);
});