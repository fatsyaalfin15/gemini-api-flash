const express = require('express');
const dotenv = require('dotenv');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

dotenv.config();
const app = express();
app.use(express.json());

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash' 
});

const upload = multer({
  dest: 'uploads/' 
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Gemini API server is running at http://localhost:${PORT}`);
});

app.post('/generate-text', async (req, res) => {
    const { prompt } = req.body;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = await response.text();
        res.json({ output: text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});


app.post('/generate-from-image', upload.single('image'), async (req, res) => {
    const prompt = req.body.prompt || 'Describe the image';
    
    try {
        // Convert uploaded image to GenerativeAI format
        const image = imageToGenerativePart(req.file.path);
        
        // Generate content from both prompt and image
        const result = await model.generateContent([prompt, image]);
        const response = await result.response;
        const text = await response.text();
        
        res.json({ output: text });
    } catch (error) {
        res.status(500).json({ error: error.message });
    } finally {
        // Clean up: delete the uploaded file
        if (req.file) {
            fs.unlinkSync(req.file.path);
        }
    }
});

// Helper function to convert image file to GenerativeAI part
function imageToGenerativePart(filePath) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString('base64'),
            mimeType: getMimeType(filePath)
        }
    };
}

// Helper function to determine MIME type
function getMimeType(filePath) {
    const extname = path.extname(filePath).toLowerCase();
    switch (extname) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.gif':
            return 'image/gif';
        case '.webp':
            return 'image/webp';
        default:
            return 'application/octet-stream';
    }
}

app.post('/generate-from-document', upload.single('document'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No document uploaded' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;

    try {
        // Read and convert document to base64
        const buffer = fs.readFileSync(filePath);
        const base64Data = buffer.toString('base64');

        // Create document part for Gemini API
        const documentPart = {
            inlineData: { 
                data: base64Data, 
                mimeType: mimeType 
            }
        };

        // Generate content from document
        const result = await model.generateContent([
            'Analyze this document:', 
            documentPart
        ]);
        
        const response = await result.response;
        const text = await response.text();
        
        res.json({ 
            output: text 
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message 
        });
    } finally {
        // Clean up: delete the uploaded file
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
});

app.post('/generate-from-audio', upload.single('audio'), async (req, res) => {
    // Validate audio file exists
    if (!req.file) {
        return res.status(400).json({ error: 'No audio file uploaded' });
    }

    try {
        // Read and convert audio to base64
        const audioBuffer = fs.readFileSync(req.file.path);
        const base64Audio = audioBuffer.toString('base64');

        // Create audio part for Gemini API
        const audioPart = {
            inlineData: {
                data: base64Audio,
                mimeType: req.file.mimetype
            }
        };

        // Generate content from audio
        const result = await model.generateContent([
            'Transcribe or analyze the following audio:', 
            audioPart
        ]);
        
        const response = await result.response;
        const text = await response.text();
        
        res.json({ 
            output: text 
        });
    } catch (error) {
        res.status(500).json({ 
            error: error.message || 'Failed to process audio' 
        });
    } finally {
        // Clean up: delete the uploaded file
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
});