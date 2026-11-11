# Shafi & Phoenix: celebration site

A one-page site announcing the marriage and inviting both families to the park celebration, with RSVPs, a guestbook and a contact form. It runs on the same home server as the portfolio site, behind the same Cloudflare Tunnel.

## Layout

```
web/                    the site guests see
  pages/                page shells (index.html, admin.html) that pull the sections in
  components/           one folder per section of the page
    hero/                 hero.html, hero.css
    rsvp/                 rsvp.html, rsvp.css, rsvp.js
    guestbook/            guestbook.html, guestbook.css, guestbook.js
    ...                   nav, announcement, story, celebration, food,
                          good-to-know, gifts, closing, contact, footer
  shared/               styles and logic used by more than one section
  admin/                the admin page's script and styles
  static/               photos and robots.txt, copied as they are
  main.js               starts each section's logic

server/                 the backend (plain Node, no npm dependencies)
  index.js              entry point and the list of API routes
  routes/               one file per feature: rsvp, guestbook, contact, admin
  lib/                  sessions, validation, rate limiting, email, http helpers
  db.js                 the SQLite database and its tables
  config.js             settings read from the environment

invitation/             the printable invitation (index.html, invitation.css, invitation.js, qr.svg)

scripts/build.js        assembles web/ into dist/
scripts/dev.js          local development: build, watch, run the backend

Dockerfile.api          image for the backend
Dockerfile.web          image that builds the site and serves it with nginx
docker-compose.yml      the two containers
nginx.conf              serves the site, proxies /api/ to the backend
deploy.sh               pull and rebuild on the server
.github/workflows/      deploy on every push to main

content.md              the written content the page was built from
```

### How a section is put together

Each section is a folder in `web/components/` holding its HTML, its CSS, and, if it does anything, its logic:

- **HTML**: `web/pages/index.html` lists the sections in order with lines like `<!-- @include components/hero/hero.html -->`. The build replaces each line with that file.
- **CSS**: the build joins every stylesheet into one `styles.css`. A new stylesheet must be added to the `STYLES` list in `scripts/build.js`; the build stops with a message if one is missing.
- **Logic**: a section's `.js` file exports an `init...()` function, and `web/main.js` calls it. Sections that need to know who the guest is subscribe through `shared/guest.js`.

To change the wording of a section, edit its `.html` file. To restyle it, edit its `.css` file.

## Run it on your computer

Needs Node 24 or newer. There is nothing to install.

```bash
npm run dev
```

Then open http://localhost:3000. The site rebuilds whenever a file in `web/` changes; refresh the page to see it. The admin page is at http://localhost:3000/admin, and its password is `ADMIN_PASSWORD` in `.env`.

Local data is kept in `data/wedding.db`. Delete that folder to start fresh.

## Invitations

The `invitation/` folder is a printable invitation in the site's colors and fonts. It is not part of the website and is never deployed.

```bash
npm run invitation
```

Then open http://localhost:3100. Opening `invitation/index.html` directly in a browser works too.

1. Type the guest names, one per line. Each line becomes its own invitation ("Dear ..."). Leave the list empty to get one invitation with a blank line to write on.
2. Type the invite code. It is printed on every invitation, next to a QR code that opens https://shaphoenix.com.
3. Pick the paper: a 5 × 7 inch card per page, or two per sheet of letter paper with a dashed line to cut along.
4. Print, or save as PDF to send to a print shop. In the print window, set margins to "None" and turn on "Background graphics".

The names and code you type are remembered in that browser only; they are not saved in this repository. To change the wording, edit the `<template>` in `invitation/index.html`.

## How guests use it

1. A guest enters the invite code and RSVPs. Their browser remembers them.
2. The guestbook opens. Notes they write stay hidden until one of you approves them on the admin page.
3. On a new device, "Already RSVP'd?" finds their RSVP from the invite code plus the phone or email they used.

Sending the RSVP form again with the same phone or email updates that RSVP instead of creating a second one.

On the admin page, each RSVP has a **Delete** button for test entries and mistakes. Deleting an RSVP also deletes that guest's guestbook notes, and their browser is no longer recognised, so they would need to RSVP again. Contact form messages have a **Delete** button too.

## Settings (`.env`)

Copy `.env.example` to `.env` and fill it in. The backend refuses to start without the first three.

| Name | Purpose |
|---|---|
| `INVITE_CODE` | The code printed on the invitation. Upper and lower case are treated the same |
| `ADMIN_PASSWORD` | Password for `/admin` |
| `SESSION_SECRET` | Signs the cookies that remember guests. Changing it signs everyone out |
| `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` | Optional. Email notifications through EmailJS. Without them nothing is emailed, but everything still shows on the admin page |

### Email template

Create a new template in the same EmailJS account the portfolio uses:

- **To Email**: both of your addresses, separated by a comma
- **Subject**: `{{subject}}`
- **Content**: `{{message}}`
- **From Name**: `{{from_name}}`
- **Reply To**: `{{reply_to}}`

The service ID and the two keys are the same as the portfolio's. Only the template ID is new.

## Hosting

The setup mirrors the portfolio:

| | Portfolio | This site |
|---|---|---|
| Containers | `backend`, `web` (nginx), `mongo`, `cloudflared` | `wedding-api`, `wedding-web` (nginx) |
| Data | MongoDB | One SQLite file in the `wedding_data` volume |
| Reached through | Its own Cloudflare Tunnel | The portfolio's tunnel, over the shared `portfolio-net` network |
| Deploy | `deploy.sh` over SSH from GitHub Actions | The same |

This site does not run its own `cloudflared`. `wedding-web` joins `portfolio-net`, so the portfolio's tunnel container can reach it by name.

### First-time setup on the server

1. Push this repository to GitHub, then clone it on the server next to the portfolio repos:
   ```
   shafi/
   ├── portfolio-website-infra/
   ├── portfolio-website-api/
   ├── portfolio-website-ui/
   └── wedding-announcement-website/   (this repo)
   ```
2. In that folder, create the settings file and fill it in. Use a fresh `ADMIN_PASSWORD` and `SESSION_SECRET`, not the ones from your computer:
   ```bash
   cp .env.example .env
   ```
3. Start it:
   ```bash
   bash deploy.sh
   ```
4. Make sure `shaphoenix.com` is an active site in the same Cloudflare account as the portfolio's tunnel.
5. In the Cloudflare Zero Trust dashboard, open **Networks > Tunnels**, pick the portfolio's tunnel, and add a **Public Hostname**:
   - Subdomain: leave empty
   - Domain: `shaphoenix.com`
   - Service: `HTTP`, `wedding-web:80`
6. Open https://shaphoenix.com. The admin page is at https://shaphoenix.com/admin.

### Deploying changes

Pushing to `main` runs `.github/workflows/deploy.yml`, which connects to the server over Cloudflare Access and runs `deploy.sh`. To deploy by hand, run this on the server:

```bash
bash deploy.sh
```

The workflow needs these repository secrets, with the same values the portfolio infra repo uses, except `DEPLOY_PATH`, which is the path to this repo on the server:

`DEPLOY_SSH_KEY`, `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`, `SSH_HOSTNAME`, `SSH_USER`, `DEPLOY_PATH`

If the GitHub repository is private, the server also needs permission to pull it (a deploy key, for example).

### Backing up the RSVPs

Everything guests submit is in one file inside the `wedding_data` volume. To copy it out:

```bash
docker compose cp wedding-api:/data/wedding.db ./wedding-backup.db
```

## Before sending the link out

- Replace `web/static/photos/echo-lake-shelter.webp` with your own photo of the shelter. The current one is someone else's photo from Google Reviews.
- Confirm the invite code in the server's `.env` matches the one on the invitations.
