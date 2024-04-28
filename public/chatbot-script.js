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

    document.getElementById('userInput').value = ''; // Clear Input Field

    const responseData = await response.json();
    const botResponse = responseData.choices[0].message.content;

    appendMessage(botResponse, 'bot');
}

function appendMessage(message, sender) {
    const chatContainer = document.getElementById('chatContainer');
    const messageContainer = document.createElement('div');
    messageContainer.className = 'message-container';
  
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.textContent = message;
  
    const profileImg = document.createElement('img');
    profileImg.className = 'profile-image';
    if (sender === 'user') {
      profileImg.src = 'user-image.png'; // Path to user profile picture
      messageDiv.classList.add('user-message');
    } else {
      profileImg.src = 'bot-image.png'; // Path to bot profile picture
      messageDiv.classList.add('bot-message');
    }
  
    // Append message and profile image based on sender
    if (sender === 'user') {
      messageContainer.appendChild(messageDiv);
      messageContainer.appendChild(profileImg);
    } else {
      messageContainer.appendChild(profileImg);
      messageContainer.appendChild(messageDiv);
    }
  
    // Append message container to chat container
    chatContainer.appendChild(messageContainer);
    chatContainer.scrollTop = chatContainer.scrollHeight; // Scroll to bottom
  }
  

  