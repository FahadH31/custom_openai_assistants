// // Client-side error handling if on chatbot.html w/o creating an assistant first.
// if (window.location.href.includes("chatbot.html")) {
//   // Fetch the information from the server
//   fetch('/api/checkAssistant')
//     .then(response => response.json())
//     .then(data => {
//       if (!data.assistantExists) {
//         alert("It seems you haven't created an assistant yet. We'll redirect you to the appropriate page now.");
//         window.location.href = "index.html"; // Redirect to index.html
//       }
//     })
//     .catch(err => {
//       console.error('Error fetching assistant status:', err);
//     });
// }

// Extract company name from URL query parameter
const urlParams = new URLSearchParams(window.location.search);
const companyName = urlParams.get('companyName');
// Set the h1 title to the extracted company name
const companyNameTitle = document.getElementById('title');
if (companyName) {
  title.textContent = companyName + "'s AI Assistant";
}

// Display Assistant ID
document.addEventListener('DOMContentLoaded', () => {
  fetch('/api/assistant-id')
    .then(response => response.json())
    .then(data => {
      const assistantIdElement = document.getElementById('assistant-id');
      assistantIdElement.textContent = `${data.assistantId}`;
    })
    .catch(error => console.error('Error fetching assistant ID:', error));
});

// Copy Assistant ID to Clipboard
function copyToClipboard() {
  const button = document.getElementById('copy-btn');
  const text = document.getElementById("assistant-id").innerText;
  navigator.clipboard.writeText(text).then(() => {
    // Change the tooltip to "Copied"
    button.setAttribute('data-tooltip', 'Copied!');

    // Reset tooltip text after 1 seconds
    setTimeout(() => {
      button.setAttribute('data-tooltip', 'Copy to Clipboard');
    }, 1000);
  });
}

// // For Clearing Server Variables
// window.addEventListener('beforeunload', function (event) {
//   event.preventDefault();
//   // Send a signal to the server when the page is unloaded
//   fetch('/clearData', { method: 'POST' });
//   return (event.returnValue = "");
//   urlParams.companyName = "";
// });

// Allow for message to be submitted with enter key.
document.getElementById('userInput').addEventListener('keypress', function (event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
});

async function sendMessage() {
  // Remove whitespace from user input.
  const userInput = document.getElementById('userInput').value.trim();
  if (!userInput) return; // Exit if empty

  appendMessage(userInput, 'user'); // Display the user message
  document.getElementById('userInput').value = ''; // Clear Input Field

  try {
    const response = await fetch('/getResponse', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userInput }),
    });

    if (!response.ok) {
      throw new Error('Network response was not ok.');
    }

    const responseData = await response.json();
    // Display response
    appendMessage(responseData.message, 'server');
  } catch (error) {
    console.error('Error sending message:', error);
    // Handle error as needed
  }
}


// Responsible for displaying messages on the screen.
function appendMessage(message, sender) {
  const chatContainer = document.getElementById('chatContainer');

  // Create a div called messageContainer
  const messageContainer = document.createElement('div');
  // Assign it the same class name.
  messageContainer.className = 'message-container';

  // Set text content of messageDiv to be the one obtained from the parameter.
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message';
  messageDiv.textContent = message;

  // Create respective profile img elements for each message based on sender.
  const profileImg = document.createElement('img');
  profileImg.className = 'profile-image';
  if (sender === 'user') {
    profileImg.src = 'Images/user-image.png';
    messageDiv.classList.add('user-message');
  } else {
    profileImg.src = 'Images/bot-image.png';
    messageDiv.classList.add('bot-message');
  }

  // Ensure correct display for each sender 
  // (pic and message positioning)
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


