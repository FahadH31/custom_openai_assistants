const dotenv = require("dotenv");
const OpenAI = require("openai");
const path = require('path');
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Define your upload directory

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
app.post('/submit-form', upload.single('uploadFile'), async (req, res) => {
    // Extract data from form fields
    const companyName = req.body.companyName;
    const chatbotInstructions = req.body.chatbotInstructions;
    const uploadedFile = req.file;

    // Create Chatbot
    const assistant = await openai.beta.assistants.create({
        name: companyName + "'s Chatbot",
        instructions: chatbotInstructions,
        tools: [{ type: "code_interpreter" }, { type: "file_search" }],
        model: "gpt-3.5-turbo"
    });

    app.locals.assistant = assistant;

    // // Integrating File Upload w/ Chatbot.                                           // ERROR WITH FILE UPLOAD HERE.
    // const fileStreams = [uploadedFile.path].map((path) =>
    //     fs.createReadStream(path),
    // );
    // // Create vector store
    // let vectorStore = await openai.beta.vectorStores.create({
    //     name: "Uploaded File",
    // });
    // await openai.beta.vectorStores.fileBatches.uploadAndPoll(vectorStore.id, fileStreams)
    // // Update assistant to use the new vector store
    // await openai.beta.assistants.update(assistant.id, {
    //     tool_resources: { file_search: { vector_store_ids: [vectorStore.id] } },
    // });


    // Append company name to the URL for chatbot, so it can be used in the title.
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

    // Create Thread
    const thread = await openai.beta.threads.create();

    // Add user message to thread.
    const message = await openai.beta.threads.messages.create(
        thread.id,
        {
            role: "user",
            content: userInput
        }
    );

    // Run message to generate response
    let run = await openai.beta.threads.runs.createAndPoll(
        thread.id,
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