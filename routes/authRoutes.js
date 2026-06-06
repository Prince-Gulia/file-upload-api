const express = require('express');
const { signup, login, getProfile } = require('../controllers/authController');
const verifyToken = require('../middleware/authMiddleware');
const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/getProfile', verifyToken, getProfile);

module.exports = router;