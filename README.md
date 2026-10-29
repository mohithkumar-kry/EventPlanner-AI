# EventCraft AI

EventCraft is a responsive event-planning app for weddings, birthdays, and community events. It can generate a budget, timeline, vendor checklist, and personalized ideas. The built-in vendor map is a **fictional demo** with sample names and illustrated pins; it does not show real businesses or locations.

The AI assistant can add, edit, complete, and remove calendar tasks; create or update the active event plan; and open requested calendar dates or views. Event data, checklist completion, profile details, and logged expenses are currently saved in this browser. Sign-in is a prototype, not secure account authentication.

## Run the app on Windows

1. Install Node.js 20 or newer.
2. Open PowerShell in this `outputs` folder.
3. Copy the example settings into a private local `.env` file:

   ```powershell
   Copy-Item .env.example .env
   notepad .env
   ```

4. Create an OpenAI API key in the [OpenAI API platform](https://platform.openai.com/api-keys), then set `OPENAI_API_KEY=your_key_here` in `.env`. Keep the key private. The full secret is shown only when created, and OpenAI recommends keeping keys on the backend rather than in browser code.
5. Save `.env`, then run:

   ```powershell
   node server.mjs
   ```

6. Open `http://localhost:4173` in your browser. Use **Checklist → Find nearby** to open the fictional demo vendor map.

The AI features use the OpenAI API, not a ChatGPT subscription; API billing is separate. API use can incur charges. The template uses `gpt-6-luna` as a cost-conscious default; change `OPENAI_MODEL` in `.env` if you want another model available to your API project. OpenAI API key help: [find or create an API key](https://help.openai.com/en/articles/4936850-where-do-i-find-my-openai-api-key) and [keep it safe](https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety). See the [official model catalog](https://developers.openai.com/api/docs/models) for current model IDs and capabilities.

## Upload the app to GitHub

Create an **empty repository** on GitHub first. Then, in PowerShell, go to this `outputs` folder and run the commands below. Replace the URL with the HTTPS URL of your new GitHub repository.

```powershell
cd "C:\Users\mohit\Documents\Codex\2026-10-23\claude-i-need-u-to-create\outputs"
git init -b main
git add index.html server.mjs README.md .gitignore .env.example "Start EventCraft.bat"
git status
git commit -m "Initial EventCraft AI app"
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Before the commit, `git status` should **not** list `.env`. `.gitignore` excludes it. If Git asks you to identify yourself, set your name and email using the `git config --global user.name` and `git config --global user.email` commands Git prints or prompts for.

GitHub stores the project files. GitHub Pages can publish static HTML, CSS, and JavaScript, but it cannot run this Node server; the AI endpoints need a Node hosting service. When deploying the full app, connect that service to the GitHub repository and set `OPENAI_API_KEY` as a private environment variable in the hosting dashboard. Do not commit it to GitHub or put it into `index.html`.

## Current demo limits

- The map and vendor records are fictional sample content, clearly labeled in the UI.
- Profile and planning data stay in this browser; there is no cloud account sync.
- Sign-in is visual only. A real public launch needs secure authentication, a database, and production monitoring.
