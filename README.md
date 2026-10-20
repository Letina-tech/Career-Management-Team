# Career Management Team: local version

Runs the team board on your own computer, so the team can save and share cards on your network.

## What you need
Node.js 18 or newer. Check with `node -v` in a terminal. If it says "not found", install the LTS version from https://nodejs.org and reopen VS Code.

## Start it (pick one)
- Windows: double-click `start-windows.bat`
- Mac / Linux: run `./start-mac-linux.sh`
- Any system, in the VS Code terminal inside this folder: `node server.js`

The terminal prints a line like:  OPEN THIS ADDRESS IN YOUR BROWSER:  http://localhost:3000
Open exactly that address. (If port 3000 is busy, it picks the next free port and prints it.)

Do NOT open `public/index.html` directly or with VS Code Live Server. They have no back end, so nothing can save.

## How to tell it is working
At the top right of the page there is a status light:
- "Server connected · 11 tasks · N cards" means saving works.
- "Server NOT connected" means the server is not running, or you opened the wrong address.

## Using your own edited page
If you changed the page text in VS Code (for example the pillar names), put your edited file in `public/` and name it `index.html`, replacing the one there. Run the server and open the address it prints. The server adds the saving support to your page automatically, so your edits stay. You do not need to copy any code.

## Set your editor passcode (do this before sharing)
Editors can add, edit and delete tasks. Everyone else can add cards, vote, change status and tick deliverables.

    macOS / Linux:          ADMIN_KEY=my-secret node server.js
    Windows (PowerShell):   $env:ADMIN_KEY="my-secret"; node server.js

The default passcode is `cmt-admin`. Change it. In the page, click **Editor login** and enter it.

## Share with the team
Teammates on the same network open http://YOUR-COMPUTER-IP:PORT (use the port the terminal printed). Find your IP with `ipconfig` (Windows) or `ifconfig` (Mac/Linux). Your computer must stay on with the server running, and your firewall must allow that port. Each person is asked for their name the first time.

## Something not displayed? Use the check page
With the server running, open the address the terminal prints and add `/check` (for example `http://localhost:3000/check`). It tests everything from the server to what is on screen, in plain words, and shows a tick or a cross for each step. A cross comes with a hint. If the page code has a typo (common after editing the page text by hand) it shows the exact error. Send a screenshot of that page when asking for help.

## If something is wrong
- Status light says "NOT connected": start the server (above) and open the address it printed.
- The terminal says "Port ... is already in use": that is fine, use the new address it prints.
- Tick boxes or the card box are greyed out: you are on the wrong address (Live Server, a file, or the old single-file page). Use the address the terminal printed.
- Nothing appears after a reload: press Ctrl+F5 (Cmd+Shift+R on Mac) to clear the browser cache.
- Still stuck: copy the text shown in the terminal and the status light message and send them to whoever supports this.

## Your data
Everything is saved in `data.json` next to `server.js`. It is created on first start with the 11 tasks. Copy that file to back it up. Delete it to reset to the starter tasks.

## Files
- `server.js`: the server and saved data (no dependencies)
- `public/index.html`: the page (replace with your edited copy if you have one)
- `public/check.html`: the check page described above
- `public/local-shim.js`: the small local back end the server adds to the page
- `seed-tasks.json`: the starting tasks, used only when `data.json` does not exist yet
- `start-windows.bat`, `start-mac-linux.sh`: one-click start

## Limits to know about
- There are no real user accounts. Names are typed in, and anyone on your network who can open the address can add cards. Use it on a trusted network, not the open internet.
- Updates appear within a few seconds (the page checks the server every 2.5 seconds).
