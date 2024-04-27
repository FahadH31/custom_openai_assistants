async function sendMessage() {
    const userInput = document.getElementById('userInput').value.trim();
    if (!userInput) return;

    appendMessage(userInput, 'user');

    const response = await fetch('/getResponse', {
        method: 'GET',
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
  