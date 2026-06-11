const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { uploadFile, getFiles, getFileById, deleteFile } = require('../controllers/uploadController');


router.post('/', verifyToken, upload.single('file'), uploadFile);
router.get('/', verifyToken, getFiles);
router.get('/:id', verifyToken, getFileById);
router.delete('/:id', verifyToken, deleteFile);

module.exports = router;