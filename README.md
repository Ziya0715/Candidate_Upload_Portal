# Video Share

A small staff dashboard for uploading videos and sending a watch link. Videos stay private in your DigitalOcean Space. A client who opens the link can play the video in the browser and does not need a login.

The stack is Next.js (App Router), JavaScript, SCSS Modules, and DigitalOcean Spaces.

## How a share link works

1. A staff member signs in and uploads a video.
2. The browser sends the video to this app.
3. The app stores the file in your Space. The browser does not talk to Spaces, so bucket CORS is not required for the upload.
4. Nothing is saved in a database. The video list is the files in the Space.
5. **Copy link** copies a page such as `https://your-domain/v/AbC123...`.
6. When someone opens that page, the server checks the link and creates a temporary playback URL. The Space itself stays private.
7. **Delete** removes the file from the Space. Old links stop working.

## Project structure

```text
app/
  api/auth/login/route.js       Staff sign-in
  api/auth/logout/route.js      Staff sign-out
  api/videos/route.js           List videos
  api/videos/presign/route.js   Create a direct upload URL
  api/videos/complete/route.js  Confirm the file is in Spaces
  api/videos/[id]/route.js      Delete a video
  api/videos/[id]/preview/route.js
  api/share/[token]/route.js    Public playback URL
  login/                        Staff login page
  dashboard/                    Upload desk
  v/[token]/                    Public watch page
  globals.scss                  Page colors and reset
components/                     Upload box, video list, buttons
lib/                            Spaces and login checks
deploy/                         Nginx, systemd, and CORS examples
```

## What you need

- Node.js 20 or newer (`node -v`). Node.js 22 is the better choice for a server. Node.js 20 still runs this app.
- A DigitalOcean account
- A Space with file listing restricted (private)

## 1. Create the Space

1. In DigitalOcean, open **Spaces Object Storage** and create a Space.
2. Pick the region closest to you. The short name is the region, for example `nyc3`, `blr1`, `sgp1`, `fra1`, `ams3`, `sfo3`, or `syd1`.
3. Choose a bucket name. You will use it as `DO_SPACES_BUCKET`.
4. Set file listing to **Restricted**. Leave the Space private.
5. Do not turn on the Spaces CDN for this app. Playback uses private links, and the CDN does not cache those links correctly.

The endpoint is the region host, without the bucket name:

```text
https://nyc3.digitaloceanspaces.com
```

Replace `nyc3` with the region you chose.

## 2. Create a Spaces key

1. Open **API**, then **Spaces Keys**.
2. Generate a key. Limit it to this one bucket when the page offers that choice.
3. Copy the key and the secret immediately. DigitalOcean shows the secret only once.

These two values become `DO_SPACES_KEY` and `DO_SPACES_SECRET`. They stay in `.env.local` on the server. The browser never receives them.

## 3. Bucket access

The staff upload goes to this app first, and the app writes the file into the Space. You do not need a CORS rule for that upload.

`deploy/spaces-cors.xml` is only needed if a browser will later call the Space directly.

## 4. Run it on your computer

Open a terminal in this folder.

Windows PowerShell:

```powershell
npm install
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

macOS or Linux:

```bash
npm install
[ -f .env.local ] || cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This project folder may already contain a `.env.local`. Edit that file. Create it from `.env.example` only when it is missing.

Open `.env.local` and fill it in:

- Paste the random string into `SESSION_SECRET`.
- Set `STAFF_USERNAME` and `STAFF_PASSWORD`.
- Set the five `DO_SPACES_*` values from the steps above.
- Leave `MAX_UPLOAD_MB` at `2048` unless you want a different limit. The largest allowed value is `5120` (5 GB), which is the single-upload limit.

Start the app:

```bash
npm run dev
```

Open [http://localhost:3010](http://localhost:3010). Until you change `.env.local`, sign in with username `staff` and password `change-this-password`.

Saving `.env.local` restarts the dev server. If a new value does not show up, stop the server and run `npm run dev` again. Change the password before you put the app on a server.

## 5. Use the dashboard

- Drag a video onto the box, or click **Browse files**.
- The bar shows upload progress. The app then stores the file in your Space.
- **Copy link** copies the watch page. Send that link to the client.
- **Preview** plays the video while you are signed in.
- **Delete** asks you to confirm, then removes the file and turns the link off.
- **Log out** ends the staff session.

A client only needs the copied link. They do not see the dashboard and they do not sign in.

MP4 (H.264) and WebM play in the most browsers. MOV and MKV can be stored, but some browsers cannot play them.

## 6. Deploy on your own server

These steps use Ubuntu, systemd, and Nginx. Video files live only in the Space.

### Install Node.js 22

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs nginx
node -v
```

### Copy the project

```bash
sudo mkdir -p /var/www/video-share
sudo useradd --system --create-home --home-dir /var/www/video-share video-share || true
sudo rsync -a --exclude node_modules --exclude .next --exclude data ./ /var/www/video-share/
sudo chown -R video-share:video-share /var/www/video-share
```

From the project directory on the server, as `video-share` (or with sudo -u):

```bash
cd /var/www/video-share
npm ci
```

Create the environment file on the server. Do not commit it.

```bash
cp .env.example .env.local
nano .env.local
chmod 600 .env.local
```

Use a new `SESSION_SECRET`, a strong `STAFF_PASSWORD`, and the Spaces values.

Build and try a manual start:

```bash
npm run build
NODE_ENV=production npm start
```

Stop it with Ctrl+C after you confirm it starts. The service below binds it to localhost only.

### systemd

If `which node` is not `/usr/bin/node`, edit `ExecStart` in the service file before copying it.

```bash
sudo cp deploy/video-share.service /etc/systemd/system/video-share.service
sudo systemctl daemon-reload
sudo systemctl enable --now video-share
sudo systemctl status video-share
```

Logs:

```bash
sudo journalctl -u video-share -f
```

### Nginx and HTTPS

Replace `videos.example.com` in `deploy/nginx.conf.example` with your domain. Point the domain's DNS A record at the server first.

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/video-share
sudo ln -s /etc/nginx/sites-available/video-share /etc/nginx/sites-enabled/video-share
sudo nginx -t
sudo systemctl reload nginx
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d videos.example.com
```

HTTPS is required in production. The login cookie is marked secure, so the browser will not keep you signed in on plain HTTP.

After the domain works, add `https://videos.example.com` as a CORS origin on the Space (step 3). Restart is not required for CORS, but upload from the live site fails until that origin is saved.

Open the firewall if you use UFW:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

## 7. Deploy on Vercel

`.env.local` stays on your computer. Vercel does not upload it, so the live site has no username or password until you add the variables there.

1. Open the Vercel project, then **Settings**, then **Environment Variables**.
2. Add each name from `.env.example` with the same values you use locally: `STAFF_USERNAME`, `STAFF_PASSWORD`, `SESSION_SECRET`, and the five `DO_SPACES_*` values. Add `MAX_UPLOAD_MB` as `2048`.
3. Enable them for **Production**.
4. Open **Deployments** and redeploy the latest deployment. A new variable is not used until the site is deployed again.

Sign in on the `https://` Vercel address with that same username and password.

## 8. Deploy with Docker

Build and run from this folder after `.env.local` is filled in:

```bash
docker build -t video-share .
docker run -d --name video-share --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.local \
  video-share
```

Put Nginx or another HTTPS proxy in front of port 3000. Use the same CORS origin as the public site.

## Limits

- One shared staff login. There are no roles, teams, or folders.
- Several videos can be chosen for one candidate. They upload one after another into that candidate's folder.
- Up to 5 GB per file. Larger files need multipart uploads, which this app does not do.
- Allowed types: MP4, M4V, WebM, MOV, OGG, and MKV.
- The video list is read from the Space. There is no database.

## If something fails

**"Set SESSION_SECRET..."**  
The secret is missing, shorter than 32 characters, or still the example text. Generate a new one and restart.

**"Add DO_SPACES_... to .env.local"**  
A Spaces value is empty. Save the file and restart `npm run dev`.

**The progress bar stops and the upload fails**  
The file is sent to this app on port 3010, then to Spaces. Confirm `npm run dev` is still running and the Spaces key can write to the bucket.

**Spaces returns 403**  
Check the key, secret, bucket name, and region. The endpoint must be `https://REGION.digitaloceanspaces.com`, not `https://BUCKET.REGION.digitaloceanspaces.com`.

**The watch page opens but the video will not play**  
The link is valid. Export the video as MP4 (H.264) or WebM and upload that file.

**Login works locally but not on the server**  
The site must be served over HTTPS. Confirm `NODE_ENV=production` and that you changed `STAFF_PASSWORD` away from `change-this-password`.

**`EINVAL: invalid argument, readlink .next`**  
Stop the server, delete the `.next` folder, and run `npm run dev` again. This can happen when the project lives in OneDrive.

**An upload was interrupted**  
The list shows the files in `course_Recored_videos/{candidate ID}/`. A file that never finished uploading will not appear there.

## Security checklist

- Change the staff password before deployment.
- Use a long random `SESSION_SECRET`.
- Do not commit `.env.local`.
- Keep the Space private. Do not add a public-read policy.
- Send people the `/v/...` page link, not a raw Spaces URL.
- Delete a video when the client should no longer watch it.
