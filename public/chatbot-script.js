// Add event listener for Enter key press on text input
document.getElementById('userInput').addEventListener('keypress', function(event) {
    if (event.key === 'Enter') {
        sendMessage(); // Call sendMessage() when Enter key is pressed
    }
});

async function sendMessage() {
    const userInput = document.getElementById('userInput').value.trim();
    if (!userInput) return;

    appendMessage(userInput, 'user');

    const response = await fetch('/getResponse', {
        method: 'POST', // Change method to POST
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ userInput }) // Send user input as JSON
    });

    const responseData = await response.json();
    const botResponse = responseData.choices[0].message.content;

    appendMessage(botResponse, 'bot');

    document.getElementById('userInput').value = '';
}

function appendMessage(message, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
  
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
  
    if (sender === 'user') {
      messageDiv.classList.add('user-message');
    } else {
      messageDiv.classList.add('bot-message');
    }
  
    messageContainer.appendChild(messageDiv);
    chatContainer.appendChild(messageContainer);
    chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to bottom
  }
  