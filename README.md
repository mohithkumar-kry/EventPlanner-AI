# EventCraft AI

EventCraft helps plan weddings, birthdays, and community events with AI generated budgets, schedules, vendor checklists, and personalized ideas. The app has no sign-in. Plans and profile details save in the current browser on the current device using local storage; they do not sync to another browser or device.

## How hosting works

GitHub Pages hosts the website. It cannot safely run the AI server or hold an OpenAI secret, so the AI runs as a small Node service on Google Cloud Run. The browser sends AI requests to that service. The app never includes the OpenAI key.

## Run it on your computer

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and add your OpenAI API key.
3. In this folder, run `npm start` and open `http://localhost:4173`.

Keep `.env` private. It is ignored by Git.

## Put the site on GitHub Pages

1. Create a GitHub repository and push the contents of this `outputs` folder.
2. In GitHub, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
3. Push to the `main` branch. The included workflow publishes only `index.html` and `api-config.js`.

## Turn on AI for the public site

The Cloud Run service and OpenAI key need to be configured once. GitHub Pages by itself cannot run AI.

1. Create or select a Google Cloud project, enable billing and Cloud Run, and install the Google Cloud CLI (`gcloud`).
2. In Google Cloud Console, create a Secret Manager secret named `eventcraft-openai-key` and add your OpenAI key as its first version. Grant the Cloud Run service identity **Secret Manager Secret Accessor** for that secret.
3. Set the active Google Cloud project and deploy the server from this folder. Replace the sample GitHub username with yours:

```powershell
gcloud config set project YOUR-GOOGLE-CLOUD-PROJECT-ID
gcloud run deploy eventcraft-api `
  --source . `
  --region asia-south1 `
  --allow-unauthenticated `
  --max 3 `
  --set-env-vars "APP_ORIGIN=https://YOUR-USERNAME.github.io,OPENAI_MODEL=gpt-6-luna" `
  --set-secrets "OPENAI_API_KEY=eventcraft-openai-key:latest"
```

4. Copy the service URL printed by Cloud Run. Edit `api-config.js` to set it, with no trailing slash:

```js
window.EVENTCRAFT_API_BASE = 'https://YOUR-CLOUD-RUN-SERVICE-URL';
```

5. Commit and push `api-config.js`. GitHub Actions publishes the updated site. `APP_ORIGIN` must exactly match the website origin (for a GitHub Pages project site, it is still `https://YOUR-USERNAME.github.io`).
6. Visit `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`. Check `https://YOUR-CLOUD-RUN-SERVICE-URL/api/health`; it should report `"ready":true` and `"ai":true`.

When changing `server.mjs`, redeploy Cloud Run. When changing the interface or `api-config.js`, push to GitHub.

## Important limits

- Browser data is local to one browser/device. Clearing browser storage removes those plans. There is no account recovery or cloud backup.
- AI needs a valid OpenAI API key, an active API account, and available usage/quota. No hosted AI can work without those external services and credentials.
- AI generated budgets are estimates. Confirm all prices, venue/vendor availability, and local requirements directly.
- Vendor map/listings in this demo are fictional sample data, not verified nearby businesses.
- The AI endpoint is public so the no-login website can use it. It has basic per-instance request limits, but those are not a complete abuse or cost-control system. Configure provider spending limits and add a managed CAPTCHA or gateway before sharing widely.

## Files to push

From this `outputs` folder, run `git add .`, check `git status`, then commit and push to `main`. `.env` is ignored by Git. Do not push `.env` or any OpenAI API key. The Pages workflow deliberately publishes only the two browser files.
