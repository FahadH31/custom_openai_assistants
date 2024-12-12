//-- Project Setup --//
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

// In-memory store for assistant IDs
const assistants = new Map(); // Key: assistant ID, Value: { assistant, threads: [] }


//-- Functions --//
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

//-- Routes --//
app.get('/ping', (req, res) => {
  res.status(200).send('OK');
});

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

    // Store assistant and thread in the Map
    assistants.set(assistant.id, {
        assistant,
        thread, // Initialize with the first thread
        companyName, // Store the companyName with the assistant
    });

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
    res.redirect(`/Pages/chat.html?companyName=${encodeURIComponent(companyName)}`);
});

// Server-side error handling if accessing chatbot w/o creating an assistant first.
app.get('/api/checkAssistant', (req, res) => {
    // Logic to check if an assistant exists
    const assistantExists = !!app.locals.assistant;
    res.json({ assistantExists });
});

// To Get and Display Assistant ID
app.get('/api/assistant-id', (req, res) => {
    res.json({ assistantId: app.locals.assistant.id });
});

// Validate existence of entered Assistant 
app.post('/validate-assistant', (req, res) => {
    const { revisitAssistantID } = req.body;

    // Check if the assistant ID exists in memory
    if (assistants.has(revisitAssistantID)) {
        
        const assistantData = assistants.get(revisitAssistantID);
        app.locals.assistant = assistantData.assistant; // Set assistant
        app.locals.thread = assistantData.thread;
        const companyName = assistantData.companyName; // Retrieve the stored companyName
        
        // Redirect to the chat page, passing the assistant ID and companyName in the query string
        res.redirect(`/Pages/chat.html?assistantID=${encodeURIComponent(revisitAssistantID)}&companyName=${encodeURIComponent(companyName)}`);
    } else {
        // Send an error message or redirect to an error page
        res.status(404).send('Assistant not found. Please check the ID and try again.');
    }
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
            
            // Removing annotations.
            const pattern = /【\d:\d†source】/g;
            const pattern2 = /【\d\d:\d†source】/g;
            const cleanedText = latestMessageText.replace(pattern, '').replace(pattern2,'');

            res.json({ message: cleanedText });
        } else {
            res.status(404).json({ error: 'No assistant message found.' });
        }
    } else {
        res.status(400).json({ error: 'Run not completed.' });
    }

});

// Route to handle clearing server variables
app.post('/clearData', (req, res) => {
    app.locals.assistant = null;
    app.locals.thread = null;
    res.sendStatus(200); // Send a success response
});

const PORT = process.env.PORT || 3000; // Use PORT environment variable or default to 3000
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

