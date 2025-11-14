document.addEventListener('DOMContentLoaded', () => {
    const chatMessages = document.getElementById('chat-messages');
    const userInput = document.getElementById('user-input');
    const sendButton = document.getElementById('send-button');
    const newChatButton = document.getElementById('new-chat');
    const newConversationButton = document.getElementById('new-conversation');
    const clearHistoryButton = document.getElementById('clear-history');
    const chatHistory = document.getElementById('chat-history');
    const startListeningButton = document.getElementById('start-listening');
    const stopListeningButton = document.getElementById('stop-listening');

    let currentChatId = generateChatId();
    let chats = loadChats();
    let conversationHistory = [];
    let recognition = null;
    let isListening = false;

    // Initialize voice recognition
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onstart = () => {
            isListening = true;
            startListeningButton.disabled = true;
            stopListeningButton.disabled = false;
            addMessage('🎤 Voice recognition started. Speak now...', false);
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }

            if (finalTranscript) {
                userInput.value = finalTranscript.trim();
                adjustTextareaHeight();
                sendMessage();
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                addMessage('No speech detected. Please try again.', false);
            } else if (event.error === 'not-allowed') {
                addMessage('Microphone permission denied. Please enable microphone access.', false);
            } else {
                addMessage('Voice recognition error: ' + event.error, false);
            }
            stopListening();
        };

        recognition.onend = () => {
            if (isListening) {
                // Restart recognition if it was manually stopped
                try {
                    recognition.start();
                } catch (e) {
                    stopListening();
                }
            }
        };
    } else {
        startListeningButton.disabled = true;
        stopListeningButton.disabled = true;
        console.warn('Speech recognition not supported in this browser');
    }

    function startListening() {
        if (recognition && !isListening) {
            try {
                recognition.start();
            } catch (e) {
                console.error('Error starting recognition:', e);
                addMessage('Error starting voice recognition. Please try again.', false);
            }
        }
    }

    function stopListening() {
        if (recognition && isListening) {
            isListening = false;
            recognition.stop();
            startListeningButton.disabled = false;
            stopListeningButton.disabled = true;
            addMessage('🎤 Voice recognition stopped.', false);
        }
    }

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
        conversationHistory = [];
        const chat = chats[chatId];
        if (chat) {
            chat.messages.forEach(msg => {
                addMessage(msg.text, msg.isUser);
                if (!msg.isUser) {
                    conversationHistory.push({
                        role: "assistant",
                        content: msg.text
                    });
                } else {
                    conversationHistory.push({
                        role: "user",
                        content: msg.text
                    });
                }
            });
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

                    return `<pre><code class="language-${language}">${escapeHtml(code)}</code></pre>`;
                }
                
                // Convert Markdown to HTML
                return escapeHtml(part)
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')           // Italic text
                    .replace(/\n\* /g, '\n• ')                      // Bullet points
                    .replace(/\n/g, '<br>');
            }).join('');
            messageDiv.innerHTML = formattedMessage;
        } else {
            // Convert Markdown to HTML for non-code messages
            message = escapeHtml(message)
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
                title: (isUser ? message : 'New Chat').slice(0, 30) + (message.length > 30 ? '...' : ''),
                messages: []
            };
        }
        chats[currentChatId].messages.push({ text: message, isUser });
        saveChats();
        updateChatHistory();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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

    async function sendMessage(messageText = null) {
        const message = messageText || userInput.value.trim();
        if (message === '') return;

        addMessage(message, true);
        if (!messageText) {
            userInput.value = '';
            adjustTextareaHeight();
        }

        const loadingDiv = addLoadingIndicator();

        try {
            conversationHistory.push({
                role: "user",
                content: message
            });

            // Build context message
            const contextMessage = conversationHistory.length > 1 
                ? `Previous conversation context:\n${conversationHistory.slice(0, -1).map(msg => `${msg.role}: ${msg.content}`).join('\n')}\n\nCurrent request: ${message}\n\nPlease provide a response that takes into account the previous context.`
                : message;

            // Use Shizo API
            const apiUrl = `https://api.shizo.top/ai/gpt?apikey=shizo&query=${encodeURIComponent(contextMessage)}`;

            try {
                const response = await fetch(apiUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const data = await response.json();
                
                // Log the response for debugging
                console.log('API Response:', data);
                
                loadingDiv.remove();

                // Try multiple possible response formats
                let botResponse = null;
                
                if (data && data.data && data.data.msg) {
                    // Format: { data: { msg: "..." } }
                    botResponse = data.data.msg;
                } else if (data && data.msg) {
                    // Format: { msg: "..." }
                    botResponse = data.msg;
                } else if (data && data.data && typeof data.data === 'string') {
                    // Format: { data: "..." }
                    botResponse = data.data;
                } else if (data && data.message) {
                    // Format: { message: "..." }
                    botResponse = data.message;
                } else if (data && data.response) {
                    // Format: { response: "..." }
                    botResponse = data.response;
                } else if (typeof data === 'string') {
                    // Format: "..." (direct string)
                    botResponse = data;
                }

                if (botResponse) {
                    addMessage(botResponse);
                    conversationHistory.push({
                        role: "assistant",
                        content: botResponse
                    });
                    // Keep last 10 messages for context
                    if (conversationHistory.length > 10) {
                        conversationHistory = conversationHistory.slice(-10);
                    }
                } else {
                    console.error('Unexpected response format:', data);
                    addMessage(`Sorry, I received an unexpected response format. Response: ${JSON.stringify(data).substring(0, 200)}...`);
                }
            } catch (apiError) {
                console.error('API Error:', apiError);
                loadingDiv.remove();
                addMessage(`Sorry, I encountered an error: ${apiError.message}. Please check your internet connection and try again.`);
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
    }

    // Event Listeners
    sendButton.addEventListener('click', () => sendMessage());

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

    newConversationButton.addEventListener('click', () => {
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

    startListeningButton.addEventListener('click', startListening);
    stopListeningButton.addEventListener('click', stopListening);

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
});
