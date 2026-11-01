# EventCraft AI

EventCraft helps people organize weddings, birthdays, and community events. It can create an AI-generated budget, timeline, vendor checklist, and ideas, and the assistant can add or update calendar tasks.

## Run EventCraft on your computer

Each person running the app needs Node.js and their own OpenAI API key. Never share or publish an API key.

### 1. Install Node.js

Install the current **LTS** version of Node.js from [nodejs.org](https://nodejs.org/en/download/). After installation, close and reopen PowerShell. Confirm it is available:

```powershell
node --version
npm --version
```

### 2. Get the app

Either download the repository ZIP from GitHub (**Code → Download ZIP**) and extract it, or clone it with Git:

```powershell
git clone https://github.com/mohithkumar-kry/EventPlanner-AI.git
cd EventPlanner-AI
```

If you downloaded the ZIP, open PowerShell in the extracted `EventPlanner-AI` folder instead.

### 3. Add your private API key

Create an API key in your OpenAI API account. API usage is billed separately and may cost money. Follow OpenAI’s [API key instructions](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key).

In PowerShell, from the project folder:

```powershell
Copy-Item .env.example .env
notepad .env
```

In Notepad, replace `replace_with_your_openai_secret` after `OPENAI_API_KEY=` with your own key, save, and close Notepad. Do not add the key to `index.html`, GitHub, screenshots, or messages. `.env` is excluded from Git; `.env.example` contains only a placeholder.

### 4. Start the app

Double-click **Start EventCraft.bat**, or run this in PowerShell:

```powershell
npm start
```

Keep the server window open and visit **http://localhost:4173**. Close the window to stop EventCraft. The website and AI server both run on your computer; the server sends AI requests to OpenAI while keeping your key out of browser code.

## Upload updates to GitHub

From the project folder:

```powershell
git add .
git status
```

Check that `.env` is not listed. Then upload:

```powershell
git commit -m "Update EventCraft"
git push origin main
```

## How EventCraft works

- **Website:** `index.html` contains the responsive interface and interactions.
- **Local server:** `server.mjs` serves the site and receives AI requests. It listens only on this computer (`127.0.0.1`) by default.
- **AI:** The local server reads `OPENAI_API_KEY` from `.env` and calls OpenAI’s Responses API. The key is never sent to the webpage.
- **Planning:** When someone submits an event, the AI builds a structured budget, date-based timeline, vendor checklist, and ideas. The app adds the generated timeline and checklist to its calendar.
- **Assistant actions:** The assistant can request task or event changes using defined tools. The webpage applies those changes and saves them locally.
- **Storage:** Events, tasks, profile details, and expenses use browser local storage. They stay in that browser on that computer and are not synchronized or backed up online.

## Presentation explanation

> “EventCraft is an AI event-planning assistant for weddings, birthdays, and community events. You enter the event details, and it creates a budget, timeline, vendor checklist, and personalized ideas. You can also ask the assistant to add or change calendar tasks. The app runs on this computer: the browser talks to a local server, and that server calls the AI while keeping the API key private. Plans are saved in this browser, so there’s no sign-in, and they don’t sync to other devices.”

## Troubleshooting and limits

- **`node` is not recognized:** install Node.js LTS, then reopen PowerShell.
- **Port 4173 is already in use:** close the other EventCraft server window, then start it again.
- **AI says the key is missing or invalid:** check the `.env` spelling and key, then restart the server. Ensure the OpenAI API account can make API calls and has available usage.
- **Data is missing on another computer/browser:** data is saved only in the browser where it was entered.
- The sample vendor finder uses fictional listings and pins. It does not show actual nearby providers.
- AI prices are estimates. Confirm vendor pricing and availability directly.
- This setup is for a local presentation or personal demo. It is not a public production service: it has no hosted backend, accounts, cloud backups, or multi-device data sync. GitHub stores and distributes the source code; each person runs the app locally and supplies their own key.