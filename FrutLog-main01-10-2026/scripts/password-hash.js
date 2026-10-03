const crypto = require("crypto");
const password = process.argv[2];
if (!password || password.length < 8) {
  console.error("Uso: npm.cmd run password-hash -- \"senha-com-no-minimo-8-caracteres\"");
  process.exit(1);
}
const rounds = 210000;
const salt = crypto.randomBytes(16).toString("hex");
const hash = crypto.pbkdf2Sync(password, salt, rounds, 32, "sha256").toString("hex");
console.log(`pbkdf2$${rounds}$${salt}$${hash}`);
