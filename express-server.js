const dotenv = require("dotenv");
const OpenAI = require("openai");
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
dotenv.config();

// Initialize API Key
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to parse form data
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());


// Handle create-chatbot form submission
app.post('/submit-form', async (req, res) => {
    // Extract data from form fields
    const companyName = req.body.companyName;
    const chatbotInstructions = req.body.chatbotInstructions;
    const uploadedFile = req.body.uploadFile;

    // Create Chatbot
    const assistant = await openai.beta.assistants.create({
        name: companyName + "'s Chatbot",
        instructions: chatbotInstructions,
        tools: [{ type: "code_interpreter" }, { type: "file_search" }],
        model: "gpt-3.5-turbo"
    });

    // Integrating File Upload w/ Chatbot.
    const fileStreams = [uploadedFile].map((path) =>
        fs.createReadStream(path),
    );
    // Create vector store
    let vectorStore = await openai.beta.vectorStores.create({
        name: "Uploaded File",
    });
    await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, fileStreams)
    // Update assistant to use the new vector store
    await openai.beta.assistants.update(assistant.id, {
        tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
    });

    // Create Thread
    const thread = await openai.beta.threads.create();

    // Append company name to the URL for chatbot, so it can be used in the title.
    res.redirect(`/chatbot.html?companyName=${encodeURIComponent(companyName)}`);
});


// Notify when server starts
app.listen(3000, () => {
    console.log("Server Started");
});