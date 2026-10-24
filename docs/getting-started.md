Envelope runs on your own computer. Open a terminal (on a Mac, Terminal in Applications → Utilities; on Windows, your WSL2 distribution), copy this line into it and press Enter:

```sh
curl -fsSL https://runeditrun.com/install.sh | sh -s -- dev just-every/run-envelope
```

Git is required; rer brings Node and pnpm. Already have Node 22 or later? `npx -y @runeditrun/rer dev just-every/run-envelope` does the same.

The line installs `rer`, the Run Edit Run command, clones Envelope into a `run-envelope` folder, installs everything, sets up a local owner and starts it. The first start can take a few minutes. When Envelope is ready it prints `RER_READY` with its address and `RER_OPEN` with a link that opens it signed in as the owner: open that link on the same computer and treat it like a password. This free copy runs only on your computer: it sends no email, and nobody else can open it.

If the installer prints a line that puts `rer` on your PATH, run that line too. To start Envelope again later, run the same line from the same folder, or `cd run-envelope && rer dev`. `rer dev --stop` stops it.

[Run it locally](/docs/run-locally) has every command, including setup with your own email, backups and deployment.
