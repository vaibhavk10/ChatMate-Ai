document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const newChatButton = document.getElementById('new-chat');
    const clearHistoryButton = document.getElementById('clear-history');
    const chatHistory = document.getElementById('chat-history');

    let currentChatId = generateChatId();
    let chats = loadChats();
    let conversationHistory = [];

    // Initialize chat history
    updateChatHistory();

    function generateChatId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function loadChats() {
        return JSON.parse(localStorage.getItem('chats') || '{}');
    }

    function saveChats() {
        localStorage.setItem('chats', JSON.stringify(chats));
    }

    function updateChatHistory() {
        chatHistory.innerHTML = '';
        Object.entries(chats).reverse().forEach(([chatId, chat]) => {
            const historyItem = document.createElement('div');
            historyItem.classList.add('history-item');
            if (chatId === currentChatId) {
                historyItem.classList.add('active');
            }
            
            historyItem.innerHTML = `
                <div class="history-text" onclick="loadChat('${chatId}')">
                    <i class="fas fa-comment"></i>
                    <span>${chat.title || 'New Chat'}</span>
                </div>
                <div class="history-menu">
                    <button onclick="toggleHistoryMenu('${chatId}')" class="history-menu-button">
                        <i class="fas fa-ellipsis-v"></i>
                    </button>
                    <div class="history-menu-content" id="menu-${chatId}">
                        <div class="history-menu-item delete" onclick="deleteChat('${chatId}')">
                            <i class="fas fa-trash"></i> Delete
                        </div>
                    </div>
                </div>
            `;
            
            chatHistory.appendChild(historyItem);
        });
    }

    function loadChat(chatId) {
        currentChatId = chatId;
        chatMessages.innerHTML = '';
        const chat = chats[chatId];
        if (chat) {
            chat.messages.forEach(msg => addMessage(msg.text, msg.isUser));
        }
        updateChatHistory();
        
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const menuBtn = document.querySelector('.mobile-menu-btn');
            sidebar.classList.remove('active');
            menuBtn.style.backgroundColor = '';
        }
    }

    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(isUser ? 'user-message' : 'bot-message');

        if (message.includes('```')) {
            const formattedMessage = message.split('```').map((part, index) => {
                if (index % 2 === 1) { 
                    const lines = part.trim().split('\n');
                    let language = '';
                    let code = part.trim();
                    
                    if (lines[0] && !lines[0].includes('<') && !lines[0].includes('{') && !lines[0].includes('(')) {
                        language = lines[0];
                        code = lines.slice(1).join('\n');
                    }

                    return `<pre><code class="language-${language}">${code}</code></pre>`;
                }
                
                // Convert Markdown to HTML
                return part
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')           // Italic text
                    .replace(/\n\* /g, '\n• ')                      // Bullet points
                    .replace(/\n/g, '<br>');
            }).join('');
            messageDiv.innerHTML = formattedMessage;
        } else {
            // Convert Markdown to HTML for non-code messages
            message = message
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')   // Bold text
                .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Italic text
                .replace(/\n\* /g, '\n• ')                        // Bullet points
                .replace(/\n/g, '<br>');
            messageDiv.innerHTML = message;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        // Save to chat history
        if (!chats[currentChatId]) {
            chats[currentChatId] = {
                title: message.slice(0, 30) + '...',
                messages: []
            };
        }
        chats[currentChatId].messages.push({ text: message, isUser });
        saveChats();
        updateChatHistory();
    }

    function addLoadingIndicator() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('typing-dots');
        loadingDiv.innerHTML = `
            <span></span>
            <span></span>
            <span></span>
        `;
        chatMessages.appendChild(loadingDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return loadingDiv;
    }

    async function sendMessage() {
        const message = userInput.value.trim();
        if (message === '') return;

        addMessage(message, true);
        userInput.value = '';
        adjustTextareaHeight();

        const loadingDiv = addLoadingIndicator();

        try {
            conversationHistory.push({
                role: "user",
                content: message
            });

            // Try to get API key from environment or use a placeholder
            const apiKey = 'AIzaSyBqCvFpQNJtBJaCEKB9vg9ZwS6p2d1eA24'; // Replace with your actual API key
            
            if (apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
                loadingDiv.remove();
                addMessage(`🤖 **ChatMate AI Demo Mode**

I'm currently running in demo mode. To enable full AI functionality, please:

1. Get a free API key from Google AI Studio: https://makersuite.google.com/app/apikey
2. Replace 'YOUR_GEMINI_API_KEY_HERE' in script.js with your actual API key
3. Refresh the page

**Demo Response to your message:** "${message}"

This is a placeholder response. Once you add your API key, I'll be able to provide intelligent, contextual responses to all your questions!`);
                return;
            }

            let enhancedMessage = message;
            if (message.toLowerCase().includes('html') || 
                message.toLowerCase().includes('css') || 
                message.toLowerCase().includes('javascript') ||
                message.toLowerCase().includes('code')) {
                enhancedMessage = `${message}
Please format your response as follows:
1. Use \`\`\`html, \`\`\`css, or \`\`\`javascript code blocks
2. Include complete, well-formatted code
3. Add comments to explain key sections
4. Ensure proper indentation
5. For HTML, include a complete document structure with proper tags`;
            }

            const contextMessage = `Previous conversation context:
${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}

Current request: ${enhancedMessage}

Please provide a response that takes into account the previous context.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: contextMessage
                        }]
                    }]
                })
            });

            
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            loadingDiv.remove();

            if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                const botResponse = data.candidates[0].content.parts[0].text;
                addMessage(botResponse);
                
                conversationHistory.push({
                    role: "assistant",
                    content: botResponse
                });

                if (conversationHistory.length > 10) {
                    conversationHistory = conversationHistory.slice(-10);
                }
            } else {
                console.error('API Response Data:', data);
                throw new Error(`Invalid response format from API. Response: ${JSON.stringify(data)}`);
            }
        } catch (error) {
            console.error('Error:', error);
            loadingDiv.remove();
            
            if (error.message.includes('API Error')) {
                addMessage(`🚨 **API Connection Error**

There was an issue connecting to the AI service. This could be due to:

• **Invalid API Key**: Please check your Gemini API key
• **Rate Limiting**: You may have exceeded the API rate limit
• **Network Issues**: Check your internet connection

**Error Details:** ${error.message}

Please try again in a few moments or check your API key configuration.`);
            } else {
                addMessage(`🤖 **ChatMate AI Response**

I apologize, but I'm experiencing some technical difficulties right now. Here's what I can tell you about your message:

**Your message:** "${message}"

**Response:** This appears to be a test message. In a fully functional state, I would provide intelligent, contextual responses to help you with coding, general questions, and problem-solving.

**Troubleshooting:**
• Check your internet connection
• Verify your API key is correctly configured
• Try refreshing the page

I'm here to help once the technical issues are resolved!`);
            }
        }
    }

    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        const maxHeight = window.innerWidth <= 768 ? 100 : 200;
        const newHeight = Math.min(userInput.scrollHeight, maxHeight);
        userInput.style.height = newHeight + 'px';
        
        const chatContainer = document.querySelector('.chat-container');
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    // Event Listeners
    sendButton.addEventListener('click', sendMessage);

    userInput.addEventListener('input', adjustTextareaHeight);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    newChatButton.addEventListener('click', () => {
        currentChatId = generateChatId();
        chatMessages.innerHTML = '';
        conversationHistory = [];
        updateChatHistory();
    });

    clearHistoryButton.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all chat history?')) {
            chats = {};
            localStorage.removeItem('chats');
            currentChatId = generateChatId();
            chatMessages.innerHTML = '';
            conversationHistory = [];
            updateChatHistory();
        }
    });

    window.loadChat = loadChat;
    window.toggleHistoryMenu = function(chatId) {
        event.stopPropagation();
        const allMenus = document.querySelectorAll('.history-menu-content');
        const targetMenu = document.getElementById(`menu-${chatId}`);
        
        allMenus.forEach(menu => {
            if (menu.id !== `menu-${chatId}`) {
                menu.classList.remove('active');
            }
        });
        
        targetMenu.classList.toggle('active');
    };

    window.deleteChat = function(chatId) {
        event.stopPropagation();
        if (confirm('Are you sure you want to delete this chat?')) {
            delete chats[chatId];
            saveChats();
            if (chatId === currentChatId) {
                currentChatId = generateChatId();
                chatMessages.innerHTML = '';
                conversationHistory = [];
            }
            updateChatHistory();
        }
    };

    document.addEventListener('click', (event) => {
        if (!event.target.closest('.history-menu') && !event.target.closest('.history-menu-button')) {
            document.querySelectorAll('.history-menu-content.active').forEach(menu => {
                menu.classList.remove('active');
            });
        }
    });

    window.toggleSidebar = function() {
        const sidebar = document.querySelector('.sidebar');
        const menuBtn = document.querySelector('.mobile-menu-btn');
        
        sidebar.classList.toggle('active');
        
        if (sidebar.classList.contains('active')) {
            menuBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
        } else {
            menuBtn.style.backgroundColor = '';
        }
    }

    // API Test Function
    window.testAPI = async function() {
        const apiKey = 'AIzaSyBqCvFpQNJtBJaCEKB9vg9ZwS6p2d1eA24';
        
        addMessage(`🧪 **API Test Starting...**
        
**Testing:** Gemini Pro API Connection
**API Key:** ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}
**Test Message:** "Hello, are you working?"`);

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: "Hello, are you working? Please respond with a simple greeting."
                        }]
                    }]
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                    addMessage(`✅ **API Test PASSED!**
                    
**Status:** Your API key is working perfectly!
**Response:** ${data.candidates[0].content.parts[0].text}
**HTTP Status:** ${response.status}
**Test Result:** SUCCESS 🎉`);
                } else {
                    addMessage(`❌ **API Test FAILED**
                    
**Issue:** Invalid response format
**Response Data:** ${JSON.stringify(data)}
**Test Result:** FAILED`);
                }
            } else {
                const errorText = await response.text();
                addMessage(`❌ **API Test FAILED**
                
**HTTP Status:** ${response.status}
**Error:** ${response.statusText}
**Details:** ${errorText}
**Test Result:** FAILED`);
            }
        } catch (error) {
            addMessage(`❌ **API Test FAILED**
            
**Error:** ${error.message}
**Test Result:** FAILED`);
        }
    }
    document.addEventListener('click', (e) => {
        const sidebar = document.querySelector('.sidebar');
        const menuBtn = document.querySelector('.mobile-menu-btn');
        
        if (!sidebar.contains(e.target) && !menuBtn.contains(e.target)) {
            sidebar.classList.remove('active');
            menuBtn.style.backgroundColor = '';
        }
    });

    function loadChat(chatId) {
        currentChatId = chatId;
        chatMessages.innerHTML = '';
        const chat = chats[chatId];
        if (chat) {
            chat.messages.forEach(msg => addMessage(msg.text, msg.isUser));
        }
        updateChatHistory();
        
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const menuBtn = document.querySelector('.mobile-menu-btn');
            sidebar.classList.remove('active');
            menuBtn.style.backgroundColor = '';
        }
    }

    function adjustTextareaHeight() {
        userInput.style.height = 'auto';
        const maxHeight = window.innerWidth <= 768 ? 100 : 200;
        userInput.style.height = Math.min(userInput.scrollHeight, maxHeight) + 'px';
    }
}); 
