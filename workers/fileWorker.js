const { Worker } = require('bullmq');
const sharp = require('sharp');
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
const cloudinary = require('../config/cloudinary');
const pool = require('../config/db');
const redis = require('../config/redis');
require('dotenv').config();

const fileWorker = new Worker ('file-processing', async (job) => {
    const { fileId, buffer, mimetype, isImage, isPDF } = job.data;

    const fileBuffer = Buffer.from(buffer, 'base64');

    try{
        if (isImage){
            //Resizing image for storing it efficiently
            const resizedBuffer = await sharp(fileBuffer)
            .resize(800, 800, { fit : 'inside' })
            .jpeg({ quality : 80 })
            .toBuffer();

            //Uploading to cloudinary
            const uploadResult = await new Promise((resolve, reject)=>{
                cloudinary.uploader.upload_stream(
                    {folder : 'file-upload-api/images'},
                    (error, result)=>{
                        if (error) reject(error);
                        else resolve(result);
                    }
                ).end(resizedBuffer);
            });

            //Updating DB with our cloudinary url
            await pool.query(
                `UPDATE files
                SET cloudinary_url = $1, status = 'done'
                WHERE id = $2`
                ,[uploadResult.secure_url, fileId]
            );

            console.log(`Image processed successfully : ${fileId}`);
        } else if (isPDF){

            //Extracting data from PDF
           const loadingTask = pdfjsLib.getDocument({ data : new Uint8Array(fileBuffer) });
           const pdfDoc = await loadingTask.promise;

           let extractedText = '';

           for (let i = 1; i <= pdfDoc.numPages; i++){
                const page = await pdfDoc.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                extractedText += pageText + '\n';
           }

            //Uploading original pdf to cloudinary
            const uploadResult = await new Promise((resolve, reject)=>{
                cloudinary.uploader.upload_stream(
                    {
                        folder : 'file-upload-api/pdfs',
                        resource_type : 'raw'
                    },
                    (error, result) => {
                        if(error) reject(error);
                        else resolve(result);
                    }
                ).end(fileBuffer);
            });

            //Updating DB with cloudinary_url, extracted_text and status done
            await pool.query(
                `UPDATE files
                SET cloudinary_url = $1, extracted_text = $2, status = 'done'
                WHERE id = $3`
                ,[uploadResult.secure_url, extractedText, fileId]
            );

            console.log(`PDF processed successfully : ${fileId}`);
        }
    } catch(err){
        console.error(`Error file processing ${fileId}: ${err.message}`);

        await pool.query(
            `UPDATE files SET status = 'failed' WHERE id = $1`
            ,[fileId]
        );
    }
}, { connection : redis });

fileWorker.on('completed', (job) =>{
    console.log(`Job ${job.id} completed successfully`);
})

fileWorker.on('failed', (job, err) =>{
    console.log(`Job ${job.id} failed : ${err.message}`);
})

module.exports = fileWorker;