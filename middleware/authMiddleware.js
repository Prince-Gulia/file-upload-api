const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next)=>{
    const authHeader = req.headers['authorization'];

    if(!authHeader || !authHeader.startsWith('Bearer ')){
        return res.status(401).json({ message : "No Token Provided" });
    }

    const token = authHeader.split(' ')[1];

    if (!token){
        return res.status(401).json({ message : "Invalid Token format" });
    }

    try{
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch(err){
        console.error(err.message);
        res.status(401).json({ message : "Token is either invalid or expired" });
    }
};

module.exports = verifyToken;