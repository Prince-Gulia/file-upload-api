const multer = require('multer');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf'];

    if(allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else{
        cb( new Error('Only images (jpeg, png, webp) and PDFs are allowed'), false)
    }   
};

const upload = multer({
    storage,
    fileFilter,
    limits : {
        fileSize : 10 * 1024 * 1024
    }
});

module.exports = upload;
