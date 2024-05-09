// PROJECT-SETUP-------------------------------------------------------------------------------
const OpenAI = require("openai");
const dotenv = require("dotenv");
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');
const cheerio = require('cheerio')

const app = express();
dotenv.config();

// Multer Set-Up
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads'); // Upload directory
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9); // Add unique identifier to each file name
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// Initialize API Key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Middleware to parse incoming request bodies
app.use(express.json());

// Route to handle clearing server variables
app.post('/clearData', (req, res) => {
    app.locals.assistant = null;
    app.locals.thread = null;
    res.sendStatus(200); // Send a success response
});
//--------------------------------------------------------------------------------------------


// FUNCTIONS-----------------------------------------------------------------------------------
// Fetch HTML content from a URL using axios
async function fetchHTML(url) {
    try {
        const response = await axios.get(url);
        return response.data;
    } catch (error) {
        console.error('Error fetching HTML:', error);
        return null;
    }
}

// Extract textual elements from HTML using cheerio
function extractText(html) {
    const $ = cheerio.load(html);
    // Extracting from body elements
    const textContent = $('body').text();
    return textContent;
}

// Save text content to a file
function saveToFile(content) {
    const fileName = "data-from-url.txt";
    fs.writeFileSync("uploads/" + fileName, content);
    console.log(`File '${fileName}' saved successfully!`);
}

// Create Vector Store
async function createVectorStore(assistant, fileId) {
    try {
        // Step 1: Creating Vector Store
        const vectorStore = await openai.beta.vectorStores.create({
            name: "Training Data"
        });

        // Step 2: Adding the file to the vector store
        const vectorStoreFile = await openai.beta.vectorStores.files.create(
            vectorStore.id,
            {
                file_id: fileId
            }
        );

        // Step 3: Updating the assistant with the vector store
        await openai.beta.assistants.update(assistant.id, {
            tool_resources: { file_search: { vector_store_ids: [vectorStoreFile.vector_store_id] } }
        });

    } catch (error) {
        console.error('Error creating vector store:', error);
        throw error; // Rethrow the error for the caller to handle
    }
}
//--------------------------------------------------------------------------------------------

// ROUTES--------------------------------------------------------------------------------------
// Handle create-chatbot form submission
app.post('/submit-form', upload.single('uploadFile'), async (req, res) => {
    // Importing form data
    const companyName = req.body.companyName;
    const chatbotInstructions = req.body.chatbotInstructions;
    const uploadedFile = req.file;
    let uploadedLinks = null;

    // If the text area for URLS is not empty
    if (req.body.uploadLinks && req.body.uploadLinks.trim() !== '') {
        uploadedLinks = req.body.uploadLinks.split('\n').filter(link => link.trim() !== ''); // Parse newline-seperated URLs
    }

    // Create an Assistant
    const assistant = await openai.beta.assistants.create({
        name: companyName + "'s Chatbot",
        instructions: chatbotInstructions,
        tools: [{ type: "code_interpreter" }, { type: "file_search" }],
        model: "gpt-3.5-turbo"
    });

    // Create a Thread
    const thread = await openai.beta.threads.create();
    
    // Make Assistant and Thread accessible throughout the code (for other routes)
    app.locals.assistant = assistant;
    app.locals.thread = thread;

    // Uploaded Link Functionality
    if (uploadedLinks) {
        const processURL = async (url) => {
            try {
                const urlHTML = await fetchHTML(url);
                if (urlHTML) {
                    const urlText = extractText(urlHTML);
                    return urlText;
                } else {
                    console.error(`No HTML content fetched from ${url}`);
                    return ''; // Return empty string if no content fetched
                }
            } catch (error) {
                console.error(`Error processing HTML from ${url}:`, error);
                return ''; // Return empty string on error
            }
        };

        try {
            const urlTexts = await Promise.all(uploadedLinks.map(processURL)); // Process all URLs concurrently

            // Concatenate all text content
            const allTextContent = urlTexts.join('\n');

            // Save concatenated content to a single file
            const fileName = "data-from-urls.txt";
            fs.writeFileSync("uploads/" + fileName, allTextContent);
            console.log(`File '${fileName}' saved successfully!`);

            const file = await openai.files.create({
                file: fs.createReadStream("uploads/" + fileName),
                purpose: "assistants"
            });

            createVectorStore(app.locals.assistant, file.id);

        } catch (error) {
            console.error('Error processing URLs:', error);
            res.status(500).send('Error processing URLs');
        }
    }
    // Uploaded File Functionality
    else if (uploadedFile) {
        const file = await openai.files.create({ // Creating openai file as copy of the uploaded one.
            file: fs.createReadStream(uploadedFile.path),
            purpose: "assistants"
        });
        createVectorStore(app.locals.assistant, file.id);
    }

    // Append company name to the URL for chatbot, so it can be used to the title (and redirect)
    res.redirect(`/chatbot.html?companyName=${encodeURIComponent(companyName)}`);
});


// Server-side error handling if accessing chatbot w/o creating an assistant first.
app.get('/api/checkAssistant', (req, res) => {
    // Logic to check if an assistant exists
    const assistantExists = !!app.locals.assistant;
    res.json({ assistantExists });
});


// Handle Conversation 
app.post('/getResponse', async (req, res) => {

    const userInput = req.body.userInput;
    if (!userInput) {
        return res.status(400).json({ error: 'User input missing' });
    }

    // Add user message to thread.
    const message = await openai.beta.threads.messages.create(
        app.locals.thread.id,
        {
            role: "user",
            content: userInput
        }
    );

    // Run message to generate response
    let run = await openai.beta.threads.runs.createAndPoll(
        app.locals.thread.id,
        {
            assistant_id: app.locals.assistant.id
        }
    );

    // Display the response
    if (run.status === 'completed') {
        const messages = await openai.beta.threads.messages.list(run.thread_id);
        const latestAssistantMessage = messages.data.find(message => message.role === 'assistant');
        if (latestAssistantMessage && latestAssistantMessage.content.length > 0) {
            const latestMessageText = latestAssistantMessage.content[0].text.value;
            res.json({ message: latestMessageText });
        } else {
            res.status(404).json({ error: 'No assistant message found.' });
        }
    } else {
        res.status(400).json({ error: 'Run not completed.' });
    }

});

// Notify when server starts
app.listen(3000, () => {
    console.log("Server Started");
});
