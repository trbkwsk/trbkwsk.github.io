# Contact endpoint

The public frontend posts contact form data to `https://api.torb.website:8443/api/contact`.

Server files live in `/opt/trbkwsk_site` on `api.torb.website`.

Required environment variables in `/opt/trbkwsk_site/.env`:

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Important: GitHub Pages serves static files only. The contact endpoint runs as the separate `contact-api.service` systemd service on `api.torb.website`. Do not put the bot token back into browser JavaScript.

After deployment, test the form states:

- empty fields show the required-fields message
- a valid request shows the sending state, then success
- a missing or failing endpoint shows the error state
