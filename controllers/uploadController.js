const pool = require('../config/db');
const redis = require('../config/redis');
const cloudinary = require('../config/cloudinary');
const { Queue } = require('bullmq');

const fileQueue = new Queue('file-processing', {
    connection : redis
});

const uploadFile = async (req, res) => {
    try{
        if(!req.file){
            return res.status(400).json({ message : 'No file uploaded' });
        }

        const { mimetype, originalname, buffer } = req.file;
        const isImage = mimetype.startsWith('image/');
        const isPDF = mimetype === 'application/pdf';

        const fileRecord = await pool.query(
            `INSERT INTO files (user_id, original_name, file_type, status)
            VALUES ($1, $2, $3, 'processing')
            RETURNING *`
            ,[req.user.id, originalname, isImage ? 'image' : 'pdf']
        );

        const fileId = fileRecord.rows[0].id;

        await fileQueue.add('process-file',{
            fileId,
            buffer : buffer.toString('base64'),
            mimetype,
            originalname,
            isImage,
            isPDF
        });

        res.status(202).json({
            message : 'File Uploaded successfully, Process in background',
            fileId,
            status : 'processing'
        });
    } catch(err){
        console.error(err.message);
        res.status(500).json({ message : 'Server Error' });
    }
};

const getFiles = async (req, res) => {
    try{
        const files = await pool.query(
            `SELECT id, original_name, file_type, cloudinary_url, status, created_at 
            FROM files
            WHERE user_id = $1
            ORDER BY created_at DESC`
            ,[req.user.id]
        );

        res.status(200).json({
            message : 'Files fetched successfully',
            files : files.rows
        });
    } catch(err){
        console.error(err.message);
        res.status(500).json({ message : 'Server Error' });
    }
};

const getFileById = async (req, res) => {
    try{
        const file = await pool.query(
            `SELECT * FROM files WHERE id = $1 and user_id = $2`
            ,[req.params.id, req.user.id]
        );

        if(file.rowCount === 0){
            return res.status(404).json({ message : 'File not found' });
        }

        res.status(200).json({
            message : 'File fecthed successfully',
            file : file.rows[0]
        });
    } catch(err){
        console.error(err.message);
        res.status(500).json({ message : 'Server Error' });
    }
};

const deleteFile = async (req, res) => {
    try{
        const file = await pool.query(
            `SELECT * FROM files WHERE id = $1 and user_id = $2`
            ,[req.params.id, req.user.id]
        );

        if(file.rowCount === 0){
            return res.status(404).json({ message : 'File not found' });
        }

        await pool.query(`DELETE FROM files WHERE id = $1`, [req.params.id]);

        res.status(200).json({ message : 'File deleted successfully' });
    } catch(err){
        console.error(err.message);
        res.status(500).json({ messgae : 'Server Error' });
    }
};

module.exports = { uploadFile, getFiles, getFileById, deleteFile };