// Private phone testing: serve the production build over HTTPS on this computer's LAN address only.
// Nothing is published. Phones need HTTPS (a secure context) for the camera and WebCrypto.
// Run: pnpm build && pnpm lan      Stop: Ctrl+C (stops both servers)
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";

const ROOT = new URL("..", import.meta.url).pathname;
const CERTS = `${ROOT}keys/lan/`; // keys/ is gitignored
const APP_PORT = 3001;
const LAN_PORT = Number(process.env.LAN_PORT || 8443);

const lanIp = Object.entries(os.networkInterfaces())
  .sort(([a], [b]) => (a === "en0" ? -1 : b === "en0" ? 1 : 0))
  .flatMap(([, addrs]) => addrs ?? [])
  .find((a) => a.family === "IPv4" && !a.internal)?.address;
if (!lanIp) throw new Error("No LAN address found. Connect to Wi-Fi first.");
if (!existsSync(`${ROOT}.next/BUILD_ID`)) throw new Error("No production build yet. Run: pnpm build");

// A short-lived self-signed certificate for this LAN address. Phones show a warning once; accept it.
mkdirSync(CERTS, { recursive: true, mode: 0o700 });
if (!existsSync(`${CERTS}cert.pem`) || readFileSync(`${CERTS}ip.txt`, "utf8").trim() !== lanIp) {
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-days", "7",
    "-keyout", `${CERTS}key.pem`, "-out", `${CERTS}cert.pem`,
    "-subj", "/CN=Wherry LAN test",
    "-addext", `subjectAltName=IP:${lanIp}`,
    "-addext", "extendedKeyUsage=serverAuth",
  ], { stdio: "ignore" });
  writeFileSync(`${CERTS}ip.txt`, lanIp);
}

// The app itself listens on loopback only; the proxy below is the only door, and only on the LAN address.
const app = spawn(`${ROOT}node_modules/.bin/next`, ["start", "-H", "127.0.0.1", "-p", String(APP_PORT)], { cwd: ROOT, stdio: "inherit" });

const proxy = https.createServer({ key: readFileSync(`${CERTS}key.pem`), cert: readFileSync(`${CERTS}cert.pem`) }, (req, res) => {
  const upstream = http.request(
    {
      host: "127.0.0.1",
      port: APP_PORT,
      method: req.method,
      path: req.url,
      // Overwrite, never trust, the client's forwarding headers: the faucet rate-limits by this IP.
      headers: { ...req.headers, "x-forwarded-for": req.socket.remoteAddress ?? "", "x-forwarded-proto": "https" },
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "content-type": "text/plain" });
    res.end("Wherry is still starting. Reload in a few seconds.");
  });
  req.pipe(upstream);
});

proxy.listen(LAN_PORT, lanIp, () => {
  console.log(`\nWherry on your Wi-Fi only (HTTPS, self-signed):`);
  console.log(`  Phone: https://${lanIp}:${LAN_PORT}/app/phone`);
  console.log(`  Shop:  https://${lanIp}:${LAN_PORT}/app/shop   (on this laptop, http://localhost:${APP_PORT}/app/shop also works)`);
  console.log(`First visit on the phone: tap through the certificate warning once. Ctrl+C stops everything.\n`);
});

const stop = () => {
  proxy.close();
  app.kill("SIGTERM");
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
app.on("exit", (code) => {
  proxy.close();
  process.exit(code ?? 0);
});
