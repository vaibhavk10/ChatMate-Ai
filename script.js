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

                    code = code
                        .replace(/&/g, '&amp;')
                        .replace(/</g, '&lt;')
                        .replace(/>/g, '&gt;')
                        .replace(/"/g, '&quot;')
                        .replace(/'/g, '&#039;');

                    return `<pre><code class="language-${language}">${code}</code></pre>`;
                }
                
                return part
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;')
                    .replace(/\n/g, '<br>');
            }).join('');
            messageDiv.innerHTML = formattedMessage;
        } else {
            message = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            messageDiv.innerHTML = message
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/\n/g, '<br>');
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

            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=AIzaSyBvRdM1ZfHL6XcXY4w1PM3OxBp4QdSTPSY', {
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
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error:', error);
            loadingDiv.remove();
            addMessage('Sorry, I encountered an error. Please try again.');
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