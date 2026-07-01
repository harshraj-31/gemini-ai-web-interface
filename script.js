const container = document.querySelector(".container");
const chatsContainer = document.querySelector(".chats-container");
const promptForm = document.querySelector(".prompt-form");
const promptInput = promptForm.querySelector(".prompt-input");
const fileInput = promptForm.querySelector("#file-input");
const fileUploadWrapper = promptForm.querySelector(".file-upload-wrapper");
const themeToggle = document.querySelector("#theme-toggle-btn");

// API Setup
// Replace with your own Gemini API key
const API_KEY = CONFIG.API_KEY;
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

let typingInterval, controller;
const chatHistory = [];
let userMessage = "";
const userData = { message: "", file: {}};

//Function to create message elements
const createMsgElemet = (content, ...classes) =>{
    const div = document.createElement("div");
    div.classList.add("message", ...classes);
    div.innerHTML = content;
    return div;
}

//Scroll to the bottom of the conatiner 
const scrollToBottom = () => container.scrollTo({ top: container.scrollHeight, behavior: "smooth"});

//Simulate typing effect or bot responses
const typingEffect = (text, textElement, botrMsgDiv) =>{
    textElement.textContent="";
    const words = text.split("");
    let wordIndex = 0;

    //Set an interval to type each word
    typingInterval = setInterval(() => {
        if (wordIndex < words.length) {
            textElement.textContent += (wordIndex === 0 ? "" : "") + words[wordIndex++];
            scrollToBottom();
        } else {
            clearInterval(typingInterval);
            botrMsgDiv.classList.remove("loading");
            document.body.classList.remove("bot-responding");
        }
    },20);
}

//Make the API call and generate the bot's message
const generateResponse = async(botrMsgDiv) =>{
    const textElement = botrMsgDiv.querySelector(".message-text");
    controller = new AbortController();

    //Add user message and file data to the chat history
    chatHistory.push({
        role: "user",
        parts:[{text : userMessage},...(userData.file.data ? [{ inline_data: (({ fileName, isImage,... rest }) => rest)(userData.file)}] : [])]
    });
    try {
        //Send the chat history to the API to get a response
        const response = await fetch(API_URL,{
            method : "POST",
            headers: { "Content-Type": "application/json"},
            body:JSON.stringify({ contents: chatHistory.map(turn => ({ parts: turn.parts })) }),
            signal: controller.signal
        });

        const data = await response.json();
        // Debug log 
        // console.log("API response (raw):", data, "status:", response.status);

        if(!response.ok) throw new Error(data.error.message);

        //Process the response text and display it with typing effect
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text.replace(/\*\*([^*]+)\*\*/g,"$1").trim();
        typingEffect(responseText, textElement, botrMsgDiv);
        chatHistory.push({
        role: "model",
        parts:[{text : responseText}]
    });    
    } catch (error) {
        textElement.style.color = "#d62939";
        textElement.textContent = error.name === "AbortError" ? "Response generation stopped." : error.message;
        botrMsgDiv.classList.remove("loading");
        document.body.classList.remove("bot-responding");
        scrollToBottom();
    }finally{
        userData.file = {};
    }
}

// Handle the form submission
const handleFormSubmit = (e) =>{
    e.preventDefault();
    userMessage = promptInput.value.trim();
    if(!userMessage || document.body.classList.contains("bot-responding")) return;

    promptInput.value ="";
    userData.message = userMessage;
    document.body.classList.add("bot-responding", "chats-active");
    fileUploadWrapper.classList.remove("active", "img-attached", "file-attached");

    //Generate user message HTML and add in the chats container
    const userMsgHTML = `
    <p class="message-text"></p>
    ${userData. file.data ? (userData.file.isImage ? `<img src="data:${userData.file.mime_type};base64,
    ${userData.file.data}" class="img-attachment" />` : `<p class="file-attachment"><span
    class="material-symbols-rounded">description</span>${userData.file.fileName}</p>`) : ""}
    `;
    const userMsgDiv = createMsgElemet(userMsgHTML,"user-message");

    userMsgDiv.querySelector(".message-text").textContent = userMessage;
    chatsContainer.appendChild(userMsgDiv);
    scrollToBottom();

    setTimeout(() =>{
        //Generate bot message HTML and add in the chats container after 600ms
        const botMsgHTML = '<img src="assets/gemini.svg" class="avatar"><p class="message-text">Just a sec...</p>';
        const botrMsgDiv = createMsgElemet(botMsgHTML,"bot-message", "loading");
        chatsContainer.appendChild(botrMsgDiv);
        scrollToBottom();
        generateResponse(botrMsgDiv); 
    },600);
}

//Handle file input change(file upload)
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if(!file) return;

    const isImage = file.type.startsWith("image/");
    const reader = new FileReader()
    reader.readAsDataURL(file);

    reader.onload = (e) => {
        fileInput.value = "";
        const base64String = e.target.result.split(",")[1];
        fileUploadWrapper.querySelector(".file-preview").src= e.target.result;
        fileUploadWrapper.classList.add("active", isImage ? "img-attached" : "file-attached");

        //Store file data in userData obj
        userData.file = { fileName: file.name, data: base64String, mime_type: file.type, isImage}
    }
});

//Cancel file upload
document.querySelector("#cancel-file-btn").addEventListener("click",() => {
    userData.file = {};
    fileUploadWrapper.classList.remove("active","img-attached","file-attached");
});

//Stop on going response
document.querySelector("#stop-response-btn").addEventListener("click",() => {
    userData.file = {};
    controller?.abort();
    clearInterval(typingInterval);

    const loadingMsg = chatsContainer.querySelector(".bot-message.loading");
    if (loadingMsg) loadingMsg.classList.remove("loading");

    document.body.classList.remove("bot-responding");
});

//Delete all chats
document.querySelector("#delete-chats-btn").addEventListener("click",() => {
    chatHistory.length = 0;
    chatsContainer.innerHTML = "";
    document.body.classList.remove("bot-responding", "chats-active");
});

//Handle suggestions click
document.querySelectorAll(".suggestions-items").forEach(item => {
    item.addEventListener("click", () => {
        promptInput.value = item.querySelector(".text").textContent;
        promptForm.dispatchEvent(new Event("submit"));
    });
});

// Show/hide controls for mobile on prompt input focus
document. addEventListener("click", ({ target }) => {
    const wrapper = document.querySelector(".prompt-wrapper");
    const shouldHide = target.classList.contains("prompt-input") || (wrapper.classList.contains("hide-controls") && (target.id === "add-file-btn" || target.id === "stop-response-btn"));
    wrapper.classList.toggle("hide-controls", shouldHide);
});

//Toggle dark / light theme
themeToggle.addEventListener("click", () => {
    const isLightTheme = document.body.classList.toggle("light-theme");
    localStorage.setItem("themeColor", isLightTheme ? "light_mode" : "dark_mode")
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";
});

//Set initial theme from local storage
const isLightTheme = localStorage.getItem("themeColor") === "light_mode";
document.body.classList.toggle("light-theme", isLightTheme);
    themeToggle.textContent = isLightTheme ? "dark_mode" : "light_mode";

// Update header username if present (keeps header dynamic after login)
(function(){
    const savedUser = localStorage.getItem('chatUser');
    if(savedUser){
        const heading = document.querySelector('.heading');
        if(heading) heading.textContent = `Hello, ${savedUser}`;
    }
})();

promptForm.addEventListener("submit", handleFormSubmit);
document.getElementById("add-file-btn").addEventListener("click", () => {
    document.getElementById("file-input").click();
});