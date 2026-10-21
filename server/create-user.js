// Uso: npm run create-user -- usuario contraseña
// Crea el usuario o cambia su contraseña si ya existe.
const store = require('./db');
const [user, pass] = process.argv.slice(2);
if (!user || !pass || pass.length < 8) {
  console.log('Uso: npm run create-user -- <usuario> <contraseña de mínimo 8 caracteres>');
  process.exit(1);
}
store.upsertUser(user, pass);
console.log(`✔ Usuario "${user.toLowerCase()}" listo.`);
